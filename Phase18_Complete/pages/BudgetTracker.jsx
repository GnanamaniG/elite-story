import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const DEFAULT_CATEGORIES = ['Rent','Salary','Electricity','Internet','Marketing','Transport','Maintenance','Purchases','Miscellaneous'];

export default function BudgetTracker({ tenant }) {
  const [budgets,   setBudgets]   = useState([]);
  const [actuals,   setActuals]   = useState({});
  const [period,    setPeriod]    = useState(new Date().toISOString().slice(0,7));
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const [budgetsRes, expenses] = await Promise.all([
      supabase.from('budgets').select('*').eq('tenant_id', tenant.id).eq('period', period),
      (await supabase.from('expenses').select('*').eq('tenant_id',tenant.id).then(r=>r.data||[])),
    ]);
    const bData = budgetsRes.data||[];
    setBudgets(bData);
    const periodExp = expenses.filter(e=>(e.date||'').startsWith(period));
    const actualMap = periodExp.reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+(e.amount||0); return acc; },{});
    setActuals(actualMap);
    const initForm = {};
    DEFAULT_CATEGORIES.forEach(cat => { initForm[cat] = bData.find(b=>b.category===cat)?.amount||0; });
    setEditForm(initForm);
    setLoading(false);
  }

  async function saveBudgets() {
    setSaving(true);
    for (const [cat, amount] of Object.entries(editForm)) {
      if (parseFloat(amount)||0 > 0) {
        await supabase.from('budgets').upsert({ tenant_id:tenant.id, category:cat, period, amount:parseFloat(amount)||0 }, { onConflict:'tenant_id,category,period' });
      }
    }
    setEditing(false); setSaving(false); await load();
  }

  const allCats = [...new Set([...DEFAULT_CATEGORIES, ...Object.keys(actuals)])];
  const totalBudget  = budgets.reduce((s,b)=>s+(b.amount||0),0);
  const totalActual  = Object.values(actuals).reduce((s,v)=>s+v,0);
  const totalVariance= totalBudget - totalActual;

  function StatusPill({ budget, actual }) {
    if (!budget) return <span style={{ color:T.muted, fontSize:11 }}>No budget set</span>;
    const pct  = Math.round(actual/budget*100);
    const over = actual > budget;
    return <span style={{ background:over?T.red+'22':pct>80?T.amber+'22':T.green+'22', color:over?T.red:pct>80?T.amber:T.green, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{pct}% {over?'⚠️ Over':'✅'}</span>;
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📊 Budget Tracker</div>
          <div style={{ fontSize:13, color:T.sub }}>Set and track monthly expense budgets</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }} />
          <button onClick={()=>setEditing(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✏️ Edit Budgets</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Budget', fmt(totalBudget), T.blue],
          ['Actual Spend', fmt(totalActual), totalActual>totalBudget?T.red:T.amber],
          ['Variance', fmt(Math.abs(totalVariance)), totalVariance>=0?T.green:T.red],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
            {label==='Variance'&&<div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{totalVariance>=0?'Under budget':'Over budget'}</div>}
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
          <span style={{ color:T.ink, fontWeight:700 }}>Overall Budget Used</span>
          <span style={{ color:T.sub }}>{fmt(totalActual)} of {fmt(totalBudget)}</span>
        </div>
        <div style={{ height:12, background:T.bdr, borderRadius:6, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:'100%', width:`${Math.min(100,totalBudget>0?totalActual/totalBudget*100:0)}%`, background:totalActual>totalBudget?T.red:totalActual/totalBudget>0.8?T.amber:T.green, borderRadius:6, transition:'width .5s' }} />
        </div>
        <div style={{ fontSize:11, color:T.muted }}>{totalBudget>0?Math.round(totalActual/totalBudget*100):0}% of monthly budget spent</div>
      </div>

      {/* Category breakdown */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Category Breakdown</div>
        {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
        : allCats.map(cat => {
          const budget = budgets.find(b=>b.category===cat)?.amount||0;
          const actual = actuals[cat]||0;
          const pct    = budget>0?Math.min(100,actual/budget*100):0;
          const over   = actual > budget && budget > 0;
          if (!budget && !actual) return null;
          return (
            <div key={cat} style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}22` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:T.ink }}>{cat}</span>
                  <StatusPill budget={budget} actual={actual} />
                </div>
                <div style={{ textAlign:'right', fontSize:13 }}>
                  <span style={{ color:over?T.red:T.amber, fontWeight:700 }}>{fmt(actual)}</span>
                  {budget>0&&<span style={{ color:T.muted }}> / {fmt(budget)}</span>}
                </div>
              </div>
              {budget>0&&<div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:over?T.red:pct>80?T.amber:T.green, borderRadius:3, transition:'width .5s' }}/></div>}
            </div>
          );
        }).filter(Boolean)}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:480, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Set Budgets — {period}</div>
              <button onClick={()=>setEditing(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {DEFAULT_CATEGORIES.map(cat=>(
                <div key={cat}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{cat}</label>
                  <input type="number" min={0} value={editForm[cat]||''} onChange={e=>setEditForm(f=>({...f,[cat]:e.target.value}))} placeholder="0"
                    style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 10px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setEditing(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={saveBudgets} disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Budgets'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
