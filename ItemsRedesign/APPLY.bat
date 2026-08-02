@echo off
echo ============================================
echo   Items and Products - Unified Dashboard
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ItemsDashboard.jsx" "%BASE%\src\pages\ItemsDashboard.jsx"
copy /Y "%~dp0InvHub.jsx"         "%BASE%\src\pages\InvHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\ItemsDashboard.jsx src\pages\InvHub.jsx
git commit -m "Items and Products: single unified dashboard with KPIs, AI tags, filters"
git push origin master
echo Done. Open Inventory - Products tab.
pause
