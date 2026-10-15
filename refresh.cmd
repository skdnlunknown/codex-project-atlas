@echo off
cd /d "%~dp0"
node src\cli.mjs refresh
if errorlevel 1 (pause & exit /b 1)
start "" ".local\index.html"
