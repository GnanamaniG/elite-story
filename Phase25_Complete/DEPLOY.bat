@echo off
echo ============================================
echo   7SQ - Phase 25 Deploy
echo ============================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0index.html"          "%BASE%\index.html"
copy /Y "%~dp0App.jsx"             "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] Core files

for %%f in ("%~dp0pages\*.jsx") do (
  copy /Y "%%f" "%BASE%\src\pages\%%~nxf"
)
echo [OK] All pages

cd /d "%BASE%"
git add .
git commit -m "Phase 25 - Cash Book, Targets, Reviews, Coupons"
git push origin master

echo.
echo ============================================
echo  Done! New in sidebar:
echo    Analytics ^& Growth section:
echo    - Daily Cash Book
echo    - Sales Targets
echo    - Product Reviews
echo    - Coupon Manager
echo ============================================
pause
