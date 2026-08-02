@echo off
echo ============================================
echo   7SQ - Desktop App Installation (PWA)
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"           "%BASE%\index.html"
copy /Y "%~dp0App.jsx"              "%BASE%\src\App.jsx"
copy /Y "%~dp0public\manifest.json" "%BASE%\public\manifest.json"
copy /Y "%~dp0public\sw.js"         "%BASE%\public\sw.js"
copy /Y "%~dp0public\icon-192.png"          "%BASE%\public\icon-192.png"
copy /Y "%~dp0public\icon-512.png"          "%BASE%\public\icon-512.png"
copy /Y "%~dp0public\icon-512-maskable.png" "%BASE%\public\icon-512-maskable.png"
copy /Y "%~dp0public\apple-touch-icon.png"  "%BASE%\public\apple-touch-icon.png"
copy /Y "%~dp0public\favicon-32.png"        "%BASE%\public\favicon-32.png"
copy /Y "%~dp0public\favicon-16.png"        "%BASE%\public\favicon-16.png"

cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "PWA: real icons, corrected manifest, service worker registration - enables Install as desktop app"
git push origin master

echo.
echo ============================================
echo  TO INSTALL ON DESKTOP (after deploy):
echo   Chrome/Edge: open elite-story.vercel.app
echo   Look for the install icon (a screen with a
echo   down arrow) at the right of the address bar
echo   Click it - Install 7SQ Business Platform
echo   It opens in its own window with a taskbar
echo   icon, same as any other installed app.
echo.
echo   On Windows, you can also pin it to Start
echo   after installing, right-click the taskbar
echo   icon - Pin to Start / Pin to taskbar.
echo ============================================
pause
