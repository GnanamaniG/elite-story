import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function PriceHistory({ tenant }) {
  const [history,   setHistory]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [selItem,   setSelItem]   = useState(null);
  const [search,    setSearch]    = useState('');
  const [form, setForm] = useState({ item_id:'', item_name:'', new_cp:'', new_sp:'', reason:'', changed_by:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [hRes, invRes] = await Promise.all([
      supabase.from('price_history').select('*').eq('tenant_id', tenant.id).order('changed_at', { ascending:false }).limit(200),
      supabase.from('inventory').select('id,name,code,cp,sp,category').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setHistory(hRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  async function savePriceChange(e) {
    e.preventDefault(); setSaving(true);
    const item = inventory.find(i=>i.id===form.item_id);
    if (!item) { setSaving(false); return; }
    const newCp  = parseFloat(form.new_cp) || item.cp;
    const newSp  = parseFloat(form.new_sp) || item.sp;
    const change = item.sp>0 ? ((newSp-item.sp)/item.sp*100) : 0;

    await Promise.all([
      supabase.from('price_history').insert({
        tenant_id:tenant.id, item_id:item.id, item_name:item.name,
        old_cp:item.cp, new_cp:newCp, old_sp:item.sp, new_sp:newSp,
        change_pct:change, reason:form.reason, changed_by:form.changed_by,
      }),
      supabase.from('inventory').update({ cp:newCp, sp:newSp }).eq('id', item.id),
    ]);

    setShowForm(false);
    setForm({ item_id:'', item_name:'', new_cp:'', new_sp:'', reason:'', changed_by:'' });
    setSaving(false); await load();
  }

  const itemHistory = selItem ? history.filter(h=>h.item_id===selItem) : history;
  const filteredInv = inventory.filter(i=>!search||i.name.toLowerCase().includes(search.toLowerCase()));
  const increases   = history.filter(h=>(h.change_pct||0)>0).length;
  const decreases   = history.filter(h=>(h.change_pct||0)<0).length;
  const avgChange   = history.length>0 ? (history.reduce((s,h)=>s+(h.change_pct||0),0)/history.length) : 0;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📉 Price History</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Track cost and selling price changes over time</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Record Price Change</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total Changes',history.length,T.blue,'📊'],['Price Increases',increases,T.green,'📈'],['Price Decreases',decreases,T.red,'📉'],['Avg Change',`${avgChange>=0?'+':''}${avgChange.toFixed(1)}%`,avgChange>=0?T.green:T.red,'⚖️']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'flex-start' }}>
        {/* Product list */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ padding:'12px 14px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}` }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…" style={{ ...inp, padding:'7px 10px', fontSize:12 }}/>
          </div>
          <div style={{ maxHeight:500, overflowY:'auto' }}>
            <div onClick={()=>setSelItem(null)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, background:!selItem?T.lightRed:'transparent', fontWeight:!selItem?700:400, fontSize:12, color:!selItem?T.red:T.sub }}>
              📋 All Products ({history.length} changes)
            </div>
            {filteredInv.map(i=>{
              const cnt = history.filter(h=>h.item_id===i.id).length;
              return (
                <div key={i.id} onClick={()=>setSelItem(i.id)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, background:selItem===i.id?T.lightRed:'transparent' }}>
                  <div style={{ fontSize:12, fontWeight:selItem===i.id?700:500, color:selItem===i.id?T.red:T.ink }}>{i.name}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                    <span style={{ fontSize:10, color:T.muted }}>{cnt} change{cnt!==1?'s':''}</span>
                    <span style={{ fontSize:10, color:T.sub }}>{fmt(i.sp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* History timeline */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:T.lightRed }}>
              {['Date','Product','Cost Price','Selling Price','Change','Reason','By'].map(h=>(
                <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
              :itemHistory.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📉</div>
                <div style={{ color:T.muted, fontWeight:600 }}>No price changes recorded</div>
                <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Record a price change to start tracking</div>
              </td></tr>
              :itemHistory.map(h=>{
                const up = (h.change_pct||0)>0;
                return (
                  <tr key={h.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{h.changed_at?.slice(0,10)}</td>
                    <td style={{ padding:'11px 14px', color:T.ink, fontWeight:600 }}>{h.item_name}</td>
                    <td style={{ padding:'11px 14px', color:T.sub }}>
                      <span style={{ textDecoration:'line-through', color:T.muted, fontSize:11 }}>{fmt(h.old_cp)}</span>
                      <span style={{ margin:'0 5px', color:T.muted }}>→</span>
                      <span style={{ color:T.ink, fontWeight:600 }}>{fmt(h.new_cp)}</span>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ textDecoration:'line-through', color:T.muted, fontSize:11 }}>{fmt(h.old_sp)}</span>
                      <span style={{ margin:'0 5px', color:T.muted }}>→</span>
                      <span style={{ color:T.red, fontWeight:700 }}>{fmt(h.new_sp)}</span>
                    </td>
                    <td style={{ padding:'11px 14px' }}>
                      <span style={{ background:up?'#F0FDF4':'#FEF2F2', color:up?T.green:T.red, border:`1px solid ${up?'#BBF7D0':'#FECACA'}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                        {up?'↑':'↓'} {Math.abs(h.change_pct||0).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding:'11px 14px', color:T.sub, fontSize:11 }}>{h.reason||'—'}</td>
                    <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{h.changed_by||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Record Price Change</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={savePriceChange}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product *</label>
                <select value={form.item_id} onChange={e=>{const i=inventory.find(x=>x.id===e.target.value);setForm(f=>({...f,item_id:e.target.value,item_name:i?.name||'',new_cp:String(i?.cp||''),new_sp:String(i?.sp||'')}));}} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select product…</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name} — {fmt(i.sp)}</option>)}
                </select>
              </div>

              {form.item_id&&(()=>{ const item=inventory.find(i=>i.id===form.item_id); return item&&(
                <div style={{ background:T.bg, borderRadius:9, padding:'12px 16px', marginBottom:14, fontSize:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:T.sub }}>Current Cost Price</span><span style={{ color:T.ink, fontWeight:600 }}>{fmt(item.cp)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:T.sub }}>Current Selling Price</span><span style={{ color:T.red, fontWeight:700 }}>{fmt(item.sp)}</span></div>
                </div>
              ); })()}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>New Cost Price</label><input type="number" value={form.new_cp} onChange={e=>setForm(f=>({...f,new_cp:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>New Selling Price *</label><input type="number" value={form.new_sp} onChange={e=>setForm(f=>({...f,new_sp:e.target.value}))} required style={{ ...inp, fontWeight:700, color:T.red }}/></div>
              </div>

              {form.item_id&&form.new_sp&&(()=>{ const item=inventory.find(i=>i.id===form.item_id); const ch=item?.sp>0?((parseFloat(form.new_sp)-item.sp)/item.sp*100):0; return (
                <div style={{ background:ch>=0?'#F0FDF4':'#FEF2F2', border:`1px solid ${ch>=0?'#BBF7D0':'#FECACA'}`, borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:12, color:ch>=0?T.green:T.red, fontWeight:600 }}>
                  {ch>=0?'📈':'📉'} Price change: {ch>=0?'+':''}{ch.toFixed(1)}% · New margin: {form.new_cp&&parseFloat(form.new_sp)>0?(((parseFloat(form.new_sp)-parseFloat(form.new_cp))/parseFloat(form.new_sp)*100).toFixed(1)+'%'):'—'}
                </div>
              ); })()}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Reason</label><input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Supplier hike" style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Changed By</label><input value={form.changed_by} onChange={e=>setForm(f=>({...f,changed_by:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'📉 Update Price'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
