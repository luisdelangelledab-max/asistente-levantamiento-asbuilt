$appDir = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Asistente de Levantamiento AsBuilt.lnk"
$iconPath = Join-Path $appDir "assets\app-icon.ico"
$targetPath = Join-Path $appDir "AsistenteLevantamientoASBUILT.exe"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $appDir
$shortcut.Description = "Asistente de Levantamiento AsBuilt - Aplicación AS-BUILT en mm (Rhino 8)"
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath, 0"
}
$shortcut.Save()
Write-Host "Acceso directo creado exitosamente en: $shortcutPath" -ForegroundColor Green
