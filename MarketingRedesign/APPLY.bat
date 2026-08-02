@echo off
echo ============================================
echo   Marketing - Overview with Attribution
echo ============================================
echo  RUN 035_campaign_tracking.sql IN SUPABASE FIRST!
echo  (adds spend, sent_count, promo_code to campaigns)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0MarketingDashboard.jsx" "%BASE%\src\pages\MarketingDashboard.jsx"
copy /Y "%~dp0MarketingHub.jsx"       "%BASE%\src\pages\MarketingHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\MarketingDashboard.jsx src\pages\MarketingHub.jsx
git commit -m "Marketing: overview with promo-code attribution and honest channel status"
git push origin master
echo.
echo  TO GET ROI WORKING:
echo   1. Marketing - Promo Codes - create a code e.g. FLASH20
echo   2. Marketing - Overview - click a campaign row
echo   3. Enter spend + link that promo code
echo   4. Sell with the code at POS - revenue traces back
pause
