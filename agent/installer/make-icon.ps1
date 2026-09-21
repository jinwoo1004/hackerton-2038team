# 앱 로고(frontend/public/images/logo/logo_mark.png)로 에이전트 아이콘을 만든다
# 출력: installer/Assets/logo_app.ico, src/MonitoringAgent.App/Assets/logo_app.png, logo_app.ico

Add-Type -AssemblyName System.Drawing

$agentRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $agentRoot "..\frontend\public\images\logo\logo_mark.png"
$installerAssets = Join-Path $PSScriptRoot "Assets"
$appAssets = Join-Path $agentRoot "src\MonitoringAgent.App\Assets"
New-Item -ItemType Directory -Force $installerAssets, $appAssets | Out-Null

$logo = [System.Drawing.Image]::FromFile((Resolve-Path $source))

function New-Scaled([int]$size, [double]$inset) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $pad = [int][Math]::Round($size * $inset)
    $g.DrawImage($logo, $pad, $pad, $size - 2 * $pad, $size - 2 * $pad)
    $g.Dispose()
    return $bmp
}

$png = New-Scaled 256 0.04
$png.Save((Join-Path $appAssets "logo_app.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Dispose()

$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$images = @()
foreach ($s in $sizes) {
    $inset = if ($s -le 24) { 0.0 } else { 0.04 }
    $bmp = New-Scaled $s $inset
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $images += ,@{ Size = $s; Bytes = $ms.ToArray() }
    $ms.Dispose(); $bmp.Dispose()
}
$logo.Dispose()

$icoPath = Join-Path $installerAssets "logo_app.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$images.Count)
$offset = 6 + (16 * $images.Count)
foreach ($img in $images) {
    $dim = if ($img.Size -ge 256) { 0 } else { $img.Size }
    $bw.Write([Byte]$dim)
    $bw.Write([Byte]$dim)
    $bw.Write([Byte]0)
    $bw.Write([Byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$img.Bytes.Length)
    $bw.Write([UInt32]$offset)
    $offset += $img.Bytes.Length
}
foreach ($img in $images) { $bw.Write($img.Bytes) }
$bw.Flush(); $bw.Close(); $fs.Close()

Copy-Item $icoPath (Join-Path $appAssets "logo_app.ico") -Force
Write-Output "Created: $icoPath"
