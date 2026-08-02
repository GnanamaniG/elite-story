@echo off
echo ============================================
echo   Accounting and GST - Unified Overview
echo ============================================
echo  RUN 034_bank_accounts.sql IN SUPABASE FIRST!
echo  (creates bank_accounts, seeds Cash in Hand)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0AccountingDashboard.jsx" "%BASE%\src\pages\AccountingDashboard.jsx"
copy /Y "%~dp0AccountingHub.jsx"       "%BASE%\src\pages\AccountingHub.jsx"
copy /Y "%~dp0App.jsx"                 "%BASE%\src\App.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Accounting: unified overview with funds, balance sheet, P&L and GST position"
git push origin master
echo.
echo  Open Accounting - Overview, then click "Update Balances"
echo  to enter your actual cash / UPI / bank figures.
pause
