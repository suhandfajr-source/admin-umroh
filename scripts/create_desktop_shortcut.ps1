$desktopPath = [Environment]::GetFolderPath("Desktop")
$targetExe = (Join-Path (Get-Location).Path "desktop\AdminUmroh.exe")
$shortcutPath = (Join-Path $desktopPath "Admin Umroh Wahidku.lnk")

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetExe
$Shortcut.WorkingDirectory = (Join-Path (Get-Location).Path "desktop")
$Shortcut.Description = "Aplikasi Operasional Admin Jamaah Umroh"
$Shortcut.Save()

Write-Host "Shortcut created successfully at $shortcutPath"
