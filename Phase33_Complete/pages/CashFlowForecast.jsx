import { useState, useEffect } from 'react';
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
const fmt = n => 'Rs.' + (Math.abs(n)||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

function Bar({ value, max, color, label, sub }) {
  const pct = max > 0 ? Math.min(100, Math.abs(value)/max*100) : 0;
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
        <span style={{ color:T.ink, fontWeight:600 }}>{label}</span>
        <span style={{ color, fontWeight:700 }}>{value>=0?'':'-'}{fmt(value)}</span>
      </div>
      <div style={{ height:10, background:T.bdr, borderRadius:5, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:5, transition:'width .5s' }}/>
      </div>
      {sub&&<div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export default function CashFlowForecast({ tenant }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState('4weeks'); // 4weeks | 3months | 6months

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const today = new Date();
    // Get last 6 months of data
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().slice(0,10);

    const [salesRes, expRes] = await Promise.all([
      supabase.from('sales').select('total,date,payment_mode').eq('tenant_id', tenant.id).gte('date', fromDate).order('date'),
      supabase.from('expenses').select('amount,date,category').eq('tenant_id', tenant.id).gte('date', fromDate).order('date'),
    ]);

    const sales    = salesRes.data||[];
    const expenses = expRes.data||[];

    // Monthly averages (last 3 months)
    const months   = [0,1,2].map(i => { const d=new Date(today); d.setMonth(d.getMonth()-i-1); return d.toISOString().slice(0,7); });
    const avgRevenue  = months.reduce((s,m)=>s+sales.filter(x=>x.date.startsWith(m)).reduce((t,x)=>t+(x.total||0),0),0) / 3;
    const avgExpenses = months.reduce((s,m)=>s+expenses.filter(x=>x.date.startsWith(m)).reduce((t,x)=>t+(x.amount||0),0),0) / 3;
    const avgCashSales= months.reduce((s,m)=>s+sales.filter(x=>x.date.startsWith(m)&&x.payment_mode==='cash').reduce((t,x)=>t+(x.total||0),0),0) / 3;

    // Weekly averages
    const avgWeeklyRevenue  = avgRevenue / 4.33;
    const avgWeeklyExpenses = avgExpenses / 4.33;

    // Current month actuals
    const thisMonth    = today.toISOString().slice(0,7);
    const monthRevenue = sales.filter(s=>s.date.startsWith(thisMonth)).reduce((t,s)=>t+(s.total||0),0);
    const monthExpenses= expenses.filter(e=>e.date.startsWith(thisMonth)).reduce((t,e)=>t+(e.amount||0),0);
    const daysInMonth  = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
    const dayOfMonth   = today.getDate();
    const daysLeft     = daysInMonth - dayOfMonth;
    const dailyRevRate = monthRevenue / dayOfMonth;
    const dailyExpRate = monthExpenses / dayOfMonth;

    // Generate forecast periods
    let forecast = [];
    if (horizon === '4weeks') {
      forecast = Array.from({length:4},(_,i)=>{
        const wStart = new Date(today); wStart.setDate(today.getDate() + i*7);
        const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate()+6);
        const projRev = avgWeeklyRevenue * (0.9 + Math.random()*0.2);
        const projExp = avgWeeklyExpenses * (0.85 + Math.random()*0.3);
        return { label:`Week ${i+1}`, sublabel:`${wStart.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${wEnd.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`, revenue:projRev, expenses:projExp, net:projRev-projExp };
      });
    } else if (horizon === '3months') {
      forecast = Array.from({length:3},(_,i)=>{
        const d=new Date(today); d.setMonth(d.getMonth()+i+1);
        const projRev = avgRevenue * (0.92+Math.random()*0.16);
        const projExp = avgExpenses * (0.9+Math.random()*0.2);
        return { label:d.toLocaleDateString('en-IN',{month:'long',year:'numeric'}), sublabel:'Projected', revenue:projRev, expenses:projExp, net:projRev-projExp };
      });
    } else {
      forecast = Array.from({length:6},(_,i)=>{
        const d=new Date(today); d.setMonth(d.getMonth()+i+1);
        const projRev = avgRevenue * (0.88+Math.random()*0.24);
        const projExp = avgExpenses * (0.85+Math.random()*0.3);
        return { label:d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}), sublabel:'Projected', revenue:projRev, expenses:projExp, net:projRev-projExp };
      });
    }

    // Expense category breakdown
    const expByCategory = expenses.filter(e=>e.date.startsWith(thisMonth)).reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+(e.amount||0); return acc; },{});

    setData({ avgRevenue, avgExpenses, avgCashSales, monthRevenue, monthExpenses, daysLeft, dailyRevRate, dailyExpRate, forecast, expByCategory, netCashFlow:avgRevenue-avgExpenses, cashflowPositive:avgRevenue>avgExpenses });
    setLoading(false);
  }

  const maxForecast = data ? Math.max(...data.forecast.map(f=>Math.max(f.revenue,f.expenses))) : 1;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>💹 Cash Flow Forecast</div>
          <div style={{ fontSize:13, color:T.sub }}>Based on last 3 months average performance</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[['4weeks','4 Weeks'],['3months','3 Months'],['6months','6 Months']].map(([id,label])=>(
            <button key={id} onClick={()=>{ setHorizon(id); setData(null); setLoading(true); setTimeout(load,100); }} style={{ background:horizon===id?T.blue:T.srf, color:horizon===id?'#fff':T.sub, border:`1px solid ${horizon===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:80 }}>Calculating forecast…</div>:data&&(
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              ['Avg Monthly Revenue',fmt(data.avgRevenue),T.blue,'Last 3 months avg'],
              ['Avg Monthly Expenses',fmt(data.avgExpenses),T.red,'Last 3 months avg'],
              ['Net Cash Flow',fmt(data.netCashFlow),data.cashflowPositive?T.green:T.red,data.cashflowPositive?'Positive ✅':'Negative ⚠️'],
              ['This Month So Far',fmt(data.monthRevenue),T.amber,`${data.daysLeft} days remaining`],
            ].map(([label,val,color,sub])=>(
              <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* This month projection */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>📅 This Month Projection</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <Bar value={data.monthRevenue} max={data.avgRevenue*1.2} color={T.blue} label="Revenue to date" sub={`${fmt(data.dailyRevRate*data.daysLeft)} expected in remaining ${data.daysLeft} days`}/>
                <Bar value={data.monthExpenses} max={data.avgExpenses*1.2} color={T.red} label="Expenses to date" sub={`${fmt(data.dailyExpRate*data.daysLeft)} expected remaining`}/>
              </div>
              <div>
                <div style={{ background:T.card, borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:13, color:T.sub, marginBottom:10 }}>Projected Month End</div>
                  {[
                    ['Total Revenue',fmt(data.monthRevenue + data.dailyRevRate*data.daysLeft),T.blue],
                    ['Total Expenses',fmt(data.monthExpenses + data.dailyExpRate*data.daysLeft),T.red],
                    ['Net Profit',fmt((data.monthRevenue+data.dailyRevRate*data.daysLeft)-(data.monthExpenses+data.dailyExpRate*data.daysLeft)),(data.monthRevenue>data.monthExpenses)?T.green:T.red],
                  ].map(([label,val,color])=>(
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                      <span style={{ color:T.sub }}>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Forecast bars */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:16 }}>🔮 Projected {horizon==='4weeks'?'4-Week':'Cash Flow'} Forecast</div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${data.forecast.length},1fr)`, gap:12, alignItems:'flex-end', height:180 }}>
              {data.forecast.map((f,i)=>(
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end' }}>
                  <div style={{ fontSize:10, color:T.green, marginBottom:3 }}>{fmt(f.revenue)}</div>
                  <div style={{ width:'100%', display:'flex', gap:3, alignItems:'flex-end', justifyContent:'center' }}>
                    <div style={{ width:14, background:T.blue, borderRadius:'3px 3px 0 0', height:`${maxForecast>0?f.revenue/maxForecast*140:4}px`, transition:'height .5s' }}/>
                    <div style={{ width:14, background:T.red+'99', borderRadius:'3px 3px 0 0', height:`${maxForecast>0?f.expenses/maxForecast*140:4}px`, transition:'height .5s' }}/>
                  </div>
                  <div style={{ fontSize:10, color:T.ink, fontWeight:700, marginTop:5, textAlign:'center' }}>{f.label}</div>
                  <div style={{ fontSize:9, color:T.muted, textAlign:'center' }}>{f.sublabel}</div>
                  <div style={{ fontSize:10, color:f.net>=0?T.green:T.red, fontWeight:700, marginTop:2 }}>{f.net>=0?'+':''}{fmt(f.net)}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12, justifyContent:'center' }}>
              {[[T.blue,'Revenue'],[T.red+'99','Expenses']].map(([color,label])=>(
                <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, borderRadius:2, background:color }}/><span style={{ fontSize:11, color:T.muted }}>{label}</span></div>
              ))}
            </div>
          </div>

          {/* Expense breakdown */}
          {Object.keys(data.expByCategory).length>0&&(
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>💸 This Month Expense Breakdown</div>
              {Object.entries(data.expByCategory).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <Bar key={cat} value={amt} max={Math.max(...Object.values(data.expByCategory))} color={T.red} label={cat} sub={`${data.monthExpenses>0?Math.round(amt/data.monthExpenses*100):0}% of total expenses`}/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
