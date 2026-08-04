@echo off
echo ============================================
echo   Move Repairs into Inventory module
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0InvHub.jsx"          "%BASE%\src\pages\InvHub.jsx"
copy /Y "%~dp0OpsHub.jsx"          "%BASE%\src\pages\OpsHub.jsx"
copy /Y "%~dp0roleAccess.js"       "%BASE%\src\lib\roleAccess.js"
copy /Y "%~dp0CommandPalette.jsx"  "%BASE%\src\components\shell\CommandPalette.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\InvHub.jsx src\pages\OpsHub.jsx src\lib\roleAccess.js src\components\shell\CommandPalette.jsx
git commit -m "Move Repairs tab from Operations into Inventory; carry staff permission across; rebuild search index"
git push origin master
echo.
echo  Repairs is now under Inventory - Repairs, not Operations.
echo  Staff role permission moved with it.
pause
