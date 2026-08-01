@echo off
echo Applying build fixes...
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ToolsHub.jsx"            "%BASE%\src\pages\ToolsHub.jsx"
copy /Y "%~dp0CustomerLedgerAging.jsx" "%BASE%\src\pages\CustomerLedgerAging.jsx"
cd /d "%BASE%"
git add src\pages\ToolsHub.jsx src\pages\CustomerLedgerAging.jsx
git commit -m "Fix build: duplicate import in ToolsHub, Fragment key in CustomerLedgerAging"
git push origin master
echo Done - Vercel will rebuild.
pause
