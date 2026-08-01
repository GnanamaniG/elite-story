@echo off
echo Applying build fix...
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0CustomerLedgerAging.jsx" "%BASE%\src\pages\CustomerLedgerAging.jsx"
cd /d "%BASE%"
git add src\pages\CustomerLedgerAging.jsx
git commit -m "Fix build: Fragment key in CustomerLedgerAging"
git push origin master
echo Done - Vercel will rebuild.
pause
