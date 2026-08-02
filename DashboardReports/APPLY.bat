@echo off
echo ============================================
echo   Dashboard - Reports Section
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0Dashboard.jsx" "%BASE%\src\pages\Dashboard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\Dashboard.jsx
git commit -m "Dashboard: reports section on same page, reusing existing fetch"
git push origin master
echo Done. Open Dashboard and click the Reports bar.
pause
