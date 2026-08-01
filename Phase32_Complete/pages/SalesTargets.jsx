import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const STAFF = ['Gnanamani','Store Staff 1','Store Staff 2'];
const fmt   = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn   = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp   = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

function ProgressBar({ pct, color }) {
  const p = Math.min(100, pct||0);
  return (
    <div style={{ height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden', marginTop:6 }}>
      <div style={{ height:'100%', width:`${p}%`, background:p>=100?T.green:p>=75?T.blue:p>=50?T.amber:T.red, borderRadius:4, transition:'width .6s ease' }}/>
    </div>
  );
}

export default function SalesTargets({ tenant }) {
  const [targets,  setTargets]  = useState([]);
  const [sales,    setSales]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState(new Date().toISOString().slice(0,7));
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ staff_name:'', target_sales:'', target_orders:'', incentive_rate:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);
    const [tRes, sRes] = await Promise.all([
      supabase.from('sales_targets').select('*').eq('tenant_id', tenant.id).eq('period', period),
      supabase.from('sales').select('total,staff_name,date').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);
    // Compute actuals per staff
    const actualsByStaff = {};
    (sRes.data||[]).forEach(s => {
      const name = s.staff_name || 'Unknown';
      if (!actualsByStaff[name]) actualsByStaff[name] = { sales:0, orders:0 };
      actualsByStaff[name].sales  += s.total||0;
      actualsByStaff[name].orders += 1;
    });
    // Merge targets with actuals
    const merged = (tRes.data||[]).map(t => ({
      ...t,
      actual_sales:  actualsByStaff[t.staff_name]?.sales  || 0,
      actual_orders: actualsByStaff[t.staff_name]?.orders || 0,
    }));
    setTargets(merged);
    setSales(sRes.data||[]);
    setLoading(false);
  }

  async function saveTarget(e) {
    e.preventDefault(); setSaving(true);
    const existing = targets.find(t=>t.staff_name===form.staff_name);
    const payload  = { ...form, tenant_id:tenant.id, period, target_sales:parseFloat(form.target_sales)||0, target_orders:parseInt(form.target_orders)||0, incentive_rate:parseFloat(form.incentive_rate)||0 };
    if (existing) await supabase.from('sales_targets').update(payload).eq('id', existing.id);
    else          await supabase.from('sales_targets').insert(payload);
    setShowForm(false); setForm({ staff_name:'', target_sales:'', target_orders:'', incentive_rate:'', notes:'' });
    setSaving(false); await load();
  }

  const totalTarget  = targets.reduce((s,t)=>s+(t.target_sales||0),0);
  const totalActual  = targets.reduce((s,t)=>s+(t.actual_sales||0),0);
  const overallPct   = totalTarget>0 ? Math.round(totalActual/totalTarget*100) : 0;

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>🎯 Sales Targets</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Monthly targets, achievements and incentives</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Set Target</button>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px', marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:T.darkRed }}>Team Overall — {period}</div>
            <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{fmt(totalActual)} of {fmt(totalTarget)} target</div>
          </div>
          <div style={{ fontSize:32, fontWeight:900, color:overallPct>=100?T.green:overallPct>=75?T.blue:T.amber }}>{overallPct}%</div>
        </div>
        <ProgressBar pct={overallPct}/>
      </div>

      {/* Staff cards */}
      {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
      :targets.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🎯</div>
        <div style={{ color:T.muted, fontWeight:600 }}>No targets set for {period}</div>
        <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Click "+ Set Target" to add monthly targets for staff</div>
      </div>
      :<div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
        {targets.map(t=>{
          const salesPct  = t.target_sales>0  ? Math.round(t.actual_sales/t.target_sales*100)   : 0;
          const orderPct  = t.target_orders>0 ? Math.round(t.actual_orders/t.target_orders*100) : 0;
          const incentive = t.actual_sales * (t.incentive_rate||0) / 100;
          return (
            <div key={t.id} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 22px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{t.staff_name}</div>
                  <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{period} · Incentive: {t.incentive_rate||0}%</div>
                </div>
                <div style={{ background:salesPct>=100?'#F0FDF4':salesPct>=75?'#EFF6FF':'#FFFBEB', border:`1px solid ${salesPct>=100?'#BBF7D0':salesPct>=75?'#BFDBFE':'#FDE68A'}`, borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:800, color:salesPct>=100?T.green:salesPct>=75?T.blue:T.amber }}>
                  {salesPct}%
                </div>
              </div>

              {/* Sales */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:T.sub, fontWeight:600 }}>Sales Revenue</span>
                  <span style={{ color:T.ink }}><span style={{ fontWeight:700, color:T.green }}>{fmt(t.actual_sales)}</span> <span style={{ color:T.muted }}>/ {fmt(t.target_sales)}</span></span>
                </div>
                <ProgressBar pct={salesPct}/>
              </div>

              {/* Orders */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:T.sub, fontWeight:600 }}>Orders</span>
                  <span style={{ color:T.ink }}><span style={{ fontWeight:700, color:T.blue }}>{t.actual_orders}</span> <span style={{ color:T.muted }}>/ {t.target_orders}</span></span>
                </div>
                <ProgressBar pct={orderPct}/>
              </div>

              {/* Incentive earned */}
              <div style={{ background:T.lightRed, borderRadius:9, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:T.sub, fontWeight:600 }}>Incentive Earned</span>
                <span style={{ fontSize:16, fontWeight:800, color:T.red }}>{fmt(incentive)}</span>
              </div>

              <button onClick={()=>{ setForm({ staff_name:t.staff_name, target_sales:t.target_sales, target_orders:t.target_orders, incentive_rate:t.incentive_rate, notes:t.notes||'' }); setShowForm(true); }}
                style={{ width:'100%', marginTop:12, ...btn(T.bg, T.sub, { border:`1px solid ${T.bdr}`, fontSize:11 }) }}>✏️ Edit Target</button>
            </div>
          );
        })}
      </div>}

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Set Target — {period}</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveTarget}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Staff Member *</label>
                  <select value={form.staff_name} onChange={e=>setForm(f=>({...f,staff_name:e.target.value}))} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select staff…</option>
                    {STAFF.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {[['Sales Target (Rs.) *','number','target_sales'],['Order Count Target','number','target_orders'],['Incentive Rate (%)','number','incentive_rate'],['Notes','text','notes']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                    <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'🎯 Save Target'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
