@echo off
echo ============================================
echo   Expenses - Unified Dashboard
echo ============================================
echo  RUN 033_expenses_fields.sql IN SUPABASE FIRST!
echo  (adds vendor, payment_mode, recurring columns)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ExpensesDashboard.jsx" "%BASE%\src\pages\ExpensesDashboard.jsx"
copy /Y "%~dp0App.jsx"               "%BASE%\src\App.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\ExpensesDashboard.jsx src\App.jsx
git commit -m "Expenses: unified dashboard with budget tracking, vendor analysis, recurring"
git push origin master
echo Done. Open Expenses.
pause
