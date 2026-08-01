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

const CRITERIA = [
  { key:'delivery_score', label:'Delivery Timeliness', icon:'🚚', desc:'On-time delivery performance' },
  { key:'quality_score',  label:'Product Quality',     icon:'✨', desc:'Defect rate and consistency'  },
  { key:'pricing_score',  label:'Pricing',             icon:'💰', desc:'Competitiveness and stability'},
  { key:'service_score',  label:'Service & Support',   icon:'🤝', desc:'Responsiveness and issue resolution' },
];

function StarRating({ value, onChange, size=22, readOnly=false }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[1,2,3,4,5].map(n=>(
        <span key={n}
          onClick={()=>!readOnly&&onChange?.(n)}
          style={{ fontSize:size, color:n<=value?'#F59E0B':'#E5E7EB', cursor:readOnly?'default':'pointer', transition:'color .1s' }}>★</span>
      ))}
    </div>
  );
}

function GradeBadge({ score }) {
  const grade = score>=4.5?'A+':score>=4?'A':score>=3.5?'B+':score>=3?'B':score>=2.5?'C':'D';
  const color = score>=4?T.green:score>=3?T.blue:score>=2.5?T.amber:T.red;
  const bg    = score>=4?'#F0FDF4':score>=3?'#EFF6FF':score>=2.5?'#FFFBEB':'#FEF2F2';
  const bdr   = score>=4?'#BBF7D0':score>=3?'#BFDBFE':score>=2.5?'#FDE68A':'#FECACA';
  return <span style={{ background:bg, color, border:`1px solid ${bdr}`, borderRadius:8, padding:'4px 12px', fontSize:14, fontWeight:900 }}>{grade}</span>;
}

export default function SupplierScorecard({ tenant }) {
  const [suppliers, setSuppliers] = useState([]);
  const [scores,    setScores]    = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState(new Date().toISOString().slice(0,7));
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ supplier_name:'', supplier_id:'', delivery_score:3, quality_score:3, pricing_score:3, service_score:3, late_deliveries:'0', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);
    const [supRes, scoreRes, purRes] = await Promise.all([
      supabase.from('suppliers').select('id,name,phone,gstin').eq('tenant_id', tenant.id).order('name'),
      supabase.from('supplier_scores').select('*').eq('tenant_id', tenant.id).eq('period', period),
      supabase.from('purchases').select('supplier,total,date').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);
    setSuppliers(supRes.data||[]);
    setScores(scoreRes.data||[]);
    setPurchases(purRes.data||[]);
    setLoading(false);
  }

  async function saveScore(e) {
    e.preventDefault(); setSaving(true);
    const overall = ((parseInt(form.delivery_score)+parseInt(form.quality_score)+parseInt(form.pricing_score)+parseInt(form.service_score))/4).toFixed(2);
    // Compute order stats for this supplier
    const supPurchases = purchases.filter(p=>p.supplier===form.supplier_name);
    const existing = scores.find(s=>s.supplier_name===form.supplier_name);
    const payload = {
      tenant_id:tenant.id, supplier_id:form.supplier_id||null, supplier_name:form.supplier_name, period,
      delivery_score:parseInt(form.delivery_score), quality_score:parseInt(form.quality_score),
      pricing_score:parseInt(form.pricing_score),   service_score:parseInt(form.service_score),
      overall_score:parseFloat(overall),
      orders_count:supPurchases.length,
      total_value:supPurchases.reduce((s,p)=>s+(p.total||0),0),
      late_deliveries:parseInt(form.late_deliveries)||0,
      notes:form.notes,
    };
    if (existing) await supabase.from('supplier_scores').update(payload).eq('id', existing.id);
    else          await supabase.from('supplier_scores').insert(payload);
    setShowForm(false);
    setForm({ supplier_name:'', supplier_id:'', delivery_score:3, quality_score:3, pricing_score:3, service_score:3, late_deliveries:'0', notes:'' });
    setSaving(false); await load();
  }

  // Merge suppliers with their scores + purchase data
  const merged = suppliers.map(s => {
    const score       = scores.find(x=>x.supplier_name===s.name);
    const supPurchases= purchases.filter(p=>p.supplier===s.name);
    return {
      ...s,
      score, 
      orders: supPurchases.length,
      value:  supPurchases.reduce((sum,p)=>sum+(p.total||0),0),
    };
  }).sort((a,b)=>(b.score?.overall_score||0)-(a.score?.overall_score||0));

  const rated    = merged.filter(m=>m.score);
  const avgScore = rated.length>0 ? (rated.reduce((s,m)=>s+(m.score.overall_score||0),0)/rated.length).toFixed(2) : 0;
  const topSup   = rated[0];

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🏅 Supplier Scorecard</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Rate suppliers on delivery, quality, pricing and service</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Rate Supplier</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['Suppliers Rated', `${rated.length}/${suppliers.length}`, T.blue,  '🏅'],
          ['Avg Score',        avgScore,                             T.purple,'⭐'],
          ['Top Supplier',     topSup?.name?.slice(0,12)||'—',       T.green, '🏆'],
          ['Purchase Value',   fmt(purchases.reduce((s,p)=>s+(p.total||0),0)), T.amber, '💰'],
        ].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(400px,1fr))', gap:14 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted, gridColumn:'1/-1' }}>Loading…</div>
        :merged.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', gridColumn:'1/-1' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🏅</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No suppliers found</div>
          <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Add suppliers in Purchases → Suppliers first</div>
        </div>
        :merged.map(s=>(
          <div key={s.id} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ padding:'14px 18px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{s.name}</div>
                <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{s.orders} orders · {fmt(s.value)} this month</div>
              </div>
              {s.score?<div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:20, fontWeight:900, color:T.darkRed }}>{s.score.overall_score}</div>
                  <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase' }}>out of 5</div>
                </div>
                <GradeBadge score={s.score.overall_score}/>
              </div>
              :<span style={{ background:'#F9FAFB', color:T.muted, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'4px 12px', fontSize:10, fontWeight:700 }}>NOT RATED</span>}
            </div>
            {s.score?<div style={{ padding:'14px 18px' }}>
              {CRITERIA.map(c=>(
                <div key={c.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>{c.icon}</span>
                    <span style={{ fontSize:12, color:T.sub }}>{c.label}</span>
                  </div>
                  <StarRating value={s.score[c.key]} size={14} readOnly/>
                </div>
              ))}
              {s.score.late_deliveries>0&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:7, padding:'7px 12px', marginTop:10, fontSize:11, color:T.amber }}>
                ⚠️ {s.score.late_deliveries} late deliveries this period
              </div>}
              {s.score.notes&&<div style={{ fontSize:11, color:T.sub, marginTop:10, fontStyle:'italic' }}>"{s.score.notes}"</div>}
              <button onClick={()=>{ setForm({ supplier_name:s.name, supplier_id:s.id, delivery_score:s.score.delivery_score, quality_score:s.score.quality_score, pricing_score:s.score.pricing_score, service_score:s.score.service_score, late_deliveries:String(s.score.late_deliveries||0), notes:s.score.notes||'' }); setShowForm(true); }}
                style={{ width:'100%', marginTop:12, ...btn(T.bg, T.sub, { border:`1px solid ${T.bdr}`, fontSize:11, padding:'7px' }) }}>✏️ Update Rating</button>
            </div>
            :<div style={{ padding:'20px 18px', textAlign:'center' }}>
              <button onClick={()=>{ setForm(f=>({...f, supplier_name:s.name, supplier_id:s.id })); setShowForm(true); }}
                style={btn(T.red, T.white, { fontSize:11, padding:'8px 18px' })}>⭐ Rate This Supplier</button>
            </div>}
          </div>
        ))}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:460, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Rate Supplier — {period}</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveScore}>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Supplier *</label>
                <select value={form.supplier_id} onChange={e=>{const s=suppliers.find(x=>x.id===e.target.value);setForm(f=>({...f,supplier_id:e.target.value,supplier_name:s?.name||''}));}} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select supplier…</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {CRITERIA.map(c=>(
                <div key={c.key} style={{ marginBottom:16, background:T.bg, borderRadius:10, padding:'12px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{c.icon} {c.label}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{c.desc}</div>
                    </div>
                    <span style={{ fontSize:16, fontWeight:900, color:T.red }}>{form[c.key]}</span>
                  </div>
                  <StarRating value={form[c.key]} onChange={v=>setForm(f=>({...f,[c.key]:v}))}/>
                </div>
              ))}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Late Deliveries</label><input type="number" value={form.late_deliveries} onChange={e=>setForm(f=>({...f,late_deliveries:e.target.value}))} style={inp}/></div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <div style={{ background:T.lightRed, borderRadius:8, padding:'9px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:T.sub, textTransform:'uppercase', fontWeight:700 }}>Overall</div>
                    <div style={{ fontSize:18, fontWeight:900, color:T.red }}>{((parseInt(form.delivery_score)+parseInt(form.quality_score)+parseInt(form.pricing_score)+parseInt(form.service_score))/4).toFixed(2)}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom:14 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🏅 Save Rating'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
