@echo off
echo ============================================
echo   Elite Store Phase 12 - Complete Deploy
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

echo Copying App.jsx and AppShell.jsx...
copy /Y "%~dp0App.jsx"                 "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx"     "%BASE%\src\components\layout\AppShell.jsx"

echo Copying lib files...
copy /Y "%~dp0lib\thermalPrint.js"     "%BASE%\src\lib\thermalPrint.js"
copy /Y "%~dp0lib\roleAccess.js"       "%BASE%\src\lib\roleAccess.js"

echo Copying all pages...
for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
  echo [OK] %%~nxf
)

echo.
echo Pushing to Vercel...
cd /d "%BASE%"
git add .
git commit -m "Phase 12 - Cash Register, QR Labels, Repairs, Thermal Print"
git push origin master

echo.
echo ============================================
echo  Done! Check sidebar for new items:
echo    - Cash Register
echo    - QR Labels  
echo    - Repairs
echo ============================================
pause
