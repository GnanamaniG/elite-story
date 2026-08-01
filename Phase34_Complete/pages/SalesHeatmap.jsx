import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS = Array.from({length:15},(_,i)=>i+8); // 8am – 10pm

function heatColor(v, max) {
  if (!v || !max) return '#F9FAFB';
  const t = v/max;
  if (t > .8) return '#8B0000';
  if (t > .6) return '#C0392B';
  if (t > .4) return '#E57373';
  if (t > .2) return '#F5B7B1';
  return '#FDEDEC';
}

// Radar chart in pure SVG
function Radar({ data, size=260 }) {
  const cx = size/2, cy = size/2, r = size/2 - 42;
  const n = data.length;
  if (!n) return null;
  const max = Math.max(...data.map(d=>d.value), 1);
  const pt = (i, frac) => {
    const a = (Math.PI*2*i/n) - Math.PI/2;
    return [cx + Math.cos(a)*r*frac, cy + Math.sin(a)*r*frac];
  };
  const poly = data.map((d,i)=>pt(i, d.value/max).join(',')).join(' ');
  return (
    <svg width={size} height={size}>
      {[0.25,0.5,0.75,1].map(f=>(
        <polygon key={f} points={data.map((_,i)=>pt(i,f).join(',')).join(' ')}
          fill="none" stroke={T.bdr} strokeWidth="1"/>
      ))}
      {data.map((_,i)=>{ const [x,y]=pt(i,1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.bdr} strokeWidth="1"/>; })}
      <polygon points={poly} fill={T.red+'33'} stroke={T.red} strokeWidth="2"/>
      {data.map((d,i)=>{ const [x,y]=pt(i, d.value/max); return <circle key={i} cx={x} cy={y} r="3.5" fill={T.red}/>; })}
      {data.map((d,i)=>{
        const [x,y] = pt(i, 1.19);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fill={T.sub} fontWeight="600">{d.label.slice(0,11)}</text>;
      })}
    </svg>
  );
}

export default function SalesHeatmap({ tenant }) {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('90');
  const [metric,  setMetric]  = useState('revenue');
  const [hover,   setHover]   = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, period]);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate()-parseInt(period));
    const { data } = await supabase.from('sales')
      .select('total,items,date,created_at')
      .eq('tenant_id', tenant.id)
      .gte('date', since.toISOString().slice(0,10));
    setSales(data||[]);
    setLoading(false);
  }

  // Build hour × day grid
  const grid = {};
  sales.forEach(s => {
    const dt = new Date(s.created_at || s.date);
    const d  = dt.getDay(), h = dt.getHours();
    const k  = `${d}-${h}`;
    if (!grid[k]) grid[k] = { count:0, revenue:0 };
    grid[k].count   += 1;
    grid[k].revenue += s.total || 0;
  });
  const values = Object.values(grid).map(v => v[metric]);
  const maxVal = Math.max(...values, 1);

  // Day totals
  const dayTotals = DAYS.map((_,d) => {
    const rel = Object.entries(grid).filter(([k])=>k.startsWith(d+'-'));
    return { label:DAYS[d], value: rel.reduce((s,[,v])=>s+v[metric],0) };
  });

  // Category radar
  const catMap = {};
  sales.forEach(s => (s.items||[]).forEach(i => {
    const c = i.category || 'Uncategorised';
    catMap[c] = (catMap[c]||0) + ((i.rate||0)*(i.qty||1));
  }));
  const radarData = Object.entries(catMap)
    .sort((a,b)=>b[1]-a[1]).slice(0,7)
    .map(([label,value])=>({ label, value }));

  // Insights
  const busiest = Object.entries(grid).sort((a,b)=>b[1][metric]-a[1][metric])[0];
  const quietest= Object.entries(grid).filter(([,v])=>v.count>0).sort((a,b)=>a[1][metric]-b[1][metric])[0];
  const bestDay = [...dayTotals].sort((a,b)=>b.value-a.value)[0];
  const totalRev= sales.reduce((s,x)=>s+(x.total||0),0);

  const label = k => { const [d,h]=k.split('-'); return `${DAYS[d]} ${h}:00`; };

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🔥 Sales Patterns</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>When your shop is busy, and what sells — staff and stock accordingly</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, overflow:'hidden' }}>
            {[['revenue','Revenue'],['count','Orders']].map(([v,l])=>(
              <button key={v} onClick={()=>setMetric(v)} style={{ padding:'8px 14px', background:metric===v?T.red:'transparent', color:metric===v?T.white:T.sub, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:600 }}>{l}</button>
            ))}
          </div>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
            {[['30','Last 30 days'],['90','Last 90 days'],['180','Last 6 months'],['365','Last year']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Insight strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[
          ['Total Revenue',  fmt(totalRev),                                     T.blue,   '💰'],
          ['Busiest Slot',   busiest ? label(busiest[0]) : '—',                 T.red,    '🔥'],
          ['Best Day',       bestDay?.value ? bestDay.label : '—',              T.green,  '📅'],
          ['Quietest Slot',  quietest ? label(quietest[0]) : '—',               T.muted,  '😴'],
        ].map(([lbl,val,color,icon])=>(
          <div key={lbl} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{lbl}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:18, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:18, alignItems:'flex-start' }}>

        {/* Heatmap */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>Hour × Day Heatmap</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:T.muted }}>
              <span>Quiet</span>
              {['#FDEDEC','#F5B7B1','#E57373','#C0392B','#8B0000'].map(c=>(
                <div key={c} style={{ width:16, height:12, background:c, borderRadius:2 }}/>
              ))}
              <span>Busy</span>
            </div>
          </div>

          {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading sales data…</div>
          :sales.length===0?<div style={{ textAlign:'center', padding:60 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🔥</div>
            <div style={{ color:T.muted, fontWeight:600 }}>No sales in this period</div>
          </div>
          :<div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'separate', borderSpacing:3, margin:'0 auto' }}>
              <thead>
                <tr>
                  <th style={{ width:38 }}/>
                  {HOURS.map(h=>(
                    <th key={h} style={{ fontSize:9, color:T.muted, fontWeight:600, paddingBottom:4, minWidth:30 }}>
                      {h>12?h-12:h}{h>=12?'p':'a'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day,d)=>(
                  <tr key={day}>
                    <td style={{ fontSize:10, color:T.sub, fontWeight:700, textAlign:'right', paddingRight:6 }}>{day}</td>
                    {HOURS.map(h=>{
                      const cell = grid[`${d}-${h}`];
                      const v = cell?.[metric] || 0;
                      const isHover = hover===`${d}-${h}`;
                      return (
                        <td key={h}
                          onMouseEnter={()=>setHover(`${d}-${h}`)} onMouseLeave={()=>setHover(null)}
                          style={{
                            width:30, height:26, background:heatColor(v,maxVal), borderRadius:4,
                            cursor: v?'pointer':'default', position:'relative',
                            border: isHover?`2px solid ${T.ink}`:'2px solid transparent',
                          }}>
                          {isHover&&v>0&&(
                            <div style={{ position:'absolute', bottom:'115%', left:'50%', transform:'translateX(-50%)', background:T.ink, color:'#fff', borderRadius:6, padding:'5px 9px', fontSize:10, whiteSpace:'nowrap', zIndex:20, boxShadow:'0 4px 12px rgba(0,0,0,.25)' }}>
                              <strong>{DAYS[d]} {h}:00</strong><br/>
                              {metric==='revenue'?fmt(v):`${v} orders`}
                              {cell&&<span style={{ opacity:.7 }}> · {cell.count} orders</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}

          {/* Day bars */}
          <div style={{ marginTop:22, paddingTop:16, borderTop:`1px solid ${T.bdr}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>By Day of Week</div>
            {dayTotals.map(d=>{
              const max = Math.max(...dayTotals.map(x=>x.value), 1);
              return (
                <div key={d.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:T.sub, width:32, fontWeight:600 }}>{d.label}</span>
                  <div style={{ flex:1, height:16, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${d.value/max*100}%`, background:d.value===max?T.red:T.blue, borderRadius:4, transition:'width .5s' }}/>
                  </div>
                  <span style={{ fontSize:11, color:T.ink, fontWeight:700, minWidth:70, textAlign:'right' }}>
                    {metric==='revenue'?fmt(d.value):d.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category radar */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.darkRed, marginBottom:4 }}>Category Mix</div>
          <div style={{ fontSize:11, color:T.sub, marginBottom:12 }}>Revenue spread across your top categories</div>
          {radarData.length>0
            ? <>
                <div style={{ display:'flex', justifyContent:'center' }}><Radar data={radarData}/></div>
                <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.bdr}` }}>
                  {radarData.map((d,i)=>(
                    <div key={d.label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:11 }}>
                      <span style={{ color:T.sub }}>{i+1}. {d.label}</span>
                      <span style={{ color:T.red, fontWeight:700 }}>{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            : <div style={{ textAlign:'center', padding:'50px 10px', color:T.muted }}>
                <div style={{ fontSize:30, marginBottom:8 }}>📊</div>
                <div style={{ fontSize:12, fontWeight:600 }}>No category data</div>
                <div style={{ fontSize:11, marginTop:4 }}>Assign categories to products to see this chart</div>
              </div>}
        </div>
      </div>

      {busiest&&(
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 20px', marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>💡 What this tells you</div>
          <div style={{ fontSize:12, color:T.sub, lineHeight:1.7 }}>
            Your peak trading slot is <strong style={{ color:T.red }}>{label(busiest[0])}</strong> — make sure your best staff are on the floor then.
            {bestDay&&<> <strong style={{ color:T.green }}>{bestDay.label}</strong> is your strongest day overall, so schedule deliveries and stock-taking away from it.</>}
            {quietest&&<> The <strong>{label(quietest[0])}</strong> slot is quietest — good for restocking, cleaning or staff breaks.</>}
          </div>
        </div>
      )}
    </div>
  );
}
