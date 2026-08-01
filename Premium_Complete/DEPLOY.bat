@echo off
echo ============================================
echo   7SQ Business Platform - Premium Deploy
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All pages updated

cd /d "%BASE%"
git add .
git commit -m "7SQ Premium - white/red theme, maroon sidebar, hub pages"
git push origin master

echo.
echo ============================================
echo  7SQ Business Platform deployed!
echo  - White background, red accents
echo  - Maroon sidebar (#7B1E1E)
echo  - 18 sidebar items (was 88)
echo  - 12 hub pages with tabs
echo ============================================
pause
