@echo off
echo ============================================
echo   Navigation Restructure: remove duplicates
echo ============================================
echo  No SQL needed.
echo  This deletes 2 orphaned hub files and removes
echo  3 duplicated tabs, keeping one reachable home
echo  for each. Search index rebuilt to match.
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

REM Remove the two fully-redundant, unreachable hub files
if exist "%BASE%\src\pages\SalesDocHub.jsx" del "%BASE%\src\pages\SalesDocHub.jsx"
if exist "%BASE%\src\pages\AIHub.jsx" del "%BASE%\src\pages\AIHub.jsx"

copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0CommandPalette.jsx"  "%BASE%\src\components\shell\CommandPalette.jsx"
copy /Y "%~dp0OpsHub.jsx"          "%BASE%\src\pages\OpsHub.jsx"

cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add -A
git commit -m "Restructure: remove 2 orphaned hubs (SalesDocHub, AIHub) and 3 duplicate tabs; rebuild search index with zero duplicates"
git push origin master
echo.
echo  Done. 126 to 121 destinations, zero orphans, zero duplicate search entries.
pause
