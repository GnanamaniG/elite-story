import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });

// 11 standard RFM segments
const SEGMENTS = {
  champions:      { label:'Champions',          icon:'🏆', color:'#16A34A', bg:'#F0FDF4', desc:'Bought recently, buy often, spend most', action:'Reward them. Early access to new stock.' },
  loyal:          { label:'Loyal Customers',    icon:'💚', color:'#16A34A', bg:'#F0FDF4', desc:'Buy regularly, good spend',              action:'Upsell higher-value items. Ask for referrals.' },
  potential:      { label:'Potential Loyalist', icon:'🌱', color:'#2563EB', bg:'#EFF6FF', desc:'Recent buyers, decent frequency',        action:'Offer membership or loyalty tier.' },
  new:            { label:'New Customers',      icon:'✨', color:'#2563EB', bg:'#EFF6FF', desc:'Bought very recently, only once',        action:'Onboard well. Build the second purchase.' },
  promising:      { label:'Promising',          icon:'🔮', color:'#7C3AED', bg:'#F5F3FF', desc:'Recent, low spend so far',               action:'Free shipping or small incentive to return.' },
  need_attention: { label:'Need Attention',     icon:'⚠️', color:'#D97706', bg:'#FFFBEB', desc:'Above average but slipping',             action:'Limited-time offer. Reconnect personally.' },
  about_to_sleep: { label:'About to Sleep',     icon:'😴', color:'#D97706', bg:'#FFFBEB', desc:'Below average recency and frequency',    action:'Share popular items. Win-back discount.' },
  at_risk:        { label:'At Risk',            icon:'🚨', color:'#C0392B', bg:'#FEF2F2', desc:'Spent big, but long time ago',           action:'Personalised call. Strong offer.' },
  cant_lose:      { label:"Can't Lose Them",    icon:'💔', color:'#C0392B', bg:'#FEF2F2', desc:'Best customers who stopped coming',      action:'Win back at any cost. Talk to them directly.' },
  hibernating:    { label:'Hibernating',        icon:'🐻', color:'#6B7280', bg:'#F9FAFB', desc:'Low spend, low frequency, long ago',     action:'Standard win-back campaign.' },
  lost:           { label:'Lost',               icon:'👻', color:'#6B7280', bg:'#F9FAFB', desc:'Lowest scores across the board',         action:'Low priority. Broad campaigns only.' },
};

function segmentOf(r, f, m) {
  if (r>=4 && f>=4)                 return 'champions';
  if (r>=3 && f>=3 && m>=3)         return 'loyal';
  if (r>=4 && f<=2 && m<=2)         return 'new';
  if (r>=3 && f>=2)                 return 'potential';
  if (r>=3)                         return 'promising';
  if (r===2 && f>=3)                return 'need_attention';
  if (r===2)                        return 'about_to_sleep';
  if (r<=2 && f>=4 && m>=4)         return 'cant_lose';
  if (r<=2 && f>=3)                 return 'at_risk';
  if (r<=1 && f<=2 && m<=2)         return 'lost';
  return 'hibernating';
}

function quintile(value, sorted, invert=false) {
  if (!sorted.length) return 3;
  const idx = sorted.findIndex(v => v >= value);
  const pos = idx < 0 ? sorted.length-1 : idx;
  const pct = pos / Math.max(1, sorted.length-1);
  const score = Math.min(5, Math.max(1, Math.ceil(pct*5) || 1));
  return invert ? 6-score : score;
}

export default function RFMAnalysis({ tenant }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('monetary');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [custRes, salesRes] = await Promise.all([
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id),
      supabase.from('sales').select('customer,customer_id,total,date').eq('tenant_id', tenant.id),
    ]);
    const customers = custRes.data || [];
    const sales     = salesRes.data || [];
    const today     = new Date();

    // Aggregate per customer
    const agg = {};
    sales.forEach(s => {
      const k = s.customer_id || s.customer;
      if (!k) return;
      if (!agg[k]) agg[k] = { count:0, total:0, last:s.date, first:s.date, name:s.customer };
      agg[k].count += 1;
      agg[k].total += s.total || 0;
      if (s.date > agg[k].last)  agg[k].last  = s.date;
      if (s.date < agg[k].first) agg[k].first = s.date;
    });

    const base = Object.entries(agg).map(([k,v]) => {
      const cust = customers.find(c=>c.id===k) || customers.find(c=>c.name===v.name);
      return {
        id: k, name: cust?.name || v.name || 'Unknown', phone: cust?.phone || '',
        recencyDays: Math.floor((today - new Date(v.last))/86400000),
        frequency: v.count,
        monetary: v.total,
        lastPurchase: v.last, firstPurchase: v.first,
        avgOrder: v.total / v.count,
      };
    });

    // Score against distribution
    const rSorted = [...base].map(b=>b.recencyDays).sort((a,b)=>a-b);
    const fSorted = [...base].map(b=>b.frequency).sort((a,b)=>a-b);
    const mSorted = [...base].map(b=>b.monetary).sort((a,b)=>a-b);

    const scored = base.map(b => {
      const R = quintile(b.recencyDays, rSorted, true); // lower days = better
      const F = quintile(b.frequency,   fSorted);
      const M = quintile(b.monetary,    mSorted);
      return { ...b, R, F, M, rfm:`${R}${F}${M}`, segment: segmentOf(R,F,M) };
    });

    setRows(scored);
    setLoading(false);
  }

  function sendOffer(c) {
    const seg = SEGMENTS[c.segment];
    const msgs = {
      champions:   `Hi ${c.name}! 🏆\n\nYou're one of our most valued customers at ${tenant?.name||'7SQ'}!\n\nAs a thank you, you get *early access* to our new arrivals before anyone else.\n\nCome by whenever — we always have something special for you! 🙏`,
      cant_lose:   `Hi ${c.name}! 💔\n\nWe've really missed you at ${tenant?.name||'7SQ'}.\n\nYou were one of our best customers and we'd love to see you again. Is there anything we could have done better?\n\nPlease accept a *special discount* on your next visit — just show this message. 🙏`,
      at_risk:     `Hi ${c.name}! 👋\n\nIt's been a while since your last visit to ${tenant?.name||'7SQ'}.\n\nWe have new stock you might like, and a *special offer* waiting for you.\n\nHope to see you soon! 🛍️`,
      new:         `Hi ${c.name}! ✨\n\nThank you for shopping with ${tenant?.name||'7SQ'}!\n\nWe hope you loved your purchase. Come back soon — as a new customer you get a *welcome discount* on your next visit! 🎁`,
    };
    const msg = msgs[c.segment] || `Hi ${c.name}! 👋\n\nWe have exciting new arrivals at ${tenant?.name||'7SQ'}.\n\nDo visit us soon — there's something special waiting for you! 🛍️`;
    const ph = (c.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const counts = Object.keys(SEGMENTS).reduce((a,k)=>({ ...a, [k]: rows.filter(r=>r.segment===k).length }), {});
  const displayed = rows
    .filter(r => filter==='all' || r.segment===filter)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=> sortBy==='monetary' ? b.monetary-a.monetary
                : sortBy==='frequency'? b.frequency-a.frequency
                : sortBy==='recency'  ? a.recencyDays-b.recencyDays
                : b.rfm.localeCompare(a.rfm));

  const totalValue = rows.reduce((s,r)=>s+r.monetary,0);
  const atRiskValue= rows.filter(r=>['at_risk','cant_lose'].includes(r.segment)).reduce((s,r)=>s+r.monetary,0);
  const topValue   = rows.filter(r=>['champions','loyal'].includes(r.segment)).reduce((s,r)=>s+r.monetary,0);

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🎯 RFM Segmentation</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Recency · Frequency · Monetary scoring across 11 behavioural segments</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer…"
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:170 }}/>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 10px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none' }}>
            {[['monetary','Sort: Value'],['frequency','Sort: Frequency'],['recency','Sort: Recency'],['rfm','Sort: RFM Score']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={load} style={btn(T.red, T.white)}>↻ Recalculate</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[
          ['Customers Analysed', rows.length,                                    T.blue,   '👥'],
          ['Champions + Loyal',  counts.champions+counts.loyal,                  T.green,  '🏆'],
          ['At Risk Value',      fmt(atRiskValue),                               T.red,    '🚨'],
          ['Top Segment Value',  fmt(topValue),                                  T.purple, '💰'],
        ].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Segment cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:11, marginBottom:20 }}>
        {Object.entries(SEGMENTS).filter(([k])=>counts[k]>0).map(([k,s])=>{
          const segValue = rows.filter(r=>r.segment===k).reduce((sum,r)=>sum+r.monetary,0);
          const active = filter===k;
          return (
            <div key={k} onClick={()=>setFilter(active?'all':k)}
              style={{ background:active?s.bg:T.white, border:`2px solid ${active?s.color:T.bdr}`, borderRadius:12, padding:'13px 15px', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:17 }}>{s.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.label}</span>
                </div>
                <span style={{ background:s.color, color:T.white, borderRadius:20, minWidth:22, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, padding:'0 6px' }}>{counts[k]}</span>
              </div>
              <div style={{ fontSize:10, color:T.sub, lineHeight:1.4, marginBottom:6, minHeight:26 }}>{s.desc}</div>
              <div style={{ fontSize:13, fontWeight:800, color:s.color }}>{fmt(segValue)}</div>
            </div>
          );
        })}
      </div>

      {filter!=='all'&&SEGMENTS[filter]&&(
        <div style={{ background:SEGMENTS[filter].bg, border:`1px solid ${SEGMENTS[filter].color}44`, borderRadius:11, padding:'12px 18px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:SEGMENTS[filter].color, marginBottom:3 }}>
            {SEGMENTS[filter].icon} {SEGMENTS[filter].label} — recommended action
          </div>
          <div style={{ fontSize:12, color:T.sub }}>{SEGMENTS[filter].action}</div>
        </div>
      )}

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Customer','Segment','R','F','M','Score','Last Purchase','Orders','Total Spent','Avg Order','Action'].map(h=>(
              <th key={h} style={{ padding:'11px 11px', textAlign:['R','F','M','Score','Orders','Total Spent','Avg Order'].includes(h)?'right':'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={11} style={{ textAlign:'center', padding:50, color:T.muted }}>Calculating RFM scores…</td></tr>
            :displayed.length===0?<tr><td colSpan={11} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🎯</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No customers in this segment</div>
              <div style={{ color:T.muted, fontSize:11, marginTop:4 }}>RFM needs sales history — record a few sales first</div>
            </td></tr>
            :displayed.map(c=>{
              const s = SEGMENTS[c.segment];
              return (
                <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 11px' }}>
                    <div style={{ color:T.ink, fontWeight:700 }}>{c.name}</div>
                    <div style={{ fontSize:10, color:T.muted }}>{c.phone||'No phone'}</div>
                  </td>
                  <td style={{ padding:'10px 11px' }}>
                    <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}33`, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{s.icon} {s.label}</span>
                  </td>
                  {['R','F','M'].map(k=>(
                    <td key={k} style={{ padding:'10px 11px', textAlign:'right' }}>
                      <span style={{ display:'inline-block', width:22, height:22, lineHeight:'22px', borderRadius:6, background:c[k]>=4?'#F0FDF4':c[k]>=3?'#EFF6FF':c[k]>=2?'#FFFBEB':'#FEF2F2', color:c[k]>=4?T.green:c[k]>=3?T.blue:c[k]>=2?T.amber:T.red, fontSize:11, fontWeight:800, textAlign:'center' }}>{c[k]}</span>
                    </td>
                  ))}
                  <td style={{ padding:'10px 11px', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:T.purple }}>{c.rfm}</td>
                  <td style={{ padding:'10px 11px', color:T.sub, fontSize:11 }}>
                    {c.lastPurchase}
                    <div style={{ fontSize:10, color:c.recencyDays>90?T.red:c.recencyDays>30?T.amber:T.green }}>{c.recencyDays}d ago</div>
                  </td>
                  <td style={{ padding:'10px 11px', textAlign:'right', color:T.blue, fontWeight:600 }}>{c.frequency}</td>
                  <td style={{ padding:'10px 11px', textAlign:'right', color:T.red, fontWeight:800 }}>{fmt(c.monetary)}</td>
                  <td style={{ padding:'10px 11px', textAlign:'right', color:T.sub }}>{fmt(c.avgOrder)}</td>
                  <td style={{ padding:'10px 11px' }}>
                    {c.phone&&<button onClick={()=>sendOffer(c)} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Reach out</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
