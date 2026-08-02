@echo off
echo ============================================
echo   CRITICAL Fix: Create Account never created a business
echo ============================================
echo  RUN 038_signup_provisioning.sql IN SUPABASE FIRST!
echo  (adds permission policies needed for self-signup)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0supabase.js" "%BASE%\src\lib\supabase.js"
copy /Y "%~dp0useAuth.js"  "%BASE%\src\hooks\useAuth.js"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\lib\supabase.js src\hooks\useAuth.js
git commit -m "Fix: signup never created a tenant/business - now auto-provisions on first login"
git push origin master
echo.
echo  TEST: Create Account with a NEW email you have not used before,
echo  confirm the email, sign in - you should now land on the
echo  onboarding wizard for a fresh business, not a blank/broken screen.
pause
