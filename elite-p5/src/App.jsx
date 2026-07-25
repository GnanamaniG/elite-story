import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { signIn, signUp, signOut } from './lib/supabase';
import AppShell   from './components/layout/AppShell';
import Dashboard  from './pages/Dashboard';
import POS        from './pages/POSv5';
import Sales      from './pages/Sales';
import Inventory  from './pages/Inventory';
import Customers  from './pages/Customers';
import Expenses   from './pages/Expenses';
import Purchases  from './pages/Purchases';
import Reports    from './pages/Reports';
import GSTFiling  from './pages/GSTFiling';
import AIAssistant from './pages/AIAssistant';
import Team       from './pages/Team';
import Billing    from './pages/Billing';
import Settings   from './pages/Settings';

const T = { bg:'#060710', srf:'#0f1220', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', red:'#ff4d6a', green:'#00d68f' };

function LoginPage() {
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [bizName,setBizName]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const inp={width:'100%',background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:8,padding:'11px 14px',color:T.ink,fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
  async function handle(e){e.preventDefault();setLoading(true);setError('');try{if(mode==='login'){const{error:err}=await signIn(email,password);if(err)throw err;}else{if(!bizName.trim()){setError('Business name required');setLoading(false);return;}const{error:err}=await signUp(email,password,{biz_name:bizName,biz_type:'retail'});if(err)throw err;setError('\u2705 Account created! Check your email, then sign in.');setMode('login');}}catch(e){setError(e.message);}finally{setLoading(false);}}
  return(<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{width:'100%',maxWidth:400}}><div style={{textAlign:'center',marginBottom:32}}><div style={{width:64,height:64,background:T.blue,borderRadius:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,color:'#fff',marginBottom:16}}>ES</div><div style={{fontSize:26,fontWeight:800,color:T.ink}}>Elite Store</div><div style={{fontSize:13,color:T.sub,marginTop:4}}>Business Management Platform</div></div><div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:14,padding:28}}>{error&&<div style={{background:error.startsWith('\u2705')?T.green+'18':T.red+'18',border:`1px solid ${error.startsWith('\u2705')?T.green:T.red}44`,borderRadius:8,padding:'10px 14px',color:error.startsWith('\u2705')?T.green:T.red,fontSize:13,marginBottom:16}}>{error}</div>}<div style={{display:'flex',background:T.bg,borderRadius:9,padding:3,marginBottom:20}}>{[['login','Sign In'],['signup','Create Account']].map(([id,label])=>(<button key={id} onClick={()=>{setMode(id);setError('');}} style={{flex:1,background:mode===id?T.srf:'transparent',color:mode===id?T.ink:T.sub,border:mode===id?`1px solid ${T.bdr}`:'none',borderRadius:7,padding:'8px',fontSize:13,fontWeight:mode===id?700:500,cursor:'pointer',fontFamily:'inherit'}}>{label}</button>))}</div><form onSubmit={handle} style={{display:'flex',flexDirection:'column',gap:13}}>{mode==='signup'&&<div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Business Name *</label><input value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="e.g. Signals Elite" style={inp}/></div>}<div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Email *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com" style={inp} required/></div><div><label style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:5}}>Password *</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} required/></div><button type="submit" disabled={loading} style={{background:T.blue,color:'#fff',border:'none',borderRadius:9,padding:'13px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>{loading?'Please wait…':mode==='login'?'Sign In':'Create Account'}</button></form></div></div></div>);
}

export default function App() {
  const{user,tenant,loading}=useAuth();const[page,setPage]=useState('dashboard');const[localTenant,setLocalTenant]=useState(null);const activeTenant=localTenant||tenant;
  if(loading)return(<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}><div style={{width:52,height:52,background:T.blue,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,color:'#fff'}}>ES</div><div style={{width:40,height:40,border:'3px solid #4f7cff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>);
  if(!user)return<LoginPage/>;
  const PAGES={dashboard:<Dashboard tenant={activeTenant} user={user} onNavigate={setPage}/>,pos:<POS tenant={activeTenant} user={user}/>,sales:<Sales tenant={activeTenant} user={user}/>,inventory:<Inventory tenant={activeTenant} user={user}/>,customers:<Customers tenant={activeTenant} user={user}/>,purchases:<Purchases tenant={activeTenant} user={user}/>,expenses:<Expenses tenant={activeTenant} user={user}/>,reports:<Reports tenant={activeTenant} user={user}/>,gst:<GSTFiling tenant={activeTenant} user={user}/>,ai:<AIAssistant tenant={activeTenant} user={user}/>,team:<Team tenant={activeTenant} user={user}/>,billing:<Billing tenant={activeTenant} user={user}/>,settings:<Settings tenant={activeTenant} user={user} onTenantUpdate={t=>setLocalTenant(t)}/>};
  return(<><style>{"*{box-sizing:border-box;margin:0;padding:0}body{background:#060710;color:#eef0f8;font-family:'DM Sans',system-ui,sans-serif}@keyframes spin{to{transform:rotate(360deg)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#1e2540;border-radius:3px}"}</style><AppShell tenant={activeTenant} user={user} page={page} onNavigate={setPage} onLogout={()=>signOut()}>{PAGES[page]||PAGES.dashboard}</AppShell></>);
}