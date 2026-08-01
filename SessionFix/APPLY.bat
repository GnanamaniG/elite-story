@echo off
echo ============================================
echo   Fix: cash_sessions foreign key error
echo ============================================
echo  RUN 031_fix_session_fk.sql IN SUPABASE FIRST!
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POSSession.jsx"   "%BASE%\src\components\shell\POSSession.jsx"
copy /Y "%~dp0CashRegister.jsx" "%BASE%\src\pages\CashRegister.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Fix: cash_sessions opened_by FK violation"
git push origin master
echo Done.
pause
