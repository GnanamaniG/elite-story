import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { signIn, signUp, signOut, supabase } from './lib/supabase';
import AppShell           from './components/layout/AppShell';
import Dashboard          from './pages/Dashboard';
import POS                from './pages/POS';
import Sales              from './pages/Sales';
import Inventory          from './pages/Inventory';
import Customers          from './pages/Customers';
import Expenses           from './pages/Expenses';
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


const T = { bg:'#060710', srf:'#0f1220', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', red:'#ff4d6a', green:'#00d68f' };

function LoginPage() {
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [bizName,setBizName]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const inp={width:'100%',background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:8,padding:'11px 14px',color:T.ink,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  async function handle(e){e.preventDefault();setLoading(true);setError('');try{if(mode==='login'){const{error:err}=await signIn(email,password);if(err)throw err;}else{if(!bizName.trim()){setError('Business name required');setLoading(false);return;}const{error:err}=await signUp(email,password,{biz_name:bizName,biz_type:'retail'});if(err)throw err;setError('✅ Account created! Check your email.');setMode('login');}}catch(e){setError(e.message);}finally{setLoading(false);}}
  return(<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{width:'100%',maxWidth:400}}><div style={{textAlign:'center',marginBottom:32}}><div style={{width:64,height:64,background:T.blue,borderRadius:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,color:'#fff',marginBottom:16,boxShadow:'0 0 32px #4f7cff44'}}>ES</div><div style={{fontSize:26,fontWeight:800,color:T.ink}}>Elite Store</div><div style={{fontSize:13,color:T.sub,marginTop:4}}>Business Management Platform</div></div><div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:14,padding:28}}>{error&&<div style={{background:error.startsWith('✅')?T.green+'18':T.red+'18',border:`1px solid ${error.startsWith('✅')?T.green:T.red}44`,borderRadius:8,padding:'10px 14px',color:error.startsWith('✅')?T.green:T.red,fontSize:13,marginBottom:16}}>{error}</div>}<div style={{display:'flex',background:T.bg,borderRadius:9,padding:3,marginBottom:20}}>{[['login','Sign In'],['signup','Create Account']].map(([id,label])=>(<button key={id} onClick={()=>{setMode(id);setError('');}} style={{flex:1,background:mode===id?T.srf:'transparent',color:mode===id?T.ink:T.sub,border:mode===id?`1px solid ${T.bdr}`:'none',borderRadius:7,padding:'8px',fontSize:13,fontWeight:mode===id?700:500,cursor:'pointer',fontFamily:'inherit'}}>{label}</button>))}</div><form onSubmit={handle} style={{display:'flex',flexDirection:'column',gap:13}}>{mode==='signup'&&<div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Business Name *</label><input value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="e.g. Signals Elite" style={inp}/></div>}<div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Email *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com" style={inp} required/></div><div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Password *</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} required/></div><button type="submit" disabled={loading} style={{background:T.blue,color:'#fff',border:'none',borderRadius:9,padding:'13px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>{loading?'Please wait…':mode==='login'?'Sign In':'Create Account'}</button></form></div></div></div>);
}

export default function App() {
  const{user,tenant,loading}=useAuth();const[page,setPage]=useState('dashboard');const[localTenant,setLocalTenant]=useState(null);const[branches,setBranches]=useState([]);const[activeBranch,setActiveBranch]=useState(null);
  const activeTenant=localTenant||tenant;
  useEffect(()=>{if(!activeTenant?.id)return;supabase.from('branches').select('*').eq('tenant_id',activeTenant.id).eq('active',true).order('is_main',{ascending:false}).order('name').then(({data})=>{if(data?.length){setBranches(data);setActiveBranch(data.find(b=>b.is_main)||data[0]);}}).catch(()=>{});},[activeTenant?.id]);
  if(loading)return(<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}><div style={{width:52,height:52,background:T.blue,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,color:'#fff'}}>ES</div><div style={{width:40,height:40,border:'3px solid #4f7cff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></div>);
  if(!user)return<LoginPage/>;
  const props={tenant:activeTenant,user,activeBranch};
  const PAGES={
    dashboard:       <Dashboard           {...props} onNavigate={setPage}/>,
    pos:             <POS                 {...props}/>,
    sales:           <Sales               {...props}/>,
    inventory:       <Inventory           {...props}/>,
    customers:       <Customers           {...props}/>,
    purchases:       <Purchases           {...props}/>,
    expenses:        <Expenses            {...props}/>,
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
    notifications:   <Notifications       {...props} onNavigate={setPage}/>,
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
  return(<><style>{"*{box-sizing:border-box;margin:0;padding:0}body{background:#060710;color:#eef0f8;font-family:'DM Sans',system-ui,sans-serif}@keyframes spin{to{transform:rotate(360deg)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#1e2540;border-radius:3px}"}</style><AppShell tenant={activeTenant} user={user} page={page} onNavigate={setPage} onLogout={()=>signOut()} branches={branches} activeBranch={activeBranch} onBranchChange={setActiveBranch}>{PAGES[page]||PAGES.dashboard}</AppShell></>);
}
