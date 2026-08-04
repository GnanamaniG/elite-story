@echo off
echo ============================================
echo   Fix: sales.amount_paid does not exist
echo ============================================
echo  RUN 045_public_invoice.sql IN SUPABASE FIRST!
echo  (replaces the function, no other changes needed)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0PublicInvoice.jsx" "%BASE%\src\pages\PublicInvoice.jsx"
copy /Y "%~dp0POS.jsx"           "%BASE%\src\pages\POS.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\PublicInvoice.jsx src\pages\POS.jsx
git commit -m "Fix: sales has no amount_paid column - POS has no partial payment tracking, every invoice is fully paid"
git push origin master
echo Done.
pause
