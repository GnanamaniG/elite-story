@echo off
echo ============================================
echo   Repairs button on Products page
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ItemsDashboard.jsx" "%BASE%\src\pages\ItemsDashboard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\ItemsDashboard.jsx
git commit -m "Add Repairs quick-action button to Products page, next to +Product and +Service"
git push origin master
echo Done.
pause
