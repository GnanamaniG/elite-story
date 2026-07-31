import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
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
      supabase.from('sales').select('total,gst_amount,items,customer,date,status,payment_mode').eq('tenant_id',tenant.id).gte('date',dateFrom),
      lastFrom ? supabase.from('sales').select('total').eq('tenant_id',tenant.id).gte('date',lastFrom).lte('date',lastTo) : Promise.resolve({data:[]}),
      supabase.from('expenses').select('amount,category').eq('tenant_id',tenant.id).gte('date',dateFrom),
      supabase.from('inventory').select('name,stock,alert,sp,cp').eq('tenant_id',tenant.id).eq('active',true),
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

    // Hour distribution (from today)
    setGoals(goalsRes.data||[]);
    setData({ revenue,lastRev,revChange,gstColl,expTotal,profit,orders,avgOrder,lowStock,outstanding,topItems,payModes,todayRev,todayOrders:todaySales.length,inventory,customers });
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
    </div>
  );
}
