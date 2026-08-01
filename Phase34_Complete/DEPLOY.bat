@echo off
echo ============================================
echo   7SQ - Phase 34: Offline POS and Mobile
echo ============================================
echo  NO SQL NEEDED for this phase.
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

if not exist "%BASE%\src\components\shell" mkdir "%BASE%\src\components\shell"
if not exist "%BASE%\src\hooks" mkdir "%BASE%\src\hooks"
if not exist "%BASE%\src\lib" mkdir "%BASE%\src\lib"

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
for %%f in ("%~dp0lib\*.js")   do copy /Y "%%f" "%BASE%\src\lib\"
for %%f in ("%~dp0shell\*.jsx")do copy /Y "%%f" "%BASE%\src\components\shell\"
for %%f in ("%~dp0hooks\*.js") do copy /Y "%%f" "%BASE%\src\hooks\"
for %%f in ("%~dp0pages\*.jsx")do copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
echo [OK] All files copied

echo.
echo Running local build check...
cd /d "%BASE%"
call npm run build
if errorlevel 1 (
  echo.
  echo ###########################################
  echo  BUILD FAILED - see error above. Not pushing.
  echo ###########################################
  pause
  exit /b 1
)
echo [OK] Build succeeded

git add .
git commit -m "Phase 34 - Offline POS with sync queue, mobile responsive"
git push origin master

echo.
echo ============================================
echo  TO TEST OFFLINE:
echo   1. Open the app, let it load (caches data)
echo   2. DevTools - Network - set to Offline
echo   3. Bill a sale in POS - it saves locally
echo   4. Go back Online - watch it auto-sync
echo ============================================
pause
