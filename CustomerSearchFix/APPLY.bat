@echo off
echo ============================================
echo   Fix: Customer search by name and phone
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx"              "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0PartiesDashboard.jsx" "%BASE%\src\pages\PartiesDashboard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx src\pages\PartiesDashboard.jsx
git commit -m "Fix: customer search matches phone regardless of formatting, guards null names"
git push origin master
echo Done.
pause
