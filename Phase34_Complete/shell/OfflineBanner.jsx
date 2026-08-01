import { useState, useEffect } from 'react';
import { queueAll, queueRemove } from '../../lib/offlineStore';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const ago = ts => {
  if (!ts) return 'never';
  const m = Math.floor((Date.now()-ts)/60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};

export default function OfflineBanner({ online, pending, syncing, lastSync, cachedAt, onSync }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => { if (open) queueAll().then(setRows); }, [open, pending, syncing]);

  // Nothing to report
  if (online && pending===0 && !syncing) return null;

  const state = !online ? 'offline' : syncing ? 'syncing' : 'pending';
  const cfg = {
    offline: { bg:'#FFFBEB', bdr:'#FDE68A', color:'#D97706', icon:'📴', label:'Offline' },
    syncing: { bg:'#EFF6FF', bdr:'#BFDBFE', color:'#2563EB', icon:'🔄', label:'Syncing…' },
    pending: { bg:'#FEF2F2', bdr:'#FECACA', color:'#C0392B', icon:'⏳', label:`${pending} unsynced` },
  }[state];

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:6, background:cfg.bg, border:`1px solid ${cfg.bdr}`, borderRadius:8, padding:'6px 12px', color:cfg.color, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        <span style={{ fontSize:13, animation: syncing?'spin 1.2s linear infinite':'none', display:'inline-block' }}>{cfg.icon}</span>
        <span>{cfg.label}</span>
        {pending>0&&state!=='pending'&&<span style={{ background:cfg.color, color:T.white, borderRadius:20, padding:'0 6px', fontSize:9, fontWeight:800 }}>{pending}</span>}
      </button>

      {open&&(
        <div style={{ position:'absolute', right:0, top:40, width:340, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, boxShadow:'0 14px 44px rgba(0,0,0,.16)', zIndex:400, overflow:'hidden' }}>
          <div style={{ padding:'13px 16px', background:cfg.bg, borderBottom:`1px solid ${T.bdr}` }}>
            <div style={{ fontSize:13, fontWeight:800, color:cfg.color }}>{cfg.icon} {!online?'Working Offline':'Sync Status'}</div>
            <div style={{ fontSize:11, color:T.sub, marginTop:3, lineHeight:1.5 }}>
              {!online
                ? 'Billing still works. Sales are saved on this device and will upload automatically when the internet returns.'
                : pending>0
                  ? `${pending} record${pending>1?'s':''} waiting to upload.`
                  : 'Everything is up to date.'}
            </div>
          </div>

          <div style={{ padding:'11px 16px', display:'flex', justifyContent:'space-between', fontSize:11, borderBottom:`1px solid ${T.bdr}` }}>
            <div><span style={{ color:T.muted }}>Last sync</span> <strong style={{ color:T.ink }}>{ago(lastSync)}</strong></div>
            <div><span style={{ color:T.muted }}>Data cached</span> <strong style={{ color:T.ink }}>{ago(cachedAt)}</strong></div>
          </div>

          {rows.length>0&&(
            <div style={{ maxHeight:190, overflowY:'auto' }}>
              {rows.slice(0,12).map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 16px', borderBottom:`1px solid ${T.bdr}22`, fontSize:11 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:T.ink, fontWeight:600 }}>
                      {r.table==='sales'?'🧧 Sale':r.table==='customers'?'👤 Customer':`📄 ${r.table}`}
                      {r.payload?.total?<span style={{ color:T.red, marginLeft:6 }}>{fmt(r.payload.total)}</span>:null}
                    </div>
                    <div style={{ color:T.muted, fontSize:10 }}>
                      {r.localRef} · {ago(r.created)}
                      {r.lastError&&<span style={{ color:T.red }}> · {r.lastError.slice(0,30)}</span>}
                    </div>
                  </div>
                  <span style={{
                    background: r.status==='failed'?'#FEF2F2':r.status==='synced'?'#F0FDF4':'#FFFBEB',
                    color:      r.status==='failed'?T.red:r.status==='synced'?T.green:T.amber,
                    borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700, flexShrink:0,
                  }}>{r.status}</span>
                  {r.status==='failed'&&(
                    <button onClick={async()=>{ await queueRemove(r.id); setRows(await queueAll()); }}
                      style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:14, marginLeft:6 }}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ padding:'11px 16px', background:T.bg, display:'flex', gap:8 }}>
            <button onClick={onSync} disabled={!online||syncing}
              style={{ flex:1, background: online?T.red:T.bdr, color:T.white, border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor: online?'pointer':'not-allowed', fontFamily:'inherit' }}>
              {syncing?'Syncing…':online?'🔄 Sync Now':'Waiting for connection'}
            </button>
            <button onClick={()=>setOpen(false)}
              style={{ background:T.white, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
