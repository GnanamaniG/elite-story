@echo off
echo ============================================
echo   Bill Image Redesign + View Invoice Button
echo ============================================
echo  RUN 045_public_invoice.sql IN SUPABASE FIRST!
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0PublicInvoice.jsx"       "%BASE%\src\pages\PublicInvoice.jsx"
copy /Y "%~dp0POS.jsx"                "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0MarketingIntegrations.jsx" "%BASE%\src\pages\MarketingIntegrations.jsx"
copy /Y "%~dp0App.jsx"                "%BASE%\src\App.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Redesign bill image as clean summary card, add public View Invoice page + WhatsApp button"
git push origin master
echo.
echo  If you already created a Meta receipt template, you will
echo  need to ADD A BUTTON to it (type Visit Website, Dynamic URL,
echo  base https://elite-story.vercel.app/invoice/) and re-submit
echo  for approval - Meta does not let you edit an approved
echo  template's structure, only text, so this needs re-review.
pause
