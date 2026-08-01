@echo off
echo ============================================
echo   Elite Store Phase 19 - Complete Deploy
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] App.jsx and AppShell.jsx

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
  echo [OK] %%~nxf
)

cd /d "%BASE%"
git add .
git commit -m "Phase 19 - Store Analytics, Purchase Returns, Catalog, Statements, Audit Log"
git push origin master

echo.
echo ============================================
echo  Done! New sidebar items:
echo    - Store Analytics
echo    - Purchase Returns
echo    - Product Catalog
echo    - Cust. Statements
echo    - Audit Log
echo ============================================
pause
