import { useState, useEffect } from 'react';

const T = {
  bg:'#060710', srf:'#0f1220', bdr:'#1e2540', blue:'#4f7cff',
  ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547',
};

const NAV = [
  { id:'dashboard', label:'Dashboard',   icon:'📊' },
  { id:'pos',       label:'POS / Sales', icon:'🛒' },
  { id:'sales',     label:'Sales History',icon:'🧾' },
  { id:'inventory', label:'Inventory',   icon:'📦' },
  { id:'customers', label:'Customers',   icon:'👥' },
  { id:'purchases', label:'Purchases',   icon:'🛍️' },
  { id:'expenses',  label:'Expenses',    icon:'💸' },
  { id:'reports',   label:'Reports',     icon:'📈' },
  { divider: true },
  { id:'gst',       label:'GST Filing',    icon:'📋' },
  { id:'ai',        label:'AI Assistant',  icon:'🤖' },
  { divider: true },
  { id:'team',      label:'Team',        icon:'👔' },
  { id:'billing',   label:'Billing',     icon:'💳' },
  { id:'settings',  label:'Settings',    icon:'⚙️' },
];

export default function AppShell({ tenant, user, page, onNavigate, onLogout, children }) {
  const [open,        setOpen]        = useState(true);
  const [online,      setOnline]      = useState(navigator.onLine);
  const [mobile,      setMobile]      = useState(window.innerWidth < 768);
  const [installable, setInstallable] = useState(false);
  const [deferredEvt, setDeferredEvt] = useState(null);

  useEffect(() => {
    const onR = () => { const m = window.innerWidth < 768; setMobile(m); if (m) setOpen(false); };
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    window.addEventListener('resize',  onR);
    if (mobile) setOpen(false);

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredEvt(e);
      setInstallable(true);
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }

    return () => { window.removeEventListener('resize', onR); };
  }, []);

  async function handleInstall() {
    if (!deferredEvt) return;
    deferredEvt.prompt();
    const { outcome } = await deferredEvt.userChoice;
    if (outcome === 'accepted') setInstallable(false);
  }

  const W = open ? 215 : 58;

  return (
    <div style={{ display:'flex', height:'100vh', background:T.bg, color:T.ink, fontFamily:"'DM Sans',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#1e2540;border-radius:3px}`}</style>

      {/* Sidebar */}
      <div style={{
        width:W, flexShrink:0, background:T.srf, borderRight:`1px solid ${T.bdr}`,
        display:'flex', flexDirection:'column', transition:'width .2s', overflow:'hidden',
        position:mobile?'fixed':'relative', zIndex:100, height:'100vh',
        transform:mobile&&!open?'translateX(-100%)':'translateX(0)',
      }}>
        {/* Logo */}
        <div style={{ padding:'13px 10px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${T.bdr}`, flexShrink:0 }}>
          <div style={{ width:34, height:34, background:T.blue, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'#fff', flexShrink:0 }}>ES</div>
          {open && <div style={{ overflow:'hidden' }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tenant?.name || 'Elite Store'}</div>
            <div style={{ fontSize:10, color:T.muted, textTransform:'capitalize' }}>{tenant?.plan || 'starter'} plan</div>
          </div>}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'6px 5px', overflowY:'auto' }}>
          {NAV.map((item, i) => {
            if (item.divider) return <div key={i} style={{ height:1, background:T.bdr, margin:'6px 8px' }} />;
            const active = page === item.id;
            return (
              <div key={item.id}
                onClick={() => { onNavigate(item.id); if (mobile) setOpen(false); }}
                title={!open ? item.label : undefined}
                style={{
                  display:'flex', alignItems:'center', gap:9, padding:'8px 9px',
                  borderRadius:7, cursor:'pointer', marginBottom:2,
                  background:active?T.blue+'22':'transparent', color:active?T.blue:T.sub,
                }}>
                <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                {open && <span style={{ fontSize:13, fontWeight:active?700:500, whiteSpace:'nowrap' }}>{item.label}</span>}
              </div>
            );
          })}
        </nav>

        {/* Install PWA button */}
        {installable && open && (
          <div style={{ padding:'8px 10px', borderTop:`1px solid ${T.bdr}` }}>
            <button onClick={handleInstall} style={{ width:'100%', background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'8px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
              📱 Install App
            </button>
          </div>
        )}

        {/* User + logout */}
        <div style={{ padding:'8px 6px', borderTop:`1px solid ${T.bdr}`, flexShrink:0 }}>
          {open && <div style={{ fontSize:10, color:T.muted, padding:'2px 9px 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>}
          <div onClick={onLogout} title="Sign out" style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 9px', borderRadius:7, cursor:'pointer', color:T.muted }}>
            <span style={{ fontSize:16, width:22, textAlign:'center' }}>🚪</span>
            {open && <span style={{ fontSize:12 }}>Sign out</span>}
          </div>
        </div>
      </div>

      {mobile && open && <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:99 }} />}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Topbar */}
        <div style={{ height:50, background:T.srf, borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', padding:'0 14px', gap:10, flexShrink:0 }}>
          <button onClick={() => setOpen(s => !s)} style={{ background:'none', border:'none', color:T.sub, cursor:'pointer', fontSize:20, lineHeight:1 }}>☰</button>
          {!online && (
            <div style={{ display:'flex', alignItems:'center', gap:5, background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 9px', fontSize:11, color:T.amber }}>
              📴 Offline — changes saved locally
            </div>
          )}
          <div style={{ flex:1 }} />
          {/* Trial badge */}
          {tenant?.plan_status === 'trial' && (
            <div onClick={() => onNavigate('billing')} style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 10px', fontSize:11, color:T.amber, cursor:'pointer' }}>
              Trial · {Math.max(0, Math.ceil((new Date(tenant.trial_ends_at||Date.now()) - new Date()) / 86400000))} days → Upgrade
            </div>
          )}
          <div style={{ width:8, height:8, borderRadius:'50%', background:online?T.green:T.amber }} />
          <span style={{ fontSize:11, color:online?T.green:T.amber }}>{online?'Live':'Offline'}</span>
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
    </div>
  );
}
