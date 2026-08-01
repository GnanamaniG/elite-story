import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

const ADJ_TYPES = {
  damage:            { label:'Damaged',           icon:'💥', color:'#C0392B', bg:'#FEF2F2', sign:-1 },
  theft:             { label:'Theft / Missing',   icon:'🚨', color:'#C0392B', bg:'#FEF2F2', sign:-1 },
  expiry:            { label:'Expired',           icon:'⏰', color:'#D97706', bg:'#FFFBEB', sign:-1 },
  sample:            { label:'Sample / Gift',     icon:'🎁', color:'#7C3AED', bg:'#F5F3FF', sign:-1 },
  return_to_supplier:{ label:'Returned to Supplier', icon:'↩️', color:'#2563EB', bg:'#EFF6FF', sign:-1 },
  correction:        { label:'Stock Correction',  icon:'✏️', color:'#6B7280', bg:'#F9FAFB', sign:0  },
  found:             { label:'Found / Extra',     icon:'✨', color:'#16A34A', bg:'#F0FDF4', sign:1  },
};

export default function StockAdjustments({ tenant }) {
  const [adjustments, setAdjustments] = useState([]);
  const [inventory,   setInventory]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [filter,      setFilter]      = useState('all');
  const [period,      setPeriod]      = useState('30');
  const [form, setForm] = useState({ item_id:'', item_name:'', adj_type:'damage', qty_change:'1', reason:'', adjusted_by:'', approved_by:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate()-parseInt(period));
    const [aRes, invRes] = await Promise.all([
      supabase.from('stock_adjustments').select('*').eq('tenant_id', tenant.id).gte('adj_date', since.toISOString().slice(0,10)).order('created_at', { ascending:false }),
      supabase.from('inventory').select('id,name,code,stock,cp,category').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setAdjustments(aRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `ADJ/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  async function saveAdj(e) {
    e.preventDefault(); setSaving(true);
    const item   = inventory.find(i=>i.id===form.item_id);
    if (!item) { setSaving(false); return; }
    const cfg    = ADJ_TYPES[form.adj_type];
    const qtyRaw = Math.abs(parseInt(form.qty_change)||0);
    const change = cfg.sign===0 ? (parseInt(form.qty_change)||0) : qtyRaw * cfg.sign;
    const before = item.stock||0;
    const after  = Math.max(0, before + change);
    const cost   = Math.abs(change) * (item.cp||0) * (change<0?1:-1);

    await Promise.all([
      supabase.from('stock_adjustments').insert({
        tenant_id:tenant.id, adj_no:genNo(), item_id:item.id, item_name:item.name,
        adj_type:form.adj_type, qty_before:before, qty_change:change, qty_after:after,
        cost_impact:cost, reason:form.reason, adjusted_by:form.adjusted_by, approved_by:form.approved_by,
      }),
      supabase.from('inventory').update({ stock:after }).eq('id', item.id),
    ]);

    setShowForm(false);
    setForm({ item_id:'', item_name:'', adj_type:'damage', qty_change:'1', reason:'', adjusted_by:'', approved_by:'' });
    setSaving(false); await load();
  }

  const displayed  = filter==='all'?adjustments:adjustments.filter(a=>a.adj_type===filter);
  const totalLoss  = adjustments.filter(a=>a.cost_impact>0).reduce((s,a)=>s+a.cost_impact,0);
  const unitsLost  = adjustments.filter(a=>a.qty_change<0).reduce((s,a)=>s+Math.abs(a.qty_change),0);
  const byType     = Object.keys(ADJ_TYPES).map(k=>({ type:k, count:adjustments.filter(a=>a.adj_type===k).length, loss:adjustments.filter(a=>a.adj_type===k).reduce((s,a)=>s+Math.max(0,a.cost_impact),0) })).filter(x=>x.count>0).sort((a,b)=>b.loss-a.loss);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>📋 Stock Adjustments</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Record damage, theft, expiry and stock corrections</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
            {[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['365','Last year']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Adjustment</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total Adjustments',adjustments.length,T.blue,'📋'],['Units Lost',unitsLost,T.amber,'📉'],['Cost Impact',fmt(totalLoss),T.red,'💸'],['Avg per Adj.',fmt(adjustments.length>0?totalLoss/adjustments.length:0),T.purple,'⚖️']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {byType.length>0&&<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Loss Breakdown by Type</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {byType.map(t=>{
            const cfg = ADJ_TYPES[t.type];
            return (
              <div key={t.type} style={{ background:cfg.bg, border:`1px solid ${cfg.color}33`, borderRadius:9, padding:'8px 14px', minWidth:130 }}>
                <div style={{ fontSize:11, color:cfg.color, fontWeight:700 }}>{cfg.icon} {cfg.label}</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                  <span style={{ fontSize:11, color:T.sub }}>{t.count} adj.</span>
                  <span style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{fmt(t.loss)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={()=>setFilter('all')} style={{ padding:'6px 13px', background:filter==='all'?T.red:T.white, color:filter==='all'?T.white:T.sub, border:`1px solid ${filter==='all'?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>All ({adjustments.length})</button>
        {Object.entries(ADJ_TYPES).map(([k,v])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ padding:'6px 13px', background:filter===k?T.red:T.white, color:filter===k?T.white:T.sub, border:`1px solid ${filter===k?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Adj No','Date','Product','Type','Before','Change','After','Cost Impact','Reason','By'].map(h=>(
              <th key={h} style={{ padding:'11px 12px', textAlign:['Before','Change','After','Cost Impact'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={10} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={10} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No adjustments recorded</div>
            </td></tr>
            :displayed.map(a=>{
              const cfg = ADJ_TYPES[a.adj_type]||ADJ_TYPES.correction;
              return (
                <tr key={a.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:T.blue, fontWeight:600 }}>{a.adj_no}</td>
                  <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{a.adj_date}</td>
                  <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{a.item_name}</td>
                  <td style={{ padding:'10px 12px' }}><span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}33`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{cfg.icon} {cfg.label}</span></td>
                  <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{a.qty_before}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:a.qty_change<0?T.red:T.green }}>{a.qty_change>0?'+':''}{a.qty_change}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:T.ink }}>{a.qty_after}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:a.cost_impact>0?T.red:T.green }}>{a.cost_impact>0?'-':'+'}{fmt(a.cost_impact)}</td>
                  <td style={{ padding:'10px 12px', color:T.sub, fontSize:11 }}>{a.reason||'—'}</td>
                  <td style={{ padding:'10px 12px', color:T.muted, fontSize:10 }}>{a.adjusted_by||'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Stock Adjustment</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveAdj}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product *</label>
                <select value={form.item_id} onChange={e=>{const i=inventory.find(x=>x.id===e.target.value);setForm(f=>({...f,item_id:e.target.value,item_name:i?.name||''}));}} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select product…</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name} — {i.stock} in stock</option>)}
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Adjustment Type *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                  {Object.entries(ADJ_TYPES).map(([k,v])=>(
                    <button key={k} type="button" onClick={()=>setForm(f=>({...f,adj_type:k}))}
                      style={{ background:form.adj_type===k?v.bg:T.white, color:form.adj_type===k?v.color:T.sub, border:`1.5px solid ${form.adj_type===k?v.color:T.bdr}`, borderRadius:8, padding:'8px 10px', fontSize:11, fontWeight:form.adj_type===k?700:500, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Quantity *</label><input type="number" value={form.qty_change} onChange={e=>setForm(f=>({...f,qty_change:e.target.value}))} required style={{ ...inp, fontWeight:700 }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Adjusted By</label><input value={form.adjusted_by} onChange={e=>setForm(f=>({...f,adjusted_by:e.target.value}))} style={inp}/></div>
              </div>

              {form.item_id&&form.qty_change&&(()=>{
                const item = inventory.find(i=>i.id===form.item_id);
                const cfg  = ADJ_TYPES[form.adj_type];
                const qty  = Math.abs(parseInt(form.qty_change)||0);
                const chg  = cfg.sign===0 ? (parseInt(form.qty_change)||0) : qty*cfg.sign;
                const after= Math.max(0,(item?.stock||0)+chg);
                const cost = Math.abs(chg)*(item?.cp||0);
                return (
                  <div style={{ background:cfg.bg, border:`1px solid ${cfg.color}33`, borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:T.sub }}>Stock: {item?.stock||0} → <strong style={{ color:cfg.color }}>{after}</strong></span></div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:T.sub }}>Cost impact</span><strong style={{ color:cfg.color }}>{chg<0?'-':'+'}{fmt(cost)}</strong></div>
                  </div>
                );
              })()}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Reason *</label><input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Water damage in storage" required style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Approved By</label><input value={form.approved_by} onChange={e=>setForm(f=>({...f,approved_by:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'📋 Record Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
