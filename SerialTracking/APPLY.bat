@echo off
echo ============================================
echo   Serial / IMEI Tracking
echo ============================================
echo  RUN 032_serial_tracking.sql IN SUPABASE FIRST!
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0SerialRegistry.jsx"  "%BASE%\src\pages\SerialRegistry.jsx"
copy /Y "%~dp0InvHub.jsx"          "%BASE%\src\pages\InvHub.jsx"
copy /Y "%~dp0POS.jsx"             "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0ItemsDashboard.jsx"  "%BASE%\src\pages\ItemsDashboard.jsx"
copy /Y "%~dp0useOffline.js"       "%BASE%\src\hooks\useOffline.js"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Serial/IMEI tracking: registry, POS unit selection, trace lookup"
git push origin master
echo.
echo  HOW TO USE:
echo   1. Inventory - Products - edit a phone - tick "Track each unit individually"
echo   2. Inventory - Serial / IMEI - Add Serials - paste IMEIs one per line
echo   3. Sell it in POS - it asks which unit you are handing over
echo   4. Later: paste any IMEI into Trace a Unit to see who bought it
pause
