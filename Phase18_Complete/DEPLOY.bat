@echo off
echo ============================================
echo   Elite Store Phase 18 - Complete Deploy
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
git commit -m "Phase 18 - Expense Claims, Credit Notes, Barcode Gen, Cash Flow, WA Templates"
git push origin master

echo.
echo ============================================
echo  Done! New sidebar items:
echo    - Expense Claims
echo    - Credit Notes
echo    - Barcode Generator
echo    - Cash Flow Forecast
echo    - WA Templates
echo ============================================
pause
