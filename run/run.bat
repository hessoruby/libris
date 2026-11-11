@echo off

cd /d "%~dp0..\backend"

echo Compiling the Java files in src ...
javac -d classes src\*.java
if errorlevel 1 (
    echo Compile failed. Read the error above.
    pause
    exit /b 1
)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8080"

java -cp "sqlite-jdbc-3.49.1.0.jar;classes" JavaApp
pause
