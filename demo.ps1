[CmdletBinding()]
param(
    [ValidateSet('Start','Prepare','Stop','Reset','Status')][string]$Action = 'Start',
    [ValidateSet('Full','Frontend')][string]$Mode = 'Full',
    [ValidateRange(1024,65535)][int]$FrontendPort = 3200,
    [ValidateRange(1024,65535)][int]$BackendPort = 8080,
    [ValidateRange(1024,65535)][int]$ServicePort = 8000,
    [switch]$Offline,
    [switch]$SkipAgent
)
. (Join-Path $PSScriptRoot 'scripts/runtime/common.ps1')
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$demo = Assert-DemoPath $root (Join-Path $root '.demo')
$runtime = Join-Path $demo 'runtime'
$readyFile = Join-Path $demo 'prepared.json'
$stateFile = Join-Path $demo 'state.json'
$frontendBase = "http://localhost:$FrontendPort"
$backendBase = "http://localhost:$BackendPort"
$serviceBase = "http://127.0.0.1:$ServicePort"
if (@(@($FrontendPort,$BackendPort,$ServicePort) | Select-Object -Unique).Count -ne 3) { throw 'Frontend, backend, and service ports must be distinct.' }
New-Item -ItemType Directory -Force -Path $demo,$runtime,(Join-Path $demo 'logs') | Out-Null
$rootHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($root))).Replace('-','').Substring(0,20)
$mutex = New-Object Threading.Mutex($false, "Local\MonitoringDemo-$rootHash")
try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
if (-not $locked) { $mutex.Dispose(); throw 'Another demo command is running for this workspace.' }

function Find-DemoExecutable([string]$Name, [string[]]$Candidates) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    foreach ($candidate in $Candidates) { if ($candidate -and (Test-Path -LiteralPath $candidate)) { return [IO.Path]::GetFullPath($candidate) } }
    throw "Missing prerequisite: $Name. Install it or add its executable to PATH."
}

function Prepare-Demo {
    if ($Offline) { throw 'Offline mode requires a completed Prepare. Run .\demo.ps1 -Action Prepare while online.' }
    if (@(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ }).Count -gt 0) { throw 'Stop the demo before preparing builds.' }
    $node = Find-DemoExecutable 'node.exe' @('C:/Program Files/nodejs/node.exe')
    $npm = Join-Path (Split-Path $node -Parent) 'npm.cmd'
    $java = $null; $dotnet = $null; $python = $null; $jarPath = $null
    if ($Mode -eq 'Full') {
    $java = Find-DemoExecutable 'java.exe' @()
    $dotnet = Find-DemoExecutable 'dotnet.exe' @((Join-Path $env:USERPROFILE '.dotnet/dotnet.exe'),'C:/Program Files/dotnet/dotnet.exe')
    $pythonDir = Join-Path $root '.tools/python311'
    $python = Join-Path $pythonDir 'python.exe'
    if (-not (Test-Path -LiteralPath $python)) {
        New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
        $archive = Join-Path $root '.tools/python311.zip'
        Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile $archive -UseBasicParsing
        Expand-Archive -LiteralPath $archive -DestinationPath $pythonDir -Force
        @('python311.zip','.','Lib/site-packages','../../service','import site') | Set-Content -LiteralPath (Join-Path $pythonDir 'python311._pth') -Encoding ascii
    }
    & $python -c "import importlib.util; raise SystemExit(0 if importlib.util.find_spec('pip') else 1)"
    if ($LASTEXITCODE -ne 0) {
        $bootstrap = Join-Path $pythonDir 'get-pip.py'
        Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $bootstrap -UseBasicParsing
        Invoke-DemoChecked $python @($bootstrap,'--disable-pip-version-check','--no-warn-script-location')
    }
    Invoke-DemoChecked $python @('-m','pip','install','--disable-pip-version-check','--no-warn-script-location','-r',(Join-Path $root 'service/requirements-dev.txt'))
    $env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
    Push-Location (Join-Path $root 'backend')
    try { Invoke-DemoChecked (Join-Path $root 'backend/gradlew.bat') @('--no-daemon','bootJar') } finally { Pop-Location }
    Invoke-DemoChecked $dotnet @('build',(Join-Path $root 'agent/src/MonitoringAgent.Worker/MonitoringAgent.Worker.csproj'),'-c','Release','--nologo')
    $jar = Get-ChildItem -LiteralPath (Join-Path $root 'backend/build/libs') -Filter '*.jar' | Where-Object Name -NotLike '*-plain.jar' | Select-Object -First 1
    if (-not $jar) { throw 'Backend bootJar was not produced.' }
    $jarPath = $jar.FullName
    }
    Push-Location (Join-Path $root 'frontend')
    try {
        Invoke-DemoChecked $npm @('ci','--no-audit','--no-fund')
        $env:NEXT_TELEMETRY_DISABLED = '1'
        foreach ($buildMode in @('Full','Frontend')) {
            $env:NEXT_PUBLIC_API_BASE_URL = $(if ($buildMode -eq 'Full') { $backendBase } else { '' })
            $env:NEXT_BUILD_DIR = $(if ($buildMode -eq 'Full') { '.next-demo-full' } else { '.next-demo-frontend' })
            Invoke-DemoChecked $npm @('run','build')
        }
    } finally { Pop-Location; Remove-Item Env:NEXT_PUBLIC_API_BASE_URL,Env:NEXT_BUILD_DIR -ErrorAction SilentlyContinue }
    Write-DemoJson $readyFile @{ node=$node; java=$java; python=$python; dotnet=$dotnet; jar=$jarPath; fullReady=($Mode -eq 'Full'); backendPort=$BackendPort; frontendPort=$FrontendPort; servicePort=$ServicePort; preparedAt=[DateTimeOffset]::UtcNow.ToString('o') }
    Write-Host "Preparation complete ($Mode). Production builds are available offline."
}

function Start-DemoComponent([string]$Name,[string]$Executable,[string[]]$Arguments,[string]$WorkingDirectory) {
    $config = Join-Path $runtime ($Name + '.config.json')
    Write-DemoJson $config @{ name=$Name; executable=$Executable; arguments=$Arguments; workingDirectory=$WorkingDirectory; runtimeDir=$runtime; stdout=(Join-Path $demo "logs/$Name.stdout.log"); stderr=(Join-Path $demo "logs/$Name.stderr.log") }
    $shell = (Get-Process -Id $PID).Path
    $shellArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'scripts/runtime/supervise.ps1'),'-Config',$config)
    $savedSecrets = @{}
    foreach ($key in @('OPENAI_API_KEY','APP_JWT_SECRET','MONITORING_DEMO_AGENT_TOKEN')) {
        $savedSecrets[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
        $allowed = ($Name -eq 'backend' -and $key -in @('OPENAI_API_KEY','APP_JWT_SECRET')) -or ($Name -eq 'agent' -and $key -eq 'MONITORING_DEMO_AGENT_TOKEN')
        if (-not $allowed) { [Environment]::SetEnvironmentVariable($key,$null,'Process') }
    }
    try { $process = Start-Process -FilePath $shell -ArgumentList (($shellArgs | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ') -WindowStyle Hidden -PassThru }
    finally { foreach ($key in $savedSecrets.Keys) { [Environment]::SetEnvironmentVariable($key,$savedSecrets[$key],'Process') } }
    $until = [DateTime]::UtcNow.AddSeconds(15)
    while (-not (Test-Path -LiteralPath (Join-Path $runtime "$Name.processes.json"))) {
        $process.Refresh()
        if ($process.HasExited -or [DateTime]::UtcNow -gt $until) { throw "$Name supervisor failed to start." }
        Start-Sleep -Milliseconds 100
    }
}

try {
    if ($Action -eq 'Status') {
        $records = @(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ })
        Write-Host "Owned processes: $($records.Count)"
        $statusPorts = @($FrontendPort,$BackendPort,$ServicePort)
        if (Test-Path -LiteralPath $stateFile) {
            $savedState = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            $statusPorts = @($savedState.frontendPort,$savedState.backendPort,$savedState.servicePort)
            Write-Host "Mode: $($savedState.mode), URL: $($savedState.frontend)"
        }
        foreach ($port in $statusPorts) { Write-Host "Port $port listener PID(s): $((Get-DemoPortOwner $port) -join ', ')" }
        return
    }
    if ($Action -in @('Stop','Reset')) {
        Stop-DemoProcesses $runtime
        foreach ($path in @($runtime,$stateFile)) {
            $verified = Assert-DemoPath $root $path
            if (Test-Path -LiteralPath $verified) { Remove-Item -LiteralPath $verified -Force -Recurse }
        }
        if ($Action -eq 'Reset') {
            foreach ($path in @((Join-Path $demo 'data'),(Join-Path $demo 'storage'),(Join-Path $demo 'agent'))) {
                $verified = Assert-DemoPath $root $path
                if (Test-Path -LiteralPath $verified) { Remove-Item -LiteralPath $verified -Recurse -Force }
            }
            Write-Host 'Demo data reset. Prepared builds are retained. Browser backup data: use its Reset demo button.'
        } else { Write-Host 'Owned demo processes stopped.' }
        return
    }
    if ($Action -eq 'Prepare') { Prepare-Demo; return }
    $active = @(Get-DemoRecords $runtime | Where-Object { Test-DemoIdentity $_ })
    if ($active.Count -gt 0) {
        if (Test-Path -LiteralPath $stateFile) {
            $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            if ($state.mode -eq $Mode -and $state.frontendPort -eq $FrontendPort -and $state.backendPort -eq $BackendPort -and $state.servicePort -eq $ServicePort) {
                Wait-DemoHttp "$frontendBase/login" 8
                if ($Mode -eq 'Full') { Wait-DemoHttp "$backendBase/api/health" 8; Wait-DemoHttp "$serviceBase/health" 8 }
                Write-Host "Demo is already running ($Mode): $frontendBase/login"
                return
            }
        }
        throw 'An owned demo is already running or partially started. Run .\demo.ps1 -Action Stop before changing modes.'
    }
    $ports = $(if ($Mode -eq 'Full') { @($FrontendPort,$BackendPort,$ServicePort) } else { @($FrontendPort) })
    Assert-DemoPorts $ports
    if (-not (Test-Path -LiteralPath $readyFile)) { Prepare-Demo }
    $ready = Get-Content -LiteralPath $readyFile -Raw | ConvertFrom-Json
    if ($Mode -eq 'Full' -and -not $ready.fullReady) { Prepare-Demo; $ready = Get-Content -LiteralPath $readyFile -Raw | ConvertFrom-Json }
    if ($Mode -eq 'Full' -and $ready.backendPort -ne $BackendPort) { throw "Prepared frontend targets backend port $($ready.backendPort). Run Prepare with -BackendPort $BackendPort before starting this configuration." }
    foreach ($old in @(Get-ChildItem -LiteralPath $runtime -File)) { Remove-Item -LiteralPath $old.FullName -Force }
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:NEXT_PUBLIC_API_BASE_URL = $(if ($Mode -eq 'Full') { $backendBase } else { '' })
    $env:NEXT_BUILD_DIR = $(if ($Mode -eq 'Full') { '.next-demo-full' } else { '.next-demo-frontend' })
    if (-not (Test-Path -LiteralPath (Join-Path $root "frontend/$env:NEXT_BUILD_DIR/BUILD_ID"))) { throw 'Selected production build is missing. Run .\demo.ps1 -Action Prepare.' }
    try {
        if ($Mode -eq 'Full') {
            New-Item -ItemType Directory -Force -Path (Join-Path $demo 'data'),(Join-Path $demo 'storage') | Out-Null
            $env:APP_STORAGE_LOCATION = Join-Path $demo 'storage'
            $env:APP_DEMO_FIXTURES = Join-Path $root 'demo-fixtures'
            $env:SPRING_PROFILES_ACTIVE = 'demo'
            $env:SPRING_DATASOURCE_URL = 'jdbc:h2:file:' + (Join-Path $demo 'data/monitoring').Replace('\','/') + ';MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE'
            $env:APP_ANALYSIS_BASE_URL = $serviceBase
            $env:APP_PUBLIC_URL = $frontendBase
            $env:APP_DEMO_HEARTBEAT_ENABLED = $(if ($SkipAgent) { 'true' } else { 'false' })
            $env:DOTNET_ROOT = Split-Path $ready.dotnet -Parent
            if (-not $env:APP_JWT_SECRET) { $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); $env:APP_JWT_SECRET = [Convert]::ToBase64String($bytes) }
            Start-DemoComponent 'service' $ready.python @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port',"$ServicePort") (Join-Path $root 'service')
            Wait-DemoHttp "$serviceBase/health"
            Start-DemoComponent 'backend' $ready.java @('-jar',$ready.jar,'--server.address=127.0.0.1',"--server.port=$BackendPort","--app.cors.allowed-origins=$frontendBase,http://127.0.0.1:$FrontendPort") (Join-Path $root 'backend')
            Wait-DemoHttp "$backendBase/api/health" 120
            $login = Invoke-RestMethod -Uri "$backendBase/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@xisnd.com';password='test1234'} | ConvertTo-Json)
            $headers = @{ Authorization = 'Bearer ' + $login.token }
            $seed = Invoke-RestMethod -Uri "$backendBase/api/demo/seed" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}'
            if (-not $SkipAgent) {
                $agentUrl = "$backendBase/api/projects/$($seed.projectId)/agents"
                $agent = Invoke-RestMethod -Uri "$backendBase/api/demo/projects/$($seed.projectId)/agent-token" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}'
                $env:MONITORING_DEMO_AGENT_TOKEN = $agent.token
                $env:MONITORING_DEMO_SERVER = "http://127.0.0.1:$BackendPort"
                $agentExe = Join-Path $root 'agent/src/MonitoringAgent.Worker/bin/Release/net8.0-windows/win-x64/MonitoringAgentService.exe'
                Start-DemoComponent 'agent' $agentExe @('--demo') (Split-Path $agentExe -Parent)
                Remove-Item Env:MONITORING_DEMO_AGENT_TOKEN -ErrorAction SilentlyContinue
                $agentReady = $false
                $agentUntil = [DateTime]::UtcNow.AddSeconds(15)
                do {
                    $currentAgents = Invoke-RestMethod -Uri $agentUrl -Headers $headers
                    foreach ($currentAgent in $currentAgents) {
                        if ($currentAgent.id -eq $agent.agentId -and $currentAgent.state -eq 'ONLINE' -and $currentAgent.agentVersion -eq '1.0.0-demo' -and $null -ne $currentAgent.latest) { $agentReady = $true }
                    }
                    if (-not $agentReady) { Start-Sleep -Milliseconds 400 }
                } while (-not $agentReady -and [DateTime]::UtcNow -lt $agentUntil)
                if (-not $agentReady) { throw 'C# synthetic Agent did not send heartbeat/metrics in time. Inspect .demo/logs/agent.stderr.log.' }
            }
        }
        Start-DemoComponent 'frontend' $ready.node @((Join-Path $root 'frontend/node_modules/next/dist/bin/next'),'start','-p',"$FrontendPort",'-H','127.0.0.1') (Join-Path $root 'frontend')
        Wait-DemoHttp "$frontendBase/login" 90
        Write-DemoJson $stateFile @{mode=$Mode; frontendPort=$FrontendPort; backendPort=$BackendPort; servicePort=$ServicePort; startedAt=[DateTimeOffset]::UtcNow.ToString('o'); frontend="$frontendBase/login"}
        Write-Host "Demo ready ($Mode): $frontendBase/login"
        Write-Host 'Account: admin@xisnd.com / test1234 | stop: .\demo-stop.ps1 | reset: .\demo-reset.ps1'
    } catch { Stop-DemoProcesses $runtime; throw }
} finally {
    Remove-Item Env:MONITORING_DEMO_AGENT_TOKEN -ErrorAction SilentlyContinue
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
