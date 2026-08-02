@echo off
echo ============================================
echo   Dashboard rebuilt as "Business Pulse"
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0BusinessPulse.jsx"    "%BASE%\src\pages\BusinessPulse.jsx"
copy /Y "%~dp0App.jsx"              "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx"  "%BASE%\src\components\layout\AppShell.jsx"
copy /Y "%~dp0shell\CommandPalette.jsx" "%BASE%\src\components\shell\CommandPalette.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Rebuild Dashboard as Business Pulse: period tabs, AI insight, needs-attention, 4 KPI cards, forecast, sales heatmap"
git push origin master
echo Done. Sidebar now reads "Business Pulse".
pause
