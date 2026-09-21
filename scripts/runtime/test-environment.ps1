#requires -Version 7.4
[CmdletBinding()]
param([switch]$SentinelHost,[switch]$Probe)
. (Join-Path $PSScriptRoot 'common.ps1')
$keys = @('APP_RUNTIME','LLM_PROVIDER','CODEX_HOME','CODEX_MODEL','CODEX_AUTH_FILE','OPENAI_MODEL','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN','APP_JWT_SECRET','MONITORING_DEMO_AGENT_TOKEN')
if ($Probe) {
    $present = [ordered]@{}
    foreach ($key in $keys) { $present[$key] = $null -ne [Environment]::GetEnvironmentVariable($key,'Process') }
    $present | ConvertTo-Json -Compress
    return
}
$shell = (Get-Process -Id $PID).Path
if (-not $SentinelHost) {
    $parentHome = [Environment]::GetEnvironmentVariable('CODEX_HOME','Process')
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$shell; $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    foreach ($arg in @('-NoProfile','-File',$PSCommandPath,'-SentinelHost')) { $info.ArgumentList.Add($arg) }
    # Synthetic inheritance exists only in this disposable child; never modify the parent's CODEX_HOME.
    foreach ($key in $keys) { $info.Environment[$key]='fake-sentinel-' + $key }
    $child = [Diagnostics.Process]::Start($info)
    try {
        $output=$child.StandardOutput.ReadToEndAsync(); $errors=$child.StandardError.ReadToEndAsync()
        if (-not $child.WaitForExit(60000)) { $child.Kill($true); throw 'Environment test exceeded its deadline.' }
        $safeOutput=$output.GetAwaiter().GetResult(); [void]$errors.GetAwaiter().GetResult()
        if ($child.ExitCode -ne 0) { throw 'Synthetic environment isolation child failed.' }
        if ($parentHome -cne [Environment]::GetEnvironmentVariable('CODEX_HOME','Process')) { throw 'Parent CODEX_HOME changed.' }
        Write-Host $safeOutput.Trim()
    } finally { $child.Dispose() }
    return
}
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$temporary = Assert-DemoPath $root (Join-Path $root ('.demo/environment-check-' + [Guid]::NewGuid().ToString('N')))
New-Item -ItemType Directory -Path $temporary | Out-Null
$passed=0
try {
    foreach ($runtimeValue in @('local','test')) {
        foreach ($component in @('backend','frontend','service','agent')) {
            $before=@{}; foreach ($key in $keys) { $before[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
            $overrides=Get-DemoChildEnvironment $component $runtimeValue
            $outputFile=Join-Path $temporary 'stdout.json'; $errorFile=Join-Path $temporary 'stderr.txt'
            $arguments=@('-NoProfile','-File',$PSCommandPath,'-Probe') | ForEach-Object { ConvertTo-NativeArgument $_ }
            $probeProcess=Start-Process -FilePath $shell -ArgumentList ($arguments -join ' ') -Environment $overrides -WindowStyle Hidden -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile -PassThru
            try {
                if (-not $probeProcess.WaitForExit(15000)) { $probeProcess.Kill($true); throw 'Environment probe exceeded its deadline.' }
                $probeProcess.WaitForExit()
                if ($probeProcess.ExitCode -ne 0) { throw 'Environment probe failed.' }
                $present=Get-Content -LiteralPath $outputFile -Raw | ConvertFrom-Json
                $expected=@()
                if ($component -eq 'backend') {
                    $expected=@('APP_RUNTIME','LLM_PROVIDER','APP_JWT_SECRET')
                    if ($runtimeValue -eq 'local') { $expected+=@('CODEX_MODEL','CODEX_AUTH_FILE') }
                } elseif ($component -eq 'agent') { $expected=@('MONITORING_DEMO_AGENT_TOKEN') }
                foreach ($key in $keys) {
                    if ($present.$key -ne ($key -in $expected)) { throw "Unexpected child environment boundary: $runtimeValue/$component/$key" }
                    if ($before[$key] -cne [Environment]::GetEnvironmentVariable($key,'Process')) { throw 'A parent variable changed.' }
                }
                $passed++
            } finally { $probeProcess.Dispose() }
        }
    }
    Write-Host "PASS $passed actual local/test child environment probes; CODEX_HOME stripped, parent preserved, synthetic values only."
} finally {
    foreach ($name in @('stdout.json','stderr.txt')) {
        $file=Join-Path $temporary $name
        if (Test-Path -LiteralPath $file) {
            for ($attempt=0; $attempt -lt 20; $attempt++) {
                try { Remove-Item -LiteralPath $file -Force; break } catch { if ($attempt -eq 19) { throw }; Start-Sleep -Milliseconds 100 }
            }
        }
    }
    Remove-Item -LiteralPath $temporary -Force
}
