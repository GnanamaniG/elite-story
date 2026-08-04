@echo off
echo ============================================
echo   Auto-send bill on checkout (WhatsApp)
echo ============================================
echo  No SQL needed - uses the WhatsApp setup
echo  from the previous phase (044_wa_bill_template.sql).
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx" "%BASE%\src\pages\POS.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx
git commit -m "Auto-send bill image on checkout when a customer with a phone is attached; non-blocking status banner replaces alert popups"
git push origin master
echo.
echo  Checkout with a customer (with a phone number)
echo  attached now automatically sends the bill - no
echo  extra tap needed. A small status line appears
echo  near Print/Send showing what happened. The
echo  manual Send on WhatsApp button still works too,
echo  e.g. to resend.
pause
