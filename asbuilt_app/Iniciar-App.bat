@echo off
chcp 65001 >nul
title Asistente de Levantamiento AsBuilt
cd /d "%~dp0"
start "" "%~dp0AsistenteLevantamientoASBUILT.exe"
exit /b 0
