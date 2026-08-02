@echo off
echo ============================================
echo   Fix: 4 KPI cards on one row
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0BusinessPulse.jsx" "%BASE%\src\pages\BusinessPulse.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\BusinessPulse.jsx
git commit -m "Business Pulse: force 4 KPI cards onto one row on desktop"
git push origin master
echo Done.
pause
