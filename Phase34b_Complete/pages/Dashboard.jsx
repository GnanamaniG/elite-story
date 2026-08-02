import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', card2:'#FFF5F5',
  bdr:'#E8DEDE', bdr2:'#F0E8E8',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FDECEA',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  purple:'#7C3AED', teal:'#0D9488', orange:'#EA580C',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
  white:'#FFFFFF',
  sidebar:'#7B1E1E', sideHov:'#9B2C2C', sideTxt:'#FFCDD2', sideActTxt:'#7B1E1E'
};
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtK = n => n >= 100000 ? 'Rs.' + (n/100000).toFixed(1) + 'L' : n >= 1000 ? 'Rs.' + (n/1000).toFixed(1) + 'K' : fmt(n);

function MiniBar({ value, max, color }) {
  const pct = Math.min(100, max > 0 ? (value/max)*100 : 0);
  return <div style={{ height:5, background:T.bdr, borderRadius:3, overflow:'hidden', marginTop:6 }}><div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .5s' }}/></div>;
}

function GoalRing({ value, target, color, label }) {
  const pct = Math.min(100, target > 0 ? (value/target)*100 : 0);
  const r=36, circ=2*Math.PI*r, dash=circ*(pct/100);
  return (
    <div style={{ textAlign:'center' }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke={T.bdr} strokeWidth={8}/>
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 45 45)" style={{ transition:'stroke-dasharray .5s' }}/>
        <text x={45} y={48} textAnchor="middle" fontSize={14} fontWeight="bold" fill={T.ink}>{Math.round(pct)}%</text>
      </svg>
      <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{label}</div>
      <div style={{ fontSize:10, color:T.muted }}>{fmtK(value)} / {fmtK(target)}</div>
    </div>
  );
}

export default function Dashboard({ tenant, user, onNavigate }) {
  const [data,     setData]     = useState(null);
  const [goals,    setGoals]    = useState([]);
  const [period,   setPeriod]   = useState('month');
  const [loading,  setLoading]  = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [editGoals,setEditGoals]= useState(false);
  const [goalForm, setGoalForm] = useState({});
  const [showReports, setShowReports] = useState(false);
  const [reportTab,   setReportTab]   = useState('trend');

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    const now       = new Date();
    const yr        = now.getFullYear();
    const mo        = String(now.getMonth()+1).padStart(2,'0');
    const today     = now.toISOString().slice(0,10);
    const weekStart = new Date(now - now.getDay()*86400000).toISOString().slice(0,10);
    const monthStart = `${yr}-${mo}-01`;
    const lastMonthStart = new Date(yr, now.getMonth()-1, 1).toISOString().slice(0,10);
    const lastMonthEnd   = new Date(yr, now.getMonth(), 0).toISOString().slice(0,10);

    const dateFrom = period==='today'?today : period==='week'?weekStart : period==='month'?monthStart : `${yr}-01-01`;
    const lastFrom = period==='month'?lastMonthStart : null;
    const lastTo   = period==='month'?lastMonthEnd : null;

    const [salesRes, lastSalesRes, expRes, invRes, custRes, goalsRes] = await Promise.all([
      supabase.from('sales').select('total,gst_amount,items,customer,customer_id,date,status,payment_mode,staff_name').eq('tenant_id',tenant.id).gte('date',dateFrom),
      lastFrom ? supabase.from('sales').select('total').eq('tenant_id',tenant.id).gte('date',lastFrom).lte('date',lastTo) : Promise.resolve({data:[]}),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id',tenant.id).gte('date',dateFrom),
      supabase.from('inventory').select('name,cat,stock,alert,sp,cp').eq('tenant_id',tenant.id).eq('active',true),
      supabase.from('customers').select('id,name,outstanding,total_spent').eq('tenant_id',tenant.id),
      supabase.from('goals').select('*').eq('tenant_id',tenant.id).eq('period',`${yr}-${mo}`),
    ]);

    const sales    = salesRes.data||[];
    const lastSales= lastSalesRes.data||[];
    const expenses = expRes.data||[];
    const inventory= invRes.data||[];
    const customers= custRes.data||[];

    const revenue   = sales.reduce((s,x)=>s+(x.total||0),0);
    const lastRev   = lastSales.reduce((s,x)=>s+(x.total||0),0);
    const gstColl   = sales.reduce((s,x)=>s+(x.gst_amount||0),0);
    const expTotal  = expenses.reduce((s,x)=>s+(x.amount||0),0);
    const profit    = revenue - expTotal;
    const orders    = sales.length;
    const avgOrder  = orders > 0 ? revenue/orders : 0;
    const lowStock  = inventory.filter(i=>(i.stock||0)<=(i.alert||10));
    const outstanding= customers.reduce((s,c)=>s+(c.outstanding||0),0);
    const revChange = lastRev > 0 ? ((revenue-lastRev)/lastRev*100) : null;

    // Top items
    const itemSales={};
    sales.forEach(s=>(s.items||[]).forEach(i=>{itemSales[i.name]=(itemSales[i.name]||0)+(i.amount||0);}));
    const topItems = Object.entries(itemSales).sort((a,b)=>b[1]-a[1]).slice(0,5);

    // Payment modes
    const payModes = sales.reduce((acc,s)=>{acc[s.payment_mode||'cash']=(acc[s.payment_mode||'cash']||0)+(s.total||0);return acc;},{});

    // Today stats
    const todaySales = sales.filter(s=>s.date===today);
    const todayRev   = todaySales.reduce((s,x)=>s+(x.total||0),0);

    // ── Report aggregates — derived from the same fetch, no extra queries ──
    // Daily revenue trend
    const byDay = {};
    sales.forEach(s => { byDay[s.date] = (byDay[s.date]||0) + (s.total||0); });
    const trend = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0]));

    // Expense split by category
    const expByCat = {};
    expenses.forEach(e => { const k = e.category||'Uncategorised'; expByCat[k] = (expByCat[k]||0) + (e.amount||0); });
    const expenseSplit = Object.entries(expByCat).sort((a,b)=>b[1]-a[1]);

    // Revenue by product category, and COGS for real margin
    const catRev = {}; let cogs = 0;
    const cpByName = {}; inventory.forEach(i => { cpByName[i.name] = i.cp||0; });
    const catByName= {}; inventory.forEach(i => { catByName[i.name] = i.cat||'Uncategorised'; });
    sales.forEach(s => (s.items||[]).forEach(li => {
      const cat = catByName[li.name] || li.cat || 'Uncategorised';
      catRev[cat] = (catRev[cat]||0) + (li.amount||0);
      cogs += (cpByName[li.name]||0) * (li.qty||1);
    }));
    const categorySplit = Object.entries(catRev).sort((a,b)=>b[1]-a[1]);
    const grossProfit = revenue - cogs;
    const grossMargin = revenue>0 ? grossProfit/revenue*100 : 0;

    // Staff leaderboard
    const byStaff = {};
    sales.forEach(s => { const k=s.staff_name||'Unassigned'; if(!byStaff[k]) byStaff[k]={rev:0,orders:0}; byStaff[k].rev+=s.total||0; byStaff[k].orders+=1; });
    const staffBoard = Object.entries(byStaff).sort((a,b)=>b[1].rev-a[1].rev);

    // Repeat vs new customers in this period
    const custOrders = {};
    sales.forEach(s => { const k=s.customer_id||s.customer; if(k) custOrders[k]=(custOrders[k]||0)+1; });
    const repeatCust = Object.values(custOrders).filter(n=>n>1).length;
    const uniqueCust = Object.keys(custOrders).length;
    const repeatRate = uniqueCust>0 ? repeatCust/uniqueCust*100 : 0;

    // Dead stock — never sold in this period but sitting in inventory
    const soldNames = new Set();
    sales.forEach(s => (s.items||[]).forEach(li => soldNames.add(li.name)));
    const deadStock = inventory.filter(i => !soldNames.has(i.name) && (i.stock||0) > 0)
      .map(i => ({ ...i, tied: (i.stock||0)*(i.cp||0) }))
      .sort((a,b)=>b.tied-a.tied);
    const deadValue = deadStock.reduce((s,i)=>s+i.tied,0);

    setGoals(goalsRes.data||[]);
    setData({ revenue,lastRev,revChange,gstColl,expTotal,profit,orders,avgOrder,lowStock,outstanding,topItems,payModes,todayRev,todayOrders:todaySales.length,inventory,customers,
              trend, expenseSplit, categorySplit, cogs, grossProfit, grossMargin, staffBoard, repeatRate, uniqueCust, repeatCust, deadStock, deadValue });
    setLastRefresh(new Date());
    setLoading(false);
  }, [tenant?.id, period]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  async function saveGoals() {
    const mo = new Date().toISOString().slice(0,7);
    for (const [metric, target] of Object.entries(goalForm)) {
      if (!target) continue;
      await supabase.from('goals').upsert({ tenant_id:tenant.id, metric, period:mo, target:parseFloat(target) }, { onConflict:'tenant_id,metric,period' });
    }
    setEditGoals(false); load();
  }

  const PERIODS = [['today','Today'],['week','This Week'],['month','This Month'],['year','This Year']];
  const getGoal = metric => goals.find(g=>g.metric===metric)?.target||0;

  if (loading) return <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading dashboard…</div>;

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>{tenant?.name || 'Elite Store'}</div>
          <div style={{ fontSize:12, color:T.muted }}>Last updated: {lastRefresh.toLocaleTimeString('en-IN')} · Auto-refreshes every 60s</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setEditGoals(true)} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🎯 Set Goals</button>
          <button onClick={load} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↻ Refresh</button>
          <div style={{ display:'flex', background:T.srf, borderRadius:8, border:`1px solid ${T.bdr}`, overflow:'hidden' }}>
            {PERIODS.map(([id,label])=>(
              <button key={id} onClick={()=>setPeriod(id)} style={{ background:period===id?T.blue:'transparent', color:period===id?'#fff':T.sub, border:'none', padding:'7px 12px', fontSize:12, fontWeight:period===id?700:500, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Today's quick stats */}
      {period !== 'today' && (
        <div style={{ background:T.blue+'12', border:`1px solid ${T.blue}33`, borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', gap:24 }}>
          <div><span style={{ fontSize:11, color:T.blue }}>TODAY </span><span style={{ fontSize:16, fontWeight:800, color:T.ink }}>{fmt(data.todayRev)}</span><span style={{ fontSize:11, color:T.sub }}> · {data.todayOrders} orders</span></div>
        </div>
      )}

      {/* Main KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Revenue', val:data.revenue, color:T.blue, change:data.revChange, goal:getGoal('revenue') },
          { label:'Profit', val:data.profit, color:data.profit>=0?T.green:T.red, goal:getGoal('profit') },
          { label:'Orders', val:data.orders, color:T.purple, isCount:true, goal:getGoal('orders') },
          { label:'Avg Order', val:data.avgOrder, color:T.teal },
        ].map(({ label, val, color, change, goal, isCount }) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
              <span>{label}</span>
              {change !== null && change !== undefined && (
                <span style={{ color:change>=0?T.green:T.red, fontSize:10 }}>{change>=0?'▲':'▼'} {Math.abs(Math.round(change))}% vs last month</span>
              )}
            </div>
            <div style={{ fontSize:24, fontWeight:800, color }}>{isCount ? val.toLocaleString('en-IN') : fmtK(val)}</div>
            {goal > 0 && (
              <>
                <MiniBar value={val} max={goal} color={color} />
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{Math.round(Math.min(100,val/goal*100))}% of goal {isCount?val:fmtK(goal)}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Goals rings */}
      {goals.length > 0 && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:16, fontSize:14 }}>🎯 Monthly Goals</div>
          <div style={{ display:'flex', gap:24, justifyContent:'space-around' }}>
            {goals.map(g => (
              <GoalRing key={g.metric} label={g.metric.charAt(0).toUpperCase()+g.metric.slice(1)}
                value={g.metric==='revenue'?data.revenue:g.metric==='profit'?data.profit:g.metric==='orders'?data.orders:data.revenue}
                target={g.target} color={T.blue} />
            ))}
          </div>
        </div>
      )}

      {/* Secondary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['GST Collected', fmt(data.gstColl), T.amber],
          ['Expenses', fmt(data.expTotal), T.red],
          ['Low Stock', `${data.lowStock.length} items`, T.amber],
          ['Outstanding', fmt(data.outstanding), T.red],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Top items */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14, display:'flex', justifyContent:'space-between' }}>
            <span>🏆 Top Items</span>
            <button onClick={()=>onNavigate('reports')} style={{ background:'none', border:'none', color:T.blue, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>View all →</button>
          </div>
          {data.topItems.length === 0 ? <div style={{ color:T.muted, fontSize:12, textAlign:'center', padding:20 }}>No sales yet</div>
          : data.topItems.map(([name,rev],i)=>(
            <div key={name} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3 }}>
                <span style={{ color:T.ink }}>{i+1}. {name}</span>
                <span style={{ color:T.green, fontWeight:700 }}>{fmt(rev)}</span>
              </div>
              <MiniBar value={rev} max={data.topItems[0][1]} color={T.blue} />
            </div>
          ))}
        </div>

        {/* Quick actions + low stock */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>⚡ Quick Actions</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[['🛒 New Sale','pos'],['📦 Add Stock','inventory'],['👤 Add Customer','customers'],['📊 Reports','reports'],['💬 WA Catalog','catalog'],['🔔 Alerts','notifications']].map(([label,page])=>(
                <button key={page} onClick={()=>onNavigate(page)} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>{label}</button>
              ))}
            </div>
          </div>
          {data.lowStock.length > 0 && (
            <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:12, padding:16 }}>
              <div style={{ fontWeight:700, color:T.amber, marginBottom:10, fontSize:13 }}>⚠️ Low Stock Alerts</div>
              {data.lowStock.slice(0,4).map(i=>(
                <div key={i.name} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.ink, marginBottom:5 }}>
                  <span>{i.name}</span>
                  <span style={{ color:i.stock===0?T.red:T.amber, fontWeight:700 }}>{i.stock||0} left</span>
                </div>
              ))}
              {data.lowStock.length > 4 && <button onClick={()=>onNavigate('notifications')} style={{ background:'none', border:'none', color:T.amber, fontSize:11, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>+{data.lowStock.length-4} more →</button>}
            </div>
          )}
        </div>
      </div>

      {/* Payment modes */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:14 }}>💳 Revenue by Payment Mode</div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {Object.entries(data.payModes).map(([mode,amt])=>(
            <div key={mode} style={{ flex:1, minWidth:100, background:T.card, borderRadius:9, padding:'10px 14px' }}>
              <div style={{ fontSize:11, color:T.sub, textTransform:'capitalize', marginBottom:4 }}>{mode}</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{fmt(amt)}</div>
              <div style={{ fontSize:10, color:T.muted }}>{data.revenue>0?Math.round(amt/data.revenue*100):0}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals modal */}
      {editGoals && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>🎯 Set Monthly Goals</div>
              <button onClick={()=>setEditGoals(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            {[['revenue','Revenue Target (Rs.)'],['profit','Profit Target (Rs.)'],['orders','Orders Target']].map(([metric,label])=>(
              <div key={metric} style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                <input type="number" defaultValue={goals.find(g=>g.metric===metric)?.target||''}
                  onChange={e=>setGoalForm(f=>({...f,[metric]:e.target.value}))}
                  style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={()=>setEditGoals(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={saveGoals} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Save Goals</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REPORTS — same page, same data, no extra queries ═══ */}
      <div style={{ marginTop:20, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden' }}>
        <button onClick={()=>setShowReports(s=>!s)}
          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 20px',
                   background: showReports ? '#FEF2F2' : 'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#8B0000' }}>📊 Reports</div>
            <div style={{ fontSize:11.5, color:T.sub, marginTop:2 }}>
              Trend, margins, categories, staff, customers and dead stock — for the selected period
            </div>
          </div>
          <span style={{ fontSize:15, color:'#C0392B', transform: showReports?'rotate(180deg)':'none', transition:'transform .2s' }}>▾</span>
        </button>

        {showReports && data && (
          <div style={{ borderTop:`1px solid ${T.bdr}` }}>
            {/* Report tabs */}
            <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${T.bdr}`, overflowX:'auto', paddingLeft:8 }}>
              {[['trend','📈 Trend'],['margin','💰 Margins'],['category','🏷️ Categories'],['staff','👤 Staff'],['customers','👥 Customers'],['dead','💀 Dead Stock']].map(([id,label])=>(
                <button key={id} onClick={()=>setReportTab(id)}
                  style={{ padding:'11px 16px', background:'transparent', color: reportTab===id?'#C0392B':T.sub,
                           border:'none', borderBottom: reportTab===id?'2px solid #C0392B':'2px solid transparent',
                           marginBottom:-1, cursor:'pointer', fontSize:12, fontWeight: reportTab===id?700:500,
                           fontFamily:'inherit', whiteSpace:'nowrap' }}>{label}</button>
              ))}
            </div>

            <div style={{ padding:'18px 20px' }}>

              {/* ── Revenue trend ── */}
              {reportTab==='trend' && (
                data.trend.length===0
                  ? <div style={{ textAlign:'center', padding:36, color:T.muted, fontSize:13 }}>No sales in this period</div>
                  : (() => {
                      const max = Math.max(...data.trend.map(([,v])=>v), 1);
                      const best = data.trend.reduce((a,b)=>b[1]>a[1]?b:a);
                      return (
                        <>
                          <div style={{ display:'flex', gap:20, marginBottom:16, flexWrap:'wrap' }}>
                            <div><div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Best Day</div><div style={{ fontSize:15, fontWeight:800, color:'#16A34A' }}>{best[0]} · {fmt(best[1])}</div></div>
                            <div><div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Daily Average</div><div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{fmt(data.revenue/data.trend.length)}</div></div>
                            <div><div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Days Traded</div><div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{data.trend.length}</div></div>
                          </div>
                          <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:130, padding:'0 2px' }}>
                            {data.trend.map(([d,v])=>(
                              <div key={d} title={`${d}: ${fmt(v)}`} style={{ flex:1, minWidth:5, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%' }}>
                                <div style={{ height:`${v/max*100}%`, background: v===best[1]?'#16A34A':'#C0392B', borderRadius:'3px 3px 0 0', minHeight:2, transition:'height .4s' }}/>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9.5, color:T.muted, marginTop:6 }}>
                            <span>{data.trend[0][0]}</span><span>{data.trend[data.trend.length-1][0]}</span>
                          </div>
                        </>
                      );
                    })()
              )}

              {/* ── Margins: revenue → COGS → expenses → profit ── */}
              {reportTab==='margin' && (
                <div style={{ maxWidth:520 }}>
                  {[
                    ['Revenue',        data.revenue,      '#2563EB', null],
                    ['Cost of Goods',  -data.cogs,        '#D97706', data.revenue?data.cogs/data.revenue*100:0],
                    ['Gross Profit',   data.grossProfit,  '#16A34A', data.grossMargin],
                    ['Expenses',       -data.expTotal,    '#C0392B', data.revenue?data.expTotal/data.revenue*100:0],
                    ['Net Profit',     data.profit,       data.profit>=0?'#16A34A':'#C0392B', data.revenue?data.profit/data.revenue*100:0],
                  ].map(([label,val,color,pct],i,arr)=>(
                    <div key={label} style={{ marginBottom:13, paddingTop: i===arr.length-1?12:0, borderTop: i===arr.length-1?`2px solid ${T.bdr}`:'none' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:12.5, color:T.sub, fontWeight: i===arr.length-1?800:600 }}>{label}</span>
                        <span style={{ fontSize: i===arr.length-1?17:14, fontWeight:800, color }}>
                          {val<0?'(':''}{fmt(Math.abs(val))}{val<0?')':''}
                          {pct!=null && <span style={{ fontSize:11, color:T.muted, marginLeft:7 }}>{pct.toFixed(1)}%</span>}
                        </span>
                      </div>
                      <div style={{ height:7, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100, Math.abs(val)/(data.revenue||1)*100)}%`, background:color, borderRadius:4, transition:'width .5s' }}/>
                      </div>
                    </div>
                  ))}
                  <div style={{ background:'#FEF2F2', borderRadius:9, padding:'11px 14px', fontSize:11.5, color:T.sub, marginTop:4 }}>
                    Gross margin is <strong style={{ color:'#8B0000' }}>{data.grossMargin.toFixed(1)}%</strong>.
                    {data.grossMargin < 25 && ' That is thin — check your buying prices or selling rates.'}
                    {data.grossMargin >= 45 && ' Healthy for retail.'}
                  </div>
                </div>
              )}

              {/* ── Category split ── */}
              {reportTab==='category' && (
                data.categorySplit.length===0
                  ? <div style={{ textAlign:'center', padding:36, color:T.muted, fontSize:13 }}>No category data — assign categories to products</div>
                  : data.categorySplit.slice(0,10).map(([cat,val])=>{
                      const pct = data.revenue>0 ? val/data.revenue*100 : 0;
                      return (
                        <div key={cat} style={{ marginBottom:11 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4 }}>
                            <span style={{ color:T.ink, fontWeight:600 }}>{cat}</span>
                            <span style={{ color:T.sub }}><strong style={{ color:'#C0392B' }}>{fmt(val)}</strong> · {pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:'#C0392B', borderRadius:4, transition:'width .5s' }}/>
                          </div>
                        </div>
                      );
                    })
              )}

              {/* ── Staff leaderboard ── */}
              {reportTab==='staff' && (
                data.staffBoard.length===0
                  ? <div style={{ textAlign:'center', padding:36, color:T.muted, fontSize:13 }}>No staff attribution on sales yet</div>
                  : data.staffBoard.map(([name,d],i)=>{
                      const max = data.staffBoard[0][1].rev || 1;
                      return (
                        <div key={name} style={{ marginBottom:12 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:4 }}>
                            <span style={{ color:T.ink, fontWeight:600 }}>{i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}{name}</span>
                            <span style={{ color:T.sub }}><strong style={{ color:'#16A34A' }}>{fmt(d.rev)}</strong> · {d.orders} orders · avg {fmt(d.rev/d.orders)}</span>
                          </div>
                          <div style={{ height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${d.rev/max*100}%`, background: i===0?'#16A34A':'#2563EB', borderRadius:4 }}/>
                          </div>
                        </div>
                      );
                    })
              )}

              {/* ── Customers ── */}
              {reportTab==='customers' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:13 }}>
                  {[
                    ['Unique Customers', data.uniqueCust,                       '#2563EB', 'bought in this period'],
                    ['Repeat Buyers',    data.repeatCust,                       '#16A34A', 'more than one order'],
                    ['Repeat Rate',      `${data.repeatRate.toFixed(1)}%`,      data.repeatRate>=30?'#16A34A':'#D97706', 'of buyers returned'],
                    ['Avg Order Value',  fmt(data.avgOrder),                    '#7C3AED', 'per transaction'],
                    ['Outstanding Dues', fmt(data.outstanding),                 data.outstanding>0?'#C0392B':'#16A34A', 'to be collected'],
                  ].map(([label,val,color,sub])=>(
                    <div key={label} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'13px 15px' }}>
                      <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{label}</div>
                      <div style={{ fontSize:19, fontWeight:900, color }}>{val}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Dead stock ── */}
              {reportTab==='dead' && (
                data.deadStock.length===0
                  ? <div style={{ textAlign:'center', padding:36, color:'#16A34A', fontSize:13, fontWeight:600 }}>✅ Everything in stock sold at least once this period</div>
                  : <>
                      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:9, padding:'11px 14px', marginBottom:14, fontSize:12.5, color:'#D97706' }}>
                        <strong>{fmt(data.deadValue)}</strong> tied up in {data.deadStock.length} product{data.deadStock.length>1?'s':''} that did not sell in this period.
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                        <thead><tr>
                          {['Product','Category','Stock','Cash Tied Up'].map(h=>(
                            <th key={h} style={{ padding:'7px 10px', textAlign:h==='Product'||h==='Category'?'left':'right', fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {data.deadStock.slice(0,12).map(i=>(
                            <tr key={i.name} style={{ borderBottom:`1px solid ${T.bdr}33` }}>
                              <td style={{ padding:'8px 10px', color:T.ink, fontWeight:600 }}>{i.name}</td>
                              <td style={{ padding:'8px 10px', color:T.sub }}>{i.cat||'—'}</td>
                              <td style={{ padding:'8px 10px', textAlign:'right', color:T.sub }}>{i.stock}</td>
                              <td style={{ padding:'8px 10px', textAlign:'right', color:'#C0392B', fontWeight:700 }}>{fmt(i.tied)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {data.deadStock.length>12 && <div style={{ fontSize:11, color:T.muted, textAlign:'center', marginTop:9 }}>+{data.deadStock.length-12} more — see Reports → Product Performance</div>}
                    </>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
