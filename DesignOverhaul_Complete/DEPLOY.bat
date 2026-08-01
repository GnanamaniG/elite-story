@echo off
echo ============================================
echo   Elite Store - BizFlow Design + Grouped Sidebar
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files updated

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All 92 pages updated

cd /d "%BASE%"
git add .
git commit -m "Design overhaul - BizFlow design + grouped sidebar (9 sections)"
git push origin master

echo.
echo ============================================
echo  Sidebar groups:
echo    Core (8 items - no header)
echo    Finance ^& GST
echo    Sales Documents
echo    Inventory ^& Purchasing
echo    Customers ^& Loyalty
echo    Marketing
echo    HR ^& Payroll
echo    Operations
echo    Tools ^& Admin
echo    Settings
echo ============================================
pause
