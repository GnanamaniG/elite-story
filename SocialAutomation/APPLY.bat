@echo off
echo ============================================
echo   Real Image Gen + Instagram/WhatsApp Auto-Post
echo ============================================
echo  RUN 037_social_integrations.sql IN SUPABASE FIRST!
echo  (creates credentials table, storage bucket, post log)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0CampaignBot.jsx"          "%BASE%\src\pages\CampaignBot.jsx"
copy /Y "%~dp0MarketingIntegrations.jsx" "%BASE%\src\pages\MarketingIntegrations.jsx"
copy /Y "%~dp0MarketingHub.jsx"          "%BASE%\src\pages\MarketingHub.jsx"
copy /Y "%~dp0MarketingDashboard.jsx"    "%BASE%\src\pages\MarketingDashboard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Marketing: real AI image generation, Instagram auto-post, WhatsApp Business API send"
git push origin master
echo.
echo  NEXT STEPS (these take time - Meta review is not instant):
echo   1. Marketing - Integrations - follow the "How to get this" guide
echo      under each section to get your OpenAI key and Meta credentials
echo   2. Submit your Meta app for review (instagram_content_publish permission)
echo   3. Create + get approval for a WhatsApp message template
echo   4. Once approved, Marketing - Campaign Bot will actually post for real
pause
