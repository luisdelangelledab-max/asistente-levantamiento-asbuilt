@echo off
chcp 65001 >nul
title Detener Asistente de Levantamiento AsBuilt
echo Deteniendo servidor local en puerto 3120...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3120 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo Servidor detenido correctamente.
