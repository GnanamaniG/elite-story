@echo off
echo ============================================
echo   Elite Store Phase 23 - Complete Deploy
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
git commit -m "Phase 23 - EOD Report, Staff Scheduler, Supplier RFQ, Loyalty Tiers, AI Analytics"
git push origin master

echo.
echo ============================================
echo  Done! New sidebar items:
echo    - EOD Report
echo    - Staff Scheduler
echo    - Supplier RFQ
echo    - Loyalty Tiers
echo    - AI Analytics
echo ============================================
pause
