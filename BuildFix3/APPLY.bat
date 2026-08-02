@echo off
echo ============================================
echo   Fix: broken apostrophe escaping in build
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0MarketingIntegrations.jsx" "%BASE%\src\pages\MarketingIntegrations.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\MarketingIntegrations.jsx
git commit -m "Fix: double-escaped apostrophe breaking esbuild"
git push origin master
echo Done.
pause
