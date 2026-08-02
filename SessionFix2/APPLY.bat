@echo off
echo ============================================
echo   POS Session - gate + visible session bar
echo ============================================
echo  If you have NOT run 031_fix_session_fk.sql yet,
echo  run it in Supabase first. Then continue.
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
if not exist "%BASE%\src\components\shell" mkdir "%BASE%\src\components\shell"
copy /Y "%~dp0POS.jsx"        "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0POSSession.jsx" "%BASE%\src\components\shell\POSSession.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "POS session: visible status bar, close-and-reconcile flow"
git push origin master
echo.
echo  If the Open Session screen still does not appear,
echo  run DIAGNOSE_session.sql in Supabase - it will tell you why.
pause
