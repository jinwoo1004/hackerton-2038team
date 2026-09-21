Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-DemoPath([string]$Root, [string]$Path) {
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\','/')
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing path outside demo workspace: $full"
    }
    $cursor = $full
    while ($cursor.Length -gt $rootFull.Length) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Refusing a symbolic link/junction in demo path: $cursor"
            }
        }
        $cursor = Split-Path -Parent $cursor
    }
    return $full
}

function Write-DemoJson([string]$Path, $Value) {
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath ($Path + '.tmp') -Encoding UTF8
    Move-Item -LiteralPath ($Path + '.tmp') -Destination $Path -Force
}

function ConvertTo-NativeArgument([string]$Value) {
    if ($Value -notmatch '[\s"]' -and $Value.Length -gt 0) { return $Value }
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Get-DemoChildEnvironment([string]$Name,[string]$LlmRuntime) {
    $overrides = @{}
    foreach ($key in @('APP_RUNTIME','LLM_PROVIDER','CODEX_HOME','CODEX_MODEL','CODEX_AUTH_FILE','OPENAI_MODEL','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN','APP_JWT_SECRET','MONITORING_DEMO_AGENT_TOKEN')) {
        $allowed = ($Name -eq 'backend' -and (
            $key -in @('APP_RUNTIME','LLM_PROVIDER','APP_JWT_SECRET') -or
            ($LlmRuntime -eq 'local' -and $key -in @('CODEX_MODEL','CODEX_AUTH_FILE')) -or
            ($LlmRuntime -eq 'deployed' -and $key -in @('OPENAI_MODEL','OPENAI_API_KEY'))
        )) -or ($Name -eq 'agent' -and $key -eq 'MONITORING_DEMO_AGENT_TOKEN')
        if (-not $allowed) { $overrides[$key] = $null }
    }
    # Start-Process applies these overrides to the child only, preserving every parent variable.
    return $overrides
}

function Get-DemoIdentity([int]$ProcessId) {
    $p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $p) { return $null }
    try {
        return [pscustomobject]@{ pid = $p.Id; started = $p.StartTime.ToUniversalTime().Ticks.ToString(); executable = $p.Path }
    } catch { return $null }
}

function Test-DemoIdentity($Record) {
    if (-not $Record) { return $false }
    $actual = Get-DemoIdentity ([int]$Record.pid)
    return $actual -and $actual.started -eq $Record.started -and $actual.executable -eq $Record.executable
}

function Get-DemoRecords([string]$RuntimeDir) {
    $records = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $RuntimeDir -Filter '*.processes.json' -ErrorAction SilentlyContinue)) {
        try { $records += @(Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json) } catch { }
    }
    return $records
}

function Stop-DemoProcesses([string]$RuntimeDir) {
    if (-not (Test-Path -LiteralPath $RuntimeDir)) { return }
    Set-Content -LiteralPath (Join-Path $RuntimeDir 'stop.flag') -Value 'stop' -Encoding ascii
    # Supervisors record exact PID + creation time + executable identity. PID alone is never sufficient.
    $records = @(Get-DemoRecords $RuntimeDir)
    $until = [DateTime]::UtcNow.AddSeconds(3)
    while (@($records | Where-Object { Test-DemoIdentity $_ }).Count -gt 0 -and [DateTime]::UtcNow -lt $until) {
        Start-Sleep -Milliseconds 200
        $records = @(Get-DemoRecords $RuntimeDir)
    }
    foreach ($record in @($records | Sort-Object { [long]$_.started } -Descending)) {
        if (Test-DemoIdentity $record) { Stop-Process -Id ([int]$record.pid) -Force -ErrorAction SilentlyContinue }
    }
    Start-Sleep -Milliseconds 400
    $remaining = @($records | Where-Object { Test-DemoIdentity $_ })
    if ($remaining.Count -gt 0) { throw 'Some owned demo processes did not stop. No unrelated process was terminated.' }
}

function Get-DemoPortOwner([int]$Port) {
    return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Assert-DemoPorts([int[]]$Ports) {
    foreach ($port in $Ports) {
        $owners = @(Get-DemoPortOwner $port)
        if ($owners.Count -gt 0) { throw "Port $port is occupied by PID(s) $($owners -join ', '). No process was stopped. Close it or use the frontend backup when only backend ports conflict." }
        # A permission error from process enumeration must never be mistaken for a free port.
        $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $port)
        try { $probe.Start() }
        catch { throw "Port $port cannot be reserved. Existing processes were preserved; verify port availability and local network permission." }
        finally { $probe.Stop() }
    }
}

function Wait-DemoHttp([string]$Url, [int]$Seconds = 90) {
    $until = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $until) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 600
    }
    throw "Readiness timeout: $Url. Inspect .demo/logs (secrets are never intentionally logged)."
}

function Invoke-DemoChecked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Executable" }
}
