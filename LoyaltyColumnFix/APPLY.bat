@echo off
echo ============================================
echo   CRITICAL Fix: wrong loyalty column name
echo   app-wide (loyalty_points -> loyalty_pts)
echo ============================================
echo  No SQL needed - this is a code-only fix.
echo  Every query against customers.loyalty_points
echo  was failing since that column never existed;
echo  the real column is loyalty_pts.
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0AIAnalytics.jsx"    "%BASE%\src\pages\AIAnalytics.jsx"
copy /Y "%~dp0CustomerApp.jsx"    "%BASE%\src\pages\CustomerApp.jsx"
copy /Y "%~dp0LoyaltyTiers.jsx"   "%BASE%\src\pages\LoyaltyTiers.jsx"
copy /Y "%~dp0POS.jsx"            "%BASE%\src\pages\POS.jsx"
copy /Y "%~dp0Referrals.jsx"      "%BASE%\src\pages\Referrals.jsx"
copy /Y "%~dp0StoreAnalytics.jsx" "%BASE%\src\pages\StoreAnalytics.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\AIAnalytics.jsx src\pages\CustomerApp.jsx src\pages\LoyaltyTiers.jsx src\pages\POS.jsx src\pages\Referrals.jsx src\pages\StoreAnalytics.jsx
git commit -m "Fix: customers.loyalty_points does not exist, real column is loyalty_pts - fixed everywhere it was referenced"
git push origin master
echo.
echo  This likely fixes customer search in POS too -
echo  the whole customer query was failing on this
echo  column, which meant no customers ever loaded.
pause
