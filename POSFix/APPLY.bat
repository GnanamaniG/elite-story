@echo off
echo ============================================
echo   POS Fix - product grid + customer search
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx" "%BASE%\src\pages\POS.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx
git commit -m "POS: browsable product grid, customer search by name/phone, inline add customer"
git push origin master
echo Done.
pause
