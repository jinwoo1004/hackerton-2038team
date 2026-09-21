#Requires -Version 7.0
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskJar=Join-Path $taskRoot 'backend/build/libs/monitoring-backend-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $taskJar)) { throw 'Build the backend bootJar before packaged verification.' }
$taskJava=if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { (Get-Command java).Source }
$taskChecks=@()

function Invoke-PackagedCase([string]$Name,[string[]]$Arguments,[hashtable]$Environment,[int]$ExpectedExit,[switch]$Bootstrap) {
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$taskJava; $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.WorkingDirectory=$taskRoot
    $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    $info.StandardOutputEncoding=[Text.Encoding]::UTF8; $info.StandardErrorEncoding=[Text.Encoding]::UTF8
    foreach ($key in @('APP_RUNTIME','LLM_PROVIDER','LLM_TIMEOUT_SECONDS','CODEX_HOME','CODEX_AUTH_FILE',
        'CODEX_MODEL','CODEX_ACCESS_TOKEN','CODEX_API_KEY','OPENAI_API_KEY','OPENAI_MODEL','OPENAI_BASE_URL')) {
        [void]$info.Environment.Remove($key)
    }
    foreach ($key in $Environment.Keys) { $info.Environment[$key]=$Environment[$key] }
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $process=[Diagnostics.Process]::Start($info)
    try {
        $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(15000)) { $process.Kill($true); throw 'Packaged validation exceeded its deadline.' }
        $out=$stdout.GetAwaiter().GetResult(); $err=$stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne $ExpectedExit) { throw "Unexpected exit code for ${Name}: $($process.ExitCode)" }
        if ($Bootstrap) {
            if ($out -match 'Spring Boot|Tomcat|Hikari|Started MonitoringApplication' -or
                $err -notmatch '^AI configuration \[CONFIG_INVALID\]:') {
                throw 'Invalid bootstrap did not fail safely before Spring/database startup.'
            }
            return [ordered]@{name=$Name;result='PASS';exitCode=$process.ExitCode;springStarted=$false;code='CONFIG_INVALID'}
        }
        $parsed=$out.Trim() | ConvertFrom-Json
        $names=@($parsed.PSObject.Properties.Name)
        if ($ExpectedExit -eq 0) {
            if (($names -join ',') -ne 'runtime,provider,model,authConfigured' -or
                $parsed.runtime -ne 'test' -or $parsed.provider -ne 'mock' -or $parsed.authConfigured) {
                throw 'Packaged mock diagnostic must contain exactly four safe fields.'
            }
        } elseif (($names -join ',') -ne 'code,message' -or $parsed.code -ne 'API_KEY_REQUIRED') {
            throw 'Missing deployed key did not return the safe API_KEY_REQUIRED error.'
        }
        if ($out -match 'would-fail-if-read|Bearer|access_token|sk-' -or $err.Trim().Length -ne 0) {
            throw 'Packaged diagnostic emitted unexpected raw output.'
        }
        return [ordered]@{name=$Name;result='PASS';exitCode=$process.ExitCode;metadata=$parsed}
    } finally { $process.Dispose() }
}

$taskEntry=@('-Dfile.encoding=UTF-8','-Dloader.main=com.xisnd.monitoring.llm.LlmDiagnostic','-cp',$taskJar,'org.springframework.boot.loader.launch.PropertiesLauncher')
$taskMock=@{APP_RUNTIME='test';LLM_PROVIDER='mock'}
$taskChecks+=Invoke-PackagedCase 'JAR mock Diagnose' ($taskEntry+@('diagnose')) $taskMock 0
$taskChecks+=Invoke-PackagedCase 'JAR mock Smoke' ($taskEntry+@('smoke')) $taskMock 0
$taskChecks+=Invoke-PackagedCase 'Missing selectors cannot be supplied through Spring aliases' @('-Dfile.encoding=UTF-8','-jar',$taskJar,'--app.llm.runtime=deployed','--app.llm.provider=openai_api') @{} 2 -Bootstrap
$taskChecks+=Invoke-PackagedCase 'Deployed missing key ignores invalid OAuth path' ($taskEntry+@('diagnose')) @{
    APP_RUNTIME='deployed';LLM_PROVIDER='openai_api';OPENAI_MODEL='synthetic-deployment-model';CODEX_AUTH_FILE='would-fail-if-read'
} 3
$taskEvidence=[ordered]@{completedAt=[DateTimeOffset]::UtcNow.ToString('o');result='PASS';modelHttpRequests=0;checks=$taskChecks}
$taskDirectory=Join-Path $taskRoot 'docs/evidence/llm'
[void][IO.Directory]::CreateDirectory($taskDirectory)
$taskEvidence | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $taskDirectory 'packaged.json') -Encoding utf8NoBOM
Write-Output "PASS $($taskChecks.Count) packaged JAR checks; no model requests, no running server created."
