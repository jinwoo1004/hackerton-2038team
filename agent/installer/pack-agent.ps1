#requires -Version 7.0
<#
.SYNOPSIS
  Test and publish a self-contained win-x64 setup EXE without installing or starting it.
.EXAMPLE
  pwsh -NoProfile -File installer/pack-agent.ps1
#>
[CmdletBinding()]
param([string]$OutDir = '')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$agentRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\','/')
$distRoot = Join-Path $agentRoot 'dist'

function Assert-AgentBuildPath([string]$Path,[string]$AllowedRoot,[switch]$AllowRoot) {
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\','/')
    $allowed = [IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\','/')
    if (-not $allowed.StartsWith($agentRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Build root must be inside the agent workspace.' }
    if (-not (($AllowRoot -and $full.Equals($allowed,[StringComparison]::OrdinalIgnoreCase)) -or $full.StartsWith($allowed + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))) { throw 'Refusing a path outside the intended agent build output.' }
    $cursor = $full
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Build paths must not pass through a symbolic link or junction.' }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
    return $full
}

function Remove-AgentBuildDirectory([string]$Path) {
    $checked = Assert-AgentBuildPath $Path $staging -AllowRoot
    if (-not (Test-Path -LiteralPath $checked)) { return }
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($checked)
    while ($pending.Count) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $pending.Pop() -Force)) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing cleanup of a build tree containing a symbolic link or junction.' }
            if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
        }
    }
    Remove-Item -LiteralPath $checked -Recurse -Force
}

function Invoke-AgentDotnet([string[]]$Arguments) {
    & $dotnet @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Agent build failed (dotnet exit $LASTEXITCODE)." }
}

if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = $distRoot }
elseif (-not [IO.Path]::IsPathFullyQualified($OutDir)) { $OutDir = Join-Path $agentRoot $OutDir }
$OutDir = Assert-AgentBuildPath $OutDir $distRoot -AllowRoot
$staging = Join-Path $agentRoot ('.package-build-' + [Guid]::NewGuid().ToString('N'))
$staging = Assert-AgentBuildPath $staging $staging -AllowRoot
$resourceRoot = Join-Path $agentRoot 'src/MonitoringAgent.App/Resources/worker'
$resourceRoot = Assert-AgentBuildPath $resourceRoot $resourceRoot -AllowRoot
$resourceFile = Assert-AgentBuildPath (Join-Path $resourceRoot 'MonitoringAgentService.exe') $resourceRoot
$resourceExisted = Test-Path -LiteralPath $resourceFile
$resourceDirectoryExisted = Test-Path -LiteralPath $resourceRoot
$resourceWritten = $false
$dotnetCommand = Get-Command dotnet.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$dotnet = $(if ($dotnetCommand) { $dotnetCommand.Source } else { $null })
foreach ($candidate in @((Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dotnet/dotnet.exe'),'C:/Program Files/dotnet/dotnet.exe')) {
    if (-not $dotnet -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { $dotnet = $candidate }
}
if (-not $dotnet) { throw 'Install the .NET 8 SDK or put dotnet.exe on PATH.' }
$workerProject = Join-Path $agentRoot 'src/MonitoringAgent.Worker/MonitoringAgent.Worker.csproj'
$appProject = Join-Path $agentRoot 'src/MonitoringAgent.App/MonitoringAgent.App.csproj'
$testProject = Join-Path $agentRoot 'tests/MonitoringAgent.Tests/MonitoringAgent.Tests.csproj'
$workerOut = Join-Path $staging 'worker'
$appOut = Join-Path $staging 'app'
$artifacts = Join-Path $staging 'artifacts'
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    if ($resourceExisted) { Copy-Item -LiteralPath $resourceFile -Destination (Join-Path $staging 'original-worker.exe') }
    Write-Host 'Testing agent source using isolated build outputs...'
    Invoke-AgentDotnet @('test',$testProject,'-c','Release','--artifacts-path',$artifacts,'--nologo')
    $publishOptions = @('-c','Release','-r','win-x64','--self-contained','true','--artifacts-path',$artifacts,'--nologo','-p:PublishSingleFile=true','-p:IncludeNativeLibrariesForSelfExtract=true','-p:EnableCompressionInSingleFile=true','-p:DebugType=None','-p:DebugSymbols=false')
    Write-Host 'Publishing self-contained worker...'
    Invoke-AgentDotnet (@('publish',$workerProject) + $publishOptions + @('-o',$workerOut))
    $workerExe = Join-Path $workerOut 'MonitoringAgentService.exe'
    if (-not (Test-Path -LiteralPath $workerExe -PathType Leaf)) { throw 'Worker single-file output is missing.' }
    [void](Assert-AgentBuildPath $resourceFile $resourceRoot)
    New-Item -ItemType Directory -Path $resourceRoot -Force | Out-Null
    $resourceWritten = $true
    Copy-Item -LiteralPath $workerExe -Destination $resourceFile -Force
    Write-Host 'Publishing self-contained installer with embedded worker...'
    Invoke-AgentDotnet (@('publish',$appProject) + $publishOptions + @('-o',$appOut))
    $publishedExe = Join-Path $appOut 'MonitoringAgentApp.exe'
    if (-not (Test-Path -LiteralPath $publishedExe -PathType Leaf)) { throw 'Installer single-file output is missing.' }
    foreach ($directory in @($workerOut,$appOut)) {
        $unexpected = @(Get-ChildItem -LiteralPath $directory -File -Recurse | Where-Object { $_.Name -match '(?i)(^auth\.json$|^agent\.json$|^\.env($|\.)|credential|secret)' })
        if ($unexpected.Count) { throw 'Private configuration names appeared in publish output; package was not copied to dist.' }
    }
    $appAssembly = Get-ChildItem -LiteralPath (Join-Path $artifacts 'bin') -Filter 'MonitoringAgentApp.dll' -File -Recurse | Select-Object -First 1
    if (-not $appAssembly) { throw 'Installer assembly metadata is missing.' }
    # Read resources only: never invoke an assembly entry point or run the setup EXE.
    $assembly = [Reflection.Assembly]::Load([IO.File]::ReadAllBytes($appAssembly.FullName))
    $embeddedWorker = $assembly.GetManifestResourceStream('MonitoringAgentService.exe')
    if (-not $embeddedWorker) { throw 'Installer does not contain the worker executable.' }
    try {
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { $embeddedHash = [BitConverter]::ToString($hasher.ComputeHash($embeddedWorker)).Replace('-','') } finally { $hasher.Dispose() }
        if ($embeddedHash -cne (Get-FileHash -LiteralPath $workerExe -Algorithm SHA256).Hash) { throw 'Embedded worker does not match the published service.' }
    } finally { $embeddedWorker.Dispose() }
    Write-Host 'PASS embedded worker SHA256 matches the published service.'
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $setup = Assert-AgentBuildPath (Join-Path $OutDir 'MonitoringAgentSetup.exe') $distRoot
    Copy-Item -LiteralPath $publishedExe -Destination $setup -Force
    $digest = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifest = Assert-AgentBuildPath (Join-Path $OutDir 'SHA256SUMS') $distRoot
    [IO.File]::WriteAllText($manifest,$digest + '  MonitoringAgentSetup.exe' + [Environment]::NewLine,[Text.Encoding]::ASCII)
    $file = Get-Item -LiteralPath $setup
    [pscustomobject]@{Name=$file.Name;Bytes=$file.Length;MiB=[math]::Round($file.Length/1MB,2);SHA256=$digest;Signature=(Get-AuthenticodeSignature -LiteralPath $setup).Status.ToString()} | Format-List
    Write-Host 'Packaging completed. The setup EXE was not executed or installed.'
} finally {
    if ($resourceWritten) {
        [void](Assert-AgentBuildPath $resourceFile $resourceRoot)
        if ($resourceExisted) { Copy-Item -LiteralPath (Join-Path $staging 'original-worker.exe') -Destination $resourceFile -Force }
        elseif (Test-Path -LiteralPath $resourceFile) { Remove-Item -LiteralPath $resourceFile -Force }
    }
    if (-not $resourceDirectoryExisted -and (Test-Path -LiteralPath $resourceRoot) -and @(Get-ChildItem -LiteralPath $resourceRoot -Force).Count -eq 0) {
        [void](Assert-AgentBuildPath $resourceRoot $resourceRoot -AllowRoot)
        Remove-Item -LiteralPath $resourceRoot -Force
    }
    Remove-AgentBuildDirectory $staging
}
