param([switch]$Lifecycle,[int]$FrontendPort=3200,[int]$BackendPort=8080,[int]$ServicePort=8000)
. (Join-Path $PSScriptRoot 'common.ps1')
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$launcher = Join-Path $root 'demo.ps1'
$savedRuntime = [Environment]::GetEnvironmentVariable('APP_RUNTIME','Process')
$savedProvider = [Environment]::GetEnvironmentVariable('LLM_PROVIDER','Process')
$env:APP_RUNTIME = 'test'
$env:LLM_PROVIDER = 'mock'
try {
$runtime = Join-Path $root '.demo/runtime'
if (@(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ }).Count -gt 0) { throw 'Stop the running demo before this verification.' }
$passed = @()
foreach ($port in @(3200,8080,8000)) {
    $ownersBefore = @(Get-DemoPortOwner $port)
    $listener = $null
    if ($ownersBefore.Count -eq 0) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port)
        $listener.Start()
        $ownersBefore = @(Get-DemoPortOwner $port)
    }
    try {
        $rejected = $false
        try { Assert-DemoPorts @($port) } catch { $rejected = $_.Exception.Message -like "Port $port is occupied*" }
        if (-not $rejected) { throw "Port collision $port was not rejected." }
        if (@(Compare-Object $ownersBefore @(Get-DemoPortOwner $port)).Count -ne 0) { throw 'Unrelated listener was stopped.' }
        $passed += "PASS occupied port ${port}: rejected without terminating its owner"
    } finally { if ($listener) { $listener.Stop() } }
}
$unsafe = $false
try { Assert-DemoPath $root (Join-Path $root '../outside-demo') | Out-Null } catch { $unsafe = $true }
if (-not $unsafe) { throw 'Outside-workspace path was accepted.' }
$passed += 'PASS reset path guard: outside workspace rejected'

$testDir = Assert-DemoPath $root (Join-Path $root '.demo/runtime-test')
New-Item -ItemType Directory -Force -Path $testDir | Out-Null
$node = (Get-Command node.exe).Source
$childJs = Join-Path $testDir 'child.cjs'
'setInterval(() => {}, 1000);' | Set-Content -LiteralPath $childJs -Encoding ascii
$config = Join-Path $testDir 'test.config.json'
Write-DemoJson $config @{name='test'; executable=$node; arguments=@($childJs); workingDirectory=$root; runtimeDir=$testDir; stdout=(Join-Path $testDir 'out.log'); stderr=(Join-Path $testDir 'err.log')}
$shell = (Get-Process -Id $PID).Path
$shellArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'supervise.ps1'),'-Config',$config)
$supervisor = Start-Process -FilePath $shell -ArgumentList (($shellArgs | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ') -WindowStyle Hidden -PassThru
try {
    $until = [DateTime]::UtcNow.AddSeconds(20)
    do {
        Start-Sleep -Milliseconds 250
        $records = @(Get-DemoRecords $testDir)
    } while ($records.Count -lt 2 -and [DateTime]::UtcNow -lt $until)
    if ($records.Count -lt 2) { throw 'Supervisor failed to record child identity.' }
    $ownedSupervisor = $records | Where-Object pid -EQ $supervisor.Id | Select-Object -First 1
    if (-not (Test-DemoIdentity $ownedSupervisor)) { throw 'Supervisor identity missing.' }
    Stop-Process -Id $supervisor.Id -Force
    Start-Sleep -Milliseconds 200
    $orphans = @($records | Where-Object { Test-DemoIdentity $_ })
    if ($orphans.Count -lt 1) { throw 'Expected test orphan was not running.' }
    Stop-DemoProcesses $testDir
    if (@($records | Where-Object { Test-DemoIdentity $_ }).Count -gt 0) { throw 'Orphan process survived stop.' }
    $passed += 'PASS orphan recovery: owned child stopped after supervisor was terminated'
    $mismatch = Get-DemoIdentity $PID
    $mismatch.started = '0'
    if (Test-DemoIdentity $mismatch) { throw 'Reused PID identity was accepted.' }
    $passed += 'PASS reused PID guard: mismatched process creation time rejected'
} finally {
    Stop-DemoProcesses $testDir
    $verified = Assert-DemoPath $root $testDir
    Remove-Item -LiteralPath $verified -Recurse -Force
}
if ($Lifecycle) {
    $ports = @{FrontendPort=$FrontendPort;BackendPort=$BackendPort;ServicePort=$ServicePort}
    & $launcher -Action Reset
    & $launcher -Offline @ports
    $before = @(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ } | ForEach-Object pid)
    & $launcher -Offline @ports
    $after = @(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ } | ForEach-Object pid)
    if (@(Compare-Object $before $after).Count -ne 0) { throw 'Duplicate start changed process ownership.' }
    $passed += 'PASS full-stack clean start and duplicate start'
    & $launcher -Action Stop
    foreach ($port in @($FrontendPort,$BackendPort,$ServicePort)) { if (@(Get-DemoPortOwner $port).Count -gt 0) { throw "Port $port left listening after stop." } }
    $passed += "PASS full-stack stop: ports $FrontendPort, $BackendPort, $ServicePort released"
    & $launcher -Mode Frontend -Offline @ports
    Wait-DemoHttp "http://localhost:$FrontendPort/login"
    & $launcher -Action Reset
    if (Test-Path -LiteralPath (Join-Path $root '.demo/data')) { throw 'Reset retained demo database.' }
    $passed += 'PASS frontend-only offline start and safe data reset'
}
$passed | ForEach-Object { Write-Host $_ }
} finally {
    [Environment]::SetEnvironmentVariable('APP_RUNTIME',$savedRuntime,'Process')
    [Environment]::SetEnvironmentVariable('LLM_PROVIDER',$savedProvider,'Process')
}
