param (
    [string]$ImagePath = "C:\Users\PC WAHIDKU\.gemini\antigravity-ide\brain\72922445-09b8-4760-a6dd-df8d9bca3195\umroh_app_icon_1788335402041.jpg",
    [string]$OutputPath = "c:\Users\PC WAHIDKU\Music\Admin Umroh\desktop\app.ico"
)

Add-Type -AssemblyName System.Drawing

$srcImage = [System.Drawing.Image]::FromFile($ImagePath)
$sizes = @(16, 32, 48, 64, 128, 256)

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

# Icon Header
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type 1 = ICO
$bw.Write([UInt16]$sizes.Count) # Number of images

$imageDataList = @()
$offset = 6 + (16 * $sizes.Count)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImage, 0, 0, $size, $size)
    $g.Dispose()

    $imgStream = New-Object System.IO.MemoryStream
    $bmp.Save($imgStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $imgBytes = $imgStream.ToArray()
    $imageDataList += ,$imgBytes
    $bmp.Dispose()
    $imgStream.Dispose()

    # Directory Entry
    $w = if ($size -ge 256) { 0 } else { [byte]$size }
    $h = if ($size -ge 256) { 0 } else { [byte]$size }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0) # Color palette count
    $bw.Write([byte]0) # Reserved
    $bw.Write([UInt16]1) # Color planes
    $bw.Write([UInt16]32) # Bits per pixel
    $bw.Write([UInt32]$imgBytes.Length)
    $bw.Write([UInt32]$offset)

    $offset += $imgBytes.Length
}

foreach ($imgBytes in $imageDataList) {
    $bw.Write($imgBytes)
}

$srcImage.Dispose()

[System.IO.File]::WriteAllBytes($OutputPath, $ms.ToArray())
$bw.Dispose()
$ms.Dispose()

Write-Host "Icon successfully created at $OutputPath"
