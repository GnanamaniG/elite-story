@echo off
echo ============================================
echo   POS: Manual Discount, CGST/SGST, WhatsApp Bill
echo ============================================
echo  RUN 039_pos_discount_gst.sql IN SUPABASE FIRST!
echo  (adds manual_discount column to sales)
echo.
pause
set BASE=C:\Users\ADMIN\Documents\BizFlowApp
copy /Y "%~dp0POS.jsx" "%BASE%\src\pages\POS.jsx"
cd /d "%BASE%"
call npm run build
if errorlevel 1 ( echo BUILD FAILED - not pushing & pause & exit /b 1 )
git add src\pages\POS.jsx
git commit -m "POS: manual flat/percent discount, CGST/SGST split display, WhatsApp bill send"
git push origin master
echo.
echo  NEW IN POS:
echo   - Manual Discount box next to Promo Code (Rs or %% toggle)
echo   - Totals now show CGST + SGST separately, not lump GST
echo   - After any sale, tap "Send on WhatsApp" next to Print
echo     to forward the itemised bill to the customer's number
echo     (requires the customer be attached with a phone number)
pause
