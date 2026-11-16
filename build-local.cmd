@echo off
setlocal enabledelayedexpansion

echo Building YouTube Aura locally (LG OLED55B7V / webOS 3)...
echo.

:: Check if node_modules exists. If not, run npm install (faster than ci)
if not exist "node_modules\" (
    echo [1/4] Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
) else (
    echo [1/4] Dependencies already installed. Skipping...
)

echo [2/4] Testing and building...
call npm test
if !errorlevel! neq 0 (
    echo ERROR: npm test failed
    echo Press any key to close...
    pause >nul
    exit /b 1
)

echo [3/4] Creating the .ipk package...
call npm run package
if !errorlevel! neq 0 (
    echo ERROR: npm run package failed
    echo Press any key to close...
    pause >nul
    exit /b 1
)

echo [4/4] Copying userScript.js to the clipboard...
echo        (for pasting into the TV's web inspector while debugging)

SET "SOURCE_FILE=dist\webOSUserScripts\userScript.js"

IF EXIST "%SOURCE_FILE%" (
    powershell.exe -NoProfile -Command "[System.IO.File]::ReadAllText('%SOURCE_FILE%') | Set-Clipboard"
    echo Success! userScript.js contents copied to clipboard.
) ELSE (
    echo ERROR: Could not find userScript.js at %SOURCE_FILE%
)

echo.
for %%f in (dist\*.ipk) do echo Package: %%f
echo Build complete!
pause
