import { useState, useEffect } from 'react';
import { useLang, LANGUAGES } from '../../lib/i18n';

const T = {
  bg:'#060710', srf:'#0f1220', bdr:'#1e2540', blue:'#4f7cff',
  ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547',
};

const NAV = [
  { id:'dashboard', labelKey:'dashboard',   icon:'📊' },
  { id:'pos',       labelKey:'pos',          icon:'🛒' },
  { id:'sales',     labelKey:'salesHistory', icon:'🧾' },
  { id:'inventory', labelKey:'inventory',    icon:'📦' },
  { id:'customers', labelKey:'customers',    icon:'👥' },
  { id:'purchases', labelKey:'purchases',    icon:'🛍️' },
  { id:'expenses',  labelKey:'expenses',     icon:'💸' },
  { id:'reports',   labelKey:'reports',      icon:'📈' },
  { id:'gst',       labelKey:'gstFiling',    icon:'📋' },
  { id:'ai',        labelKey:'aiAssistant',  icon:'🤖' },
  { id:'returns',        label:'Returns',          icon:'🔄' },
  { id:'pricelists',     label:'Price Lists',      icon:'🏷️' },
  { id:'transfer',       label:'Stock Transfer',   icon:'🔀' },
  { id:'purchaseorders', label:'Purchase Orders',  icon:'📋' },
  { divider: true },
  { id:'branches',   labelKey:'branch',       icon:'🏪' },
  { id:'suppliers',  label:'Suppliers',       icon:'🏭' },
  { id:'credit',     label:'Credit Ledger',   icon:'📒' },
  { id:'variants',   label:'Variants',        icon:'🎨' },
  { id:'attendance', label:'Attendance',      icon:'📅' },
  { id:'payroll',    label:'Payroll',         icon:'💰' },
  { id:'loyalty',    label:'Loyalty Points',  icon:'🎁' },
  { id:'notifications', label:'Notifications', icon:'🔔' },
  { id:'store',      label:'Online Store',    icon:'🌐' },
  { id:'portal',     label:'Customer Portal', icon:'🔗' },
  { id:"import",    label:"Bulk Import",       icon:"⬆️" },
  { id:"catalog",   label:"WA Catalog",        icon:"💬" },
  { id:"segments",  label:"Segments",          icon:"🎯" },
  { id:"documents", label:"Documents",         icon:"📂" },
  { id:'cashregister', label:'Cash Register',  icon:'💵' },
  { id:'qrlabels',     label:'QR Labels',      icon:'🏷️' },
  { id:'repairs',      label:'Repairs',        icon:'🔧' },
  { id:'giftcards', label:'Gift Cards',        icon:'🎁' },
  { id:'budget',    label:'Budget Tracker',    icon:'📊' },
  { id:'aging',     label:'Inventory Aging',   icon:'📉' },
  { id:'feedback',  label:'Feedback',          icon:'⭐' },
  { id:'wabot',     label:'Order Bot',         icon:'🤖' },
  { id:'appointments', label:'Appointments',   icon:'📅' },
  { id:'fyclose',      label:'Year Close',     icon:'📆' },
  { id:'einvoice',     label:'E-Invoice',      icon:'🧾' },
  { id:'multistore',   label:'Multi-Store',    icon:'🏪' },
  { id:'autoreports',  label:'Auto Reports',   icon:'📧' },
  { id:'promocodes', label:'Promo Codes',      icon:'🏷️' },
  { id:'bundles',    label:'Bundles',          icon:'📦' },
  { id:'staffperf',  label:'Staff Performance',icon:'🏆' },
  { id:'stockaudit', label:'Stock Audit',      icon:'📋' },
  { id:'backup',     label:'Backup & Restore', icon:'💾' },
  { id:'team',      labelKey:'team',         icon:'👔' },
  { id:'billing',   labelKey:'billing',      icon:'💳' },
  { id:'settings',  labelKey:'settings',     icon:'⚙️' },
];

export default function AppShell({ tenant, user, page, onNavigate, onLogout, children, branches, activeBranch, onBranchChange }) {
  const [open,        setOpen]        = useState(true);
  const [online,      setOnline]      = useState(navigator.onLine);
  const [mobile,      setMobile]      = useState(window.innerWidth < 768);
  const [installable, setInstallable] = useState(false);
  const [deferredEvt, setDeferredEvt] = useState(null);
  const [showLang,    setShowLang]    = useState(false);
  const { lang, setLang, tr }         = useLang();

  useEffect(() => {
    const onR = () => { const m = window.innerWidth < 768; setMobile(m); if (m) setOpen(false); };
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    window.addEventListener('resize',  onR);
    if (window.innerWidth < 768) setOpen(false);
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setDeferredEvt(e); setInstallable(true); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => window.removeEventListener('resize', onR);
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
      <style>{`::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#1e2540;border-radius:3px}`}</style>

      {/* Sidebar */}
      <div style={{ width:W, flexShrink:0, background:T.srf, borderRight:`1px solid ${T.bdr}`, display:'flex', flexDirection:'column', transition:'width .2s', overflow:'hidden', position:mobile?'fixed':'relative', zIndex:100, height:'100vh', transform:mobile&&!open?'translateX(-100%)':'translateX(0)' }}>

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
                title={!open ? tr(item.labelKey) : undefined}
                style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 9px', borderRadius:7, cursor:'pointer', marginBottom:2, background:active?T.blue+'22':'transparent', color:active?T.blue:T.sub }}>
                <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                {open && <span style={{ fontSize:13, fontWeight:active?700:500, whiteSpace:'nowrap' }}>{item.label || tr(item.labelKey)}</span>}
              </div>
            );
          })}
        </nav>

        {/* Install + User */}
        {installable && open && (
          <div style={{ padding:'6px 8px' }}>
            <button onClick={handleInstall} style={{ width:'100%', background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'7px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              📱 {tr('settings')} — Install App
            </button>
          </div>
        )}

        <div style={{ padding:'8px 6px', borderTop:`1px solid ${T.bdr}`, flexShrink:0 }}>
          {open && <div style={{ fontSize:10, color:T.muted, padding:'2px 9px 6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>}
          <div onClick={onLogout} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 9px', borderRadius:7, cursor:'pointer', color:T.muted }}>
            <span style={{ fontSize:16, width:22, textAlign:'center' }}>🚪</span>
            {open && <span style={{ fontSize:12 }}>{tr('signOut')}</span>}
          </div>
        </div>
      </div>

      {mobile && open && <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:99 }} />}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Topbar */}
        <div style={{ height:50, background:T.srf, borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', padding:'0 14px', gap:10, flexShrink:0 }}>
          <button onClick={() => setOpen(s => !s)} style={{ background:'none', border:'none', color:T.sub, cursor:'pointer', fontSize:20, lineHeight:1 }}>☰</button>

          {/* Branch selector */}
          {branches && branches.length > 1 && (
            <select
              value={activeBranch?.id || ''}
              onChange={e => {
                const b = branches.find(x => x.id === e.target.value) || null;
                onBranchChange?.(b);
              }}
              style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
              <option value="">{tr('allBranches')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {!online && <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 9px', fontSize:11, color:T.amber }}>📴 Offline</div>}
          <div style={{ flex:1 }} />

          {/* Language switcher */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowLang(s => !s)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', color:T.sub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {LANGUAGES.find(l => l.code === lang)?.flag} {LANGUAGES.find(l => l.code === lang)?.nativeLabel}
            </button>
            {showLang && (
              <div style={{ position:'absolute', right:0, top:36, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, overflow:'hidden', zIndex:200, minWidth:140 }}>
                {LANGUAGES.map(l => (
                  <div key={l.code}
                    onClick={() => { setLang(l.code); setShowLang(false); }}
                    style={{ padding:'9px 14px', cursor:'pointer', fontSize:13, color: lang===l.code ? T.blue : T.ink, background: lang===l.code ? T.blue+'18' : 'transparent', display:'flex', alignItems:'center', gap:8 }}>
                    <span>{l.flag}</span>
                    <span>{l.nativeLabel}</span>
                    {lang === l.code && <span style={{ marginLeft:'auto', color:T.blue }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {tenant?.plan_status === 'trial' && (
            <div onClick={() => onNavigate('billing')} style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 10px', fontSize:11, color:T.amber, cursor:'pointer' }}>
              Trial → Upgrade
            </div>
          )}
          <div style={{ width:8, height:8, borderRadius:'50%', background:online?T.green:T.amber }} />
          <span style={{ fontSize:11, color:online?T.green:T.amber }}>{online?'Live':'Offline'}</span>
        </div>

        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
    </div>
  );
}
