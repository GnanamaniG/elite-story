import { useState, useEffect } from 'react';
import { useLang, LANGUAGES } from '../../lib/i18n';
import CommandPalette   from '../shell/CommandPalette';
import ShortcutsHelp    from '../shell/ShortcutsHelp';
import NotificationBell from '../shell/NotificationBell';
import useShortcuts     from '../../hooks/useShortcuts';

const SIDEBAR_BG    = '#7B1E1E';
const SIDEBAR_HOVER = '#9B2C2C';
const SIDEBAR_ACT   = '#FFFFFF';
const SIDEBAR_TXT   = '#FFE4E4';
const SIDEBAR_ATXT  = '#7B1E1E';
const SIDEBAR_SEC   = '#E57373';
const RED           = '#C0392B';
const BDR           = '#E8DEDE';
const INK           = '#111827';
const SUB           = '#6B7280';
const WHITE         = '#FFFFFF';
const BG            = '#F7F3F3';

const NAV = [
  { id:'dashboard',     label:'Dashboard',       icon:'⚡' },
  { id:'pos',           label:'Sales / POS',     icon:'🧧' },
  { id:'saleshub',      label:'Sales',           icon:'📄' },
  { id:'invhub',        label:'Inventory',       icon:'📦' },
  { id:'custhub',       label:'Customers',       icon:'👥' },
  { id:'purchhub',      label:'Purchases',       icon:'🛒' },
  { id:'expenses',      label:'Expenses',        icon:'💸' },
  { id:'reportshub',    label:'Reports',         icon:'📊' },

  { section:'Finance' },
  { id:'accountinghub', label:'Accounting',      icon:'📒' },
  { id:'gsthub',        label:'GST & Tax',       icon:'📋' },

  { section:'Growth' },
  { id:'loyaltyhub',    label:'Loyalty & CRM',   icon:'👑' },
  { id:'marketinghub',  label:'Marketing',       icon:'📣' },

  { section:'Team & Ops' },
  { id:'hrhub',         label:'HR & Payroll',    icon:'👷' },
  { id:'opshub',        label:'Operations',      icon:'🏪' },

  { section:'System' },
  { id:'toolshub',      label:'Tools & Admin',   icon:'🔧' },
  { id:'settings',      label:'Settings',        icon:'⚙️' },
];

export default function AppShell({ children, user, tenant, page, onNavigate, onLogout, branches, activeBranch, onBranchChange, online = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile,    setMobile]    = useState(window.innerWidth < 768);
  const [mobOpen,   setMobOpen]   = useState(false);
  const { lang, setLang }         = useLang();
  const [showLang,  setShowLang]  = useState(false);
  const [palette,   setPalette]   = useState(false);
  const [helpOpen,  setHelpOpen]  = useState(false);
  const [seqHint,   setSeqHint]   = useState(null);

  // Global keyboard shortcuts
  useShortcuts({
    onNavigate: (page, tab) => { onNavigate(page, tab); },
    onPalette:  () => setPalette(p=>!p),
    onHelp:     () => setHelpOpen(h=>!h),
    onToggleSidebar: () => mobile ? setMobOpen(s=>!s) : setCollapsed(s=>!s),
  });

  useEffect(() => {
    const start = e => setSeqHint(e.detail.key);
    const end   = () => setSeqHint(null);
    window.addEventListener('seq-start', start);
    window.addEventListener('seq-end',   end);
    return () => { window.removeEventListener('seq-start', start); window.removeEventListener('seq-end', end); };
  }, []);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const sideOpen = mobile ? mobOpen : !collapsed;
  const W        = mobile ? 230 : (collapsed ? 64 : 230);

  return (
    <div style={{ display:'flex', height:'100vh', background:BG, color:INK, fontFamily:'"DM Sans",system-ui,-apple-system,sans-serif', overflow:'hidden' }}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#F7F3F3}
        ::-webkit-scrollbar-thumb{background:#D0B8B8;border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:#C0392B}
        input:focus,select:focus,textarea:focus{outline:1.5px solid #C0392B;outline-offset:0}
        input,select,textarea,button{font-family:"DM Sans",system-ui,sans-serif}
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator{cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .2s ease}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:#9CA3AF;text-align:center;gap:10px}
        .empty-state .es-icon{font-size:40px;opacity:.5}
        .empty-state .es-title{font-size:15px;font-weight:700;color:#6B7280}
        .empty-state .es-sub{font-size:12px}
        .pbar-track{height:4px;background:#F0E8E8;border-radius:2px;overflow:hidden}
        .pbar-fill{height:100%;border-radius:2px;transition:width .5s ease}
        .alert-v3-danger{background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-warn{background:#FFFBEB;border:1px solid #FDE68A;color:#D97706;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-info{background:#EFF6FF;border:1px solid #BFDBFE;color:#2563EB;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
        .alert-v3-success{background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;border-radius:8px;padding:10px 13px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
      `}</style>

      {/* Sidebar */}
      <div style={{
        width:W, flexShrink:0, background:SIDEBAR_BG,
        display:'flex', flexDirection:'column',
        transition:'width .25s', overflow:'hidden',
        position: mobile ? 'fixed' : 'relative',
        zIndex: mobile ? 400 : 1, height:'100vh',
        transform: mobile && !mobOpen ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: mobile && mobOpen ? '6px 0 24px rgba(0,0,0,.25)' : '2px 0 8px rgba(0,0,0,.12)',
      }}>
        {/* Logo */}
        <div style={{ padding: sideOpen ? '16px 16px 14px' : '16px 0 14px', borderBottom:`1px solid rgba(255,255,255,.1)`, display:'flex', alignItems:'center', gap:11, justifyContent: sideOpen ? 'flex-start' : 'center', flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:WHITE, border:'1px solid rgba(255,255,255,.25)', letterSpacing:'-0.03em' }}>7SQ</div>
          {sideOpen && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontWeight:800, fontSize:13, color:WHITE, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:164, letterSpacing:'-0.02em' }}>{tenant?.name || '7SQ'}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', marginTop:1, textTransform:'uppercase', letterSpacing:'0.05em' }}>{tenant?.plan || 'Starter'} Plan</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              if (!sideOpen) return <div key={i} style={{ height:1, background:'rgba(255,255,255,.1)', margin:'8px 6px' }} />;
              return <div key={i} style={{ padding:'14px 8px 4px', fontSize:9, fontWeight:800, color:SIDEBAR_SEC, textTransform:'uppercase', letterSpacing:'0.1em' }}>{item.section}</div>;
            }
            const active = page === item.id;
            return (
              <button key={item.id + i}
                onClick={() => { onNavigate(item.id); if (mobile) setMobOpen(false); }}
                title={!sideOpen ? item.label : ''}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding: sideOpen ? '8px 10px' : '10px 0', justifyContent: sideOpen ? 'flex-start' : 'center', background: active ? SIDEBAR_ACT : 'transparent', color: active ? SIDEBAR_ATXT : SIDEBAR_TXT, border:'none', borderRadius:8, cursor:'pointer', marginBottom:2, fontWeight: active ? 700 : 500, fontSize:12, textAlign:'left', transition:'all .15s', fontFamily:'inherit', boxShadow: active ? '0 2px 8px rgba(0,0,0,.15)' : 'none' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = SIDEBAR_HOVER; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize:14, flexShrink:0, width: sideOpen ? 'auto' : 22, textAlign:'center' }}>{item.icon}</span>
                {sideOpen && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop:`1px solid rgba(255,255,255,.1)`, padding:'10px 8px', flexShrink:0 }}>
          {sideOpen && user && (
            <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', marginBottom:6, background:'rgba(255,255,255,.07)', borderRadius:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:WHITE }}>
                {(user.email || 'A').slice(0,1).toUpperCase()}
              </div>
              <div style={{ overflow:'hidden', flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:WHITE, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.5)' }}>Administrator</div>
              </div>
            </div>
          )}
          {!mobile && (
            <button onClick={() => setCollapsed(s => !s)}
              style={{ width:'100%', padding:'7px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.15)', borderRadius:7, color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:11, fontFamily:'inherit', marginBottom:5, transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.15)'; e.currentTarget.style.color=WHITE; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.07)'; e.currentTarget.style.color='rgba(255,255,255,.6)'; }}>
              {collapsed ? '→' : '← Collapse'}
            </button>
          )}
          <button onClick={onLogout}
            style={{ width:'100%', padding:'7px 10px', background:'transparent', border:'1px solid rgba(255,255,255,.15)', borderRadius:7, color:'rgba(255,255,255,.6)', cursor:'pointer', fontFamily:'inherit', fontSize:11, display:'flex', alignItems:'center', gap:6, justifyContent: sideOpen ? 'flex-start' : 'center', transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,100,100,.2)'; e.currentTarget.style.color='#FF8A80'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,.6)'; }}>
            🚪 {sideOpen && 'Sign Out'}
          </button>
        </div>
      </div>

      {mobile && mobOpen && <div onClick={() => setMobOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:399 }} />}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Topbar */}
        <div style={{ height:52, background:WHITE, borderBottom:`1px solid ${BDR}`, display:'flex', alignItems:'center', padding:'0 20px', gap:12, flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <button onClick={() => mobile ? setMobOpen(s=>!s) : setCollapsed(s=>!s)}
            style={{ background:'none', border:'none', color:SUB, cursor:'pointer', fontSize:18, lineHeight:1, padding:'4px' }}>☰</button>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:SUB }}>{tenant?.name || '7SQ'}</span>
            <span style={{ color:BDR }}>›</span>
            <span style={{ fontSize:12, fontWeight:700, color:RED }}>
              {NAV.find(n=>n.id===page)?.label || 'Dashboard'}
            </span>
          </div>
          {branches && branches.length > 1 && (
            <select value={activeBranch?.id || ''} onChange={e => onBranchChange?.(branches.find(x=>x.id===e.target.value)||null)}
              style={{ background:BG, border:`1px solid ${BDR}`, borderRadius:7, padding:'5px 10px', color:INK, fontSize:11, fontFamily:'inherit', outline:'none' }}>
              <option value="">All Branches</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {!online && <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:6, padding:'2px 9px', fontSize:10, color:'#D97706' }}>📴 Offline</div>}
          <div style={{ flex:1 }} />

          {/* Command palette trigger */}
          <button onClick={()=>setPalette(true)}
            style={{ display:'flex', alignItems:'center', gap:8, background:BG, border:`1px solid ${BDR}`, borderRadius:8, padding:'6px 12px', color:SUB, fontSize:12, cursor:'pointer', fontFamily:'inherit', minWidth:190 }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=RED; e.currentTarget.style.color=RED; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=BDR; e.currentTarget.style.color=SUB; }}>
            <span>🔍</span>
            <span style={{ flex:1, textAlign:'left' }}>Search anything…</span>
            <kbd style={{ background:WHITE, border:`1px solid ${BDR}`, borderRadius:4, padding:'1px 6px', fontSize:10, fontFamily:'inherit' }}>Ctrl K</kbd>
          </button>

          <NotificationBell tenant={tenant} onNavigate={onNavigate}/>

          <button onClick={()=>setHelpOpen(true)} title="Keyboard shortcuts (?)"
            style={{ background:BG, border:`1px solid ${BDR}`, borderRadius:8, padding:'6px 10px', color:SUB, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>⌨️</button>

          <div style={{ position:'relative' }}>
            <button onClick={() => setShowLang(s=>!s)}
              style={{ background:BG, border:`1px solid ${BDR}`, borderRadius:7, padding:'5px 11px', color:SUB, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
              🌐 {lang?.toUpperCase() || 'EN'}
            </button>
            {showLang && (
              <div style={{ position:'absolute', right:0, top:40, background:WHITE, border:`1px solid ${BDR}`, borderRadius:10, overflow:'hidden', zIndex:200, minWidth:140, boxShadow:'0 8px 30px rgba(0,0,0,.12)' }}>
                {[{code:'en',label:'English'},{code:'ta',label:'தமிழ்'},{code:'hi',label:'हिंदी'}].map(l=>(
                  <div key={l.code} onClick={()=>{setLang(l.code);setShowLang(false);}}
                    style={{ padding:'9px 14px', cursor:'pointer', fontSize:12, color:lang===l.code?RED:INK, background:lang===l.code?'#FEF2F2':'transparent', fontWeight:lang===l.code?700:400, display:'flex', justifyContent:'space-between' }}>
                    {l.label}{lang===l.code&&<span style={{color:RED}}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, background: online ? '#F0FDF4' : '#FFFBEB', border:`1px solid ${online?'#BBF7D0':'#FDE68A'}`, borderRadius:20, padding:'3px 10px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: online ? '#16A34A' : '#D97706' }} />
            <span style={{ fontSize:10, fontWeight:600, color: online ? '#16A34A' : '#D97706' }}>{online ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>

      {/* ── Global overlays ─────────────────────────────── */}
      <CommandPalette open={palette} onClose={()=>setPalette(false)} onNavigate={onNavigate} tenant={tenant}/>
      <ShortcutsHelp  open={helpOpen} onClose={()=>setHelpOpen(false)}/>

      {/* Sequence key hint */}
      {seqHint&&(
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#111827', color:'#fff', borderRadius:10, padding:'10px 18px', fontSize:13, zIndex:950, boxShadow:'0 8px 30px rgba(0,0,0,.3)', display:'flex', alignItems:'center', gap:10 }}>
          <kbd style={{ background:'rgba(255,255,255,.18)', borderRadius:5, padding:'3px 9px', fontWeight:700, fontFamily:'inherit' }}>{seqHint.toUpperCase()}</kbd>
          <span style={{ opacity:.75 }}>{seqHint==='g'?'Go to… (D P S I C B R A H T)':'New… (S I C P E Q)'}</span>
        </div>
      )}
    </div>
  );
}
