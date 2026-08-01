@echo off
echo ====================================
echo   7SQ - Fix Vercel Routing (404)
echo ====================================
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

copy /Y "%~dp0vercel.json" "%BASE%\vercel.json"
echo [OK] vercel.json added

cd /d "%BASE%"
git add vercel.json
git commit -m "Fix: Add vercel.json for SPA routing (fixes 404 on refresh)"
git push origin master

echo.
echo ====================================
echo  Done! Vercel will redeploy.
echo  All routes will now work correctly.
echo ====================================
pause
