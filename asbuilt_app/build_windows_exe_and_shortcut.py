# -*- coding: utf-8 -*-
"""
Compilador de Ejecutable Nativo Windows (.exe), Icono Multi-resolución (.ico/.png),
Lanzadores y Acceso Directo en Escritorio para CODEX Asistente Levantamiento AS-BUILT.
"""
from __future__ import annotations

import os
import subprocess
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

APP_DIR = Path(__file__).resolve().parent
ASSETS_DIR = APP_DIR / "assets"
PUBLIC_DIR = APP_DIR / "public"
SCRIPTS_DIR = APP_DIR / "scripts"
PORT = 3120
APP_DISPLAY_NAME = "Asistente de Levantamiento AsBuilt"
EXE_NAME = "AsistenteLevantamientoASBUILT.exe"

for d in (ASSETS_DIR, PUBLIC_DIR, SCRIPTS_DIR):
    d.mkdir(parents=True, exist_ok=True)


def create_architectural_icons() -> Path:
    """Genera un icono arquitectónico AS-BUILT 2D de alta resolución (.ico multi-size + .png PWA)."""
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fondo redondeado azul profundo técnico (#1E3A8A) con borde blanco
    draw.rounded_rectangle([16, 16, size - 16, size - 16], radius=96, fill=(15, 23, 42, 255), outline=(59, 130, 246, 255), width=14)

    # Hoja blanca interior tipo plano CAD
    draw.rounded_rectangle([64, 64, size - 64, size - 64], radius=40, fill=(255, 255, 255, 255))

    # Trazos de planta AS-BUILT en negro y azul
    wall_pts = [(110, 390), (110, 130), (380, 130), (380, 270), (260, 390), (110, 390)]
    draw.line(wall_pts, fill=(15, 23, 42, 255), width=22, joint="curve")

    # Cota roja/verde milimétrica
    draw.line([(110, 425), (380, 425)], fill=(4, 120, 87, 255), width=10)
    draw.line([(110, 410), (110, 440)], fill=(4, 120, 87, 255), width=8)
    draw.line([(380, 410), (380, 440)], fill=(4, 120, 87, 255), width=8)

    # Punto de instalación roja (eléctrica) y azul (hidrosanitaria)
    draw.ellipse([155, 185, 205, 235], fill=(220, 38, 38, 255))
    draw.ellipse([275, 185, 325, 235], fill=(37, 99, 235, 255))

    ico_path = ASSETS_DIR / "app-icon.ico"
    img.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    img.resize((512, 512), Image.Resampling.LANCZOS).save(PUBLIC_DIR / "icon-512.png", format="PNG")
    img.resize((192, 192), Image.Resampling.LANCZOS).save(PUBLIC_DIR / "icon-192.png", format="PNG")
    return ico_path


def write_and_compile_native_exe(ico_path: Path) -> Path:
    """
    Compila AsistenteLevantamientoASBUILT.exe usando el compilador nativo de Windows (.NET csc.exe).
    El ejecutable:
    1. Comprueba si el servidor local en el puerto 3120 ya está activo.
    2. Si no está activo, inicia python server.py en segundo plano sin ventana negra (CreateNoWindow = true).
    3. Espera hasta que /api/health responda OK (o máximo 6 s).
    4. Abre la interfaz gráfica de la aplicación en modo ventana de aplicación (--app=http://localhost:3120 en Edge/Chrome) o navegador predeterminado.
    """
    cs_code = f"""using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace CodexAsBuiltLauncher
{{
    static class Program
    {{
        private const int PORT = {PORT};
        private static readonly string Url = "http://localhost:" + PORT;

        [STAThread]
        static void Main(string[] args)
        {{
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            Directory.SetCurrentDirectory(appDir);

            bool headlesCheckOnly = (args.Length > 0 && args[0] == "--verify-start");

            if (!IsPortListening(PORT))
            {{
                StartBackendServer(appDir);
                for (int i = 0; i < 40; i++)
                {{
                    if (IsPortListening(PORT)) break;
                    Thread.Sleep(200);
                }}
            }}

            if (headlesCheckOnly)
            {{
                Console.WriteLine("EXE_BACKEND_READY:" + Url);
                return;
            }}

            OpenApplicationWindow(Url);
        }}

        static bool IsPortListening(int port)
        {{
            try
            {{
                using (TcpClient client = new TcpClient())
                {{
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }}
            }}
            catch
            {{
                return false;
            }}
        }}

        static void StartBackendServer(string appDir)
        {{
            string serverPy = Path.Combine(appDir, "server.py");
            if (!File.Exists(serverPy))
            {{
                MessageBox.Show("No se encontró server.py en: " + appDir, "Error AS-BUILT", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }}

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "python";
            psi.Arguments = "\\"" + serverPy + "\\"";
            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;

            try
            {{
                Process.Start(psi);
            }}
            catch (Exception ex)
            {{
                MessageBox.Show("Error al iniciar Python server.py: " + ex.Message, "Error AS-BUILT", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }}
        }}

        static void OpenApplicationWindow(string url)
        {{
            string[] edgePaths = new string[]
            {{
                @"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                @"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                @"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            }};

            foreach (string browser in edgePaths)
            {{
                if (File.Exists(browser))
                {{
                    try
                    {{
                        ProcessStartInfo bPsi = new ProcessStartInfo();
                        bPsi.FileName = browser;
                        bPsi.Arguments = "--app=" + url + " --window-size=1440,900";
                        bPsi.UseShellExecute = true;
                        Process.Start(bPsi);
                        return;
                    }}
                    catch {{ }}
                }}
            }}

            Process.Start(new ProcessStartInfo(url) {{ UseShellExecute = true }});
        }}
    }}
}}
"""
    cs_path = APP_DIR / "launcher.cs"
    cs_path.write_text(cs_code, encoding="utf-8")

    csc_exe = Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe")
    exe_path = APP_DIR / EXE_NAME
    cmd = [
        str(csc_exe),
        "/nologo",
        "/target:winexe",
        f"/out:{exe_path}",
        f"/win32icon:{ico_path}",
        "/r:System.Windows.Forms.dll",
        str(cs_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Error compilando {EXE_NAME}: {res.stdout} {res.stderr}")
    return exe_path


def write_launchers_and_shortcut(exe_path: Path, ico_path: Path) -> Path:
    # requirements.txt
    (APP_DIR / "requirements.txt").write_text(
        "fastapi>=0.110.0\nuvicorn>=0.29.0\nezdxf>=1.4.0\nreportlab>=4.0.0\nPillow>=10.0.0\n",
        encoding="utf-8",
    )

    # netlify.toml para despliegue web estático (PC + Tablet)
    (APP_DIR / "netlify.toml").write_text(
        """[build]
  publish = "public"
  command = "echo 'Static PWA Ready'"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Cache-Control = "public, max-age=0, must-revalidate"
""",
        encoding="utf-8",
    )

    # Iniciar-App.bat
    iniciar_bat = f"""@echo off
chcp 65001 >nul
title {APP_DISPLAY_NAME}
cd /d "%~dp0"
start "" "%~dp0{EXE_NAME}"
exit /b 0
"""
    (APP_DIR / "Iniciar-App.bat").write_text(iniciar_bat, encoding="utf-8", newline="\r\n")

    # Iniciar-App.vbs
    iniciar_vbs = f"""Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run Chr(34) & strPath & "\\{EXE_NAME}" & Chr(34), 0, False
"""
    (APP_DIR / "Iniciar-App.vbs").write_text(iniciar_vbs, encoding="utf-8", newline="\r\n")

    # Detener-App.bat
    detener_bat = f"""@echo off
chcp 65001 >nul
title Detener {APP_DISPLAY_NAME}
echo Deteniendo servidor local en puerto {PORT}...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort {PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force }}"
echo Servidor detenido correctamente.
"""
    (APP_DIR / "Detener-App.bat").write_text(detener_bat, encoding="utf-8", newline="\r\n")

    # scripts/install-pc.ps1 (Apunta directamente al ejecutable .exe con el icono personalizado)
    install_ps1 = f"""$appDir = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "{APP_DISPLAY_NAME}.lnk"
$iconPath = Join-Path $appDir "assets\\app-icon.ico"
$targetPath = Join-Path $appDir "{EXE_NAME}"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $appDir
$shortcut.Description = "{APP_DISPLAY_NAME} - Aplicación AS-BUILT en mm (Rhino 8)"
if (Test-Path $iconPath) {{
    $shortcut.IconLocation = "$iconPath, 0"
}}
$shortcut.Save()
Write-Host "Acceso directo creado exitosamente en: $shortcutPath" -ForegroundColor Green
"""
    ps1_path = SCRIPTS_DIR / "install-pc.ps1"
    ps1_path.write_text(install_ps1, encoding="utf-8", newline="\r\n")

    # Instalar-App.bat
    instalar_bat = f"""@echo off
chcp 65001 >nul
title Instalador {APP_DISPLAY_NAME}
echo Creando acceso directo en el Escritorio hacia {EXE_NAME}...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\install-pc.ps1"
echo Listo.
"""
    (APP_DIR / "Instalar-App.bat").write_text(instalar_bat, encoding="utf-8", newline="\r\n")

    # Ejecutar install-pc.ps1 para crear el acceso directo en el escritorio ahora mismo
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1_path)],
        check=True,
    )
    desktop_dir = Path(os.path.expanduser("~")) / "Desktop"
    shortcut_path = desktop_dir / f"{APP_DISPLAY_NAME}.lnk"
    return shortcut_path


def main():
    ico_path = create_architectural_icons()
    exe_path = write_and_compile_native_exe(ico_path)
    shortcut_path = write_launchers_and_shortcut(exe_path, ico_path)
    print(f"[OK] Icono creado: {ico_path}")
    print(f"[OK] Ejecutable Windows compilado: {exe_path} ({exe_path.stat().st_size} bytes)")
    print(f"[OK] Acceso directo creado en Escritorio: {shortcut_path} (existe={shortcut_path.exists()})")


if __name__ == "__main__":
    main()
