import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSales } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };

const STAR_LABELS = { 1:'😞 Poor', 2:'😐 Below Average', 3:'🙂 Average', 4:'😊 Good', 5:'🤩 Excellent' };

function StarRating({ rating, size=20 }) {
  return <span style={{ fontSize:size }}>{[1,2,3,4,5].map(s => s<=rating?'⭐':'☆').join('')}</span>;
}

export default function Feedback({ tenant }) {
  const [feedback,  setFeedback]  = useState([]);
  const [recentSales,setRecentSales]=useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState('');
  const [filter,    setFilter]    = useState('all');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [fbRes, sales] = await Promise.all([
      supabase.from('feedback').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      getSales(tenant.id, 50),
    ]);
    setFeedback(fbRes.data||[]);
    setRecentSales(sales.filter(s=>s.customer&&s.customer!=='Walk-in').slice(0,20));
    setLoading(false);
  }

  function genToken() { return Math.random().toString(36).slice(2,10).toUpperCase(); }

  async function sendFeedbackRequest(sale) {
    setSending(sale.id);
    try {
      const token = genToken();
      await supabase.from('feedback').insert({ tenant_id:tenant.id, sale_id:sale.id, customer:sale.customer, customer_id:sale.customer_id, token });
      const feedbackUrl = `${window.location.origin}/feedback/${token}`;
      const msg = `Hi ${sale.customer}! 👋\n\nThank you for shopping at *${tenant?.name||'Elite Store'}*!\n\nYour invoice: *${sale.inv_num}*\nAmount: Rs.${(sale.total||0).toLocaleString('en-IN')}\n\nWe'd love your feedback! Please rate your experience (takes 10 seconds):\n${feedbackUrl}\n\nThank you! 🙏`;
      // Find customer phone
      const { data: cust } = await supabase.from('customers').select('phone').eq('id', sale.customer_id).single();
      const phone = (cust?.phone||'').replace(/\D/g,'').replace(/^0/,'91');
      window.open(`https://wa.me/${phone||''}?text=${encodeURIComponent(msg)}`, '_blank');
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSending(''); }
  }

  const avgRating = feedback.filter(f=>f.rating).length > 0
    ? (feedback.filter(f=>f.rating).reduce((s,f)=>s+(f.rating||0),0) / feedback.filter(f=>f.rating).length).toFixed(1)
    : '—';
  const ratingDist = [5,4,3,2,1].map(r=>({ r, count:feedback.filter(f=>f.rating===r).length }));
  const responded  = feedback.filter(f=>f.rating).length;
  const sent       = feedback.length;

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:20 }}>⭐ Customer Feedback</div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Avg Rating', avgRating, T.amber],
          ['Total Sent', sent, T.blue],
          ['Responded', responded, T.green],
          ['Response Rate', sent>0?Math.round(responded/sent*100)+'%':'—', T.purple],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:label==='Avg Rating'?32:22, fontWeight:800, color }}>{val}</div>
            {label==='Avg Rating'&&val!=='—'&&<StarRating rating={Math.round(parseFloat(avgRating))} size={14}/>}
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Rating distribution */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Rating Distribution</div>
          {ratingDist.map(({ r, count }) => (
            <div key={r} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ fontSize:13, width:20, color:T.ink }}>{r}</span>
              <span style={{ fontSize:14 }}>⭐</span>
              <div style={{ flex:1, height:8, background:T.bdr, borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${responded>0?count/responded*100:0}%`, background:r>=4?T.green:r===3?T.amber:T.red, borderRadius:4, transition:'width .5s' }}/>
              </div>
              <span style={{ fontSize:12, color:T.sub, width:20, textAlign:'right' }}>{count}</span>
            </div>
          ))}
          {!responded&&<div style={{ textAlign:'center', color:T.muted, fontSize:12, padding:16 }}>No ratings yet — send requests to customers</div>}
        </div>

        {/* Send requests */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Send Feedback Request</div>
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {recentSales.map(sale => {
              const alreadySent = feedback.some(f=>f.sale_id===sale.id);
              return (
                <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:T.ink }}>{sale.customer}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{sale.inv_num} · Rs.{(sale.total||0).toLocaleString('en-IN')}</div>
                  </div>
                  {alreadySent
                    ? <span style={{ background:T.green+'22', color:T.green, borderRadius:5, padding:'3px 8px', fontSize:10, fontWeight:700 }}>✓ Sent</span>
                    : <button onClick={()=>sendFeedbackRequest(sale)} disabled={sending===sale.id} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        {sending===sale.id?'…':'💬 Request'}
                      </button>}
                </div>
              );
            })}
            {!recentSales.length&&<div style={{ padding:24, textAlign:'center', color:T.muted, fontSize:12 }}>No named customers found in recent sales</div>}
          </div>
        </div>
      </div>

      {/* Feedback list */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginTop:16 }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, color:T.ink }}>All Feedback</div>
          <div style={{ display:'flex', gap:6 }}>
            {['all','responded','pending'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.card, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f}</button>
            ))}
          </div>
        </div>
        {(filter==='all'?feedback:filter==='responded'?feedback.filter(f=>f.rating):feedback.filter(f=>!f.rating)).map(fb=>(
          <div key={fb.id} style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}22`, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:fb.rating?T.amber+'33':T.bdr, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              {fb.rating?'⭐':'⏳'}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{fb.customer||'Unknown'}</div>
              {fb.rating ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                  <StarRating rating={fb.rating} size={12}/>
                  <span style={{ fontSize:11, color:T.sub }}>{STAR_LABELS[fb.rating]}</span>
                </div>
              ) : <div style={{ fontSize:11, color:T.muted }}>Awaiting response…</div>}
              {fb.comment&&<div style={{ fontSize:12, color:T.sub, marginTop:3, fontStyle:'italic' }}>&ldquo;{fb.comment}&rdquo;</div>}
            </div>
            <div style={{ fontSize:10, color:T.muted }}>{new Date(fb.created_at).toLocaleDateString('en-IN')}</div>
          </div>
        ))}
        {!feedback.length&&<div style={{ padding:40, textAlign:'center', color:T.muted, fontSize:12 }}>No feedback yet. Send requests to customers after their purchases.</div>}
      </div>
    </div>
  );
}
