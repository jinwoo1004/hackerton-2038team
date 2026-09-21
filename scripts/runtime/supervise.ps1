param([Parameter(Mandatory)][string]$Config)
. (Join-Path $PSScriptRoot 'common.ps1')
$settings = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtime = Assert-DemoPath $root $settings.runtimeDir
$journal = Join-Path $runtime ($settings.name + '.processes.json')
$records = @((Get-DemoIdentity $PID))
Write-DemoJson $journal $records
$child = $null
try {
    $argumentLine = (@($settings.arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $child = Start-Process -FilePath $settings.executable -ArgumentList $argumentLine -WorkingDirectory $settings.workingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput $settings.stdout -RedirectStandardError $settings.stderr
    $records += Get-DemoIdentity $child.Id
    Write-DemoJson $journal $records
    while (-not (Test-Path -LiteralPath (Join-Path $runtime 'stop.flag'))) {
        $processes = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId -ErrorAction SilentlyContinue)
        $known = @($records | Where-Object { Test-DemoIdentity $_ } | ForEach-Object { [int]$_.pid })
        do {
            $new = @($processes | Where-Object { $_.ParentProcessId -in $known -and $_.ProcessId -notin $known })
            foreach ($p in $new) {
                $identity = Get-DemoIdentity ([int]$p.ProcessId)
                if ($identity) { $records += $identity; $known += [int]$identity.pid }
            }
        } while ($new.Count -gt 0)
        Write-DemoJson $journal $records
        $child.Refresh()
        if ($child.HasExited) { break }
        Start-Sleep -Milliseconds 750
    }
} finally {
    foreach ($record in @($records | Sort-Object { [long]$_.started } -Descending)) {
        if ([int]$record.pid -ne $PID -and (Test-DemoIdentity $record)) {
            Stop-Process -Id ([int]$record.pid) -Force -ErrorAction SilentlyContinue
        }
    }
}
