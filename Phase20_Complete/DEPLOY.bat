@echo off
echo ============================================
echo   Elite Store Phase 20 - Complete Deploy
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
git commit -m "Phase 20 - Quotations, EMI, Commissions, Quality Control, e-Way Bill"
git push origin master

echo.
echo ============================================
echo  Done! New sidebar items:
echo    - Quotations
echo    - EMI / BNPL
echo    - Commissions
echo    - Quality Control
echo    - e-Way Bill
echo ============================================
pause
