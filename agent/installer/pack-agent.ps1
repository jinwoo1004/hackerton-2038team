<#
.SYNOPSIS
  Monitoring Agent 를 단일 EXE 설치 파일로 만든다.
  1) 서비스(Worker)를 단일 EXE 로 게시해 App 리소스로 넣고
  2) App 을 단일 EXE 로 게시한 뒤
  3) dist\MonitoringAgentSetup.exe 로 이름을 바꾼다.
  백엔드는 기본으로 ../agent/dist/MonitoringAgentSetup.exe 를 내려준다.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer/pack-agent.ps1
#>
param(
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

$agentRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = Join-Path $agentRoot "dist" }
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    $env:Path = "C:\Program Files\dotnet;" + $env:Path
}

$workerProj = Join-Path $agentRoot "src\MonitoringAgent.Worker\MonitoringAgent.Worker.csproj"
$appProj = Join-Path $agentRoot "src\MonitoringAgent.App\MonitoringAgent.App.csproj"
$workerOut = Join-Path $agentRoot "publish-worker"
$appOut = Join-Path $agentRoot "publish-app"

Write-Host "서비스 게시 중..." -ForegroundColor Cyan
dotnet publish $workerProj -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=None `
    -o $workerOut | Out-Null
if ($LASTEXITCODE -ne 0) { throw "서비스 게시 실패 (exit $LASTEXITCODE)" }

$resDir = Join-Path $agentRoot "src\MonitoringAgent.App\Resources\worker"
New-Item -ItemType Directory -Force $resDir | Out-Null
Copy-Item (Join-Path $workerOut "MonitoringAgentService.exe") (Join-Path $resDir "MonitoringAgentService.exe") -Force

Write-Host "설치 프로그램 게시 중..." -ForegroundColor Cyan
dotnet publish $appProj -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=None `
    -o $appOut | Out-Null
if ($LASTEXITCODE -ne 0) { throw "설치 프로그램 게시 실패 (exit $LASTEXITCODE)" }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$setup = Join-Path $OutDir "MonitoringAgentSetup.exe"
Copy-Item (Join-Path $appOut "MonitoringAgentApp.exe") $setup -Force

Remove-Item $resDir -Recurse -Force
Remove-Item $workerOut, $appOut -Recurse -Force

Write-Host "완료: $setup" -ForegroundColor Green
Get-Item $setup | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}}, FullName | Format-List
