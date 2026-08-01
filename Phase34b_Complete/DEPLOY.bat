@echo off
echo ============================================
echo   7SQ - POS Session Gate + Role Fix
echo ============================================
echo  RUN 031_fix_session_fk.sql IN SUPABASE FIRST!
echo.
pause
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
  echo. & echo BUILD FAILED - see error above. Not pushing. & pause & exit /b 1
)
echo [OK] Build succeeded

git add .
git commit -m "POS session gate with denomination count, role permission fix"
git push origin master
echo.
echo  Open Sales/POS - you will be asked to open a session first.
pause
