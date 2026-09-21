#Requires -Version 7.0
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskBackend = Join-Path $taskRoot 'backend'
$taskStarted = [DateTimeOffset]::UtcNow

# Run a separate shell so verification never changes the caller's selected runtime.
# The filtered tests use in-memory HTTP fakes; the feature contract uses only a
# loopback service stub. They never invoke a live model endpoint or the login CLI.
$taskScript = @'
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath '__BACKEND__'
& './gradlew.bat' --no-daemon --offline --console=plain test --rerun-tasks --tests 'com.xisnd.monitoring.llm.*' --tests 'com.xisnd.monitoring.OpenAiContractTest'
exit $LASTEXITCODE
'@.Replace('__BACKEND__', $taskBackend.Replace("'", "''"))
$taskInfo = [Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName = (Get-Process -Id $PID).Path
$taskInfo.UseShellExecute = $false
$taskInfo.CreateNoWindow = $true
$taskInfo.WorkingDirectory = $taskBackend
foreach ($taskArgument in @('-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($taskScript)))) {
    $taskInfo.ArgumentList.Add($taskArgument)
}
foreach ($taskVariable in @('OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL',
    'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN', 'CODEX_AUTH_FILE', 'CODEX_HOME', 'CODEX_MODEL')) {
    [void]$taskInfo.Environment.Remove($taskVariable)
}
$taskInfo.Environment['APP_RUNTIME'] = 'test'
$taskInfo.Environment['LLM_PROVIDER'] = 'mock'
$taskProcess = [Diagnostics.Process]::Start($taskInfo)
$taskProcess.WaitForExit()
$taskExitCode = $taskProcess.ExitCode
$taskProcess.Dispose()

# Persist counts only, never test stdout, request headers or credential contents.
$taskSuites = @()
$taskResultsDirectory = Join-Path $taskBackend 'build/test-results/test'
foreach ($taskName in @('com.xisnd.monitoring.llm.LlmProviderBoundaryTest',
    'com.xisnd.monitoring.llm.LlmTransportTest', 'com.xisnd.monitoring.llm.LlmSseCompletionTest',
    'com.xisnd.monitoring.OpenAiContractTest')) {
    $taskResultPath = Join-Path $taskResultsDirectory ('TEST-' + $taskName + '.xml')
    if ((Test-Path -LiteralPath $taskResultPath) -and
        (Get-Item -LiteralPath $taskResultPath).LastWriteTimeUtc -ge $taskStarted.UtcDateTime) {
        [xml]$taskResult = Get-Content -LiteralPath $taskResultPath -Raw
        $taskSuites += [ordered]@{
            name = $taskName
            tests = [int]$taskResult.testsuite.tests
            failures = [int]$taskResult.testsuite.failures
            errors = [int]$taskResult.testsuite.errors
            skipped = [int]$taskResult.testsuite.skipped
        }
    }
}
$taskPassed = $taskExitCode -eq 0 -and $taskSuites.Count -eq 4 -and
    @($taskSuites | Where-Object { $_.tests -lt 1 -or $_.failures -gt 0 -or $_.errors -gt 0 -or $_.skipped -gt 0 }).Count -eq 0
$taskEvidenceDirectory = Join-Path $taskRoot 'docs/evidence/llm'
[void][IO.Directory]::CreateDirectory($taskEvidenceDirectory)
$taskEvidence = [ordered]@{
    startedAt = $taskStarted.ToString('o')
    completedAt = [DateTimeOffset]::UtcNow.ToString('o')
    result = $(if ($taskPassed) { 'PASS' } else { 'FAIL' })
    command = 'gradlew.bat --no-daemon --offline --console=plain test --rerun-tasks --tests com.xisnd.monitoring.llm.* --tests com.xisnd.monitoring.OpenAiContractTest'
    runtime = 'test'
    provider = 'mock'
    liveModelRequests = 0
    requestIsolation = 'Provider/transport use in-memory fakes; feature service stub is loopback only. No live credentials are inherited.'
    exitCode = $taskExitCode
    suites = $taskSuites
}
$taskEvidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskEvidenceDirectory 'backend-boundaries.json') -Encoding utf8NoBOM
if (-not $taskPassed) { throw 'LLM boundary verification failed or the expected fresh test results are incomplete.' }
Write-Output 'LLM boundary verification PASS. Sanitized counts: docs/evidence/llm/backend-boundaries.json'
