import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', gold:'#B45309',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => Math.abs(n)>=100000 ? '₹'+(n/100000).toFixed(1)+'L' : Math.abs(n)>=1000 ? '₹'+(n/1000).toFixed(1)+'K' : fmt(n);
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };

const CATS = {
  'Raw Materials': { icon:'📦', color:'#D97706' },
  'Staff Salary':  { icon:'👥', color:'#7C3AED' },
  'Rent':          { icon:'🏢', color:'#2563EB' },
  'Logistics':     { icon:'🚚', color:'#EA580C' },
  'Marketing':     { icon:'📣', color:'#C0392B' },
  'Utilities':     { icon:'💡', color:'#16A34A' },
  'Maintenance':   { icon:'🔧', color:'#0D9488' },
  'Other':         { icon:'📌', color:'#6B7280' },
};
const catCfg = c => CATS[c] || { icon:'📌', color:'#6B7280' };
const MODES = ['cash','upi','neft','card','cheque'];

export default function ExpensesDashboard({ tenant, role='owner' }) {
  const [expenses, setExpenses] = useState([]);
  const [budgets,  setBudgets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('all');   // all | budget | vendor | recurring
  const [catF,     setCatF]     = useState('All');
  const [search,   setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editExp,  setEditExp]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [form, setForm] = useState({ date:new Date().toISOString().slice(0,10), category:'', vendor:'', amount:'', payment_mode:'cash', note:'', is_recurring:false, recur_every:'monthly' });

  const period = new Date().toISOString().slice(0,7);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const monthStart = period+'-01';
    const [eRes, bRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).order('date',{ ascending:false }).limit(1000),
      supabase.from('budgets').select('*').eq('tenant_id', tenant.id).eq('period', period),
    ]);
    setExpenses(eRes.data||[]); setBudgets(bRes.data||[]);
    setLoading(false);
  }

  async function saveExpense(e) {
    e.preventDefault(); setSaving(true);
    const payload = {
      tenant_id: tenant.id, date: form.date, category: form.category,
      vendor: form.vendor||null, amount: parseFloat(form.amount)||0,
      payment_mode: form.payment_mode, note: form.note||null,
      is_recurring: !!form.is_recurring,
      recur_every: form.is_recurring ? form.recur_every : null,
      next_due: form.is_recurring ? nextDue(form.date, form.recur_every) : null,
      status: 'paid',
    };
    if (editExp) await supabase.from('expenses').update(payload).eq('id', editExp.id);
    else         await supabase.from('expenses').insert(payload);
    setShowForm(false); setEditExp(null);
    setForm({ date:new Date().toISOString().slice(0,10), category:'', vendor:'', amount:'', payment_mode:'cash', note:'', is_recurring:false, recur_every:'monthly' });
    setSaved(true); setTimeout(()=>setSaved(false),2500);
    await load(); setSaving(false);
  }

  function nextDue(from, every) {
    const d = new Date(from);
    if (every==='weekly')    d.setDate(d.getDate()+7);
    if (every==='monthly')   d.setMonth(d.getMonth()+1);
    if (every==='quarterly') d.setMonth(d.getMonth()+3);
    if (every==='yearly')    d.setFullYear(d.getFullYear()+1);
    return d.toISOString().slice(0,10);
  }

  function openEdit(x) {
    setEditExp(x);
    setForm({ date:x.date, category:x.category||'', vendor:x.vendor||'', amount:String(x.amount||''), payment_mode:x.payment_mode||'cash', note:x.note||'', is_recurring:!!x.is_recurring, recur_every:x.recur_every||'monthly' });
    setShowForm(true);
  }

  function exportCsv() {
    const hdr = ['Date','Category','Vendor','Mode','Amount','Note'];
    const body = displayed.map(e=>[e.date,e.category,e.vendor||'',e.payment_mode||'',e.amount,(e.note||'').replace(/,/g,';')]);
    const csv = [hdr, ...body].map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `expenses-${period}.csv`; a.click();
  }

  const [debounced, setDebounced] = useState('');
  useEffect(()=>{ const t=setTimeout(()=>setDebounced(search),200); return ()=>clearTimeout(t); },[search]);

  const monthExp = useMemo(() => expenses.filter(e => (e.date||'').startsWith(period)), [expenses, period]);

  const displayed = useMemo(() => expenses
    .filter(e => catF==='All' || e.category===catF)
    .filter(e => !debounced
      || (e.vendor||'').toLowerCase().includes(debounced.toLowerCase())
      || (e.category||'').toLowerCase().includes(debounced.toLowerCase())
      || (e.note||'').toLowerCase().includes(debounced.toLowerCase())),
    [expenses, catF, debounced]);

  const PAGE = 150;
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? displayed : displayed.slice(0, PAGE);

  const kpis = useMemo(() => {
    const spent = monthExp.reduce((s,e)=>s+(e.amount||0),0);
    const budget = budgets.reduce((s,b)=>s+(b.amount||0),0);
    const dayOfMonth = new Date().getDate();
    const byCat = {};
    monthExp.forEach(e => { const k=e.category||'Other'; byCat[k]=(byCat[k]||0)+(e.amount||0); });
    const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    return { spent, budget, entries:monthExp.length, avgDay: dayOfMonth>0?spent/dayOfMonth:0,
             pctUsed: budget>0 ? spent/budget*100 : null, topCat: top, byCat };
  }, [monthExp, budgets]);

  // Budget vs actual per category
  const budgetRows = useMemo(() => {
    const cats = new Set([...budgets.map(b=>b.category), ...Object.keys(kpis.byCat)]);
    return [...cats].map(c => {
      const budget = budgets.find(b=>b.category===c)?.amount || 0;
      const actual = kpis.byCat[c] || 0;
      return { cat:c, budget, actual, pct: budget>0 ? actual/budget*100 : null, over: budget>0 && actual>budget };
    }).sort((a,b)=>b.actual-a.actual);
  }, [budgets, kpis.byCat]);

  // Vendor analysis
  const vendorRows = useMemo(() => {
    const byV = {};
    expenses.filter(e=>e.vendor).forEach(e => {
      if (!byV[e.vendor]) byV[e.vendor] = { total:0, count:0, cats:new Set(), last:e.date };
      byV[e.vendor].total += e.amount||0;
      byV[e.vendor].count += 1;
      byV[e.vendor].cats.add(e.category);
      if (e.date > byV[e.vendor].last) byV[e.vendor].last = e.date;
    });
    return Object.entries(byV).map(([v,d])=>({ vendor:v, ...d, cats:[...d.cats] })).sort((a,b)=>b.total-a.total);
  }, [expenses]);

  const recurringRows = useMemo(() => expenses.filter(e=>e.is_recurring)
    .sort((a,b)=>(a.next_due||'').localeCompare(b.next_due||'')), [expenses]);

  const usedCats = ['All', ...new Set(expenses.map(e=>e.category).filter(Boolean))];

  const KPI = ({ label, value, icon, color, sub }) => (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)', display:'flex', gap:12, alignItems:'center' }}>
      <div style={{ width:38, height:38, borderRadius:10, background:(color||T.red)+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <div style={{ fontSize:19, fontWeight:900, color:color||T.ink, letterSpacing:'-0.02em' }}>{value}</div>
        {sub && <div style={{ fontSize:10, color:T.muted }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Expenses</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>
            Track · Categorise · Budget · Vendor intelligence
            {saved && <span style={{ color:T.green, fontWeight:700, marginLeft:8 }}>✓ Saved</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportCsv} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>↓ Export</button>
          <button onClick={()=>{ setEditExp(null); setShowForm(true); }} style={btn(T.red, T.white)}>+ Add Expense</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12, marginBottom:16 }}>
        <KPI label="Total Spent"    value={fmtL(kpis.spent)}  icon="💰" color={T.gold}   sub={`${kpis.entries} entries this month`}/>
        <KPI label="Monthly Budget" value={kpis.budget?fmtL(kpis.budget):'Not set'} icon="🎯" color={T.blue}
             sub={kpis.pctUsed!=null ? `${kpis.pctUsed.toFixed(0)}% used` : 'set one in Accounting → Budget'}/>
        <KPI label="Avg / Day"      value={fmtL(kpis.avgDay)} icon="📊" color={T.purple} sub="daily run rate"/>
        <KPI label="Top Category"   value={kpis.topCat?kpis.topCat[0]:'—'} icon="🏷️" color={T.red}
             sub={kpis.topCat?fmt(kpis.topCat[1]):''}/>
      </div>

      {/* Budget warning */}
      {kpis.pctUsed!=null && kpis.pctUsed>85 && (
        <div style={{ background: kpis.pctUsed>100?'#FEF2F2':'#FFFBEB', border:`1px solid ${kpis.pctUsed>100?'#FECACA':'#FDE68A'}`, borderRadius:10, padding:'11px 16px', marginBottom:16, fontSize:13, fontWeight:600, color: kpis.pctUsed>100?T.red:T.amber }}>
          {kpis.pctUsed>100
            ? `🚨 Over budget by ${fmt(kpis.spent-kpis.budget)} — ${kpis.pctUsed.toFixed(0)}% of the monthly budget spent`
            : `⚠️ ${kpis.pctUsed.toFixed(0)}% of the monthly budget used with ${new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()-new Date().getDate()} days left`}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:10, padding:4, gap:3, marginBottom:14, width:'fit-content', flexWrap:'wrap' }}>
        {[['all','All Expenses'],['budget','Budget vs Actual'],['vendor','Vendor Analysis'],['recurring',`Recurring${recurringRows.length?` ${recurringRows.length}`:''}`]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{ padding:'9px 17px', background: tab===id?T.red:'transparent', color: tab===id?T.white:T.sub,
                     border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {/* ── ALL EXPENSES ── */}
      {tab==='all' && (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:13, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
              {usedCats.map(c=>{
                const cfg = c==='All'?null:catCfg(c);
                const on = catF===c;
                return (
                  <button key={c} onClick={()=>setCatF(c)}
                    style={{ padding:'6px 13px', background: on?T.red:T.white, color: on?T.white:T.sub,
                             border:`1px solid ${on?T.red:T.bdr}`, borderRadius:20, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    {cfg?`${cfg.icon} `:''}{c}
                  </button>
                );
              })}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor or category…" style={{ ...inp, width:230 }}/>
          </div>

          <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:T.lightRed }}>
                {['Date','Category','Vendor','Mode','Amount','Status',''].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:h==='Amount'?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? Array.from({length:6}).map((_,i)=>(
                  <tr key={'sk'+i}>{Array.from({length:7}).map((_,j)=>(
                    <td key={j} style={{ padding:12 }}><div style={{ height:14, background:'linear-gradient(90deg,#F0E8E8 25%,#F8F0F0 50%,#F0E8E8 75%)', backgroundSize:'200% 100%', animation:'skelShine 1.4s ease-in-out infinite', borderRadius:5, width:j===0?'70%':'50%' }}/></td>
                  ))}</tr>
                ))
                : rows.length===0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:50 }}>
                    <div style={{ fontSize:34, marginBottom:8 }}>💸</div>
                    <div style={{ color:T.muted, fontWeight:600 }}>No expenses match</div>
                  </td></tr>
                )
                : rows.map(e=>{
                    const cfg = catCfg(e.category);
                    return (
                      <tr key={e.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'10px 12px', color:T.sub }}>{e.date}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ background:cfg.color+'15', color:cfg.color, border:`1px solid ${cfg.color}33`, borderRadius:6, padding:'3px 10px', fontSize:10.5, fontWeight:700, whiteSpace:'nowrap' }}>
                            {cfg.icon} {e.category}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>
                          {e.vendor||'—'}
                          {e.is_recurring && <span style={{ marginLeft:6, background:'#F5F3FF', color:T.purple, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700 }}>🔁 {e.recur_every}</span>}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{e.payment_mode||'cash'}</span>
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:T.red, fontWeight:800 }}>{fmt(e.amount)}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'2px 9px', fontSize:9.5, fontWeight:700 }}>{(e.status||'paid').toUpperCase()}</span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <button onClick={()=>openEdit(e)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {displayed.length > PAGE && (
            <div style={{ textAlign:'center', margin:'12px 0' }}>
              <button onClick={()=>setShowAll(s=>!s)} style={btn(T.white, T.red, { border:`1px solid ${T.bdr}`, padding:'9px 20px' })}>
                {showAll ? 'Show fewer' : `Show all ${displayed.length} (${displayed.length-PAGE} more)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── BUDGET VS ACTUAL ── */}
      {tab==='budget' && (
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          {budgetRows.length===0
            ? <div style={{ textAlign:'center', padding:40, color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                <div style={{ fontSize:13, fontWeight:600 }}>No budgets set for {period}</div>
                <div style={{ fontSize:11.5, marginTop:4 }}>Set them under Accounting → Budget Tracker</div>
              </div>
            : budgetRows.map(r=>{
                const cfg = catCfg(r.cat);
                return (
                  <div key={r.cat} style={{ marginBottom:15 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <span style={{ fontSize:12.5, color:T.ink, fontWeight:600 }}>{cfg.icon} {r.cat}</span>
                      <span style={{ fontSize:12 }}>
                        <strong style={{ color: r.over?T.red:T.ink }}>{fmt(r.actual)}</strong>
                        <span style={{ color:T.muted }}> / {r.budget?fmt(r.budget):'no budget'}</span>
                        {r.pct!=null && <span style={{ color: r.over?T.red:r.pct>85?T.amber:T.green, fontWeight:700, marginLeft:8 }}>{r.pct.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div style={{ height:9, background:'#F3F4F6', borderRadius:5, overflow:'hidden', position:'relative' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, r.pct||0)}%`, background: r.over?T.red:r.pct>85?T.amber:cfg.color, borderRadius:5, transition:'width .5s' }}/>
                      {r.over && <div style={{ position:'absolute', top:0, right:0, height:'100%', width:'3px', background:T.darkRed }}/>}
                    </div>
                    {r.over && <div style={{ fontSize:10.5, color:T.red, marginTop:3, fontWeight:600 }}>Over by {fmt(r.actual-r.budget)}</div>}
                  </div>
                );
              })}
        </div>
      )}

      {/* ── VENDOR ANALYSIS ── */}
      {tab==='vendor' && (
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          {vendorRows.length===0
            ? <div style={{ textAlign:'center', padding:44, color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🏭</div>
                <div style={{ fontSize:13, fontWeight:600 }}>No vendor data yet</div>
                <div style={{ fontSize:11.5, marginTop:4 }}>Add a vendor name when recording expenses to see this</div>
              </div>
            : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead><tr style={{ background:T.lightRed }}>
                  {['Vendor','Categories','Payments','Total Spent','Share','Last Paid'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:['Payments','Total Spent','Share'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {vendorRows.slice(0,25).map(v=>{
                    const totalAll = vendorRows.reduce((s,x)=>s+x.total,0);
                    const share = totalAll>0 ? v.total/totalAll*100 : 0;
                    return (
                      <tr key={v.vendor} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'10px 12px', color:T.ink, fontWeight:700 }}>{v.vendor}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {v.cats.slice(0,3).map(c=>{ const cf=catCfg(c); return (
                              <span key={c} style={{ background:cf.color+'15', color:cf.color, borderRadius:4, padding:'1px 7px', fontSize:9.5, fontWeight:600 }}>{cf.icon} {c}</span>
                            );})}
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:T.sub }}>{v.count}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:T.red, fontWeight:800 }}>{fmt(v.total)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7, justifyContent:'flex-end' }}>
                            <div style={{ width:52, height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${share}%`, background:T.red, borderRadius:3 }}/>
                            </div>
                            <span style={{ fontSize:11, color:T.sub, minWidth:32 }}>{share.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', color:T.muted, fontSize:11 }}>{v.last}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
        </div>
      )}

      {/* ── RECURRING ── */}
      {tab==='recurring' && (
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          {recurringRows.length===0
            ? <div style={{ textAlign:'center', padding:44, color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔁</div>
                <div style={{ fontSize:13, fontWeight:600 }}>No recurring expenses</div>
                <div style={{ fontSize:11.5, marginTop:4 }}>Tick "This repeats" when adding rent, salaries or subscriptions</div>
              </div>
            : <>
                <div style={{ padding:'12px 16px', background:T.lightRed, borderBottom:`1px solid ${T.bdr}`, fontSize:12.5, color:T.darkRed, fontWeight:600 }}>
                  {fmt(recurringRows.reduce((s,r)=>s+(r.amount||0),0))} committed across {recurringRows.length} recurring expense{recurringRows.length>1?'s':''}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead><tr style={{ background:T.bg }}>
                    {['Vendor / Purpose','Category','Every','Amount','Next Due',''].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:h==='Amount'?'right':'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {recurringRows.map(r=>{
                      const cfg = catCfg(r.category);
                      const days = r.next_due ? Math.ceil((new Date(r.next_due)-new Date())/86400000) : null;
                      return (
                        <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                          <td style={{ padding:'10px 12px', color:T.ink, fontWeight:600 }}>{r.vendor||r.note||'—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background:cfg.color+'15', color:cfg.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{cfg.icon} {r.category}</span>
                          </td>
                          <td style={{ padding:'10px 12px', color:T.sub, textTransform:'capitalize' }}>{r.recur_every}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right', color:T.red, fontWeight:800 }}>{fmt(r.amount)}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.next_due
                              ? <span style={{ color: days<0?T.red:days<=7?T.amber:T.sub, fontWeight: days<=7?700:400 }}>
                                  {r.next_due}{days!=null && <span style={{ fontSize:10 }}> · {days<0?`${Math.abs(days)}d overdue`:`in ${days}d`}</span>}
                                </span>
                              : '—'}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <button onClick={()=>openEdit(r)} style={{ background:T.lightRed, color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>}
        </div>
      )}

      {/* Add / edit modal */}
      {showForm && (
        <div onClick={()=>setShowForm(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.white, borderRadius:15, padding:25, width:'100%', maxWidth:470, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed }}>{editExp?'Edit':'Add'} Expense</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:21, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveExpense}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Date *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required style={{ ...inp, width:'100%' }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Amount *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required style={{ ...inp, width:'100%', fontWeight:700, color:T.red }}/></div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Category *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                    {Object.entries(CATS).map(([c,cfg])=>(
                      <button key={c} type="button" onClick={()=>setForm(f=>({...f,category:c}))}
                        style={{ background: form.category===c?cfg.color+'18':T.white, border:`1.5px solid ${form.category===c?cfg.color:T.bdr}`,
                                 borderRadius:9, padding:'9px 4px', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                        <div style={{ fontSize:16 }}>{cfg.icon}</div>
                        <div style={{ fontSize:9.5, color: form.category===c?cfg.color:T.sub, fontWeight: form.category===c?700:500, marginTop:2, lineHeight:1.2 }}>{c}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Vendor / Paid To</label><input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="e.g. MG Properties" style={{ ...inp, width:'100%' }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Payment Mode</label>
                  <select value={form.payment_mode} onChange={e=>setForm(f=>({...f,payment_mode:e.target.value}))} style={{ ...inp, width:'100%', cursor:'pointer', textTransform:'uppercase' }}>
                    {MODES.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Note</label><input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{ ...inp, width:'100%' }}/></div>
              </div>

              <div style={{ background:T.bg, borderRadius:10, padding:'12px 15px', marginTop:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.is_recurring} onChange={e=>setForm(f=>({...f,is_recurring:e.target.checked}))} style={{ width:17, height:17, accentColor:T.red, cursor:'pointer' }}/>
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:700, color:T.ink }}>This repeats</div>
                    <div style={{ fontSize:10.5, color:T.sub }}>Rent, salaries, subscriptions — tracked with a next-due date</div>
                  </div>
                </label>
                {form.is_recurring && (
                  <div style={{ marginTop:10, display:'flex', gap:6 }}>
                    {['weekly','monthly','quarterly','yearly'].map(f2=>(
                      <button key={f2} type="button" onClick={()=>setForm(f=>({...f,recur_every:f2}))}
                        style={{ flex:1, padding:'7px', background: form.recur_every===f2?T.red:T.white, color: form.recur_every===f2?'#fff':T.sub,
                                 border:`1px solid ${form.recur_every===f2?T.red:T.bdr}`, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f2}</button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:10, marginTop:18 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving||!form.category} style={{ flex:2, ...btn(T.red,T.white,{ padding:'12px', fontSize:13 }) }}>{saving?'Saving…':editExp?'Update':'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
