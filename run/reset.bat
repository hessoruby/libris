@echo off

cd /d "%~dp0..\backend"
if exist javaapp.db del javaapp.db
echo Done. The database will be created again with sample data when you run run.bat
pause
