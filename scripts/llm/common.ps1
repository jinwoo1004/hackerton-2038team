Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-LlmExternalPath([string]$Path, [string]$RepositoryRoot) {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathFullyQualified($Path)) { throw 'CODEX_AUTH_FILE must be an explicit absolute path outside the repository.' }
    $full = [IO.Path]::GetFullPath($Path)
    $repo = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\','/')
    $personal = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex')).TrimEnd('\','/')
    foreach ($forbidden in @($repo,$personal)) {
        if ($full.Equals($forbidden,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($forbidden + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Use a dedicated project credential directory outside both the repository and the existing personal Codex directory.'
        }
    }
    $cursor = $full
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Credential paths must not pass through a symbolic link or junction.' }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    return $full
}

function Get-LlmSelection([string]$RepositoryRoot, [switch]$ForDemo) {
    $runtimeValue = [Environment]::GetEnvironmentVariable('APP_RUNTIME','Process')
    $providerValue = [Environment]::GetEnvironmentVariable('LLM_PROVIDER','Process')
    if ($runtimeValue -cnotin @('local','deployed','test')) { throw 'APP_RUNTIME is required and must be exactly local, deployed, or test.' }
    if ($providerValue -cnotin @('codex_oauth','openai_api','mock')) { throw 'LLM_PROVIDER is required and must be exactly codex_oauth, openai_api, or mock.' }
    $expected = @{local='codex_oauth';deployed='openai_api';test='mock'}[$runtimeValue]
    if ($providerValue -cne $expected) { throw 'APP_RUNTIME and LLM_PROVIDER do not match: local/codex_oauth, deployed/openai_api, test/mock are the only supported pairs.' }
    if ($ForDemo -and $runtimeValue -eq 'deployed') { throw 'demo.ps1 supports local/codex_oauth or test/mock only. Deployed API execution uses the deployment entry point.' }
    if ($runtimeValue -eq 'test') { return [pscustomobject]@{runtime='test';provider='mock';model='mock-structured';authConfigured=$false} }
    $modelVariable = $(if ($runtimeValue -eq 'local') { 'CODEX_MODEL' } else { 'OPENAI_MODEL' })
    $modelValue = [Environment]::GetEnvironmentVariable($modelVariable,'Process')
    if ($modelValue -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9._:-]{0,119}\z') { throw "$modelVariable must explicitly name a valid selected model (1-120 letters, digits, dot, underscore, colon, or hyphen; start with a letter or digit)." }
    if ($runtimeValue -eq 'local') {
        $authFile = Assert-LlmExternalPath ([Environment]::GetEnvironmentVariable('CODEX_AUTH_FILE','Process')) $RepositoryRoot
        if (-not (Test-Path -LiteralPath $authFile -PathType Leaf)) {
            $failure = [InvalidOperationException]::new('Codex OAuth credentials are missing. Run .\llm.ps1 -Action Login -Model <model> in your PowerShell session, then Diagnose.')
            $failure.Data['LlmExitCode'] = 3
            throw $failure
        }
        $configured = $true
    } else {
        $configured = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('OPENAI_API_KEY','Process'))
        if (-not $configured) {
            $failure = [InvalidOperationException]::new('OPENAI_API_KEY is required only for deployed/openai_api. Supply it through the deployment environment.')
            $failure.Data['LlmExitCode'] = 3
            throw $failure
        }
    }
    return [pscustomobject]@{runtime=$runtimeValue;provider=$providerValue;model=$modelValue;authConfigured=$configured}
}

function ConvertTo-LlmNativeArgument([string]$Value) {
    if ($Value -notmatch '[\s"]' -and $Value.Length -gt 0) { return $Value }
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function New-CodexLoginStartInfo([string]$Executable,[string]$CredentialDirectory,[string]$WorkspaceId) {
    $arguments = @('login','-c','cli_auth_credentials_store="file"','-c','forced_login_method="chatgpt"')
    if ($WorkspaceId) { $arguments += @('-c',('forced_chatgpt_workspace_id="' + $WorkspaceId + '"')) }
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.Arguments = ($arguments | ForEach-Object { ConvertTo-LlmNativeArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.WorkingDirectory = $CredentialDirectory
    # CODEX_HOME is set only in this one child's environment. Never change the parent's reserved variable.
    $info.Environment['CODEX_HOME'] = $CredentialDirectory
    foreach ($key in @('OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN','CODEX_AUTH_FILE')) { [void]$info.Environment.Remove($key) }
    return $info
}

function Get-LlmDiagnosticExitCode([string]$Code) {
    if ($Code -cin @('CONFIG_INVALID','MODEL_REQUIRED','AUTH_FILE_LOCATION')) { return 2 }
    if ($Code -cin @('API_KEY_REQUIRED','LOCAL_AUTH_REQUIRED','API_AUTH_REJECTED')) { return 3 }
    if ($Code -cin @('ACCESS_DENIED','RATE_LIMITED','MODEL_UNAVAILABLE','TIMEOUT','CANCELLED','TRANSPORT_ERROR','HTTP_ERROR','RESPONSE_TOO_LARGE','INVALID_RESPONSE','INCOMPLETE_RESPONSE','MODEL_FAILED','MODEL_REFUSAL','UNEXPECTED_OUTPUT','MOCK_UNAVAILABLE','INTERNAL_ERROR')) { return 4 }
    return $null
}

function ConvertFrom-LlmDiagnosticOutput([object[]]$Lines,[int]$ProcessExitCode) {
    $diagnostic = $null
    foreach ($line in $Lines) {
        $candidate = "$line".Trim()
        if (-not ($candidate.StartsWith('{') -and $candidate.EndsWith('}'))) { continue }
        try {
            $parsed = $candidate | ConvertFrom-Json
            $keys = @($parsed.PSObject.Properties.Name)
            $hasSelection = @('runtime','provider','model','authConfigured').Where({ $_ -notin $keys }).Count -eq 0
            $hasKnownError = $ProcessExitCode -ne 0 -and 'code' -in $keys -and $null -ne (Get-LlmDiagnosticExitCode $parsed.code)
            # Settings may fail before runtime/provider are available. Only known safe Java errors qualify.
            if (($ProcessExitCode -eq 0 -and $hasSelection) -or $hasKnownError) { $diagnostic = $parsed }
        } catch { }
    }
    if (-not $diagnostic) { throw 'LLM diagnostic could not complete. Verify the JDK/Gradle prerequisites and backend build; raw process output was withheld.' }
    $safe = [ordered]@{}
    foreach ($key in @('runtime','provider','model','authConfigured')) {
        if ($diagnostic.PSObject.Properties.Name -contains $key) { $safe[$key] = $diagnostic.$key }
    }
    if ($ProcessExitCode -ne 0) {
        foreach ($key in @('code','message')) { if ($diagnostic.PSObject.Properties.Name -contains $key) { $safe[$key] = $diagnostic.$key } }
    }
    return [pscustomobject]$safe
}

function Invoke-LlmDiagnostic([string]$RepositoryRoot,[ValidateSet('Diagnose','Smoke')][string]$Action,[switch]$AllowDeployedSmoke) {
    $selection = Get-LlmSelection $RepositoryRoot
    if ($Action -eq 'Smoke' -and $selection.runtime -eq 'deployed' -and -not $AllowDeployedSmoke) { throw 'Deployed smoke requires the separate explicit -AllowDeployedSmoke switch.' }
    $task = $(if ($Action -eq 'Diagnose') { 'llmDiagnose' } else { 'llmSmoke' })
    Push-Location (Join-Path $RepositoryRoot 'backend')
    try {
        # A Java failure is a diagnostic result, even if the caller enables native-command exceptions.
        $PSNativeCommandUseErrorActionPreference = $false
        # Capture all Gradle output; only the Java tool's allowlisted diagnostic fields may leave this wrapper.
        $captured = @(& (Join-Path $RepositoryRoot 'backend/gradlew.bat') '--no-daemon' '--offline' '-q' $task 2>&1)
        $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
    $safe = ConvertFrom-LlmDiagnosticOutput $captured $exitCode
    # Keep the process boundary ASCII-safe as well; JSON consumers recover the exact Korean text.
    $safe | ConvertTo-Json -Compress -EscapeHandling EscapeNonAscii
    if ($exitCode -ne 0) {
        $safeExit = Get-LlmDiagnosticExitCode $safe.code
        $failure = [InvalidOperationException]::new('LLM diagnostic reported failure; use the safe code/message above.')
        $failure.Data['LlmExitCode'] = $safeExit
        throw $failure
    }
}
