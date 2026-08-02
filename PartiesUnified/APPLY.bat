@echo off
echo ============================================
echo   Customers + Suppliers - Unified Parties Page
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0PartiesDashboard.jsx" "%BASE%\src\pages\PartiesDashboard.jsx"
copy /Y "%~dp0CustHub.jsx"          "%BASE%\src\pages\CustHub.jsx"
copy /Y "%~dp0PurchHub.jsx"         "%BASE%\src\pages\PurchHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\PartiesDashboard.jsx src\pages\CustHub.jsx src\pages\PurchHub.jsx
git commit -m "Unify Customers and Suppliers into one Parties dashboard with toggle"
git push origin master
echo Done. Open Customers or Purchases - Suppliers, same unified page either way.
pause
