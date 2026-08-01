import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtK = n => n>=100000?'Rs.'+(n/100000).toFixed(1)+'L':n>=1000?'Rs.'+(n/1000).toFixed(1)+'K':fmt(n);
const pct  = (a,b) => b>0?((a-b)/b*100).toFixed(1):0;

function ScoreGauge({ score }) {
  const color = score>=80?T.green:score>=60?T.amber:T.red;
  const label = score>=80?'Excellent':score>=60?'Good':score>=40?'Average':'Needs Attention';
  const r=54, circ=2*Math.PI*r, dash=circ*(score/100);
  return (
    <div style={{ textAlign:'center' }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={70} cy={70} r={r} fill="none" stroke={T.bdr} strokeWidth={12}/>
        <circle cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 70 70)"
          style={{ transition:'stroke-dasharray .8s ease' }}/>
        <text x={70} y={65} textAnchor="middle" fontSize={28} fontWeight="900" fill={color}>{score}</text>
        <text x={70} y={85} textAnchor="middle" fontSize={11} fill={T.sub}>/ 100</text>
      </svg>
      <div style={{ fontSize:14, fontWeight:700, color, marginTop:4 }}>{label}</div>
    </div>
  );
}

function Trend({ current, previous, label, color }) {
  const change = pct(current, previous);
  const up = current >= previous;
  return (
    <div style={{ background:T.card, borderRadius:9, padding:'12px 14px' }}>
      <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:800, color }}>{fmtK(current)}</div>
      <div style={{ fontSize:11, color:up?T.green:T.red, marginTop:3 }}>
        {up?'▲':'▼'} {Math.abs(change)}% vs last month
      </div>
    </div>
  );
}

export default function StoreAnalytics({ tenant }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const now   = new Date();
    const yr    = now.getFullYear();
    const mo    = String(now.getMonth()+1).padStart(2,'0');
    const thisMonthStart  = `${yr}-${mo}-01`;
    const lastMonthD      = new Date(yr, now.getMonth()-1, 1);
    const lastMonthStart  = lastMonthD.toISOString().slice(0,7)+'-01';
    const lastMonthEnd    = new Date(yr, now.getMonth(), 0).toISOString().slice(0,10);
    const threeMonthsAgo  = new Date(yr, now.getMonth()-3, 1).toISOString().slice(0,10);
    const today           = now.toISOString().slice(0,10);

    const [thisRes, lastRes, allSalesRes, expRes, invRes, custRes] = await Promise.all([
      supabase.from('sales').select('total,gst_amount,items,payment_mode,customer_id,date').eq('tenant_id',tenant.id).gte('date',thisMonthStart).lte('date',today),
      supabase.from('sales').select('total,date,customer_id').eq('tenant_id',tenant.id).gte('date',lastMonthStart).lte('date',lastMonthEnd),
      supabase.from('sales').select('total,date').eq('tenant_id',tenant.id).gte('date',threeMonthsAgo),
      supabase.from('expenses').select('amount,date').eq('tenant_id',tenant.id).gte('date',thisMonthStart),
      supabase.from('inventory').select('stock,alert,sp,cp,active').eq('tenant_id',tenant.id),
      supabase.from('customers').select('id,outstanding,total_spent,loyalty_points,segment').eq('tenant_id',tenant.id),
    ]);

    const thisSales = thisRes.data||[];
    const lastSales = lastRes.data||[];
    const allSales  = allSalesRes.data||[];
    const expenses  = expRes.data||[];
    const inventory = invRes.data||[];
    const customers = custRes.data||[];

    const thisRevenue = thisSales.reduce((s,x)=>s+(x.total||0),0);
    const lastRevenue = lastSales.reduce((s,x)=>s+(x.total||0),0);
    const thisOrders  = thisSales.length;
    const lastOrders  = lastSales.length;
    const thisExpenses= expenses.reduce((s,e)=>s+(e.amount||0),0);
    const thisProfit  = thisRevenue - thisExpenses;
    const avgOrder    = thisOrders>0?thisRevenue/thisOrders:0;
    const lastAvgOrd  = lastOrders>0?lastRevenue/lastOrders:0;

    // Inventory health
    const activeInv   = inventory.filter(i=>i.active);
    const lowStock    = activeInv.filter(i=>(i.stock||0)<=(i.alert||10)).length;
    const zeroStock   = activeInv.filter(i=>(i.stock||0)===0).length;
    const stockValue  = activeInv.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);
    const invHealth   = activeInv.length>0?Math.round(((activeInv.length-lowStock)/activeInv.length)*100):100;

    // Customer metrics
    const activeCustomers = customers.filter(c=>c.total_spent>0).length;
    const vipCustomers    = customers.filter(c=>c.segment==='vip').length;
    const outstanding     = customers.reduce((s,c)=>s+(c.outstanding||0),0);
    const repeatRate      = customers.length>0?Math.round(customers.filter(c=>(c.total_spent||0)>avgOrder*1.5).length/customers.length*100):0;

    // Monthly trend (last 6 months)
    const monthlyTrend = Array.from({length:6},(_,i)=>{
      const d = new Date(now); d.setMonth(d.getMonth()-5+i);
      const key = d.toISOString().slice(0,7);
      const rev = allSales.filter(s=>s.date.startsWith(key)).reduce((t,s)=>t+(s.total||0),0);
      return { month:d.toLocaleDateString('en-IN',{month:'short'}), revenue:rev };
    });

    // Business health score (0-100)
    let score = 0;
    // Revenue growth (25 pts)
    if (thisRevenue >= lastRevenue) score += 25; else score += Math.max(0, 25-(lastRevenue-thisRevenue)/lastRevenue*25);
    // Profit margin (20 pts)
    const margin = thisRevenue>0?(thisProfit/thisRevenue)*100:0;
    score += Math.min(20, Math.max(0, margin/5));
    // Inventory health (20 pts)
    score += invHealth*0.2;
    // Customer metrics (20 pts)
    score += Math.min(20, repeatRate*0.4 + vipCustomers*2);
    // Collections (15 pts)
    score += outstanding<thisRevenue*0.1?15:outstanding<thisRevenue*0.3?10:5;
    score = Math.round(Math.min(100, Math.max(0, score)));

    // Top payment modes
    const payModes = thisSales.reduce((acc,s)=>{ acc[s.payment_mode||'cash']=(acc[s.payment_mode||'cash']||0)+(s.total||0); return acc; },{});

    // Top items this month
    const itemMap = {};
    thisSales.forEach(s=>(s.items||[]).forEach(i=>{ itemMap[i.name]=(itemMap[i.name]||0)+(i.amount||0); }));
    const topItems = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

    setData({ thisRevenue, lastRevenue, thisOrders, lastOrders, thisProfit, avgOrder, lastAvgOrd, thisExpenses, lowStock, zeroStock, stockValue, invHealth, activeCustomers, vipCustomers, outstanding, repeatRate, monthlyTrend, payModes, topItems, score, margin: Math.round(margin) });
    setLoading(false);
  }

  const maxTrend = data ? Math.max(...data.monthlyTrend.map(m=>m.revenue), 1) : 1;

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📈 Store Analytics</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Business health score · KPI scorecard · Growth trends</div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:80 }}>Analysing your business…</div>:data&&(
        <>
          {/* Health score + KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16, marginBottom:20 }}>
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Business Health</div>
              <ScoreGauge score={data.score}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              <Trend current={data.thisRevenue} previous={data.lastRevenue} label="Revenue" color={T.blue}/>
              <Trend current={data.thisOrders} previous={data.lastOrders} label="Orders" color={T.purple}/>
              <Trend current={data.avgOrder} previous={data.lastAvgOrd} label="Avg Order" color={T.teal}/>
              {[
                ['This Month Profit', data.thisProfit>=0?fmt(data.thisProfit):'Loss: '+fmt(Math.abs(data.thisProfit)), data.thisProfit>=0?T.green:T.red],
                ['Profit Margin', data.margin+'%', data.margin>=20?T.green:data.margin>=10?T.amber:T.red],
                ['Outstanding', fmt(data.outstanding), data.outstanding>0?T.amber:T.green],
              ].map(([label,val,color])=>(
                <div key={label} style={{ background:T.card, borderRadius:9, padding:'12px 14px' }}>
                  <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                  <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue trend chart */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>📊 6-Month Revenue Trend</div>
            <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:120 }}>
              {data.monthlyTrend.map((m,i)=>(
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:9, color:T.green }}>{fmtK(m.revenue)}</div>
                  <div style={{ width:'100%', background:i===5?T.blue:T.blue+'55', borderRadius:'4px 4px 0 0', height:`${maxTrend>0?Math.max(4,m.revenue/maxTrend*100):4}px`, transition:'height .5s' }}/>
                  <div style={{ fontSize:10, color:T.muted }}>{m.month}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Inventory health */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>📦 Inventory</div>
              {[['Stock Value',fmt(data.stockValue),T.blue],['Low Stock Items',data.lowStock+' items',T.amber],['Zero Stock',data.zeroStock+' items',T.red],['Health Score',data.invHealth+'%',data.invHealth>=80?T.green:T.amber]].map(([label,val,color])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.sub }}>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Customer metrics */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>👥 Customers</div>
              {[['Active Customers',data.activeCustomers,T.blue],['VIP Customers',data.vipCustomers,T.amber],['Repeat Rate',data.repeatRate+'%',data.repeatRate>=30?T.green:T.amber],['Outstanding',fmt(data.outstanding),data.outstanding>0?T.red:T.green]].map(([label,val,color])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.sub }}>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Payment split */}
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>💳 Payment Split</div>
              {Object.entries(data.payModes).sort((a,b)=>b[1]-a[1]).map(([mode,amount])=>{
                const modePct = data.thisRevenue>0?Math.round(amount/data.thisRevenue*100):0;
                return (
                  <div key={mode} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color:T.ink, textTransform:'capitalize' }}>{mode}</span>
                      <span style={{ color:T.blue, fontWeight:700 }}>{modePct}%</span>
                    </div>
                    <div style={{ height:5, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${modePct}%`, background:T.blue, borderRadius:3 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top items */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>🏆 Top Products This Month</div>
            {data.topItems.length===0?<div style={{ color:T.muted, fontSize:12, textAlign:'center', padding:20 }}>No sales data yet</div>
            :data.topItems.map(([name,rev],i)=>(
              <div key={name} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                  <span style={{ color:T.ink }}>{['🥇','🥈','🥉','4.','5.'][i]} {name}</span>
                  <span style={{ color:T.green, fontWeight:700 }}>{fmt(rev)}</span>
                </div>
                <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${data.topItems[0][1]>0?rev/data.topItems[0][1]*100:0}%`, background:T.blue, borderRadius:3, transition:'width .5s' }}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
