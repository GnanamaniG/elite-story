import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const COLORS = [T.blue, T.green, T.amber, T.purple, T.teal, T.red];
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

function MiniBarChart({ data, maxVal }) {
  return (
    <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <div style={{ width:'100%', background:d.color||T.blue, borderRadius:'3px 3px 0 0', height:`${maxVal>0?(d.value/maxVal)*56:2}px`, minHeight:2, transition:'height .3s' }} />
          <div style={{ fontSize:8, color:T.muted, textAlign:'center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function MultiStoreAnalytics({ tenant }) {
  const [branches,  setBranches]  = useState([]);
  const [branchData,setBranchData]= useState({});
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('month');
  const [metric,    setMetric]    = useState('revenue');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const now        = new Date();
    const yr         = now.getFullYear();
    const mo         = String(now.getMonth()+1).padStart(2,'0');
    const weekStart  = new Date(now - now.getDay()*86400000).toISOString().slice(0,10);
    const monthStart = `${yr}-${mo}-01`;
    const today      = now.toISOString().slice(0,10);
    const dateFrom   = period==='today'?today:period==='week'?weekStart:period==='month'?monthStart:`${yr}-01-01`;

    const { data: branchList } = await supabase.from('branches').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name');
    setBranches(branchList||[]);

    const bData = {};
    await Promise.all((branchList||[]).map(async (branch, bi) => {
      const [salesRes, expRes, invRes] = await Promise.all([
        supabase.from('sales').select('total,gst_amount,items,date,payment_mode').eq('tenant_id', tenant.id).eq('branch_id', branch.id).gte('date', dateFrom),
        supabase.from('expenses').select('amount,category').eq('tenant_id', tenant.id).eq('branch_id', branch.id).gte('date', dateFrom),
        supabase.from('inventory').select('stock,sp,cp,alert').eq('tenant_id', tenant.id).eq('branch_id', branch.id),
      ]);
      const sales    = salesRes.data||[];
      const expenses = expRes.data||[];
      const inv      = invRes.data||[];
      const revenue  = sales.reduce((s,x)=>s+(x.total||0),0);
      const gst      = sales.reduce((s,x)=>s+(x.gst_amount||0),0);
      const expTotal = expenses.reduce((s,x)=>s+(x.amount||0),0);
      const lowStock = inv.filter(i=>(i.stock||0)<=(i.alert||10)).length;
      const stockVal = inv.reduce((s,i)=>s+(i.stock||0)*(i.cp||0),0);
      const payModes = sales.reduce((acc,s)=>{ acc[s.payment_mode||'cash']=(acc[s.payment_mode||'cash']||0)+(s.total||0); return acc; },{});
      bData[branch.id] = { revenue, gst, expTotal, profit:revenue-expTotal, orders:sales.length, avgOrder:sales.length>0?revenue/sales.length:0, lowStock, stockVal, payModes, color:COLORS[bi%COLORS.length] };
    }));

    setBranchData(bData);
    setLoading(false);
  }

  const METRICS = [
    { id:'revenue', label:'Revenue' },
    { id:'orders',  label:'Orders' },
    { id:'profit',  label:'Profit' },
    { id:'avgOrder',label:'Avg Order' },
  ];

  const chartData = branches.map((b, i) => ({ label:b.name.split(' ').slice(-1)[0]||b.name, value:branchData[b.id]?.[metric]||0, color:COLORS[i%COLORS.length] }));
  const maxVal    = Math.max(...chartData.map(d=>d.value), 1);
  const totalRev  = Object.values(branchData).reduce((s,d)=>s+(d.revenue||0),0);
  const totalOrd  = Object.values(branchData).reduce((s,d)=>s+(d.orders||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🏪 Multi-Store Analytics</div>
          <div style={{ fontSize:13, color:T.sub }}>{branches.length} branches · Combined revenue: {fmt(totalRev)}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['today','Today'],['week','Week'],['month','Month'],['year','Year']].map(([id,label])=>(
            <button key={id} onClick={()=>setPeriod(id)} style={{ background:period===id?T.blue:T.srf, color:period===id?'#fff':T.sub, border:`1px solid ${period===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
      </div>

      {branches.length < 2 ? (
        <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:12, padding:32, textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🏪</div>
          <div style={{ fontSize:15, color:T.amber, fontWeight:700 }}>Need at least 2 branches</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:6 }}>Add branches in the Branches section, then run SQL migration 004_branches.sql to enable branch tracking.</div>
        </div>
      ) : loading ? <div style={{ textAlign:'center', color:T.sub, padding:80 }}>Loading branch data…</div> : (
        <>
          {/* Overview cards */}
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(branches.length,4)},1fr)`, gap:12, marginBottom:20 }}>
            {branches.map((branch, i) => {
              const d = branchData[branch.id]||{};
              const revShare = totalRev > 0 ? Math.round(d.revenue/totalRev*100) : 0;
              return (
                <div key={branch.id} style={{ background:T.srf, border:`2px solid ${COLORS[i%COLORS.length]}44`, borderRadius:12, padding:18 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:COLORS[i%COLORS.length] }}/>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{branch.name}</div>
                    {branch.is_main&&<span style={{ background:T.blue+'22', color:T.blue, borderRadius:4, padding:'1px 6px', fontSize:9, fontWeight:700 }}>MAIN</span>}
                  </div>
                  {[
                    ['Revenue', fmt(d.revenue||0), T.green],
                    ['Profit', fmt(d.profit||0), d.profit>=0?T.green:T.red],
                    ['Orders', d.orders||0, T.blue],
                    ['Avg Order', fmt(d.avgOrder||0), T.sub],
                  ].map(([label,val,color])=>(
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12 }}>
                      <span style={{ color:T.muted }}>{label}</span><span style={{ color, fontWeight:600 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:10, color:T.sub, marginBottom:4 }}>Revenue share</div>
                    <div style={{ height:5, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${revShare}%`, background:COLORS[i%COLORS.length], borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:10, color:COLORS[i%COLORS.length], marginTop:2, fontWeight:700 }}>{revShare}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison chart */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontWeight:700, color:T.ink }}>Branch Comparison</div>
              <div style={{ display:'flex', gap:6 }}>
                {METRICS.map(m=>(
                  <button key={m.id} onClick={()=>setMetric(m.id)} style={{ background:metric===m.id?T.blue:T.card, color:metric===m.id?'#fff':T.sub, border:`1px solid ${metric===m.id?T.blue:T.bdr}`, borderRadius:6, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{m.label}</button>
                ))}
              </div>
            </div>
            <MiniBarChart data={chartData} maxVal={maxVal}/>
            <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
              {branches.map((b,i)=>(
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i%COLORS.length] }}/>
                  <span style={{ fontSize:11, color:T.sub }}>{b.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed comparison table */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Detailed Comparison</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                <th style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>Metric</th>
                {branches.map((b,i)=>(
                  <th key={b.id} style={{ padding:'9px 14px', textAlign:'right', fontSize:10, color:COLORS[i%COLORS.length], fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{b.name.split(' ').slice(-1)[0]}</th>
                ))}
                <th style={{ padding:'9px 14px', textAlign:'right', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>TOTAL</th>
              </tr></thead>
              <tbody>
                {[
                  ['Revenue', d=>fmt(d.revenue), d=>d.revenue, T.green],
                  ['Orders', d=>d.orders, d=>d.orders, T.blue],
                  ['Avg Order', d=>fmt(d.avgOrder), d=>d.avgOrder, T.sub],
                  ['GST Collected', d=>fmt(d.gst), d=>d.gst, T.amber],
                  ['Expenses', d=>fmt(d.expTotal), d=>d.expTotal, T.red],
                  ['Profit', d=>fmt(d.profit), d=>d.profit, T.green],
                  ['Low Stock Items', d=>d.lowStock, d=>d.lowStock, T.amber],
                  ['Stock Value', d=>fmt(d.stockVal), d=>d.stockVal, T.blue],
                ].map(([label, display, getValue, color]) => {
                  const total = branches.reduce((s,b)=>s+(getValue(branchData[b.id]||{})||0),0);
                  return (
                    <tr key={label} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'10px 14px', color:T.sub }}>{label}</td>
                      {branches.map(b=>(
                        <td key={b.id} style={{ padding:'10px 14px', textAlign:'right', color, fontWeight:600 }}>{display(branchData[b.id]||{})}</td>
                      ))}
                      <td style={{ padding:'10px 14px', textAlign:'right', color:T.ink, fontWeight:700 }}>{typeof total==='number'&&total>1000?fmt(total):total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
