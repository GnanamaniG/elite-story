@echo off
echo ============================================
echo   Finish canSee() - cost/margin privacy enforced
echo ============================================
echo  No SQL needed.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0ItemsDashboard.jsx"    "%BASE%\src\pages\ItemsDashboard.jsx"
copy /Y "%~dp0StockAdjustments.jsx"  "%BASE%\src\pages\StockAdjustments.jsx"
copy /Y "%~dp0BatchExpiryTracker.jsx" "%BASE%\src\pages\BatchExpiryTracker.jsx"
copy /Y "%~dp0GoodsReceiptNote.jsx"  "%BASE%\src\pages\GoodsReceiptNote.jsx"
copy /Y "%~dp0PartiesDashboard.jsx"  "%BASE%\src\pages\PartiesDashboard.jsx"
copy /Y "%~dp0InvHub.jsx"            "%BASE%\src\pages\InvHub.jsx"
copy /Y "%~dp0PurchHub.jsx"          "%BASE%\src\pages\PurchHub.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add .
git commit -m "Finish canSee(): hide cost price and margin from cashier/staff across Items, Stock Adjustments, Batches, GRN, and Parties supplier view"
git push origin master
echo.
echo  TEST: log in as a cashier or staff role and open
echo  Inventory - Products. Cost Price and Margin should
echo  now show a lock icon instead of the real figures.
pause
