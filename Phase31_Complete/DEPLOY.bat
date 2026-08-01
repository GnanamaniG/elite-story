@echo off
echo ============================================
echo   7SQ - Phase 31: Shell and Speed
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

if not exist "%BASE%\src\components\shell" mkdir "%BASE%\src\components\shell"
if not exist "%BASE%\src\hooks" mkdir "%BASE%\src\hooks"

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0shell\*.jsx") do copy /Y "%%f" "%BASE%\src\components\shell\"
echo [OK] Shell components

copy /Y "%~dp0hooks\useShortcuts.js" "%BASE%\src\hooks\useShortcuts.js"
echo [OK] Shortcut engine

for %%f in ("%~dp0pages\*.jsx") do copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
echo [OK] All pages

cd /d "%BASE%"
git add .
git commit -m "Phase 31 - Command palette, keyboard shortcuts, notification bell, print preview"
git push origin master

echo.
echo ============================================
echo  NO SQL NEEDED for this phase.
echo.
echo  Try these right away:
echo    Ctrl+K    Command palette
echo    ?         Shortcuts help
echo    G then P  Go to POS
echo    G then I  Go to Inventory
echo    G then C  Go to Customers
echo ============================================
pause
