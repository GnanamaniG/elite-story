@echo off
echo ============================================
echo   Onboarding: Multi-select Business Type
echo ============================================
echo  RUN 046_business_types.sql IN SUPABASE FIRST!
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0OnboardingWizard.jsx" "%BASE%\src\pages\OnboardingWizard.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\OnboardingWizard.jsx
git commit -m "Onboarding: multi-select business type (54 options across Retail and Services) plus manual Other entry"
git push origin master
echo Done.
pause
