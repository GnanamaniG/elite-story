@echo off
echo ============================================
echo   Elite Store - Premium White/Red Design
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All pages updated

cd /d "%BASE%"
git add .
git commit -m "Premium white/red design - maroon sidebar, consolidated hub pages"
git push origin master

echo.
echo ============================================
echo  Done! Premium design applied:
echo    White background + Red/Maroon theme
echo    Consolidated sidebar (18 items)
echo    Hub pages with tab navigation:
echo      Inventory (8 tabs)
echo      Sales (5 tabs)
echo      Customers (7 tabs)
echo      Purchases (5 tabs)
echo      HR ^& Payroll (8 tabs)
echo      GST ^& Tax (5 tabs)
echo      Accounting (5 tabs)
echo      Loyalty ^& CRM (6 tabs)
echo      Marketing (9 tabs)
echo      Operations (10 tabs)
echo      AI Tools (2 tabs)
echo      Tools ^& Admin (8 tabs)
echo ============================================
pause
