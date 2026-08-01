@echo off
echo ============================================
echo   7SQ Business Platform - Phase 24
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All pages

cd /d "%BASE%"
git add .
git commit -m "Phase 24 - Delivery, Payment Links, Warranty, Task Board, Smart Alerts"
git push origin master

echo.
echo ============================================
echo  Done! New modules:
echo    - Delivery Management
echo    - Payment Links (UPI)
echo    - Warranty Tracker
echo    - Staff Task Board (Kanban)
echo    - Smart Alerts
echo ============================================
pause
