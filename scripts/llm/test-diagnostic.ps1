#requires -Version 7.0
# Runs Java diagnostics with mock settings and a synthetic expired file; no real credentials or model HTTP.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'common.ps1')
$shell=(Get-Process -Id $PID).Path
$encodingBefore=[Console]::OutputEncoding.CodePage
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('monitoring-llm-fixture-' + [Guid]::NewGuid().ToString('N'))
$fakeAuthFile=Assert-LlmExternalPath (Join-Path $temporary 'synthetic-expired.json') $root
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    # Deliberately fabricated, unsigned and expired since Unix second 1. Never use a real login file.
    '{"auth_mode":"chatgpt","tokens":{"access_token":"e30.eyJleHAiOjF9.fake-signature","account_id":"synthetic-account"}}' | Set-Content -LiteralPath $fakeAuthFile -Encoding utf8NoBOM
    $cases=@(
        @{runtime='test';provider='mock';timeout='typo';code='CONFIG_INVALID';exit=2;message='AI 실행 환경과 제공자 설정을 확인하세요.';fields='code,message'},
        @{runtime='local';provider='codex_oauth';timeout='4';code='LOCAL_AUTH_REQUIRED';exit=3;message='로컬 로그인 명령을 다시 실행하세요.';fields='runtime,provider,model,authConfigured,code,message'}
    )
    foreach ($case in $cases) {
        $info=[Diagnostics.ProcessStartInfo]::new()
        $info.FileName=$shell; $info.UseShellExecute=$false; $info.CreateNoWindow=$true
        $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
        foreach ($arg in @('-NoProfile','-File',(Join-Path $root 'llm.ps1'),'-Action','Diagnose')) { $info.ArgumentList.Add($arg) }
        $info.Environment['APP_RUNTIME']=$case.runtime; $info.Environment['LLM_PROVIDER']=$case.provider; $info.Environment['LLM_TIMEOUT_SECONDS']=$case.timeout
        foreach ($key in @('CODEX_HOME','CODEX_AUTH_FILE','CODEX_MODEL','OPENAI_MODEL','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN')) { [void]$info.Environment.Remove($key) }
        if ($case.runtime -eq 'local') { $info.Environment['CODEX_MODEL']='synthetic-test-model'; $info.Environment['CODEX_AUTH_FILE']=$fakeAuthFile }
        $process=[Diagnostics.Process]::Start($info)
        try {
            $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
            if (-not $process.WaitForExit(60000)) { $process.Kill($true); throw 'Diagnostic test exceeded its deadline.' }
            $output=$stdout.GetAwaiter().GetResult(); [void]$stderr.GetAwaiter().GetResult()
            if ($process.ExitCode -ne $case.exit) { throw "Diagnostic returned the wrong process exit code for $($case.code)." }
            if ($output -match '[^\x00-\x7F]') { throw 'Diagnostic process output must be code-page independent ASCII JSON.' }
            $safe=$output.Trim() | ConvertFrom-Json
            if ($safe.code -cne $case.code -or ($safe.PSObject.Properties.Name -join ',') -ne $case.fields) { throw 'Java configuration failure was lost or leaked extra fields.' }
            if ($safe.message -cne $case.message) { throw "Korean diagnostic was corrupted for $($case.code)." }
        } finally { $process.Dispose() }
    }
    if ([Console]::OutputEncoding.CodePage -ne $encodingBefore) { throw 'Parent console encoding changed.' }
    Write-Host 'PASS 2 Java diagnostics: timeout typo exit2, synthetic expired auth exit3, exact Korean messages through ASCII JSON, parent console unchanged; no model HTTP.'
} finally {
    if (Test-Path -LiteralPath $fakeAuthFile) { Remove-Item -LiteralPath $fakeAuthFile -Force }
    Remove-Item -LiteralPath $temporary -Force
}
