@echo off
chcp 65001 >nul
title Instalador Asistente de Levantamiento AsBuilt
echo Creando acceso directo en el Escritorio hacia AsistenteLevantamientoASBUILT.exe...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-pc.ps1"
echo Listo.
