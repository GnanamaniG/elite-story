@echo off
echo ============================================
echo   Fix: Ctrl+K search - 47 missing tabs added
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0CommandPalette.jsx" "%BASE%\src\components\shell\CommandPalette.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\components\shell\CommandPalette.jsx
git commit -m "Fix: Ctrl+K search index was stale since Phase 31, missing 47 tabs across 11 hubs"
git push origin master
echo.
echo  Try Ctrl+K and search "Campaign Bot" - it should now appear.
pause
