@echo off
echo ============================================
echo   CRITICAL Fix: Silent query failures in POS
echo ============================================
echo  No SQL needed.
echo.
echo  Root cause: POS never checked for errors from
echo  its data queries - Supabase does not throw on
echo  a failed query, it returns {data:null, error}.
echo  The code only ever read .data, so ANY query
echo  failure (wrong column, RLS, network) silently
echo  looked identical to "there is just no data".
echo.
echo  This is likely why customer search kept failing
echo  even after the loyalty_pts fix - if something
echo  else was wrong, there was no way to see it.
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx" "%BASE%\src\pages\POS.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx
git commit -m "Fix: POS silently swallowed query errors; customers query now uses select(*) and errors are surfaced on screen with Retry"
git push origin master
echo.
echo  AFTER THIS DEPLOYS: open Sales/POS. If customer
echo  search still fails, a RED BANNER will now appear
echo  at the top of the screen showing the EXACT error
echo  message from the database. Screenshot that banner
echo  and send it - it will tell us precisely what is
echo  wrong instead of us guessing again.
pause
