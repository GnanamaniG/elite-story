// Shared Tab Shell used by all Hub pages
const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF'
};

export function HubTabs({ tabs, active, onChange }) {
  return (
    <div style={{ background:T.srf, borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', gap:0, overflowX:'auto', flexShrink:0, paddingLeft:4 }}>
      {tabs.map(tab=>(
        <button key={tab.id} onClick={()=>onChange(tab.id)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'14px 18px', background:'transparent', color: active===tab.id ? T.red : T.sub, border:'none', borderBottom: active===tab.id ? `2px solid ${T.red}` : '2px solid transparent', marginBottom:-1, cursor:'pointer', fontSize:12.5, fontWeight: active===tab.id ? 700 : 500, fontFamily:'inherit', whiteSpace:'nowrap', transition:'all .15s', letterSpacing:'-0.01em' }}
          onMouseEnter={e=>{ if(active!==tab.id) e.currentTarget.style.color=T.ink; }}
          onMouseLeave={e=>{ if(active!==tab.id) e.currentTarget.style.color=T.sub; }}>
          <span style={{ fontSize:14 }}>{tab.icon}</span>
          {tab.label}
          {tab.badge&&<span style={{ background:T.red, color:'#fff', borderRadius:20, padding:'1px 6px', fontSize:9, fontWeight:800 }}>{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function HubHeader({ title, subtitle, icon, actions }) {
  return (
    <div style={{ background:T.srf, borderBottom:`1px solid ${T.bdr}`, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:T.lightRed, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{icon}</div>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>{title}</div>
          {subtitle&&<div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{subtitle}</div>}
        </div>
      </div>
      {actions&&<div style={{ display:'flex', gap:8 }}>{actions}</div>}
    </div>
  );
}
