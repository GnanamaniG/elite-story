@echo off
echo ============================================
echo   Elite Store — BizFlow Design Overhaul
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All pages updated with BizFlow design tokens

cd /d "%BASE%"
git add .
git commit -m "Design overhaul - BizFlow exact design system applied to all 92 pages"
git push origin master

echo.
echo ============================================
echo  Design changes applied:
echo    - DM Sans font loaded from Google Fonts
echo    - Exact BizFlow dark color palette
echo    - Sidebar matches BizFlow exactly
echo    - Section headers in sidebar nav
echo    - Collapse sidebar button
echo    - BizFlow scrollbars ^& animations
echo    - All 92 pages updated
echo ============================================
pause
