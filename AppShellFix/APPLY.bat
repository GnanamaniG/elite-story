@echo off
echo Applying AppShell fix...
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] AppShell.jsx updated
cd /d "%BASE%"
git add src\components\layout\AppShell.jsx
git commit -m "Fix sidebar - all Phase 24 and 25 items added"
git push origin master
echo Done! Vercel will redeploy in 30 seconds.
pause
