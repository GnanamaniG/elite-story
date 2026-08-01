@echo off
echo ============================================
echo   Elite Store Phase 22 - FINAL Fixed Deploy
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
git commit -m "Phase 22 FINAL - Partnership, TDS, Demand Forecast, Accounting, Reorder"
git push origin master

echo.
echo ============================================
echo  Done! New sidebar items:
echo    - Partnership Accounts
echo    - TDS Management
echo    - Demand Forecast
echo    - Accounting
echo    - Reorder Management
echo ============================================
pause
