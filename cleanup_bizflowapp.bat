@echo off
echo ============================================
echo   BizFlowApp - Project Folder Cleanup
echo ============================================
echo  This removes spent patch folders and old
echo  prototype scaffolds. Your real app code in
echo  src/ is NOT touched by any of this.
echo.
echo  Review the list below before continuing.
echo ============================================
pause

cd /d C:\Users\ADMIN\Documents\BizFlowApp

echo Removing old prototype scaffolds...
for %%D in (elite-p5 elite-p6 elite-p7 elite-p8 elite-p9 elite-p10 elite-p11) do (
  if exist "%%D" rmdir /s /q "%%D"
)

echo Removing applied fix/redesign packages...
for %%D in (AccountingRedesign AppShellFix BuildFix BuildFix2 BuildFix3 BusinessPulse CampaignBot CanSeeFinish CustomerSearchFix DashboardReports DesignOverhaul_Complete DesktopApp ExpensesRedesign ItemsOptimize ItemsRedesign MarketingRedesign PartiesUnified POSFix Premium_Complete PulseGridFix PurchasesRedesign RoutingFix SearchIndexFix SerialTracking SessionFix SessionFix2 SignupFix SocialAutomation) do (
  if exist "%%D" rmdir /s /q "%%D"
)

echo Removing old numbered phase drops...
for %%D in (Phase11 Phase11_Complete Phase12_Complete Phase13_Complete Phase14_Complete Phase15_Complete Phase16_Complete Phase17_Complete Phase18_Complete Phase19_Complete Phase20_Complete Phase21_Complete Phase22_Complete Phase23_Complete Phase24_Complete Phase25_Complete Phase26_Complete Phase27_Complete Phase28_Complete Phase29_Complete Phase30_Complete Phase31_Complete Phase32_Complete Phase33_Complete Phase34_Complete Phase34b_Complete) do (
  if exist "%%D" rmdir /s /q "%%D"
)

echo Removing build output (regenerates on next build)...
if exist "dist" rmdir /s /q "dist"

echo.
echo ============================================
echo  Cleanup complete. Verifying app still works:
echo ============================================
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED - something unexpected was removed.
  echo Do NOT push. Contact for help before proceeding.
  pause
  exit /b 1
)
echo.
echo Build succeeded - cleanup was safe.
echo Nothing was pushed to git by this script.
pause
