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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const SEGMENTS = [
  { id:'vip',     label:'⭐ VIP',      color:T.amber,  desc:'Top 10% by lifetime spend' },
  { id:'loyal',   label:'💙 Loyal',    color:T.blue,   desc:'5+ purchases, recent activity' },
  { id:'new',     label:'🌱 New',      color:T.green,  desc:'First purchase in last 30 days' },
  { id:'dormant', label:'😴 Dormant',  color:T.red,    desc:'No purchase in 90+ days' },
  { id:'regular', label:'👤 Regular',  color:T.sub,    desc:'All other customers' },
];

function assignSegment(customer, allCustomers) {
  const daysSince = customer.last_purchase
    ? Math.floor((Date.now() - new Date(customer.last_purchase)) / 86400000) : 9999;
  const totalSpent  = customer.total_spent || 0;
  const purchCount  = customer.purchase_count || 0;
  const sortedSpend = [...allCustomers].sort((a,b)=>(b.total_spent||0)-(a.total_spent||0));
  const topTen      = sortedSpend.slice(0, Math.max(1, Math.ceil(sortedSpend.length*0.1)));

  if (topTen.some(c=>c.id===customer.id) && totalSpent > 0) return 'vip';
  if (daysSince > 90 && purchCount > 0) return 'dormant';
  if (daysSince <= 30 && purchCount <= 2) return 'new';
  if (purchCount >= 5 && daysSince <= 60) return 'loyal';
  return 'regular';
}

export default function CustomerSegments({ tenant }) {
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [running,    setRunning]    = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [lastRun,    setLastRun]    = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('total_spent', { ascending:false });
    setCustomers(data || []);
    setLoading(false);
  }

  async function runSegmentation() {
    setRunning(true);
    const { data: sales } = await supabase.from('sales').select('customer_id,total,date').eq('tenant_id', tenant.id).eq('status','paid').not('customer_id','is',null);

    // Compute stats per customer
    const stats = {};
    (sales||[]).forEach(s => {
      if (!s.customer_id) return;
      if (!stats[s.customer_id]) stats[s.customer_id] = { total_spent:0, purchase_count:0, last_purchase:null };
      stats[s.customer_id].total_spent    += s.total||0;
      stats[s.customer_id].purchase_count += 1;
      if (!stats[s.customer_id].last_purchase || s.date > stats[s.customer_id].last_purchase)
        stats[s.customer_id].last_purchase = s.date;
    });

    const updatedCusts = customers.map(c => ({
      ...c,
      total_spent:    stats[c.id]?.total_spent    || c.total_spent    || 0,
      purchase_count: stats[c.id]?.purchase_count || c.purchase_count || 0,
      last_purchase:  stats[c.id]?.last_purchase  || c.last_purchase  || null,
    }));

    // Assign segments
    const withSegments = updatedCusts.map(c => ({ ...c, segment: assignSegment(c, updatedCusts) }));

    // Save back to DB in batches
    for (const c of withSegments) {
      await supabase.from('customers').update({
        segment:        c.segment,
        total_spent:    c.total_spent,
        purchase_count: c.purchase_count,
        last_purchase:  c.last_purchase,
      }).eq('id', c.id);
    }

    setCustomers(withSegments);
    setLastRun(new Date().toLocaleTimeString('en-IN'));
    setRunning(false);
  }

  function sendBroadcast(segment) {
    const seg     = SEGMENTS.find(s => s.id === segment);
    const targets = customers.filter(c => c.segment === segment && c.phone);
    if (!targets.length) return alert('No customers with phone numbers in this segment');
    const msg = segment === 'dormant'
      ? `Hi! We miss you at ${tenant?.name||'Elite Store'}! 🛍️\n\nIt's been a while since your last visit. Come in and check out our latest collection!\n\nSpecial discount just for you. 💝`
      : segment === 'vip'
      ? `Dear VIP Customer! ⭐\n\nThank you for being our top customer at ${tenant?.name||'Elite Store'}.\n\nYou have exclusive access to our new arrivals before anyone else! 🎁`
      : `Hi from ${tenant?.name||'Elite Store'}! 👋\n\nCheck out our latest products and offers. We'd love to see you again! 🛍️`;
    const first = targets[0];
    const ph    = (first.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const segmentCounts = SEGMENTS.reduce((acc, s) => {
    acc[s.id] = customers.filter(c => c.segment === s.id).length;
    return acc;
  }, {});

  const displayed = customers.filter(c => {
    const matchSeg = filter === 'all' || c.segment === filter;
    const matchSrc = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchSeg && matchSrc;
  });

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Customer Segments</div>
          <div style={{ fontSize:13, color:T.sub }}>{customers.length} customers · {lastRun?`Last run: ${lastRun}`:'Run segmentation to auto-tag customers'}</div>
        </div>
        <button onClick={runSegmentation} disabled={running} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {running ? '⚙️ Running…' : '⚡ Run Auto-Segmentation'}
        </button>
      </div>

      {/* Segment cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {SEGMENTS.map(seg => (
          <div key={seg.id} onClick={() => setFilter(filter===seg.id?'all':seg.id)}
            style={{ background:filter===seg.id?seg.color+'22':T.srf, border:`1px solid ${filter===seg.id?seg.color:T.bdr}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all .15s' }}>
            <div style={{ fontSize:20, fontWeight:800, color:seg.color, marginBottom:4 }}>{segmentCounts[seg.id]||0}</div>
            <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{seg.label}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:3, lineHeight:1.4 }}>{seg.desc}</div>
            <button onClick={e=>{e.stopPropagation();sendBroadcast(seg.id);}} style={{ background:seg.color+'22', color:seg.color, border:'none', borderRadius:6, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:8 }}>
              💬 Broadcast
            </button>
          </div>
        ))}
      </div>

      {/* Customer table */}
      <div style={{ marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search customers…"
          style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.card }}>
              {['Customer','Phone','Segment','Total Spent','Purchases','Last Purchase','Outstanding'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            : displayed.length===0 ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No customers found</td></tr>
            : displayed.map(c => {
              const seg = SEGMENTS.find(s=>s.id===(c.segment||'regular'));
              const daysSince = c.last_purchase ? Math.floor((Date.now()-new Date(c.last_purchase))/86400000) : null;
              return (
                <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{c.name}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{c.phone||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:(seg?.color||T.sub)+'22', color:seg?.color||T.sub, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{seg?.label||'Regular'}</span>
                  </td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(c.total_spent||0)}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{c.purchase_count||0}</td>
                  <td style={{ padding:'10px 14px', color: daysSince>90?T.red:daysSince>30?T.amber:T.green }}>
                    {c.last_purchase ? `${daysSince}d ago` : 'Never'}
                  </td>
                  <td style={{ padding:'10px 14px', color:(c.outstanding||0)>0?T.red:T.muted }}>{fmt(c.outstanding||0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
