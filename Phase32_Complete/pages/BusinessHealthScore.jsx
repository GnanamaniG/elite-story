import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const pct = n => (n||0).toFixed(1) + '%';

function ScoreRing({ score, size=160 }) {
  const r = (size-20)/2, c = 2*Math.PI*r;
  const offset = c - (score/100)*c;
  const color = score>=80?T.green:score>=60?T.blue:score>=40?T.amber:T.red;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth="12"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 1s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:size/3.2, fontWeight:900, color, letterSpacing:'-0.03em', lineHeight:1 }}>{Math.round(score)}</div>
        <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:'uppercase', marginTop:2 }}>out of 100</div>
      </div>
    </div>
  );
}

function MetricBar({ label, score, detail, icon }) {
  const color = score>=80?T.green:score>=60?T.blue:score>=40?T.amber:T.red;
  return (
    <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>{label}</span>
        </div>
        <span style={{ fontSize:16, fontWeight:900, color }}>{Math.round(score)}</span>
      </div>
      <div style={{ height:7, background:'#F3F4F6', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
        <div style={{ height:'100%', width:`${Math.min(100,score)}%`, background:color, borderRadius:4, transition:'width .8s ease' }}/>
      </div>
      <div style={{ fontSize:11, color:T.sub }}>{detail}</div>
    </div>
  );
}

export default function BusinessHealthScore({ tenant }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('30');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const days = parseInt(period);
    const since = new Date(); since.setDate(since.getDate()-days);
    const prevSince = new Date(); prevSince.setDate(prevSince.getDate()-days*2);
    const sinceStr = since.toISOString().slice(0,10);
    const prevStr  = prevSince.toISOString().slice(0,10);

    const [salesRes, prevSalesRes, expRes, invRes, custRes] = await Promise.all([
      supabase.from('sales').select('total,items,customer,date').eq('tenant_id', tenant.id).gte('date', sinceStr),
      supabase.from('sales').select('total,date').eq('tenant_id', tenant.id).gte('date', prevStr).lt('date', sinceStr),
      supabase.from('expenses').select('amount').eq('tenant_id', tenant.id).gte('date', sinceStr),
      supabase.from('inventory').select('id,name,stock,cp,sp,alert').eq('tenant_id', tenant.id).eq('active', true),
      supabase.from('customers').select('id,created_at,total_spent').eq('tenant_id', tenant.id),
    ]);

    const sales     = salesRes.data     || [];
    const prevSales = prevSalesRes.data || [];
    const expenses  = expRes.data       || [];
    const inv       = invRes.data       || [];
    const customers = custRes.data      || [];

    const revenue     = sales.reduce((s,x)=>s+(x.total||0),0);
    const prevRevenue = prevSales.reduce((s,x)=>s+(x.total||0),0);
    const totalExp    = expenses.reduce((s,x)=>s+(x.amount||0),0);
    const profit      = revenue - totalExp;
    const profitMargin= revenue>0 ? (profit/revenue*100) : 0;
    const growth      = prevRevenue>0 ? ((revenue-prevRevenue)/prevRevenue*100) : (revenue>0?100:0);

    // Repeat customer rate
    const custOrders = {};
    sales.forEach(s=>{ const k=s.customer; if(k) custOrders[k]=(custOrders[k]||0)+1; });
    const repeatCust = Object.values(custOrders).filter(c=>c>1).length;
    const totalCust  = Object.keys(custOrders).length;
    const repeatRate = totalCust>0 ? (repeatCust/totalCust*100) : 0;

    // Inventory health
    const lowStock  = inv.filter(i=>(i.stock||0)<=(i.alert||5)).length;
    const outStock  = inv.filter(i=>(i.stock||0)<=0).length;
    const stockHealth = inv.length>0 ? ((inv.length-outStock-lowStock*0.5)/inv.length*100) : 100;

    // Product mix — how many products actually sold
    const soldIds = new Set();
    sales.forEach(s=>(s.items||[]).forEach(i=>soldIds.add(i.id||i.name)));
    const productActivity = inv.length>0 ? (soldIds.size/inv.length*100) : 0;

    // ── Scoring ──
    const scoreProfitability = Math.min(100, Math.max(0, profitMargin*3));       // 33% margin = 100
    const scoreGrowth        = Math.min(100, Math.max(0, 50 + growth*2));        // 0% growth = 50
    const scoreRetention     = Math.min(100, repeatRate*2);                       // 50% repeat = 100
    const scoreInventory     = Math.min(100, Math.max(0, stockHealth));
    const scoreActivity      = Math.min(100, productActivity*2);                  // 50% products sold = 100

    const overall = (scoreProfitability*0.30 + scoreGrowth*0.25 + scoreRetention*0.20 + scoreInventory*0.15 + scoreActivity*0.10);

    // Recommendations
    const recs = [];
    if (scoreProfitability<60) recs.push({ icon:'💰', title:'Improve Profit Margin', text:`Your margin is ${pct(profitMargin)}. Review pricing on low-margin products or negotiate better rates with suppliers.`, priority:'high' });
    if (scoreGrowth<50)        recs.push({ icon:'📉', title:'Revenue Declining', text:`Sales are ${pct(Math.abs(growth))} ${growth<0?'down':'up'} vs previous period. Consider a promotional campaign or win-back drive.`, priority:'high' });
    if (scoreRetention<50)     recs.push({ icon:'🔄', title:'Low Repeat Business', text:`Only ${pct(repeatRate)} of customers return. Launch a loyalty program or win-back campaign.`, priority:'medium' });
    if (outStock>0)            recs.push({ icon:'📦', title:`${outStock} Products Out of Stock`, text:'Restock immediately — out-of-stock items lose sales and disappoint customers.', priority:'high' });
    if (lowStock>3)            recs.push({ icon:'⚠️', title:`${lowStock} Products Low on Stock`, text:'Review reorder levels and place purchase orders soon.', priority:'medium' });
    if (scoreActivity<40)      recs.push({ icon:'🏷️', title:'Dead Stock Detected', text:`Only ${pct(productActivity)} of your catalogue sold this period. Consider discounting slow movers.`, priority:'medium' });
    if (recs.length===0)       recs.push({ icon:'🎉', title:'Business is Healthy!', text:'All key metrics look good. Keep monitoring and consider expanding your product range.', priority:'low' });

    setData({
      overall, revenue, prevRevenue, profit, profitMargin, growth, totalExp,
      orders: sales.length, repeatRate, lowStock, outStock, productActivity,
      scores: { profitability:scoreProfitability, growth:scoreGrowth, retention:scoreRetention, inventory:scoreInventory, activity:scoreActivity },
      recs, totalProducts: inv.length, totalCustomers: customers.length,
    });
    setLoading(false);
  }

  const grade = data ? (data.overall>=85?'A+':data.overall>=75?'A':data.overall>=65?'B+':data.overall>=55?'B':data.overall>=45?'C':'D') : '—';
  const gradeMsg = data ? (data.overall>=75?'Excellent — your business is thriving':data.overall>=60?'Good — solid performance with room to grow':data.overall>=45?'Fair — several areas need attention':'Needs Work — focus on the recommendations below') : '';

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>💚 Business Health Score</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Overall business performance with actionable recommendations</div>
        </div>
        <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
          {[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading?<div style={{ textAlign:'center', padding:80, color:T.muted }}>Calculating business health…</div>
      :data&&<>
        {/* Hero score */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:16, padding:'28px 32px', marginBottom:20, display:'flex', alignItems:'center', gap:36, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <ScoreRing score={data.overall}/>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span style={{ fontSize:36, fontWeight:900, color:data.overall>=75?T.green:data.overall>=55?T.blue:T.amber, letterSpacing:'-0.03em' }}>{grade}</span>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>{gradeMsg}</div>
                <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Based on profitability, growth, retention, inventory and product activity</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginTop:18 }}>
              {[
                ['Revenue',  fmt(data.revenue),    data.growth>=0?T.green:T.red, data.growth>=0?`↑ ${pct(data.growth)}`:`↓ ${pct(Math.abs(data.growth))}`],
                ['Profit',   fmt(data.profit),     data.profit>=0?T.green:T.red, pct(data.profitMargin)+' margin'],
                ['Orders',   data.orders,          T.blue,   `${data.totalCustomers} customers`],
                ['Repeat Rate', pct(data.repeatRate), T.purple, 'returning customers'],
              ].map(([label,val,color,sub])=>(
                <div key={label}>
                  <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:19, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
                  <div style={{ fontSize:10, color:T.sub, marginTop:1 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metric breakdown */}
        <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Score Breakdown</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12, marginBottom:24 }}>
          <MetricBar label="Profitability" icon="💰" score={data.scores.profitability} detail={`${pct(data.profitMargin)} net margin · 30% weight`}/>
          <MetricBar label="Growth"        icon="📈" score={data.scores.growth}        detail={`${data.growth>=0?'+':''}${pct(data.growth)} vs previous period · 25% weight`}/>
          <MetricBar label="Retention"     icon="🔄" score={data.scores.retention}     detail={`${pct(data.repeatRate)} repeat customers · 20% weight`}/>
          <MetricBar label="Inventory"     icon="📦" score={data.scores.inventory}     detail={`${data.outStock} out of stock, ${data.lowStock} low · 15% weight`}/>
          <MetricBar label="Product Mix"   icon="🏷️" score={data.scores.activity}      detail={`${pct(data.productActivity)} of catalogue sold · 10% weight`}/>
        </div>

        {/* Recommendations */}
        <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Recommendations</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.recs.map((r,i)=>{
            const pColor = r.priority==='high'?T.red:r.priority==='medium'?T.amber:T.green;
            const pBg    = r.priority==='high'?'#FEF2F2':r.priority==='medium'?'#FFFBEB':'#F0FDF4';
            const pBdr   = r.priority==='high'?'#FECACA':r.priority==='medium'?'#FDE68A':'#BBF7D0';
            return (
              <div key={i} style={{ background:T.white, border:`1px solid ${pBdr}`, borderRadius:12, padding:'16px 20px', display:'flex', gap:14, alignItems:'flex-start', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:pBg, border:`1px solid ${pBdr}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{r.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{r.title}</div>
                    <span style={{ background:pBg, color:pColor, border:`1px solid ${pBdr}`, borderRadius:20, padding:'2px 10px', fontSize:9, fontWeight:700, textTransform:'uppercase' }}>{r.priority}</span>
                  </div>
                  <div style={{ fontSize:12, color:T.sub, lineHeight:1.6 }}>{r.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}
