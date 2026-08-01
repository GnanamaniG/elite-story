import { useState, useEffect } from 'react';
import { getSales, getExpenses, getPurchases, getInventory } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const CHART_COLORS = [T.blue, T.green, T.amber, T.purple, T.teal, T.red, '#ff6b35', '#a8e6cf'];

function BarChart({ data, height=200 }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:T.muted }}>No data</div>;
  const max  = Math.max(...data.map(d => d.value), 1);
  const W=600, pad={ top:20, right:20, bottom:40, left:60 };
  const cW=W-pad.left-pad.right, cH=height-pad.top-pad.bottom;
  const barW = Math.max(8, Math.floor(cW/data.length) - 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
      {[0,0.25,0.5,0.75,1].map(pct => {
        const y = pad.top + cH*(1-pct);
        return <g key={pct}><line x1={pad.left} y1={y} x2={pad.left+cW} y2={y} stroke={T.bdr} strokeWidth={0.5} strokeDasharray="4 4"/><text x={pad.left-6} y={y+4} textAnchor="end" fontSize={9} fill={T.muted}>{fmt(max*pct)}</text></g>;
      })}
      {data.map((d,i) => {
        const barH = Math.max(2,(d.value/max)*cH);
        const x = pad.left + i*(cW/data.length) + (cW/data.length-barW)/2;
        return <g key={i}><rect x={x} y={pad.top+cH-barH} width={barW} height={barH} fill={d.color||T.blue} rx={3} opacity={0.85}/><text x={x+barW/2} y={height-pad.bottom+14} textAnchor="middle" fontSize={9} fill={T.sub}>{d.label}</text></g>;
      })}
    </svg>
  );
}

function LineChart({ data, height=160, color=T.blue }) {
  if (!data?.length||data.length<2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:T.muted }}>Need more data</div>;
  const max=Math.max(...data.map(d=>d.value),1), W=600, pad={top:16,right:20,bottom:32,left:60};
  const cW=W-pad.left-pad.right, cH=height-pad.top-pad.bottom;
  const pts=data.map((d,i)=>({ x:pad.left+(i/(data.length-1))*cW, y:pad.top+cH*(1-d.value/max), label:d.label }));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
      {[0,0.5,1].map(pct=>{ const y=pad.top+cH*(1-pct); return <g key={pct}><line x1={pad.left} y1={y} x2={pad.left+cW} y2={y} stroke={T.bdr} strokeWidth={0.5} strokeDasharray="4 4"/><text x={pad.left-6} y={y+4} textAnchor="end" fontSize={9} fill={T.muted}>{fmt(max*pct)}</text></g>; })}
      <path d={`M${pts[0].x},${pad.top+cH} `+pts.map(p=>`L${p.x},${p.y}`).join(' ')+` L${pts[pts.length-1].x},${pad.top+cH} Z`} fill={color} opacity={0.1}/>
      <polyline points={pts.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={2}/>
      {pts.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={3} fill={color}/><text x={p.x} y={height-pad.bottom+14} textAnchor="middle" fontSize={9} fill={T.sub}>{p.label}</text></g>)}
    </svg>
  );
}

function DonutChart({ data, size=180 }) {
  if (!data?.length) return null;
  const total=data.reduce((s,d)=>s+d.value,0);
  if (!total) return null;
  const cx=size/2, cy=size/2, r=size/2-16, ir=r-28;
  let angle=-Math.PI/2;
  const slices=data.map((d,i)=>{
    const pct=d.value/total, sweep=pct*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle+=sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const ix1=cx+ir*Math.cos(angle-sweep), iy1=cy+ir*Math.sin(angle-sweep);
    const ix2=cx+ir*Math.cos(angle), iy2=cy+ir*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    return { path:`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large},0 ${ix1},${iy1} Z`, color:CHART_COLORS[i%CHART_COLORS.length] };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity={0.9}/>)}
      <text x={cx} y={cy-5} textAnchor="middle" fontSize={9} fill={T.sub}>TOTAL</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize={12} fontWeight="bold" fill={T.ink}>{fmt(total)}</text>
    </svg>
  );
}

export default function Reports({ tenant }) {
  const [data, setData]=useState(null);
  const [loading, setLoading]=useState(true);
  const [period, setPeriod]=useState('this_year');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const [sales, expenses, purchases, inventory]=await Promise.all([getSales(tenant.id,1000),getExpenses(tenant.id),getPurchases(tenant.id),getInventory(tenant.id)]);
    const now=new Date(), yr=now.getFullYear(), mo=String(now.getMonth()+1).padStart(2,'0');
    const weekStart=new Date(now-now.getDay()*86400000).toISOString().slice(0,10);
    const filter=d=>{ if(period==='today') return d===now.toISOString().slice(0,10); if(period==='this_week') return d>=weekStart; if(period==='this_month') return d>=`${yr}-${mo}-01`; if(period==='this_year') return d>=`${yr}-01-01`; return true; };
    const fS=sales.filter(s=>filter(s.date)), fE=expenses.filter(e=>filter(e.date)), fP=purchases.filter(p=>filter(p.date));
    const revenue=fS.reduce((s,x)=>s+(x.total||0),0), cogs=fP.reduce((s,x)=>s+(x.total||0),0), expTotal=fE.reduce((s,x)=>s+(x.amount||0),0);
    const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mRev={}, mPft={};
    sales.forEach(s=>{ const m=s.date?.slice(0,7); if(m) mRev[m]=(mRev[m]||0)+(s.total||0); });
    expenses.forEach(e=>{ const m=e.date?.slice(0,7); if(m) mPft[m]=(mPft[m]||0)-(e.amount||0); });
    Object.keys(mRev).forEach(m=>{ mPft[m]=(mRev[m]||0)+(mPft[m]||0); });
    const last12M=Array.from({length:12},(_,i)=>{ const d=new Date(yr,now.getMonth()-11+i,1),k=d.toISOString().slice(0,7); return {label:MONTHS[d.getMonth()],value:mRev[k]||0,color:T.blue}; });
    const last12P=Array.from({length:12},(_,i)=>{ const d=new Date(yr,now.getMonth()-11+i,1),k=d.toISOString().slice(0,7); return {label:MONTHS[d.getMonth()],value:Math.max(0,mPft[k]||0)}; });
    const payModes=fS.reduce((a,s)=>{ a[s.payment_mode||'cash']=(a[s.payment_mode||'cash']||0)+(s.total||0); return a; },{});
    const expByCat=fE.reduce((a,e)=>{ a[e.category]=(a[e.category]||0)+(e.amount||0); return a; },{});
    const itemSales={};
    fS.forEach(s=>(s.items||[]).forEach(item=>{ itemSales[item.name]=(itemSales[item.name]||0)+(item.amount||0); }));
    const topItems=Object.entries(itemSales).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const custSales={};
    fS.forEach(s=>{ if(s.customer&&s.customer!=='Walk-in') custSales[s.customer]=(custSales[s.customer]||0)+(s.total||0); });
    const topCusts=Object.entries(custSales).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dow=Array(7).fill(0);
    fS.forEach(s=>{ if(s.date) dow[new Date(s.date).getDay()]+=(s.total||0); });
    setData({ revenue,cogs,expTotal,netProfit:revenue-cogs-expTotal,orders:fS.length,last12M,last12P,payModes,expByCat,topItems,topCusts,dowData:DOW.map((label,i)=>({label,value:dow[i],color:i===0||i===6?T.purple:T.blue})),inventory });
    setLoading(false);
  }

  const PERIODS=[{id:'today',label:'Today'},{id:'this_week',label:'This Week'},{id:'this_month',label:'This Month'},{id:'this_year',label:'This Year'}];
  const Card=({label,value,color,sub})=>(<div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:10,padding:'16px 18px'}}><div style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:'uppercase',marginBottom:8}}>{label}</div><div style={{fontSize:22,fontWeight:800,color}}>{value}</div>{sub&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>{sub}</div>}</div>);

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:T.ink}}>Advanced Reports</div>
        <div style={{display:'flex',gap:6}}>
          {PERIODS.map(p=><button key={p.id} onClick={()=>setPeriod(p.id)} style={{background:period===p.id?T.blue:T.srf,color:period===p.id?'#fff':T.sub,border:`1px solid ${period===p.id?T.blue:T.bdr}`,borderRadius:7,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{p.label}</button>)}
        </div>
      </div>
      {loading?<div style={{textAlign:'center',color:T.sub,padding:80}}>Loading…</div>:data&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
            <Card label="Revenue" value={fmt(data.revenue)} color={T.blue} sub={`${data.orders} invoices`}/>
            <Card label="COGS" value={fmt(data.cogs)} color={T.amber} sub="Purchase cost"/>
            <Card label="Expenses" value={fmt(data.expTotal)} color={T.red} sub="Operating cost"/>
            <Card label="Gross Profit" value={fmt(data.revenue-data.cogs)} color={T.green} sub={`Margin ${data.revenue>0?Math.round((data.revenue-data.cogs)/data.revenue*100):0}%`}/>
            <Card label="Net Profit" value={fmt(data.netProfit)} color={data.netProfit>=0?T.green:T.red} sub="After all costs"/>
          </div>
          <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:T.ink,marginBottom:16}}>📊 Monthly Revenue Trend</div>
            <BarChart data={data.last12M} height={200}/>
          </div>
          <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:T.ink,marginBottom:16}}>📈 Profit Trend</div>
            <LineChart data={data.last12P} height={160} color={T.green}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:20}}>
              <div style={{fontWeight:700,color:T.ink,marginBottom:16}}>📅 Sales by Day of Week</div>
              <BarChart data={data.dowData} height={160}/>
            </div>
            <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:20}}>
              <div style={{fontWeight:700,color:T.ink,marginBottom:16}}>💳 Payment Modes</div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <DonutChart data={Object.entries(data.payModes).map(([label,value],i)=>({label,value,color:CHART_COLORS[i]}))} size={160}/>
                <div style={{flex:1}}>
                  {Object.entries(data.payModes).map(([mode,amt],i)=>(
                    <div key={mode} style={{display:'flex',justifyContent:'space-between',marginBottom:8,alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:'50%',background:CHART_COLORS[i]}}/><span style={{fontSize:12,color:T.ink,textTransform:'capitalize'}}>{mode}</span></div>
                      <span style={{fontSize:12,fontWeight:700,color:T.sub}}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bdr}`,fontWeight:700,color:T.ink}}>🏆 Top Selling Items</div>
              <div style={{padding:14}}>
                {data.topItems.map(([name,rev],i)=>(
                  <div key={name} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:12,color:T.ink}}>{i+1}. {name}</span><span style={{fontSize:12,fontWeight:700,color:T.green}}>{fmt(rev)}</span></div>
                    <div style={{height:5,background:T.bdr,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(rev/data.topItems[0][1]*100)}%`,background:CHART_COLORS[i],borderRadius:3}}/></div>
                  </div>
                ))}
                {!data.topItems.length&&<div style={{textAlign:'center',color:T.muted,fontSize:12,padding:20}}>No sales this period</div>}
              </div>
            </div>
            <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:20}}>
              <div style={{fontWeight:700,color:T.ink,marginBottom:16}}>💸 Expense Breakdown</div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <DonutChart data={Object.entries(data.expByCat).map(([label,value],i)=>({label,value,color:CHART_COLORS[i]}))} size={150}/>
                <div style={{flex:1}}>
                  {Object.entries(data.expByCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,amt],i)=>(
                    <div key={cat} style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:8,height:8,borderRadius:2,background:CHART_COLORS[i]}}/><span style={{fontSize:11,color:T.sub}}>{cat}</span></div>
                      <span style={{fontSize:11,fontWeight:700,color:T.red}}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {data.topCusts.length>0&&(
            <div style={{background:T.srf,border:`1px solid ${T.bdr}`,borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.bdr}`,fontWeight:700,color:T.ink}}>👥 Top Customers</div>
              {data.topCusts.map(([name,rev],i)=>(
                <div key={name} style={{display:'flex',alignItems:'center',gap:16,padding:'10px 18px',borderBottom:`1px solid ${T.bdr}22`}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:CHART_COLORS[i]+'33',color:CHART_COLORS[i],display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800}}>{i+1}</div>
                  <div style={{flex:1,fontSize:14,fontWeight:600,color:T.ink}}>{name}</div>
                  <div style={{fontSize:15,fontWeight:800,color:T.blue}}>{fmt(rev)}</div>
                  <div style={{width:100,height:5,background:T.bdr,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(rev/data.topCusts[0][1]*100)}%`,background:CHART_COLORS[i],borderRadius:3}}/></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
