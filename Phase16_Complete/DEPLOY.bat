@echo off
echo ============================================
echo   Elite Store Phase 16 - Complete Deploy
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

echo Copying App.jsx and AppShell.jsx...
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] App.jsx
echo [OK] AppShell.jsx

echo.
echo Copying all page files...
for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
  echo [OK] %%~nxf
)

echo.
echo Pushing to Vercel...
cd /d "%BASE%"
git add .
git commit -m "Phase 16 - Tally Export, Leave Mgmt, SMS Alerts, Vendor Portal, Service Bays"
git push origin master

echo.
echo ============================================
echo  Done! Check sidebar for new items:
echo    - Tally Export
echo    - Leave Management
echo    - SMS Alerts
echo    - Vendor Portal
echo    - Service Bays
echo ============================================
pause
