import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED', teal:'#0D9488',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt  = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtL = n => { const a=Math.abs(n||0); const s=n<0?'-':''; return a>=100000 ? s+'₹'+(a/100000).toFixed(1)+'L' : a>=1000 ? s+'₹'+(a/1000).toFixed(1)+'K' : s+fmt(a); };
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'7px 14px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS = Array.from({length:14},(_,i)=>i+9); // 9am–10pm

function Sparkline({ points, color }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const w = 90, h = 30, range = max-min || 1;
  const pts = points.map((v,i) => `${(i/(points.length-1||1))*w},${h-((v-min)/range)*h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function heatColor(v, max) {
  if (!v) return '#F3F4F6';
  const t = v/(max||1);
  if (t > .66) return '#C0392B';
  if (t > .33) return '#E8A99A';
  return '#F5D5CC';
}

export default function BusinessPulse({ tenant, user, onNavigate }) {
  const [period,   setPeriod]   = useState('month');
  const [custFrom, setCustFrom] = useState('');
  const [custTo,   setCustTo]   = useState('');
  const [data,     setData]     = useState(null);
  const [goals,    setGoals]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAI,   setShowAI]   = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [showReports, setShowReports] = useState(false);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    const yr = now.getFullYear(), mo = String(now.getMonth()+1).padStart(2,'0');

    let dateFrom, dateTo = today, daysInPeriod, daysElapsed;
    if (period==='today')      { dateFrom = today; daysInPeriod=1; daysElapsed=1; }
    else if (period==='yesterday') { const y=new Date(now); y.setDate(y.getDate()-1); dateFrom=dateTo=y.toISOString().slice(0,10); daysInPeriod=1; daysElapsed=1; }
    else if (period==='week')  { const w=new Date(now-now.getDay()*86400000); dateFrom=w.toISOString().slice(0,10); daysInPeriod=7; daysElapsed=now.getDay()+1; }
    else if (period==='year')  { dateFrom=`${yr}-01-01`; daysInPeriod=365; daysElapsed=Math.ceil((now-new Date(yr,0,1))/86400000); }
    else if (period==='custom'){ dateFrom=custFrom||today; dateTo=custTo||today; daysInPeriod=Math.max(1,(new Date(dateTo)-new Date(dateFrom))/86400000+1); daysElapsed=daysInPeriod; }
    else { dateFrom = `${yr}-${mo}-01`; daysInPeriod = new Date(yr, now.getMonth()+1, 0).getDate(); daysElapsed = now.getDate(); }

    // Previous period of equal length, for vs-prev comparison
    const spanMs = new Date(dateTo) - new Date(dateFrom) + 86400000;
    const prevTo = new Date(new Date(dateFrom) - 86400000).toISOString().slice(0,10);
    const prevFrom = new Date(new Date(dateFrom) - spanMs).toISOString().slice(0,10);

    const [salesRes, prevSalesRes, purRes, expRes, invRes, custRes, remindRes, leaveRes, goalsRes] = await Promise.all([
      supabase.from('sales').select('total,gst_amount,items,customer,customer_id,date,created_at,payment_mode,staff_name').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo),
      supabase.from('sales').select('total').eq('tenant_id',tenant.id).gte('date',prevFrom).lte('date',prevTo),
      supabase.from('purchases').select('total,paid,supplier,date').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo),
      supabase.from('expenses').select('amount,category,date').eq('tenant_id',tenant.id).gte('date',dateFrom).lte('date',dateTo),
      supabase.from('inventory').select('name,cat,stock,alert,sp,cp').eq('tenant_id',tenant.id).eq('active',true),
      supabase.from('customers').select('id,name,outstanding,total_spent,purchase_count').eq('tenant_id',tenant.id),
      supabase.from('payment_reminders').select('id,customer,amount_due,days_overdue').eq('tenant_id',tenant.id).eq('status','pending'),
      supabase.from('leave_requests').select('staff_name,from_date,to_date').eq('tenant_id',tenant.id).eq('status','approved').lte('from_date',today).gte('to_date',today),
      supabase.from('goals').select('*').eq('tenant_id',tenant.id).eq('period',`${yr}-${mo}`),
    ]);

    const sales=salesRes.data||[], prevSales=prevSalesRes.data||[], purs=purRes.data||[], exps=expRes.data||[], inv=invRes.data||[], custs=custRes.data||[];

    const revenue = sales.reduce((s,x)=>s+(x.total||0),0);
    const prevRev = prevSales.reduce((s,x)=>s+(x.total||0),0);
    const revChange = prevRev>0 ? (revenue-prevRev)/prevRev*100 : null;
    const orders = sales.length;
    const avgOrder = orders>0 ? revenue/orders : 0;

    const purTotal = purs.reduce((s,x)=>s+(x.total||0),0);
    const purPaid  = purs.reduce((s,x)=>s+(x.paid||0),0);
    const purPayable = Math.max(0, purTotal-purPaid);
    const supplierSpend = {};
    purs.forEach(p => { if(p.supplier) supplierSpend[p.supplier]=(supplierSpend[p.supplier]||0)+(p.total||0); });
    const topSuppliers = Object.entries(supplierSpend).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const unpaidPOs = purs.filter(p=>(p.total||0)>(p.paid||0)).length;

    const expTotal = exps.reduce((s,x)=>s+(x.amount||0),0);
    const expByCat = {};
    exps.forEach(e=>{ const k=e.category||'Other'; expByCat[k]=(expByCat[k]||0)+(e.amount||0); });
    const topExpCats = Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).slice(0,4);

    let cogs = 0;
    const cpByName={}; inv.forEach(i=>{ cpByName[i.name]=i.cp||0; });
    sales.forEach(s=>(s.items||[]).forEach(li=>{ cogs += (cpByName[li.name]||0)*(li.qty||1); }));
    const profit = revenue - cogs - expTotal;
    const margin = revenue>0 ? profit/revenue*100 : 0;
    const perOrderProfit = orders>0 ? profit/orders : 0;

    const custOrders = {};
    sales.forEach(s=>{ const k=s.customer_id||s.customer; if(k) custOrders[k]=(custOrders[k]||0)+1; });
    const uniqueCust = Object.keys(custOrders).length;
    const repeatCust = Object.values(custOrders).filter(n=>n>1).length;
    const repeatRate = uniqueCust>0 ? repeatCust/uniqueCust*100 : 0;
    const newCust = custs.filter(c=>(c.purchase_count||0)===1 && custOrders[c.id]).length;

    const payModes = {};
    sales.forEach(s=>{ const m=s.payment_mode||'cash'; payModes[m]=(payModes[m]||0)+(s.total||0); });

    // Daily trend for the bar chart
    const byDay = {};
    sales.forEach(s=>{ byDay[s.date]=(byDay[s.date]||0)+(s.total||0); });
    const trend = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0]));
    const dailyAvg = daysElapsed>0 ? revenue/daysElapsed : 0;
    const forecastTotal = dailyAvg * daysInPeriod;

    // Sparkline series (last 8 points of trend, or padded)
    const spark = trend.slice(-8).map(([,v])=>v);

    // Hour × day heatmap
    const grid = {};
    sales.forEach(s=>{
      const dt = new Date(s.created_at||s.date);
      const k = `${dt.getDay()}-${dt.getHours()}`;
      grid[k] = (grid[k]||0) + (s.total||0);
    });

    const totalOutstanding = custs.reduce((s,c)=>s+(c.outstanding||0),0);

    setData({
      revenue, prevRev, revChange, orders, avgOrder, spark,
      purTotal, purPaid, purPayable, topSuppliers, unpaidPOs,
      expTotal, topExpCats,
      profit, margin, perOrderProfit,
      newCust, repeatRate, payModes, totalOutstanding,
      overdueCount: (remindRes.data||[]).length,
      overdueAmt: (remindRes.data||[]).reduce((s,r)=>s+(r.amount_due||0),0),
      staffOnLeave: (leaveRes.data||[]).length,
      staffOnLeaveNames: (leaveRes.data||[]).map(l=>l.staff_name),
      trend, dailyAvg, forecastTotal, daysInPeriod, daysElapsed,
      grid, gridMax: Math.max(...Object.values(grid), 1),
      dateFrom, dateTo,
    });
    setGoals(goalsRes.data||[]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [tenant?.id, period, custFrom, custTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!autoRefresh) return; const t=setInterval(load,60000); return ()=>clearInterval(t); }, [autoRefresh, load]);

  // ── Heuristic AI insight — computed from real deltas, no API call ──
  const insight = useMemo(() => {
    if (!data) return null;
    if (data.revChange!=null && data.revChange <= -20) return { icon:'⚠️', text:`Significant decline — revenue down ${Math.abs(data.revChange).toFixed(0)}% vs the previous period. Worth checking footfall and stock availability.`, tone:'red' };
    if (data.revChange!=null && data.revChange >= 20) return { icon:'🚀', text:`Strong growth — revenue up ${data.revChange.toFixed(0)}% vs the previous period. Consider restocking your fastest movers.`, tone:'green' };
    if (data.margin < 15 && data.revenue>0) return { icon:'📉', text:`Margin is thin at ${data.margin.toFixed(0)}% — check buying prices or discounting before it erodes profit further.`, tone:'amber' };
    if (data.overdueCount>0) return { icon:'💰', text:`${data.overdueCount} customer${data.overdueCount>1?'s':''} overdue on payment, ${fmtL(data.overdueAmt)} outstanding — a reminder nudge could help cash flow.`, tone:'amber' };
    if (data.repeatRate>=40) return { icon:'💚', text:`${data.repeatRate.toFixed(0)}% of your buyers this period are repeat customers — loyalty is working.`, tone:'green' };
    return { icon:'📊', text:`Steady period — ${fmtL(data.revenue)} revenue across ${data.orders} orders, ${data.margin.toFixed(0)}% margin.`, tone:'blue' };
  }, [data]);

  if (loading || !data) return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>
      <div style={{ height:22, width:220, background:'#F0E8E8', borderRadius:6, marginBottom:20, animation:'skelShine 1.4s ease-in-out infinite' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[1,2,3,4].map(i=><div key={i} style={{ height:150, background:'#F0E8E8', borderRadius:14, animation:'skelShine 1.4s ease-in-out infinite' }}/>)}
      </div>
    </div>
  );

  const toneColor = { red:T.red, green:T.green, amber:T.amber, blue:T.blue }[insight.tone];
  const toneBg    = { red:'#FEF2F2', green:'#F0FDF4', amber:'#FFFBEB', blue:'#EFF6FF' }[insight.tone];

  return (
    <div style={{ padding:22, background:T.bg, minHeight:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Business Pulse</div>
          {autoRefresh && <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:T.green, fontWeight:700 }}><span style={{ width:6, height:6, borderRadius:'50%', background:T.green }}/>Live</span>}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {[['today','Today'],['yesterday','Yesterday'],['week','This Week'],['month','This Month'],['year','This Year'],['custom','Custom']].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)} style={{ padding:'7px 13px', background:period===v?T.red:T.white, color:period===v?T.white:T.sub, border:`1px solid ${period===v?T.red:T.bdr}`, borderRadius:7, fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
          {period==='custom' && (
            <>
              <input type="date" value={custFrom} onChange={e=>setCustFrom(e.target.value)} style={{ border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 9px', fontSize:11.5, fontFamily:'inherit' }}/>
              <input type="date" value={custTo} onChange={e=>setCustTo(e.target.value)} style={{ border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 9px', fontSize:11.5, fontFamily:'inherit' }}/>
            </>
          )}
          <span style={{ fontSize:10.5, color:T.muted, marginLeft:6 }}>Updated {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
          <button onClick={()=>setAutoRefresh(a=>!a)} style={btn(autoRefresh?'#F0FDF4':T.bg, autoRefresh?T.green:T.sub, { border:`1px solid ${T.bdr}` })}>{autoRefresh?'⏸ Auto':'▶ Auto'}</button>
          <button onClick={load} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>↻ Refresh</button>
        </div>
      </div>

      {/* AI Insight */}
      <div onClick={()=>setShowAI(s=>!s)} style={{ background:toneBg, border:`1px solid ${toneColor}33`, borderRadius:10, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
        <span style={{ fontSize:11, color:toneColor, transform:showAI?'rotate(0deg)':'rotate(-90deg)', transition:'transform .2s' }}>▾</span>
        <span style={{ fontSize:11.5, fontWeight:700, color:toneColor, textTransform:'uppercase', letterSpacing:'0.04em' }}>AI Insight:</span>
        <span style={{ fontSize:12.5, color:T.ink }}>{insight.icon} {insight.text}</span>
      </div>

      {/* Needs Attention strip */}
      {(data.overdueCount>0 || data.unpaidPOs>0 || data.staffOnLeave>0) && (
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:10.5, fontWeight:800, color:T.red, textTransform:'uppercase', letterSpacing:'0.05em' }}>⚡ Needs Attention</span>
          {data.overdueCount>0 && (
            <button onClick={()=>onNavigate?.('custhub','reminders')} style={{ background:T.lightRed, border:`1px solid #FECACA`, borderRadius:8, padding:'7px 14px', fontSize:12, color:T.red, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {data.overdueCount} overdue · {fmtL(data.overdueAmt)} receivable →
            </button>
          )}
          {data.unpaidPOs>0 && (
            <button onClick={()=>onNavigate?.('purchhub','history')} style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'7px 14px', fontSize:12, color:T.amber, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {data.unpaidPOs} PO unpaid · {fmtL(data.purPayable)} payable →
            </button>
          )}
          {data.staffOnLeave>0 && (
            <button onClick={()=>onNavigate?.('hrhub','leave')} style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:8, padding:'7px 14px', fontSize:12, color:T.purple, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              👤 Staff on leave · {data.staffOnLeave} today →
            </button>
          )}
        </div>
      )}

      {/* 4 KPI hero cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14, marginBottom:16 }}>

        {/* Sales */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.sub }}>💰 Sales</div>
            {data.revChange!=null && <span style={{ fontSize:10.5, fontWeight:700, color:data.revChange>=0?T.green:T.red }}>{data.revChange>=0?'▲':'▼'}{Math.abs(data.revChange).toFixed(1)}%</span>}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:10 }}>
            <div style={{ fontSize:26, fontWeight:900, color:T.ink, letterSpacing:'-0.02em' }}>{fmtL(data.revenue)}</div>
            <Sparkline points={data.spark.length?data.spark:[0,0]} color={T.green}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            <MiniStat label="Orders" value={data.orders} icon="🧾"/>
            <MiniStat label="AOV" value={fmtL(data.avgOrder)} icon="📊"/>
            <MiniStat label="Repeat" value={`${data.repeatRate.toFixed(0)}%`} icon="🔄"/>
          </div>
          {Object.keys(data.payModes).length>0 && (
            <div>
              <div style={{ fontSize:9, color:T.muted, marginBottom:4 }}>Payment mix</div>
              <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden' }}>
                {Object.entries(data.payModes).sort((a,b)=>b[1]-a[1]).map(([m,v],i)=>(
                  <div key={m} style={{ width:`${v/data.revenue*100}%`, background:['#2563EB','#16A34A','#7C3AED','#D97706'][i%4] }} title={`${m}: ${fmtL(v)}`}/>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Purchase */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.sub, marginBottom:8 }}>🛒 Purchase</div>
          <div style={{ fontSize:26, fontWeight:900, color:T.ink, letterSpacing:'-0.02em', marginBottom:10 }}>{fmtL(data.purTotal)}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <MiniStat label="Payable" value={fmtL(data.purPayable)} icon="⏳" color={data.purPayable>0?T.red:T.green}/>
            <MiniStat label="Unpaid POs" value={data.unpaidPOs} icon="📋"/>
          </div>
          {data.topSuppliers.length>0 && (
            <div>
              <div style={{ fontSize:9, color:T.muted, marginBottom:5 }}>Top suppliers by spend</div>
              {data.topSuppliers.map(([name,val])=>{
                const max = data.topSuppliers[0][1]||1;
                return (
                  <div key={name} style={{ marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5 }}>
                      <span style={{ color:T.ink }}>{name}</span><span style={{ color:T.sub }}>{fmtL(val)}</span>
                    </div>
                    <div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${val/max*100}%`, background:T.purple, borderRadius:2 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expenses */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.sub, marginBottom:8 }}>💸 Expenses</div>
          <div style={{ fontSize:26, fontWeight:900, color:T.ink, letterSpacing:'-0.02em', marginBottom:10 }}>{fmtL(data.expTotal)}</div>
          {data.topExpCats.length>0 ? data.topExpCats.map(([cat,val])=>{
            const max = data.topExpCats[0][1]||1;
            return (
              <div key={cat} style={{ marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, marginBottom:2 }}>
                  <span style={{ color:T.ink }}>{cat}</span><span style={{ color:T.sub }}>{fmtL(val)}</span>
                </div>
                <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${val/max*100}%`, background:T.amber, borderRadius:3 }}/>
                </div>
              </div>
            );
          }) : <div style={{ fontSize:11, color:T.muted }}>No expenses this period</div>}
        </div>

        {/* Profit */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.sub }}>📈 Profit</div>
            <span style={{ background: data.margin>=25?'#F0FDF4':data.margin>=10?'#FFFBEB':'#FEF2F2', color: data.margin>=25?T.green:data.margin>=10?T.amber:T.red, borderRadius:20, padding:'2px 9px', fontSize:9.5, fontWeight:700 }}>
              {data.margin>=25?'Healthy':data.margin>=10?'OK':'Tight'}
            </span>
          </div>
          <div style={{ fontSize:26, fontWeight:900, color: data.profit>=0?T.green:T.red, letterSpacing:'-0.02em', marginBottom:10 }}>{fmtL(data.profit)}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            <MiniStat label="Revenue" value={fmtL(data.revenue)} icon="💰"/>
            <MiniStat label="Cost" value={fmtL(data.revenue-data.profit)} icon="📦"/>
            <MiniStat label="Margin" value={`${data.margin.toFixed(0)}%`} icon="🎯"/>
          </div>
          <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden', marginBottom:5 }}>
            <div style={{ height:'100%', width:`${Math.max(0,Math.min(100,data.margin))}%`, background:data.margin>=25?T.green:data.margin>=10?T.amber:T.red, borderRadius:3 }}/>
          </div>
          <div style={{ fontSize:9.5, color:T.muted }}>Per order: {fmtL(data.perOrderProfit)} · {data.orders} orders</div>
        </div>
      </div>

      {/* Revenue Trend + Sales Heatmap */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.3fr', gap:14, marginBottom:16 }}>

        {/* Revenue Trend */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>Revenue Trend</div>
            <button onClick={()=>setShowForecast(f=>!f)} style={btn(showForecast?T.blue:T.bg, showForecast?T.white:T.sub, { border:`1px solid ${T.bdr}` })}>Forecast</button>
          </div>
          {data.revChange!=null && <div style={{ fontSize:11, color: data.revChange>=0?T.green:T.red, fontWeight:700, marginBottom:10 }}>{data.revChange>=0?'▲':'▼'}{Math.abs(data.revChange).toFixed(1)}% vs previous period</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div style={{ background:T.bg, borderRadius:9, padding:'10px 13px' }}>
              <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Revenue</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{fmtL(data.revenue)}</div>
            </div>
            <div style={{ background:T.bg, borderRadius:9, padding:'10px 13px' }}>
              <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700 }}>Previous</div>
              <div style={{ fontSize:16, fontWeight:800, color:T.sub }}>{fmtL(data.prevRev)}</div>
            </div>
          </div>

          {showForecast && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:9, padding:'10px 13px', marginBottom:12, fontSize:12, color:T.blue }}>
              📈 At the current daily average of {fmtL(data.dailyAvg)}, projected to reach <strong>{fmtL(data.forecastTotal)}</strong> by period end.
            </div>
          )}

          {data.trend.length===0 ? <div style={{ textAlign:'center', padding:30, color:T.muted, fontSize:12 }}>No sales in this period</div> : (
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:100 }}>
              {data.trend.map(([d,v])=>{
                const max = Math.max(...data.trend.map(([,x])=>x),1);
                return <div key={d} title={`${d}: ${fmt(v)}`} style={{ flex:1, minWidth:4, height:`${v/max*100}%`, background:T.red, borderRadius:'2px 2px 0 0' }}/>;
              })}
            </div>
          )}
        </div>

        {/* Sales Heatmap */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)', overflowX:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>Sales Heatmap</div>
            <button onClick={()=>onNavigate?.('reportshub','patterns')} style={{ background:'none', border:'none', color:T.red, fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Full view →</button>
          </div>
          <div style={{ fontSize:10.5, color:T.muted, marginBottom:10 }}>Revenue intensity by day × hour — hover a cell to inspect</div>

          <table style={{ borderCollapse:'separate', borderSpacing:2, fontSize:9 }}>
            <thead><tr>
              <th style={{ width:32 }}/>
              {HOURS.map(h=><th key={h} style={{ color:T.muted, fontWeight:600, paddingBottom:3 }}>{h>12?h-12:h}{h>=12?'p':'a'}</th>)}
            </tr></thead>
            <tbody>
              {DAYS.map((day,d)=>(
                <tr key={day}>
                  <td style={{ color:T.sub, fontWeight:700, textAlign:'right', paddingRight:5 }}>{day}</td>
                  {HOURS.map(h=>{
                    const key = `${d}-${h}`; const v = data.grid[key]||0;
                    const isHover = hoverCell===key;
                    return (
                      <td key={h} onMouseEnter={()=>setHoverCell(key)} onMouseLeave={()=>setHoverCell(null)}
                        style={{ width:22, height:18, background:heatColor(v,data.gridMax), borderRadius:3, cursor:v?'pointer':'default', position:'relative', border:isHover?`1.5px solid ${T.ink}`:'1.5px solid transparent' }}>
                        {isHover && v>0 && (
                          <div style={{ position:'absolute', bottom:'120%', left:'50%', transform:'translateX(-50%)', background:T.ink, color:'#fff', borderRadius:5, padding:'4px 8px', fontSize:10, whiteSpace:'nowrap', zIndex:20 }}>
                            {day} {h}:00 — {fmt(v)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports section — reused from before, same period selection */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:13, overflow:'hidden' }}>
        <button onClick={()=>setShowReports(s=>!s)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 18px', background:showReports?T.lightRed:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>📊 More Reports — Categories, Staff, Customers, Dead Stock</div>
          <span style={{ color:T.red, transform:showReports?'rotate(180deg)':'none', transition:'transform .2s' }}>▾</span>
        </button>
        {showReports && (
          <div style={{ padding:'16px 18px', borderTop:`1px solid ${T.bdr}`, fontSize:12, color:T.sub }}>
            Open <strong>Analytics / Reports</strong> for the full category, staff-leaderboard and dead-stock breakdowns for this period.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, color }) {
  return (
    <div>
      <div style={{ fontSize:8.5, color:T.muted, textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>{icon} {label}</div>
      <div style={{ fontSize:13, fontWeight:800, color:color||T.ink }}>{value}</div>
    </div>
  );
}
