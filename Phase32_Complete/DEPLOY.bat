@echo off
echo ============================================
echo   7SQ - Phase 32: Intelligence
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

if not exist "%BASE%\src\components\shell" mkdir "%BASE%\src\components\shell"
if not exist "%BASE%\src\hooks" mkdir "%BASE%\src\hooks"

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
for %%f in ("%~dp0shell\*.jsx") do copy /Y "%%f" "%BASE%\src\components\shell\"
copy /Y "%~dp0hooks\useShortcuts.js" "%BASE%\src\hooks\useShortcuts.js"
for %%f in ("%~dp0pages\*.jsx") do copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
echo [OK] All files copied

echo.
echo Running local build check (catches errors before Vercel)...
cd /d "%BASE%"
call npm run build
if errorlevel 1 (
  echo.
  echo ###########################################
  echo  BUILD FAILED - see the error above.
  echo  NOT pushing to git.
  echo ###########################################
  pause
  exit /b 1
)
echo [OK] Build succeeded

git add .
git commit -m "Phase 32 - Bill Scanner OCR, RFM Analysis, Sales Heatmap"
git push origin master

echo.
echo ============================================
echo  NO SQL NEEDED.
echo  New tabs:
echo    Purchases  - Bill Scanner
echo    Customers  - RFM Analysis
echo    Reports    - Sales Patterns
echo ============================================
pause
