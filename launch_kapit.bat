@echo off
title Kapit 0.1 - HVAC Engineering & Carrier HAP 6.4 Alternative
cd /d "%~dp0"

echo ========================================================
echo               KAPIT 0.1 - DESKTOP LAUNCHER
echo   ASHRAE Heat Balance - Carrier HAP 6.4 Replacement
echo ========================================================
echo.
echo Iniciando o servidor de calculo e interface nativa...
echo.

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python kapit_desktop.py
    goto end
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py -3 kapit_desktop.py
    goto end
)

echo [ERRO] Python nao foi encontrado no PATH do Windows.
echo Por favor, instale o Python 3.10+ ou adicione o Python ao PATH do sistema.
echo.
pause

:end
