import { useState, useEffect } from 'react';
import { useLang, LANGUAGES } from '../../lib/i18n';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1',
  muted:'#4a5175', dim:'#2a3050',
  ink:'#eef0f8', sub:'#8892b0'
};

const NAV = [
  // ── Core ─────────────────────────────────────────
  { id:'dashboard',      label:'Business Pulse',     icon:'⚡' },
  { id:'pos',            label:'Sales / POS',        icon:'🧧' },
  { id:'sales',          label:'Sales History',      icon:'📄' },
  { id:'inventory',      label:'Items / Products',   icon:'📦' },
  { id:'customers',      label:'Customers',          icon:'👥' },
  { id:'purchases',      label:'Purchases',          icon:'🛒' },
  { id:'expenses',       label:'Expenses',           icon:'💸' },
  { id:'reports',        label:'Analytics / Reports',icon:'📊' },

  // ── Finance & GST ─────────────────────────────────
  { section:'Finance & GST' },
  { id:'accounting',     label:'Accounting',         icon:'📒' },
  { id:'gst',            label:'GST Filing (GSTR-1)',icon:'📋' },
  { id:'gstr3b',         label:'GSTR-3B & ITC',      icon:'📊' },
  { id:'budget',         label:'Budget Tracker',     icon:'📊' },
  { id:'cashflow',       label:'Cash Flow Forecast', icon:'💹' },
  { id:'expenseclaims',  label:'Expense Claims',     icon:'🧾' },
  { id:'creditnotes',    label:'Credit Notes',       icon:'📝' },
  { id:'tds',            label:'TDS Management',     icon:'🏦' },
  { id:'partnership',    label:'Partnership Accts',  icon:'🤝' },

  // ── Sales Documents ────────────────────────────────
  { section:'Sales Documents' },
  { id:'quotations',     label:'Quotations',         icon:'📋' },
  { id:'emimanager',     label:'EMI / BNPL',         icon:'💳' },
  { id:'ewaybill',       label:'e-Way Bill',         icon:'🚚' },
  { id:'einvoice',       label:'E-Invoice',          icon:'🧾' },
  { id:'credit',         label:'Credit Ledger',      icon:'📒' },
  { id:'custstatements', label:'Customer Statements',icon:'📄' },

  // ── Inventory & Purchasing ─────────────────────────
  { section:'Inventory & Purchasing' },
  { id:'suppliers',      label:'Suppliers',          icon:'🏭' },
  { id:'purchaseorders', label:'Purchase Orders',    icon:'📋' },
  { id:'pricelists',     label:'Price Lists',        icon:'🏷️' },
  { id:'variants',       label:'Variants',           icon:'🎨' },
  { id:'stockaudit',     label:'Stock Audit',        icon:'📋' },
  { id:'aging',          label:'Inventory Aging',    icon:'📉' },
  { id:'transfer',       label:'Stock Transfer',     icon:'🔀' },
  { id:'reorder',        label:'Reorder Management', icon:'🔄' },
  { id:'supplierRFQ',    label:'Supplier RFQ',       icon:'📨' },
  { id:'demandforecast', label:'Demand Forecast',    icon:'🔮' },
  { id:'purchasereturns',label:'Purchase Returns',   icon:'↩️' },
  { id:'vendor',         label:'Vendor Portal',      icon:'🏭' },

  // ── Customer & Loyalty ────────────────────────────
  { section:'Customers & Loyalty' },
  { id:'loyalty',        label:'Loyalty Points',     icon:'🎁' },
  { id:'loyaltytiers',   label:'Loyalty Tiers',      icon:'👑' },
  { id:'giftcards',      label:'Gift Cards',         icon:'🎁' },
  { id:'referrals',      label:'Referrals',          icon:'🔗' },
  { id:'salespipeline',  label:'Sales Pipeline',     icon:'🎯' },
  { id:'segments',       label:'Customer Segments',  icon:'🎯' },
  { id:'feedback',       label:'Feedback',           icon:'⭐' },
  { id:'portal',         label:'Customer Portal',    icon:'🔗' },
  { id:'customerapp',    label:'Customer App',       icon:'📱' },
  { id:'returns',        label:'Returns',            icon:'🔄' },

  // ── Marketing ─────────────────────────────────────
  { section:'Marketing' },
  { id:'campaigns',      label:'Campaigns',          icon:'📣' },
  { id:'catalog',        label:'WA Catalog',         icon:'💬' },
  { id:'wabot',          label:'WA Order Bot',       icon:'🤖' },
  { id:'watemplates',    label:'WA Templates',       icon:'💬' },
  { id:'sms',            label:'SMS Alerts',         icon:'📱' },
  { id:'promocodes',     label:'Promo Codes',        icon:'🏷️' },
  { id:'bundles',        label:'Bundles',            icon:'📦' },
  { id:'store',          label:'Online Store',       icon:'🌐' },
  { id:'productcatalog', label:'Product Catalog',    icon:'📱' },

  // ── HR & Payroll ──────────────────────────────────
  { section:'HR & Payroll' },
  { id:'attendance',     label:'Attendance',         icon:'📅' },
  { id:'payroll',        label:'Payroll',            icon:'💰' },
  { id:'leaves',         label:'Leave Management',   icon:'🗓️' },
  { id:'hrdashboard',    label:'HR Dashboard',       icon:'👥' },
  { id:'staffperf',      label:'Staff Performance',  icon:'🏆' },
  { id:'commissions',    label:'Commissions',        icon:'🏆' },
  { id:'staffscheduler', label:'Staff Scheduler',    icon:'📅' },
  { id:'appointments',   label:'Appointments',       icon:'📅' },

  // ── Operations ────────────────────────────────────
  { section:'Operations' },
  { id:'branches',       label:'Branches',           icon:'🏪' },
  { id:'cashregister',   label:'Cash Register',      icon:'🖨️' },
  { id:'eodreport',      label:'EOD Report',         icon:'🌙' },
  { id:'servicebays',    label:'Service Bays',       icon:'🏪' },
  { id:'repairs',        label:'Repairs',            icon:'🔧' },
  { id:'qrlabels',       label:'QR Labels',          icon:'🏷️' },
  { id:'storeanalytics', label:'Store Analytics',    icon:'📊' },
  { id:'multistore',     label:'Multi-Store',        icon:'🏪' },
  { id:'subscriptions',  label:'Subscriptions',      icon:'🔁' },
  { id:'fyclose',        label:'Financial Year Close',icon:'📆' },
  { id:'autoreports',    label:'Auto Reports',       icon:'📧' },
  { id:'advreports',     label:'Advanced Reports',   icon:'📊' },

  // ── Tools ─────────────────────────────────────────
  { section:'Tools & Admin' },
  { id:'qualitycontrol', label:'Quality Control',    icon:'✅' },
  { id:'barcodegen',     label:'Barcode Generator',  icon:'🔲' },
  { id:'documents',      label:'Documents',          icon:'📂' },
  { id:'import',         label:'Bulk Import',        icon:'⬆️' },
  { id:'backup',         label:'Backup & Restore',   icon:'💾' },
  { id:'tally',          label:'Tally Export',       icon:'📊' },
  { id:'auditlog',       label:'Audit Trail',        icon:'🔍' },
  { id:'usersaccess',    label:'Users & Access',     icon:'🔐' },
  { id:'aianalytics',    label:'AI Analytics',       icon:'🤖' },
  { id:'ai',             label:'AI Assistant',       icon:'🤖' },

  // ── Settings ──────────────────────────────────────
  { section:'Settings' },
  { id:'notifications',  label:'Notifications',      icon:'🔔' },
  { id:'team',           label:'Team',               icon:'👥' },
  { id:'billing',        label:'Billing',            icon:'💳' },
  { id:'settings',       label:'Settings',           icon:'⚙️' },
];

export default function AppShell({ children, user, tenant, page, onNavigate, onLogout, branches, activeBranch, onBranchChange, online = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile,    setMobile]    = useState(window.innerWidth < 768);
  const [mobOpen,   setMobOpen]   = useState(false);
  const { lang, setLang }         = useLang();
  const [showLang,  setShowLang]  = useState(false);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const sideOpen = mobile ? mobOpen : !collapsed;
  const W        = mobile ? 218 : (collapsed ? 62 : 218);

  return (
    <div style={{ display:'flex', height:'100vh', background:T.bg, color:T.ink, fontFamily:'"DM Sans",system-ui,-apple-system,sans-serif', overflow:'hidden' }}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0b0d1a}
        ::-webkit-scrollbar-thumb{background:#1c2038;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#252b48}
        input:focus,select:focus,textarea:focus{outline:1.5px solid #4f7cff;outline-offset:0}
        button:focus-visible{outline:1.5px solid #4f7cff;outline-offset:2px}
        select option{background:#0f1220;color:#eef0f8}
        input,select,textarea,button{font-family:"DM Sans",system-ui,sans-serif}
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes skelShine{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .fade-up{animation:fadeUp .2s ease}
        .skel{background:linear-gradient(90deg,#1a1e32 25%,#222740 50%,#1a1e32 75%);background-size:200% 100%;animation:skelShine 1.4s ease-in-out infinite;border-radius:6px}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;color:#4a5175;text-align:center;gap:10px}
        .empty-state .es-icon{font-size:36px;opacity:.55}
        .empty-state .es-title{font-size:14px;font-weight:700;color:#8892b0}
        .empty-state .es-sub{font-size:12px}
        .pbar-track{height:4px;background:#1a1e32;border-radius:2px;overflow:hidden}
        .pbar-fill{height:100%;border-radius:2px;transition:width .5s ease}
        .alert-v3-danger{background:rgba(255,77,106,.1);border:1px solid rgba(255,77,106,.25);color:#ff4d6a;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-warn{background:rgba(255,181,71,.1);border:1px solid rgba(255,181,71,.25);color:#ffb547;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-info{background:rgba(79,124,255,.1);border:1px solid rgba(79,124,255,.25);color:#4f7cff;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-success{background:rgba(0,214,143,.1);border:1px solid rgba(0,214,143,.25);color:#00d68f;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        @media(max-width:768px){.hide-mobile{display:none!important}.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}}
      `}</style>

      {/* ── Sidebar ─────────────────────────────────── */}
      <div style={{
        width:W, flexShrink:0, background:T.srf,
        borderRight:`1px solid ${T.bdr}`,
        display:'flex', flexDirection:'column',
        transition:'width .25s', overflow:'hidden',
        position: mobile ? 'fixed' : 'relative',
        zIndex: mobile ? 400 : 1, height:'100vh',
        transform: mobile && !mobOpen ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: mobile && mobOpen ? '4px 0 20px rgba(0,0,0,.6)' : 'none',
      }}>

        {/* Logo */}
        <div style={{ padding: sideOpen ? '12px 14px' : '12px 0', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', gap:10, justifyContent: sideOpen ? 'flex-start' : 'center', flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff', boxShadow:`0 0 16px ${T.blue}44` }}>
            ES
          </div>
          {sideOpen && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontWeight:800, fontSize:12, color:T.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:148, letterSpacing:'-0.01em' }}>
                {tenant?.name || 'Elite Store'}
              </div>
              <div style={{ fontSize:9, color:T.sub }}>{tenant?.plan || 'starter'} plan</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'6px 5px' }}>
          {NAV.map((item, i) => {
            // Section header
            if (item.section) {
              if (!sideOpen) return (
                <div key={i} style={{ height:1, background:T.bdr2, margin:'8px 4px' }} />
              );
              return (
                <div key={i} style={{ padding:'12px 9px 3px', fontSize:9, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {item.section}
                </div>
              );
            }

            const active = page === item.id;
            return (
              <button key={item.id + i}
                onClick={() => { onNavigate(item.id); if (mobile) setMobOpen(false); }}
                title={!sideOpen ? item.label : ''}
                style={{
                  width:'100%', display:'flex', alignItems:'center',
                  gap:9, padding: sideOpen ? '7px 9px' : '9px 0',
                  justifyContent: sideOpen ? 'flex-start' : 'center',
                  background: active ? `${T.blue}20` : 'transparent',
                  color: active ? T.blue : T.sub,
                  border:'none', borderRadius:7, cursor:'pointer', marginBottom:2,
                  fontWeight: active ? 700 : 400, fontSize:11.5,
                  textAlign:'left', transition:'all .15s', fontFamily:'inherit',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.bdr; e.currentTarget.style.color = T.ink; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.sub; }}}>
                <span style={{ fontSize:15, flexShrink:0, width: sideOpen ? 'auto' : 22, textAlign:'center' }}>{item.icon}</span>
                {sideOpen && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom — user + collapse */}
        <div style={{ borderTop:`1px solid ${T.bdr}`, padding:'8px 5px', flexShrink:0 }}>
          {sideOpen && user && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', marginBottom:4 }}>
              <div style={{ width:30, height:30, borderRadius:7, flexShrink:0, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>
                {(user.email || 'U').slice(0,1).toUpperCase()}
              </div>
              <div style={{ overflow:'hidden' }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                <div style={{ fontSize:9, color:T.sub }}>Administrator</div>
              </div>
            </div>
          )}
          {!mobile && (
            <button
              onClick={() => setCollapsed(s => !s)}
              style={{ width:'100%', padding:'7px', background:'transparent', border:`1px solid ${T.bdr}`, borderRadius:6, color:T.sub, cursor:'pointer', fontSize:12, transition:'all .15s', fontFamily:'inherit', marginBottom:4 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdr; e.currentTarget.style.color = T.sub; }}>
              {collapsed ? '→' : '← Collapse'}
            </button>
          )}
          <button
            onClick={onLogout}
            style={{ width:'100%', padding:'6px 8px', background:'transparent', border:`1px solid ${T.bdr}`, borderRadius:6, color:T.sub, cursor:'pointer', fontFamily:'inherit', fontSize:10, display:'flex', alignItems:'center', gap:5, justifyContent: sideOpen ? 'flex-start' : 'center', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.red; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.sub; e.currentTarget.style.borderColor = T.bdr; }}>
            🚪 {sideOpen && 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {mobile && mobOpen && (
        <div onClick={() => setMobOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:399 }} />
      )}

      {/* ── Main area ───────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Topbar */}
        <div style={{ height:48, background:T.srf, borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', padding:'0 14px', gap:10, flexShrink:0, zIndex:10 }}>
          <button
            onClick={() => mobile ? setMobOpen(s => !s) : setCollapsed(s => !s)}
            style={{ background:'none', border:'none', color:T.sub, cursor:'pointer', fontSize:18, lineHeight:1, padding:'4px 6px', borderRadius:6 }}>
            ☰
          </button>

          {branches && branches.length > 1 && (
            <select value={activeBranch?.id || ''} onChange={e => onBranchChange?.(branches.find(x => x.id === e.target.value) || null)}
              style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none' }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {!online && (
            <div style={{ background:`${T.amber}18`, border:`1px solid ${T.amber}44`, borderRadius:6, padding:'2px 9px', fontSize:10, color:T.amber }}>
              📴 Offline
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* Language switcher */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowLang(s => !s)}
              style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', color:T.sub, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
              🌐 {lang?.toUpperCase()}
            </button>
            {showLang && (
              <div style={{ position:'absolute', right:0, top:38, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:10, overflow:'hidden', zIndex:200, minWidth:140, boxShadow:'0 16px 40px rgba(0,0,0,.5)' }}>
                {[{code:'en',label:'English'},{code:'ta',label:'தமிழ்'},{code:'hi',label:'हिंदी'}].map(l => (
                  <div key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                    style={{ padding:'8px 14px', cursor:'pointer', fontSize:12, color: lang === l.code ? T.blue : T.ink, background: lang === l.code ? `${T.blue}18` : 'transparent', display:'flex', alignItems:'center', gap:8 }}>
                    {l.label} {lang === l.code && <span style={{ marginLeft:'auto', color:T.blue }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: online ? T.green : T.amber, boxShadow:`0 0 6px ${online ? T.green : T.amber}` }} />
            <span style={{ fontSize:10, color: online ? T.green : T.amber }}>{online ? 'Live' : 'Offline'}</span>
          </div>

          {tenant?.plan_status === 'trial' && (
            <div onClick={() => onNavigate('billing')}
              style={{ background:`${T.amber}18`, border:`1px solid ${T.amber}44`, borderRadius:6, padding:'3px 10px', fontSize:10, color:T.amber, cursor:'pointer' }}>
              Trial → Upgrade
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
    </div>
  );
}
