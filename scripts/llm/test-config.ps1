#requires -Version 7.0
. (Join-Path $PSScriptRoot 'common.ps1')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$variables = @('APP_RUNTIME','LLM_PROVIDER','CODEX_MODEL','CODEX_AUTH_FILE','OPENAI_MODEL','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN')
$saved = @{}
foreach ($name in $variables) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process'); [Environment]::SetEnvironmentVariable($name,$null,'Process') }
$parentHomeBefore = [Environment]::GetEnvironmentVariable('CODEX_HOME','Process')
$passed = 0
function Assert-Rejected([scriptblock]$Action,[string]$Expected) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $_.Exception.Message -like $Expected }
    if (-not $rejected) { throw "Configuration rejection did not match: $Expected" }
}
try {
    Assert-Rejected { Get-LlmSelection $root } 'APP_RUNTIME is required*'; $passed++
    $env:APP_RUNTIME='LOCAL'; $env:LLM_PROVIDER='codex_oauth'
    Assert-Rejected { Get-LlmSelection $root } 'APP_RUNTIME is required*'; $passed++
    $env:APP_RUNTIME='local'; $env:LLM_PROVIDER='openai_api'
    Assert-Rejected { Get-LlmSelection $root } 'APP_RUNTIME and LLM_PROVIDER do not match*'; $passed++
    $env:LLM_PROVIDER='codex_oauth'
    Assert-Rejected { Get-LlmSelection $root } 'CODEX_MODEL must explicitly*'; $passed++
    foreach ($invalidModel in @('%bad',('a' * 121),"model`n")) {
        $env:CODEX_MODEL=$invalidModel
        Assert-Rejected { Get-LlmSelection $root } 'CODEX_MODEL must explicitly*'; $passed++
    }
    $env:CODEX_MODEL='explicit-test-model'; $env:CODEX_AUTH_FILE='relative/auth.json'
    Assert-Rejected { Get-LlmSelection $root } 'CODEX_AUTH_FILE must be an explicit absolute path*'; $passed++
    $env:CODEX_AUTH_FILE=Join-Path $root 'auth.json'
    Assert-Rejected { Get-LlmSelection $root } 'Use a dedicated project credential directory*'; $passed++
    $env:CODEX_AUTH_FILE=Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex/auth.json'
    Assert-Rejected { Get-LlmSelection $root } 'Use a dedicated project credential directory*'; $passed++
    $env:APP_RUNTIME='test'; $env:LLM_PROVIDER='mock'; $env:CODEX_AUTH_FILE='invalid-path-never-read'; $env:CODEX_MODEL='invalid model'; $env:OPENAI_API_KEY='fake-test-sentinel'
    $test = Get-LlmSelection $root -ForDemo
    if ($test.model -ne 'mock-structured' -or $test.authConfigured) { throw 'Test mode must not read credentials/models.' }; $passed++
    $env:APP_RUNTIME='deployed'; $env:LLM_PROVIDER='openai_api'; $env:OPENAI_MODEL='explicit-deployment-model'
    Assert-Rejected { Get-LlmSelection $root -ForDemo } 'demo.ps1 supports local/codex_oauth*'; $passed++
    $deployed = Get-LlmSelection $root
    if ($deployed.provider -ne 'openai_api' -or $deployed.model -ne 'explicit-deployment-model') { throw 'Deployed selection was inferred incorrectly.' }; $passed++
    Assert-Rejected { Invoke-LlmDiagnostic $root 'Smoke' } 'Deployed smoke requires*'; $passed++
    $env:OPENAI_API_KEY='fake-test-sentinel'; $env:CODEX_API_KEY='fake-test-sentinel'; $env:CODEX_ACCESS_TOKEN='fake-test-sentinel'
    $login = New-CodexLoginStartInfo 'C:/test/codex.exe' 'C:/test-project-credentials' ''
    foreach ($key in @('OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN','CODEX_AUTH_FILE')) { if ($login.Environment.ContainsKey($key)) { throw 'Login inherited an injected credential.' } }
    if (-not $login.Arguments.StartsWith('login ') -or $login.Arguments -match '\bexec\b|--with-api-key|--with-access-token') { throw 'Login helper must never invoke model inference or alternate credential injection.' }
    if ($login.Environment['CODEX_HOME'] -ne 'C:/test-project-credentials' -or $parentHomeBefore -ne [Environment]::GetEnvironmentVariable('CODEX_HOME','Process')) { throw 'Login changed the parent reserved environment.' }
    $passed++
    foreach ($code in @('MODEL_REQUIRED','CONFIG_INVALID','TIMEOUT','LOCAL_AUTH_REQUIRED')) {
        $inputJson = @{code=$code;message='fixed safe message';raw='fake-must-not-leave-wrapper'} | ConvertTo-Json -Compress
        $safe = ConvertFrom-LlmDiagnosticOutput @('gradle noise',$inputJson) 1
        if ($safe.code -cne $code -or ($safe.PSObject.Properties.Name -join ',') -ne 'code,message') { throw 'Code-only diagnostic was lost or unsafe fields were retained.' }
        $expected = @{MODEL_REQUIRED=2;CONFIG_INVALID=2;TIMEOUT=4;LOCAL_AUTH_REQUIRED=3}[$code]
        if ((Get-LlmDiagnosticExitCode $code) -ne $expected) { throw 'Diagnostic exit mapping changed.' }; $passed++
    }
    Assert-Rejected { ConvertFrom-LlmDiagnosticOutput @('{"code":"UNKNOWN_UNSAFE","message":"fake"}') 1 } 'LLM diagnostic could not complete*'; $passed++
    $safeSuccess = ConvertFrom-LlmDiagnosticOutput @('{"runtime":"test","provider":"mock","model":"mock-structured","authConfigured":false,"raw":"fake"}') 0
    if (($safeSuccess.PSObject.Properties.Name -join ',') -ne 'runtime,provider,model,authConfigured') { throw 'Successful diagnostics must retain exactly four fields.' }; $passed++
    Write-Host "PASS $passed LLM shell checks; no processes, credentials, login, or network calls were used."
} finally {
    foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
