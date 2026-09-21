#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('Login','Diagnose','Smoke')][string]$Action = 'Diagnose',
    [string]$Model,
    [string]$AuthDirectory,
    [string]$CodexPath,
    [string]$WorkspaceId,
    [switch]$AllowDeployedSmoke
)
. (Join-Path $PSScriptRoot 'scripts/llm/common.ps1')
if ($Action -ne 'Login') {
    try { Invoke-LlmDiagnostic $PSScriptRoot $Action -AllowDeployedSmoke:$AllowDeployedSmoke }
    catch {
        $safeExitCode = 2
        if ($_.Exception.Data.Contains('LlmExitCode')) { $safeExitCode = [int]$_.Exception.Data['LlmExitCode'] }
        [Console]::Error.WriteLine($_.Exception.Message)
        exit $safeExitCode
    }
    return
}
if ($Model -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9._:-]{0,119}\z') { throw 'Login requires an explicit valid -Model (1-120 supported model-name characters). No model is selected automatically.' }
if ($WorkspaceId -and -not [Guid]::TryParse($WorkspaceId,[ref]([Guid]::Empty))) { throw 'WorkspaceId must be an official ChatGPT workspace UUID.' }
if (-not $AuthDirectory) { $AuthDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) '2038-monitoring/codex' }
$authFile = Assert-LlmExternalPath (Join-Path $AuthDirectory 'auth.json') $PSScriptRoot
$credentialDirectory = Split-Path -Parent $authFile
$directoryMarker = Join-Path $credentialDirectory '.monitoring-oauth-home'
if ([IO.Path]::GetPathRoot($credentialDirectory).TrimEnd('\','/') -eq $credentialDirectory.TrimEnd('\','/')) { throw 'Login requires a dedicated child directory, never a drive root.' }
if ((Test-Path -LiteralPath $credentialDirectory) -and -not (Test-Path -LiteralPath $directoryMarker)) {
    if (@(Get-ChildItem -LiteralPath $credentialDirectory -Force).Count -gt 0) { throw 'AuthDirectory is not an empty or previously initialized project credential directory. Existing files were preserved.' }
}
if (-not $CodexPath) {
    $command = Get-Command codex.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { $CodexPath = $command.Source }
    else {
        $appBin = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'OpenAI/Codex/bin'
        $candidate = Get-ChildItem -LiteralPath $appBin -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object { Join-Path $_.FullName 'codex.exe' } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        if ($candidate) { $CodexPath = $candidate }
    }
}
if (-not $CodexPath -or -not (Test-Path -LiteralPath $CodexPath -PathType Leaf)) { throw 'Codex CLI was not found. Pass its installed codex.exe path with -CodexPath.' }
New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    Set-Acl -LiteralPath $credentialDirectory -AclObject $acl
} catch { throw 'Could not protect the dedicated credential directory for the current Windows user. Login was not started.' }
Set-Content -LiteralPath $directoryMarker -Value '2038 Monitoring dedicated OAuth login directory' -Encoding ascii
$startInfo = New-CodexLoginStartInfo $CodexPath $credentialDirectory $WorkspaceId
Write-Host 'Complete ChatGPT sign-in in the official browser window and choose the intended workspace. This command performs login only.'
$process = [Diagnostics.Process]::Start($startInfo)
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
try {
    $process.WaitForExit()
    # Drain but never print CLI output: login URLs, identity details, and credentials stay out of the transcript.
    [void]$stdout.GetAwaiter().GetResult()
    [void]$stderr.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $authFile -PathType Leaf)) { throw 'Codex browser login did not complete. Re-run Login; no credential contents or CLI output were printed.' }
} finally {
    if (-not $process.HasExited) { $process.Kill($true) }
    $process.Dispose()
}
$env:APP_RUNTIME = 'local'
$env:LLM_PROVIDER = 'codex_oauth'
$env:CODEX_MODEL = $Model
$env:CODEX_AUTH_FILE = $authFile
Write-Host 'Login completed. This PowerShell session is configured for local/codex_oauth. Run .\llm.ps1 -Action Diagnose before starting the demo.'
