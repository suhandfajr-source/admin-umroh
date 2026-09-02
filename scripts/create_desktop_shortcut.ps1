$desktopPath = [Environment]::GetFolderPath("Desktop")
$targetExe = (Join-Path (Get-Location).Path "desktop\AdminUmroh.exe")
$iconPath = (Join-Path (Get-Location).Path "desktop\app.ico")
$shortcutPath = (Join-Path $desktopPath "Admin Umroh Wahidku.lnk")

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetExe
$Shortcut.WorkingDirectory = (Join-Path (Get-Location).Path "desktop")
$Shortcut.IconLocation = "$iconPath,0"
$Shortcut.Description = "Aplikasi Operasional Admin Jamaah Umroh"
$Shortcut.Save()

Write-Host "Shortcut icon updated successfully at $shortcutPath"
