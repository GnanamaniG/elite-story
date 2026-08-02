@echo off
echo ============================================
echo   Inventory Page - Performance Optimization
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ItemsDashboard.jsx" "%BASE%\src\pages\ItemsDashboard.jsx"
copy /Y "%~dp0InvHub.jsx"         "%BASE%\src\pages\InvHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\ItemsDashboard.jsx src\pages\InvHub.jsx
git commit -m "Optimize Items dashboard: memoized KPIs, bounded sales query, debounced search, paginated rows, responsive KPI grid, working quick actions"
git push origin master
echo Done.
pause
