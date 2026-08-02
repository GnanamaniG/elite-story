@echo off
echo ============================================
echo   Marketing - Campaign Bot
echo ============================================
echo  No SQL needed.
echo  Needs VITE_ANTHROPIC_API_KEY in Vercel env vars
echo  (same key Bill Scanner and AI Assistant use)
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0CampaignBot.jsx"       "%BASE%\src\pages\CampaignBot.jsx"
copy /Y "%~dp0MarketingHub.jsx"      "%BASE%\src\pages\MarketingHub.jsx"
copy /Y "%~dp0MarketingDashboard.jsx" "%BASE%\src\pages\MarketingDashboard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\CampaignBot.jsx src\pages\MarketingHub.jsx src\pages\MarketingDashboard.jsx
git commit -m "Marketing: AI Campaign Bot - generates WhatsApp copy, Instagram caption and graphic"
git push origin master
echo.
echo  HOW TO USE:
echo   1. Marketing - Campaign Bot
echo   2. Type what you are promoting
echo   3. Click Generate Campaign
echo   4. Download the graphic, copy the caption, post to Instagram yourself
echo   5. Save as Draft Campaign, then send from Marketing - Campaigns
pause
