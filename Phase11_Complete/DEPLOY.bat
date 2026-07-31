@echo off
echo ============================================
echo   Elite Store Phase 11 - Complete Deploy
echo ============================================
echo.
set BASE=C:\Users\ADMIN\Documents\BizFlowApp

echo Step 1: Copying App.jsx and AppShell.jsx...
copy /Y "%~dp0App.jsx" "%BASE%\src\App.jsx"
copy /Y "%~dp0layout\AppShell.jsx" "%BASE%\src\components\layout\AppShell.jsx"
echo [OK] App.jsx and AppShell.jsx replaced

echo.
echo Step 2: Copying all page files...
copy /Y "%~dp0pages\Attendance.jsx"      "%BASE%\src\pages\Attendance.jsx"
copy /Y "%~dp0pages\Payroll.jsx"         "%BASE%\src\pages\Payroll.jsx"
copy /Y "%~dp0pages\Loyalty.jsx"         "%BASE%\src\pages\Loyalty.jsx"
copy /Y "%~dp0pages\Suppliers.jsx"       "%BASE%\src\pages\Suppliers.jsx"
copy /Y "%~dp0pages\CreditLedger.jsx"    "%BASE%\src\pages\CreditLedger.jsx"
copy /Y "%~dp0pages\Variants.jsx"        "%BASE%\src\pages\Variants.jsx"
copy /Y "%~dp0pages\Notifications.jsx"   "%BASE%\src\pages\Notifications.jsx"
copy /Y "%~dp0pages\OnlineStore.jsx"     "%BASE%\src\pages\OnlineStore.jsx"
copy /Y "%~dp0pages\CustomerPortal.jsx"  "%BASE%\src\pages\CustomerPortal.jsx"
copy /Y "%~dp0pages\Returns.jsx"         "%BASE%\src\pages\Returns.jsx"
copy /Y "%~dp0pages\PriceLists.jsx"      "%BASE%\src\pages\PriceLists.jsx"
copy /Y "%~dp0pages\StockTransfer.jsx"   "%BASE%\src\pages\StockTransfer.jsx"
copy /Y "%~dp0pages\PurchaseOrders.jsx"  "%BASE%\src\pages\PurchaseOrders.jsx"
copy /Y "%~dp0pages\Dashboard.jsx"       "%BASE%\src\pages\Dashboard.jsx"
copy /Y "%~dp0pages\BulkImport.jsx"      "%BASE%\src\pages\BulkImport.jsx"
copy /Y "%~dp0pages\WhatsAppCatalog.jsx" "%BASE%\src\pages\WhatsAppCatalog.jsx"
copy /Y "%~dp0pages\CustomerSegments.jsx" "%BASE%\src\pages\CustomerSegments.jsx"
copy /Y "%~dp0pages\Documents.jsx"       "%BASE%\src\pages\Documents.jsx"
echo [OK] All 18 pages copied

echo.
echo Step 3: Pushing to GitHub/Vercel...
cd /d "%BASE%"
git add .
git commit -m "Phase 11 Complete - All modules including missing Phase 7-10 pages"
git push origin master

echo.
echo ============================================
echo  Done! Vercel will deploy in ~60 seconds
echo  Check sidebar for new items:
echo    Bulk Import, WA Catalog, Segments, Docs
echo ============================================
pause
