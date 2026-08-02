import { useState, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { signIn, signUp, signOut, supabase, sendOtp, verifyOtp, isValidPhone } from './lib/supabase';
import useRole from './hooks/useRole';
import OnboardingWizard from './pages/OnboardingWizard';
import { canAccess } from './lib/roleAccess';
import AppShell           from './components/layout/AppShell';
import Dashboard          from './pages/Dashboard';
import POS                from './pages/POS';
import Sales              from './pages/Sales';
import Inventory          from './pages/Inventory';
import Customers          from './pages/Customers';
import ExpensesDashboard from './pages/ExpensesDashboard';
import Purchases          from './pages/Purchases';
import Reports            from './pages/Reports';
import GSTFiling          from './pages/GSTFiling';
import AIAssistant        from './pages/AIAssistant';
import Branches           from './pages/Branches';
import Suppliers          from './pages/Suppliers';
import CreditLedger       from './pages/CreditLedger';
import Variants           from './pages/Variants';
import Team               from './pages/Team';
import Billing            from './pages/Billing';
import Settings           from './pages/Settings';
import Attendance         from './pages/Attendance';
import Payroll            from './pages/Payroll';
import Loyalty            from './pages/Loyalty';
import Notifications      from './pages/Notifications';
import OnlineStore        from './pages/OnlineStore';
import CustomerPortal     from './pages/CustomerPortal';
import Returns            from './pages/Returns';
import PriceLists         from './pages/PriceLists';
import StockTransfer      from './pages/StockTransfer';
import PurchaseOrders     from './pages/PurchaseOrders';
import BulkImport         from './pages/BulkImport';
import WhatsAppCatalog    from './pages/WhatsAppCatalog';
import CustomerSegments   from './pages/CustomerSegments';
import Documents          from './pages/Documents';
import CashRegister       from './pages/CashRegister';
import QRLabels           from './pages/QRLabels';
import Repairs            from './pages/Repairs';
import GiftCards          from './pages/GiftCards';
import BudgetTracker      from './pages/BudgetTracker';
import InventoryAging     from './pages/InventoryAging';
import Feedback           from './pages/Feedback';
import WAOrderBot         from './pages/WAOrderBot';
import Appointments       from './pages/Appointments';
import FinancialYearClose from './pages/FinancialYearClose';
import EInvoice           from './pages/EInvoice';
import MultiStoreAnalytics from './pages/MultiStoreAnalytics';
import AutoReports        from './pages/AutoReports';
import PromoCodes         from './pages/PromoCodes';
import Bundles            from './pages/Bundles';
import StaffPerformance   from './pages/StaffPerformance';
import StockAudit         from './pages/StockAudit';
import BackupRestore      from './pages/BackupRestore';
import TallyExport        from './pages/TallyExport';
import LeaveManagement    from './pages/LeaveManagement';
import SMSAlerts          from './pages/SMSAlerts';
import VendorPortal       from './pages/VendorPortal';
import ServiceBays        from './pages/ServiceBays';
import CustomerApp     from './pages/CustomerApp';
import ExpenseClaims    from './pages/ExpenseClaims';
import Referrals   from './pages/Referrals';
import GSTR3B      from './pages/GSTR3B';
import EODReport      from './pages/EODReport';
import StaffScheduler from './pages/StaffScheduler';
import SupplierRFQ    from './pages/SupplierRFQ';
import LoyaltyTiers   from './pages/LoyaltyTiers';
import AIAnalytics    from './pages/AIAnalytics';
import PartnershipAccounts from './pages/PartnershipAccounts';
import TDSManagement       from './pages/TDSManagement';
import DemandForecast      from './pages/DemandForecast';
import Accounting          from './pages/Accounting';
import ReorderManagement   from './pages/ReorderManagement';
import UsersAccess   from './pages/UsersAccess';
import Campaigns     from './pages/Campaigns';
import SalesPipeline from './pages/SalesPipeline';
import Quotations    from './pages/Quotations';
import EMIManager    from './pages/EMIManager';
import Commissions   from './pages/Commissions';
import QualityControl from './pages/QualityControl';
import EWayBill      from './pages/EWayBill';
import StoreAnalytics      from './pages/StoreAnalytics';
import PurchaseReturns    from './pages/PurchaseReturns';
import ProductCatalog     from './pages/ProductCatalog';
import CustomerStatements from './pages/CustomerStatements';
import AuditLog           from './pages/AuditLog';

import CreditNotes      from './pages/CreditNotes';
import BarcodeGenerator from './pages/BarcodeGenerator';
import CashFlowForecast from './pages/CashFlowForecast';
import WATemplates      from './pages/WATemplates';

import AdvancedReports from './pages/AdvancedReports';
import Subscriptions   from './pages/Subscriptions';
import HRDashboard     from './pages/HRDashboard';
import InvHub           from './pages/InvHub';
import SalesHub         from './pages/SalesHub';
import CustHub          from './pages/CustHub';
import PurchHub         from './pages/PurchHub';
import HRHub            from './pages/HRHub';
import GSTHub           from './pages/GSTHub';
import AccountingHub    from './pages/AccountingHub';
import SalesDocHub      from './pages/SalesDocHub';
import LoyaltyHub       from './pages/LoyaltyHub';
import MarketingHub     from './pages/MarketingHub';
import OpsHub           from './pages/OpsHub';
import AIHub            from './pages/AIHub';
import ToolsHub         from './pages/ToolsHub';
import DeliveryManagement from './pages/DeliveryManagement';
import PaymentLinks        from './pages/PaymentLinks';
import WarrantyTracker     from './pages/WarrantyTracker';
import StaffTaskBoard      from './pages/StaffTaskBoard';
import SmartAlerts         from './pages/SmartAlerts';
import DailyCashBook   from './pages/DailyCashBook';
import SalesTargets    from './pages/SalesTargets';
import ProductReviews  from './pages/ProductReviews';
import CouponManager   from './pages/CouponManager';
import B2BOrders              from './pages/B2BOrders';
import PurchaseRequisitions   from './pages/PurchaseRequisitions';
import ProductPerformance     from './pages/ProductPerformance';
import WhatsAppDailyReport    from './pages/WhatsAppDailyReport';
import StockValuation         from './pages/StockValuation';
import WinBackCampaigns     from './pages/WinBackCampaigns';
import RecurringOrders      from './pages/RecurringOrders';
import PriceHistory         from './pages/PriceHistory';
import SupplierScorecard    from './pages/SupplierScorecard';
import BusinessHealthScore  from './pages/BusinessHealthScore';
import StockAdjustments  from './pages/StockAdjustments';
import PaymentReminders  from './pages/PaymentReminders';
import SupplierPayments  from './pages/SupplierPayments';
import ProfitAndLoss     from './pages/ProfitAndLoss';
import StaffAttendanceQR from './pages/StaffAttendanceQR';
import ReportsHub        from './pages/ReportsHub';
import GoodsReceiptNote   from './pages/GoodsReceiptNote';
import BatchExpiryTracker from './pages/BatchExpiryTracker';
import ShiftHandover      from './pages/ShiftHandover';
import CustomerVisitLog   from './pages/CustomerVisitLog';
import GSTReconciliation  from './pages/GSTReconciliation';
import StockTransferOrders from './pages/StockTransferOrders';
import ComplianceCalendar  from './pages/ComplianceCalendar';
import CustomerLedgerAging from './pages/CustomerLedgerAging';
import CommissionRun       from './pages/CommissionRun';
import DocumentExpiry      from './pages/DocumentExpiry';
import BillScanner  from './pages/BillScanner';
import RFMAnalysis from './pages/RFMAnalysis';
import SalesHeatmap from './pages/SalesHeatmap';


const T = { bg:'#F7F3F3', srf:'#0f1220', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', red:'#ff4d6a', green:'#00d68f' };

const L = { bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE', lightRed:'#FEF2F2',
  red:'#C0392B', darkRed:'#8B0000', maroon:'#7B1E1E',
  green:'#16A34A', ink:'#111827', sub:'#6B7280', muted:'#9CA3AF' };


function LoginPage() {
  const [method,   setMethod]   = useState('phone');   // phone | email
  const [mode,     setMode]     = useState('login');   // login | signup
  const [step,     setStep]     = useState('entry');   // entry | otp
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState(['','','','','','']);
  const [bizName,  setBizName]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => { if (step === 'otp') otpRefs.current[0]?.focus(); }, [step]);

  const inp = {
    width:'100%', background:L.bg, border:`1px solid ${L.bdr}`, borderRadius:9,
    padding:'12px 14px', color:L.ink, fontSize:14, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box',
  };
  const lbl = { fontSize:10, color:L.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 };

  function reset(msg = '') { setError(msg); setLoading(false); }

  // ── Email / password ────────────────────────────────────────
  async function handleEmail(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
      } else {
        if (!bizName.trim()) return reset('Business name is required');
        const { error: err } = await signUp(email, password, { biz_name:bizName, biz_type:'retail' });
        if (err) throw err;
        setError('✅ Account created. Check your email to confirm, then sign in.');
        setMode('login');
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Phone: request OTP ──────────────────────────────────────
  async function requestOtp(e) {
    e?.preventDefault();
    if (!isValidPhone(phone)) return setError('Enter a valid 10-digit mobile number');
    if (mode === 'signup' && !bizName.trim()) return setError('Business name is required');
    setLoading(true); setError('');
    try {
      const { error: err } = await sendOtp(
        phone,
        mode === 'signup',
        mode === 'signup' ? { biz_name:bizName, biz_type:'retail' } : null
      );
      if (err) throw err;
      setStep('otp'); setResendIn(30); setOtp(['','','','','','']);
    } catch (e) {
      const m = String(e.message||'');
      if (/not found|does not exist|Signups not allowed/i.test(m) && mode === 'login') {
        setError('No account with this number. Switch to Create Account to register.');
      } else if (/provider|not enabled|unsupported/i.test(m)) {
        setError('SMS sign-in is not switched on yet. Enable a phone provider in Supabase → Authentication → Providers.');
      } else setError(m);
    } finally { setLoading(false); }
  }

  // ── Phone: verify OTP ───────────────────────────────────────
  async function submitOtp(code) {
    const token = code || otp.join('');
    if (token.length !== 6) return setError('Enter all 6 digits');
    setLoading(true); setError('');
    try {
      const { error: err } = await verifyOtp(phone, token);
      if (err) throw err;
      // session established — App re-renders via useAuth
    } catch (e) {
      setError(/expired|invalid/i.test(e.message) ? 'That code is wrong or has expired. Try again.' : e.message);
      setOtp(['','','','','','']); otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  }

  function onOtpChange(i, v) {
    const digit = v.replace(/\D/g,'').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i+1]?.focus();
    if (next.every(d=>d) && next.join('').length === 6) submitOtp(next.join(''));
  }

  function onOtpKey(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i-1]?.focus();
    if (e.key === 'ArrowLeft'  && i > 0) otpRefs.current[i-1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i+1]?.focus();
  }

  function onOtpPaste(e) {
    const txt = (e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);
    if (txt.length === 6) { e.preventDefault(); setOtp(txt.split('')); submitOtp(txt); }
  }

  return (
    <div style={{ minHeight:'100vh', background:L.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:410 }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:62, height:62, background:L.maroon, borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:21, fontWeight:900, color:'#fff', marginBottom:14, boxShadow:'0 6px 22px rgba(123,30,30,.28)' }}>7SQ</div>
          <div style={{ fontSize:25, fontWeight:900, color:L.darkRed, letterSpacing:'-0.02em' }}>7SQ</div>
          <div style={{ fontSize:13, color:L.sub, marginTop:3 }}>Business Management Platform</div>
        </div>

        <div style={{ background:L.srf, border:`1px solid ${L.bdr}`, borderRadius:16, padding:26, boxShadow:'0 3px 18px rgba(0,0,0,.06)' }}>

          {error && (
            <div style={{
              background: error.startsWith('✅') ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${error.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
              borderRadius:9, padding:'11px 14px',
              color: error.startsWith('✅') ? L.green : L.red,
              fontSize:12.5, marginBottom:16, lineHeight:1.5,
            }}>{error}</div>
          )}

          {step === 'entry' ? (
            <>
              {/* Login / Signup */}
              <div style={{ display:'flex', background:L.bg, borderRadius:10, padding:3, marginBottom:16 }}>
                {[['login','Sign In'],['signup','Create Account']].map(([id,label])=>(
                  <button key={id} onClick={()=>{ setMode(id); setError(''); }}
                    style={{ flex:1, background: mode===id?L.srf:'transparent', color: mode===id?L.darkRed:L.sub,
                             border: mode===id?`1px solid ${L.bdr}`:'1px solid transparent', borderRadius:8,
                             padding:'9px', fontSize:13, fontWeight: mode===id?700:500, cursor:'pointer', fontFamily:'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Phone / Email */}
              <div style={{ display:'flex', gap:7, marginBottom:18 }}>
                {[['phone','📱 Mobile OTP'],['email','✉️ Email']].map(([id,label])=>(
                  <button key={id} onClick={()=>{ setMethod(id); setError(''); }}
                    style={{ flex:1, background: method===id?L.lightRed:'transparent', color: method===id?L.red:L.sub,
                             border:`1.5px solid ${method===id?L.red:L.bdr}`, borderRadius:9, padding:'9px',
                             fontSize:12, fontWeight: method===id?700:500, cursor:'pointer', fontFamily:'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'signup' && (
                <div style={{ marginBottom:13 }}>
                  <label style={lbl}>Business Name *</label>
                  <input value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="e.g. Signals Elite" style={inp}/>
                </div>
              )}

              {method === 'phone' ? (
                <form onSubmit={requestOtp}>
                  <div style={{ marginBottom:16 }}>
                    <label style={lbl}>Mobile Number *</label>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ background:L.bg, border:`1px solid ${L.bdr}`, borderRadius:9, padding:'12px 13px', fontSize:14, color:L.sub, fontWeight:600 }}>+91</div>
                      <input type="tel" inputMode="numeric" value={phone} maxLength={10}
                        onChange={e=>setPhone(e.target.value.replace(/\D/g,''))}
                        placeholder="98430 12345" style={{ ...inp, flex:1, letterSpacing:'0.06em', fontSize:16 }}/>
                    </div>
                    <div style={{ fontSize:11, color:L.muted, marginTop:6 }}>We'll text you a 6-digit code</div>
                  </div>
                  <button type="submit" disabled={loading || phone.length < 10}
                    style={{ width:'100%', background: phone.length>=10 ? L.red : L.bdr, color:'#fff', border:'none',
                             borderRadius:10, padding:'14px', fontSize:15, fontWeight:700,
                             cursor: phone.length>=10 ? 'pointer':'not-allowed', fontFamily:'inherit' }}>
                    {loading ? 'Sending…' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:13 }}>
                  <div>
                    <label style={lbl}>Email *</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com" style={inp} required/>
                  </div>
                  <div>
                    <label style={lbl}>Password *</label>
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} required/>
                  </div>
                  <button type="submit" disabled={loading}
                    style={{ background:L.red, color:'#fff', border:'none', borderRadius:10, padding:'14px',
                             fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>
                    {loading ? 'Please wait…' : mode==='login' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>
              )}
            </>
          ) : (
            /* ── OTP step ─────────────────────────────────── */
            <>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{ fontSize:34, marginBottom:8 }}>📲</div>
                <div style={{ fontSize:16, fontWeight:800, color:L.darkRed }}>Enter the code</div>
                <div style={{ fontSize:12.5, color:L.sub, marginTop:5 }}>
                  Sent to <strong style={{ color:L.ink }}>+91 {phone}</strong>
                  <button onClick={()=>{ setStep('entry'); setError(''); }}
                    style={{ background:'none', border:'none', color:L.red, fontSize:12, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', marginLeft:6 }}>change</button>
                </div>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:18 }} onPaste={onOtpPaste}>
                {otp.map((d,i)=>(
                  <input key={i} ref={el=>otpRefs.current[i]=el}
                    type="tel" inputMode="numeric" maxLength={1} value={d}
                    onChange={e=>onOtpChange(i, e.target.value)}
                    onKeyDown={e=>onOtpKey(i, e)}
                    style={{ width:46, height:54, textAlign:'center', fontSize:22, fontWeight:800,
                             background: d?L.lightRed:L.bg, border:`2px solid ${d?L.red:L.bdr}`,
                             borderRadius:10, color:L.darkRed, fontFamily:'inherit', outline:'none' }}/>
                ))}
              </div>

              <button onClick={()=>submitOtp()} disabled={loading || otp.join('').length<6}
                style={{ width:'100%', background: otp.join('').length===6 ? L.green : L.bdr, color:'#fff',
                         border:'none', borderRadius:10, padding:'14px', fontSize:15, fontWeight:700,
                         cursor: otp.join('').length===6 ? 'pointer':'not-allowed', fontFamily:'inherit' }}>
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div style={{ textAlign:'center', marginTop:14 }}>
                {resendIn > 0
                  ? <span style={{ fontSize:12, color:L.muted }}>Resend code in {resendIn}s</span>
                  : <button onClick={requestOtp} disabled={loading}
                      style={{ background:'none', border:'none', color:L.red, fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      Resend OTP
                    </button>}
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign:'center', marginTop:18, fontSize:11, color:L.muted }}>
          By continuing you agree to keep your business data secure
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const nav=(p,t)=>{setPage(p);setDeepTab(t||null);};const{user,tenant,loading}=useAuth();const[showOnboard,setShowOnboard]=useState(false);const[page,setPage]=useState('dashboard');const[deepTab,setDeepTab]=useState(null);const[localTenant,setLocalTenant]=useState(null);const[branches,setBranches]=useState([]);const[activeBranch,setActiveBranch]=useState(null);
  const activeTenant=localTenant||tenant;
  const{role}=useRole(user,activeTenant);
  useEffect(()=>{if(activeTenant&&activeTenant.onboarded===false)setShowOnboard(true);},[activeTenant?.id,activeTenant?.onboarded]);
  useEffect(()=>{if(!activeTenant?.id)return;supabase.from('branches').select('*').eq('tenant_id',activeTenant.id).eq('active',true).order('is_main',{ascending:false}).order('name').then(({data})=>{if(data?.length){setBranches(data);setActiveBranch(data.find(b=>b.is_main)||data[0]);}}).catch(()=>{});},[activeTenant?.id]);
  if(loading)return(<div style={{minHeight:'100vh',background:'#F7F3F3',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}><div style={{width:52,height:52,background:'#7B1E1E',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,color:'#fff'}}>7SQ</div><div style={{width:40,height:40,border:'3px solid #C0392B',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></div>);
  if(!user)return<LoginPage/>;
  const props={deepTab,role,tenant:activeTenant,user,activeBranch};
  const PAGES={
    invhub:        <InvHub        {...props}/>,
    saleshub:      <SalesHub      {...props}/>,
    custhub:       <CustHub       {...props}/>,
    purchhub:      <PurchHub      {...props}/>,
    hrhub:         <HRHub         {...props}/>,
    gsthub:        <GSTHub        {...props}/>,
    accountinghub: <AccountingHub {...props}/>,
    salesdochub:   <SalesDocHub   {...props}/>,
    loyaltyhub:    <LoyaltyHub    {...props}/>,
    marketinghub:  <MarketingHub  {...props}/>,
    opshub:        <OpsHub        {...props}/>,
    aihub:         <AIHub         {...props}/>,
    toolshub:      <ToolsHub      {...props}/>,
    billscan:      <BillScanner   {...props}/>,
    rfm:           <RFMAnalysis   {...props}/>,
    heatmap:       <SalesHeatmap  {...props}/>,
    transfers:     <StockTransferOrders {...props}/>,
    compliance:    <ComplianceCalendar  {...props}/>,
    ledgeraging:   <CustomerLedgerAging {...props}/>,
    commrun:       <CommissionRun       {...props}/>,
    docexpiry:     <DocumentExpiry      {...props}/>,
    grn:           <GoodsReceiptNote   {...props}/>,
    batches:       <BatchExpiryTracker {...props}/>,
    shifthandover: <ShiftHandover      {...props}/>,
    visitlog:      <CustomerVisitLog   {...props}/>,
    gstrecon:      <GSTReconciliation  {...props}/>,
    reportshub:    <ReportsHub        {...props}/>,
    stockadjust:   <StockAdjustments  {...props}/>,
    payreminders:  <PaymentReminders  {...props}/>,
    supplierpay:   <SupplierPayments  {...props}/>,
    profitloss:    <ProfitAndLoss     {...props}/>,
    attendanceqr:  <StaffAttendanceQR {...props}/>,
    healthscore:   <BusinessHealthScore  {...props}/>,
    winback:       <WinBackCampaigns     {...props}/>,
    recurring:     <RecurringOrders      {...props}/>,
    pricehistory:  <PriceHistory         {...props}/>,
    supplierscore: <SupplierScorecard    {...props}/>,
    b2borders:     <B2BOrders            {...props}/>,
    requisitions:  <PurchaseRequisitions  {...props}/>,
    performance:   <ProductPerformance    {...props}/>,
    wareport:      <WhatsAppDailyReport   {...props}/>,
    stockval:      <StockValuation        {...props}/>,
    cashbook:      <DailyCashBook   {...props}/>,
    targets:       <SalesTargets    {...props}/>,
    reviews:       <ProductReviews  {...props}/>,
    coupons:       <CouponManager   {...props}/>,
    delivery:      <DeliveryManagement {...props}/>,
    paymentlinks:  <PaymentLinks        {...props}/>,
    warranty:      <WarrantyTracker     {...props}/>,
    taskboard:     <StaffTaskBoard      {...props}/>,
    smartalerts:   <SmartAlerts         {...props}/>,
    dashboard:       <Dashboard           {...props} onNavigate={nav}/>,
    pos:             <POS                 {...props}/>,
    sales:           <Sales               {...props}/>,
    inventory:       <Inventory           {...props}/>,
    customers:       <Customers           {...props}/>,
    purchases:       <Purchases           {...props}/>,
    expenses:        <ExpensesDashboard   {...props}/>,
    reports:         <Reports             {...props}/>,
    gst:             <GSTFiling           {...props}/>,
    ai:              <AIAssistant         {...props}/>,
    branches:        <Branches            {...props}/>,
    suppliers:       <Suppliers           {...props}/>,
    credit:          <CreditLedger        {...props}/>,
    variants:        <Variants            {...props}/>,
    attendance:      <Attendance          {...props}/>,
    payroll:         <Payroll             {...props}/>,
    loyalty:         <Loyalty             {...props} onTenantUpdate={t=>setLocalTenant(t)}/>,
    notifications:   <Notifications       {...props} onNavigate={nav}/>,
    store:           <OnlineStore         {...props}/>,
    portal:          <CustomerPortal      {...props}/>,
    returns:         <Returns             {...props}/>,
    pricelists:      <PriceLists          {...props}/>,
    transfer:        <StockTransfer       {...props}/>,
    purchaseorders:  <PurchaseOrders      {...props}/>,
    import:          <BulkImport          {...props}/>,
    catalog:         <WhatsAppCatalog     {...props}/>,
    segments:        <CustomerSegments    {...props}/>,
    documents:       <Documents           {...props}/>,
    cashregister:    <CashRegister        {...props}/>,
    qrlabels:        <QRLabels            {...props}/>,
    repairs:         <Repairs             {...props}/>,
    giftcards:       <GiftCards           {...props}/>,
    budget:          <BudgetTracker       {...props}/>,
    aging:           <InventoryAging      {...props}/>,
    feedback:        <Feedback            {...props}/>,
    wabot:           <WAOrderBot          {...props}/>,
    appointments:    <Appointments        {...props}/>,
    fyclose:         <FinancialYearClose  {...props}/>,
    einvoice:        <EInvoice            {...props}/>,
    multistore:      <MultiStoreAnalytics {...props}/>,
    autoreports:     <AutoReports         {...props}/>,
    promocodes:      <PromoCodes          {...props}/>,
    bundles:         <Bundles             {...props}/>,
    staffperf:       <StaffPerformance    {...props}/>,
    stockaudit:      <StockAudit          {...props}/>,
    backup:          <BackupRestore       {...props}/>,
    tally:           <TallyExport         {...props}/>,
    leaves:          <LeaveManagement     {...props}/>,
    sms:             <SMSAlerts           {...props}/>,
    vendor:          <VendorPortal        {...props}/>,
    servicebays:     <ServiceBays         {...props}/>,
    customerapp:     <CustomerApp       {...props}/>,
    advreports:      <AdvancedReports   {...props}/>,
    subscriptions:   <Subscriptions     {...props}/>,
    hrdashboard:     <HRDashboard       {...props}/>,
    eodreport:      <EODReport      {...props}/>,
    staffscheduler: <StaffScheduler {...props}/>,
    supplierRFQ:    <SupplierRFQ    {...props}/>,
    loyaltytiers:   <LoyaltyTiers   {...props}/>,
    aianalytics:    <AIAnalytics    {...props}/>,
    partnership:    <PartnershipAccounts {...props}/>,
    tds:            <TDSManagement       {...props}/>,
    demandforecast: <DemandForecast      {...props}/>,
    accounting:     <Accounting          {...props}/>,
    reorder:        <ReorderManagement   {...props}/>,
    usersaccess:    <UsersAccess    {...props}/>,
    campaigns:      <Campaigns      {...props}/>,
    referrals:      <Referrals      {...props}/>,
    salespipeline:  <SalesPipeline  {...props}/>,
    gstr3b:         <GSTR3B         {...props}/>,
    quotations:     <Quotations     {...props}/>,
    emimanager:     <EMIManager     {...props}/>,
    commissions:    <Commissions    {...props}/>,
    qualitycontrol: <QualityControl {...props}/>,
    ewaybill:       <EWayBill       {...props}/>,
    storeanalytics:   <StoreAnalytics      {...props}/>,
    purchasereturns:  <PurchaseReturns    {...props}/>,
    productcatalog:   <ProductCatalog     {...props}/>,
    custstatements:   <CustomerStatements {...props}/>,
    auditlog:         <AuditLog           {...props}/>,
    expenseclaims:   <ExpenseClaims    {...props}/>,
    creditnotes:     <CreditNotes      {...props}/>,
    barcodegen:      <BarcodeGenerator {...props}/>,
    cashflow:        <CashFlowForecast {...props}/>,
    watemplates:     <WATemplates      {...props}/>,
    team:            <Team                {...props}/>,
    billing:         <Billing             {...props}/>,
    settings:        <Settings            {...props} onTenantUpdate={t=>setLocalTenant(t)}/>,
  };
  if(showOnboard&&activeTenant)return(<OnboardingWizard tenant={activeTenant} user={user} onComplete={()=>setShowOnboard(false)}/>);
  return(<><style>{"*{box-sizing:border-box;margin:0;padding:0}body{background:#F7F3F3;color:#111827;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}@keyframes spin{to{transform:rotate(360deg)}}"}</style><AppShell role={role} tenant={activeTenant} user={user} page={page} onNavigate={nav} onLogout={()=>signOut()} branches={branches} activeBranch={activeBranch} onBranchChange={setActiveBranch}>{canAccess(role,page)?(PAGES[page]||PAGES.dashboard):PAGES.dashboard}</AppShell></>);
}
