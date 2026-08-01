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
const fmt = n => (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function DemandForecast({ tenant }) {
  const [forecasts, setForecasts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [horizon,   setHorizon]   = useState(30);
  const [filter,    setFilter]    = useState('all');

  useEffect(() => { if (tenant?.id) compute(); }, [tenant?.id, horizon]);

  async function compute() {
    setLoading(true);
    const today  = new Date();
    const past90 = new Date(today); past90.setDate(today.getDate()-90);
    const [invRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('id,name,cat,stock,alert,cp,sp,code').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('sales').select('items,date').eq('tenant_id', tenant.id).gte('date', past90.toISOString().slice(0,10)),
    ]);
    const inventory = invRes.data||[];
    const sales     = salesRes.data||[];

    // Aggregate qty sold per item per week
    const itemSales = {};
    sales.forEach(s=>(s.items||[]).forEach(i=>{
      if (!itemSales[i.id||i.name]) itemSales[i.id||i.name] = { name:i.name, weeks:Array(13).fill(0) };
      const weeksAgo = Math.floor((today-new Date(s.date))/(7*86400000));
      if (weeksAgo<13) itemSales[i.id||i.name].weeks[weeksAgo] += (i.qty||0);
    }));

    const results = inventory.map(item => {
      const salesData = itemSales[item.id] || { weeks:Array(13).fill(0) };
      const recent4   = salesData.weeks.slice(0,4).reduce((a,b)=>a+b,0);
      const mid4      = salesData.weeks.slice(4,8).reduce((a,b)=>a+b,0);
      const old4      = salesData.weeks.slice(8,12).reduce((a,b)=>a+b,0);

      // Weighted average (recent weeks weighed more)
      const weeklyAvg = (recent4*0.5 + mid4*0.35 + old4*0.15) / 4;
      const trend     = recent4 > 0 ? (recent4-mid4)/Math.max(mid4,1)*100 : 0;
      const forecast  = Math.round(weeklyAvg * (horizon/7));
      const daysLeft  = weeklyAvg>0 ? Math.round((item.stock||0) / (weeklyAvg/7)) : 999;
      const stockout  = daysLeft <= horizon;
      const reorderQty= Math.round(forecast * 1.2); // 20% buffer
      const velocity  = weeklyAvg>2?'fast':weeklyAvg>0.5?'normal':'slow';

      return { ...item, weeklyAvg:Math.round(weeklyAvg*10)/10, trend:Math.round(trend), forecast, daysLeft:Math.min(daysLeft,365), stockout, reorderQty, velocity, recent4 };
    }).filter(i=>i.recent4>0||i.stock>0).sort((a,b)=>b.recent4-a.recent4);

    setForecasts(results);
    setLoading(false);
  }

  const displayed = filter==='all'?forecasts:filter==='stockout'?forecasts.filter(f=>f.stockout):filter==='fast'?forecasts.filter(f=>f.velocity==='fast'):forecasts.filter(f=>f.velocity==='slow');
  const stockoutCount = forecasts.filter(f=>f.stockout).length;
  const fastMoving    = forecasts.filter(f=>f.velocity==='fast').length;

  const VelocityBadge = ({ v }) => {
    const cfg = { fast:{ color:T.green, label:'⚡ Fast' }, normal:{ color:T.blue, label:'→ Normal' }, slow:{ color:T.muted, label:'🐌 Slow' } };
    const c = cfg[v]||cfg.normal;
    return <span style={{ background:c.color+'22', color:c.color, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{c.label}</span>;
  };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔮 Demand Forecast</div>
          <div style={{ fontSize:13, color:T.sub }}>AI-powered demand prediction · Based on 13-week sales history</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[30,60,90].map(d=>(
            <button key={d} onClick={()=>setHorizon(d)} style={{ background:horizon===d?T.blue:T.srf, color:horizon===d?'#fff':T.sub, border:`1px solid ${horizon===d?T.blue:T.bdr}`, borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{d}d</button>
          ))}
          <button onClick={compute} style={{ background:T.purple+'22', color:T.purple, border:`1px solid ${T.purple}44`, borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Items Tracked',forecasts.length,T.blue],['Stock-out Risk',stockoutCount,T.red],['Fast Moving',fastMoving,T.green],['Forecast Horizon',`${horizon} days`,T.purple]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {stockoutCount>0&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}33`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.red }}>
        ⚠️ {stockoutCount} items at risk of stock-out within {horizon} days — review reorder quantities
      </div>}

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['all','All Items'],['stockout','Stock-out Risk'],['fast','Fast Moving'],['slow','Slow Moving']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Product','Category','Current Stock','Weekly Avg','Trend','Days Left',`${horizon}d Forecast`,'Reorder Qty','Velocity'].map(h=>(
              <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}`, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={9} style={{ textAlign:'center', padding:60, color:T.sub }}>Computing forecast from 13 weeks of sales data…</td></tr>
            :displayed.length===0?<tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.muted }}>No data. Add some sales to enable forecasting.</td></tr>
            :displayed.map(item=>(
              <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}22`, background:item.stockout?T.red+'06':'transparent' }}>
                <td style={{ padding:'9px 12px', color:T.ink, fontWeight:600 }}>{item.name}{item.code&&<div style={{ fontSize:10, color:T.muted }}>{item.code}</div>}</td>
                <td style={{ padding:'9px 12px', color:T.sub }}>{item.cat||'—'}</td>
                <td style={{ padding:'9px 12px', color:item.stock<=(item.alert||10)?T.red:T.ink, fontWeight:item.stock<=(item.alert||10)?700:400 }}>{fmt(item.stock||0)}</td>
                <td style={{ padding:'9px 12px', color:T.blue }}>{item.weeklyAvg}/wk</td>
                <td style={{ padding:'9px 12px', color:item.trend>10?T.green:item.trend<-10?T.red:T.muted, fontWeight:600 }}>
                  {item.trend>0?'▲':'▼'} {Math.abs(item.trend)}%
                </td>
                <td style={{ padding:'9px 12px', color:item.stockout?T.red:item.daysLeft<60?T.amber:T.green, fontWeight:item.stockout?700:400 }}>
                  {item.daysLeft>=365?'365+ days':`${item.daysLeft}d`}{item.stockout?' ⚠️':''}
                </td>
                <td style={{ padding:'9px 12px', color:T.purple, fontWeight:700 }}>{fmt(item.forecast)} units</td>
                <td style={{ padding:'9px 12px', color:T.amber, fontWeight:700 }}>{fmt(item.reorderQty)} units</td>
                <td style={{ padding:'9px 12px' }}><VelocityBadge v={item.velocity}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
