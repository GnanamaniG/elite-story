const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

export const SHORTCUTS = [
  { group:'Global', items:[
    { keys:['Ctrl','K'], label:'Open command palette / search' },
    { keys:['?'],        label:'Show this shortcuts help' },
    { keys:['Esc'],      label:'Close any modal or panel' },
    { keys:['Ctrl','B'], label:'Toggle sidebar' },
    { keys:['Ctrl','/'], label:'Focus search on current page' },
  ]},
  { group:'Quick Navigation', items:[
    { keys:['G','D'], label:'Go to Dashboard' },
    { keys:['G','P'], label:'Go to POS / Billing' },
    { keys:['G','S'], label:'Go to Sales' },
    { keys:['G','I'], label:'Go to Inventory' },
    { keys:['G','C'], label:'Go to Customers' },
    { keys:['G','B'], label:'Go to Purchases (Buy)' },
    { keys:['G','R'], label:'Go to Reports' },
    { keys:['G','A'], label:'Go to Accounting' },
    { keys:['G','H'], label:'Go to HR & Payroll' },
    { keys:['G','T'], label:'Go to Tools & Admin' },
  ]},
  { group:'Actions', items:[
    { keys:['N','S'], label:'New sale / bill' },
    { keys:['N','I'], label:'New item / product' },
    { keys:['N','C'], label:'New customer' },
    { keys:['N','P'], label:'New purchase' },
    { keys:['N','E'], label:'New expense' },
  ]},
  { group:'POS / Billing', items:[
    { keys:['F2'],       label:'Focus product search' },
    { keys:['F4'],       label:'Select customer' },
    { keys:['F9'],       label:'Complete sale / payment' },
    { keys:['Ctrl','P'], label:'Print last invoice' },
    { keys:['Ctrl','D'], label:'Clear cart' },
  ]},
  { group:'Tables & Lists', items:[
    { keys:['Ctrl','F'], label:'Search within table' },
    { keys:['Ctrl','E'], label:'Export current view' },
    { keys:['Ctrl','R'], label:'Refresh data' },
  ]},
];

function Kbd({ children }) {
  return (
    <kbd style={{
      background:T.white, border:`1px solid ${T.bdr}`, borderBottom:`2px solid ${T.bdr}`,
      borderRadius:5, padding:'3px 8px', fontSize:11, fontWeight:700, color:T.darkRed,
      fontFamily:'inherit', minWidth:22, display:'inline-block', textAlign:'center',
    }}>{children}</kbd>
  );
}

export default function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.45)', backdropFilter:'blur(3px)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:T.white, borderRadius:16, width:'100%', maxWidth:720, maxHeight:'86vh', overflow:'hidden', boxShadow:'0 24px 70px rgba(0,0,0,.28)', display:'flex', flexDirection:'column' }}>

        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${T.bdr}`, background:T.lightRed, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>⌨️ Keyboard Shortcuts</div>
            <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Work faster — most actions are two keystrokes away</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:T.muted, lineHeight:1 }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px 32px' }}>
            {SHORTCUTS.map(sec=>(
              <div key={sec.group}>
                <div style={{ fontSize:10, fontWeight:800, color:T.red, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${T.bdr}` }}>
                  {sec.group}
                </div>
                {sec.items.map((s,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0' }}>
                    <span style={{ fontSize:12.5, color:T.ink }}>{s.label}</span>
                    <span style={{ display:'flex', gap:4, flexShrink:0, marginLeft:12 }}>
                      {s.keys.map((k,j)=>(
                        <span key={j} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          {j>0&&<span style={{ color:T.muted, fontSize:10 }}>then</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'12px 24px', borderTop:`1px solid ${T.bdr}`, background:T.bg, fontSize:11, color:T.sub, textAlign:'center' }}>
          Sequence shortcuts like <Kbd>G</Kbd> <span style={{ margin:'0 4px' }}>then</span> <Kbd>P</Kbd> — press the keys one after another, not together
        </div>
      </div>
    </div>
  );
}
