@echo off
echo ============================================
echo   WhatsApp Bill as Image (WhatsApp Business API)
echo ============================================
echo  RUN 044_wa_bill_template.sql IN SUPABASE FIRST!
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx"                    "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0MarketingIntegrations.jsx"  "%BASE%\src\pages\MarketingIntegrations.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx src\pages\MarketingIntegrations.jsx
git commit -m "POS: send bill as a real image via WhatsApp Business API, with graceful fallback to manual text send"
git push origin master
echo.
echo  TO GET AUTOMATIC IMAGE SENDING WORKING:
echo   1. Marketing - Integrations - Bill / Receipt Template
echo   2. Create a UTILITY (not Marketing) template in Meta with
echo      an Image header and exactly 3 body variables
echo   3. Wait for Meta approval, then enter the template name here
echo   Until then, Send on WhatsApp in POS still works - it just
echo   opens a manual text-only chat instead of an automatic image.
pause
