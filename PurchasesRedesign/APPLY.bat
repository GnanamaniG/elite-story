@echo off
echo ============================================
echo   Purchases - Unified Dashboard
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0PurchasesDashboard.jsx" "%BASE%\src\pages\PurchasesDashboard.jsx"
copy /Y "%~dp0PurchHub.jsx"           "%BASE%\src\pages\PurchHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\PurchasesDashboard.jsx src\pages\PurchHub.jsx
git commit -m "Purchases: unified dashboard with payables tracking and inline payment"
git push origin master
echo Done. Open Purchases.
pause
