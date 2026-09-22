#requires -Version 7.4
# Execute the real preparation function with build/process operations replaced by in-memory stubs.
# Do not invoke the launcher's main block, change running applications, or issue model requests.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'demo.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Launcher syntax failed.' }
$definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Prepare-Demo'},$true)
. ([ScriptBlock]::Create($definition.Extent.Text))
function Get-DemoRecords { return @() }
function Find-DemoExecutable { return 'C:/synthetic/node.exe' }
function Write-DemoJson {}
function Invoke-DemoChecked([string]$Executable,[string[]]$Arguments) {
    if ($Arguments[0] -eq 'run') {
        $script:snapshots.Add(@{mode=$env:NEXT_PUBLIC_DATA_MODE;api=$env:NEXT_PUBLIC_API_BASE_URL;directory=$env:NEXT_BUILD_DIR})
        if ($script:failBuild -and $script:snapshots.Count -eq 2) { throw 'synthetic-build-failure' }
    }
}
$variables=@('NEXT_PUBLIC_DATA_MODE','NEXT_PUBLIC_API_BASE_URL','NEXT_BUILD_DIR','NEXT_TELEMETRY_DISABLED')
$original=@{}
foreach ($key in $variables) { $original[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
$Offline=$false; $runtime='unused'; $Mode='Frontend'; $backendBase='http://localhost:18080'
$BackendPort=18080; $FrontendPort=13200; $ServicePort=18000; $readyFile='unused'; $checks=0
try {
    foreach ($present in @($false,$true)) {
        foreach ($script:failBuild in @($false,$true)) {
            foreach ($key in $variables) {
                if ($present) { [Environment]::SetEnvironmentVariable($key,'synthetic-prior-value','Process') }
                else { Remove-Item -LiteralPath ("Env:"+$key) -ErrorAction SilentlyContinue }
            }
            $script:snapshots=[Collections.Generic.List[object]]::new(); $failed=$false
            try { Prepare-Demo 6>$null }
            catch { if ($_.Exception.Message -ne 'synthetic-build-failure') { throw }; $failed=$true }
            if ($failed -ne $script:failBuild -or $script:snapshots.Count -ne 2) { throw 'Unexpected synthetic build result.' }
            $full=$script:snapshots[0]; $frontend=$script:snapshots[1]
            if ($full.mode -ne 'api' -or $full.api -ne $backendBase -or $full.directory -ne '.next-demo-full') { throw 'Full build selection failed.' }
            if ($frontend.mode -ne 'mock' -or $frontend.api -ne '' -or $frontend.directory -ne '.next-demo-frontend') { throw 'Frontend build selection failed.' }
            foreach ($key in $variables) {
                $expected=if ($present) {'synthetic-prior-value'} else {$null}
                if ([Environment]::GetEnvironmentVariable($key,'Process') -cne $expected) { throw 'Caller frontend environment was not restored.' }
            }
            $checks++
        }
    }
    $assignments=$ast.FindAll({param($node)
        $node -is [Management.Automation.Language.AssignmentStatementAst] -and
        $node.Left -is [Management.Automation.Language.VariableExpressionAst] -and
        $node.Left.VariablePath.UserPath -in @('env:NEXT_PUBLIC_DATA_MODE','env:NEXT_PUBLIC_API_BASE_URL','env:NEXT_BUILD_DIR') -and
        $node.Extent.Text -cmatch '\$Mode\b'
    },$true)
    if ($assignments.Count -ne 3) { throw 'Expected three runtime frontend settings.' }
    foreach ($Mode in @('Full','Frontend')) {
        foreach ($assignment in $assignments) { . ([ScriptBlock]::Create($assignment.Extent.Text)) }
        if ($Mode -eq 'Full') {
            if ($env:NEXT_PUBLIC_DATA_MODE -ne 'api' -or $env:NEXT_PUBLIC_API_BASE_URL -ne $backendBase -or $env:NEXT_BUILD_DIR -ne '.next-demo-full') { throw 'Full runtime settings failed.' }
        } elseif ($env:NEXT_PUBLIC_DATA_MODE -ne 'mock' -or $env:NEXT_PUBLIC_API_BASE_URL -ne '' -or $env:NEXT_BUILD_DIR -ne '.next-demo-frontend') { throw 'Frontend runtime settings failed.' }
        $checks++
    }
    Write-Host "PASS $checks data-mode/environment restoration contracts; no builds, subprocesses, network, or AI calls."
} finally {
    foreach ($key in $variables) {
        if ($null -eq $original[$key]) { Remove-Item -LiteralPath ("Env:"+$key) -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($key,$original[$key],'Process') }
    }
}
