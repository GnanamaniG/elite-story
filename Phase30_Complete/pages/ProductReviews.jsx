import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const Stars = ({ rating, size=16 }) => (
  <div style={{ display:'flex', gap:2 }}>
    {[1,2,3,4,5].map(i=><span key={i} style={{ fontSize:size, color:i<=rating?'#F59E0B':'#E5E7EB' }}>★</span>)}
  </div>
);

const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function ProductReviews({ tenant }) {
  const [reviews,   setReviews]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [replyId,   setReplyId]   = useState(null);
  const [replyText, setReplyText] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [form, setForm] = useState({ customer:'', phone:'', item_name:'', item_id:'', rating:5, review:'', source:'manual' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [rRes, invRes, custRes] = await Promise.all([
      supabase.from('product_reviews').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('inventory').select('id,name').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setReviews(rRes.data||[]);
    setInventory(invRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  async function saveReview(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('product_reviews').insert({ ...form, tenant_id:tenant.id, rating:parseInt(form.rating) });
    setShowForm(false);
    setForm({ customer:'', phone:'', item_name:'', item_id:'', rating:5, review:'', source:'manual' });
    setSaving(false); await load();
  }

  async function saveReply(id) {
    await supabase.from('product_reviews').update({ reply:replyText }).eq('id', id);
    setReplyId(null); setReplyText('');
    await load();
  }

  function requestReviewWA(cust, item) {
    const msg = `Hi ${cust.name}! 😊\n\nThank you for purchasing from *${tenant?.name||'7SQ'}*!\n\nWe'd love to hear your feedback on:\n👟 *${item}*\n\nPlease rate us:\n⭐ 1 - Poor\n⭐⭐ 2 - Fair\n⭐⭐⭐ 3 - Good\n⭐⭐⭐⭐ 4 - Very Good\n⭐⭐⭐⭐⭐ 5 - Excellent\n\nJust reply with your rating (1-5) and any comments. Thank you! 🙏`;
    const ph = (cust.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const avgRating    = reviews.length>0 ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length).toFixed(1) : 0;
  const ratingCounts = [5,4,3,2,1].map(r=>({ star:r, count:reviews.filter(x=>x.rating===r).length }));
  const displayed    = filter==='all' ? reviews : filter==='no_reply' ? reviews.filter(r=>!r.reply) : reviews.filter(r=>r.rating===parseInt(filter));

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>⭐ Product Reviews</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Collect and manage customer reviews and ratings</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Review</button>
      </div>

      {/* Rating summary */}
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:20, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, padding:'20px 24px', marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ textAlign:'center', paddingRight:20, borderRight:`1px solid ${T.bdr}` }}>
          <div style={{ fontSize:52, fontWeight:900, color:T.amber, letterSpacing:'-0.03em' }}>{avgRating}</div>
          <Stars rating={Math.round(parseFloat(avgRating))} size={20}/>
          <div style={{ fontSize:12, color:T.sub, marginTop:6 }}>{reviews.length} reviews</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:8, paddingLeft:4 }}>
          {ratingCounts.map(({ star, count })=>(
            <div key={star} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:3, width:60 }}>
                <span style={{ fontSize:12, color:T.sub, width:6 }}>{star}</span>
                <span style={{ color:'#F59E0B', fontSize:13 }}>★</span>
              </div>
              <div style={{ flex:1, height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:reviews.length>0?`${count/reviews.length*100}%`:'0%', background:'#F59E0B', borderRadius:4, transition:'width .5s' }}/>
              </div>
              <span style={{ fontSize:11, color:T.sub, width:20, textAlign:'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Request review - quick action */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.darkRed, marginBottom:8 }}>💬 Request Review via WhatsApp</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {customers.filter(c=>c.phone).slice(0,6).map(c=>(
            <button key={c.id} onClick={()=>{ const item = prompt('Product name?'); if(item) requestReviewWA(c, item); }}
              style={{ background:T.bg, color:T.blue, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              💬 {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {[['all','All'],['no_reply','Needs Reply'],['5','⭐⭐⭐⭐⭐'],['4','⭐⭐⭐⭐'],['3','⭐⭐⭐'],['1','⭐ 1-2 Stars']].map(([f,label])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 12px', background:filter===f?T.red:T.white, color:filter===f?T.white:T.sub, border:`1px solid ${filter===f?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {/* Reviews list */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>⭐</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No reviews yet</div>
        </div>
        :displayed.map(r=>(
          <div key={r.id} style={{ background:T.white, border:`1px solid ${r.rating<=2?'#FECACA':T.bdr}`, borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <span style={{ fontWeight:700, color:T.ink }}>{r.customer}</span>
                  {r.verified&&<span style={{ background:'#F0FDF4', color:T.green, border:'1px solid #BBF7D0', borderRadius:5, padding:'1px 7px', fontSize:9, fontWeight:700 }}>✓ Verified</span>}
                  <span style={{ background:T.bg, color:T.muted, borderRadius:5, padding:'1px 7px', fontSize:9, textTransform:'capitalize' }}>{r.source}</span>
                </div>
                <div style={{ fontSize:12, color:T.sub }}>{r.item_name}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <Stars rating={r.rating}/>
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{r.created_at?.slice(0,10)}</div>
              </div>
            </div>
            {r.review&&<div style={{ fontSize:13, color:T.ink, lineHeight:1.6, marginBottom:10, background:T.bg, borderRadius:8, padding:'10px 14px' }}>"{r.review}"</div>}
            {r.reply&&<div style={{ fontSize:12, color:T.blue, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>💬 <strong>Reply:</strong> {r.reply}</div>}
            <div style={{ display:'flex', gap:8 }}>
              {!r.reply&&<button onClick={()=>{ setReplyId(r.id); setReplyText(''); }} style={{ background:'#EFF6FF', color:T.blue, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Reply</button>}
              {r.phone&&<button onClick={()=>{ const msg=`Hi ${r.customer}! Thank you for your ${r.rating}⭐ review! ${r.rating>=4?'We\'re glad you loved it 😊':'We\'re sorry about your experience. Please contact us so we can make it right.'}\n\n— ${tenant?.name||'7SQ'}`; window.open(`https://wa.me/${r.phone.replace(/\D/g,'').replace(/^0/,'91')}?text=${encodeURIComponent(msg)}`,'_blank'); }} style={{ background:'#DCFCE7', color:T.green, border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Thank</button>}
            </div>
            {replyId===r.id&&<div style={{ marginTop:10, display:'flex', gap:8 }}>
              <input value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Type your reply…" style={{ ...inp, flex:1 }}/>
              <button onClick={()=>saveReply(r.id)} style={btn(T.blue, T.white)}>Send</button>
              <button onClick={()=>setReplyId(null)} style={btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` })}>Cancel</button>
            </div>}
          </div>
        ))}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Review</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveReview}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer</label>
                  <select onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setForm(f=>({...f,customer:c.name,phone:c.phone||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Or type name" required style={inp}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Product</label>
                  <select onChange={e=>{const i=inventory.find(x=>x.id===e.target.value);if(i)setForm(f=>({...f,item_id:i.id,item_name:i.name}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select product…</option>
                    {inventory.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value}))} placeholder="Or type product name" required style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Rating *</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} type="button" onClick={()=>setForm(f=>({...f,rating:n}))} style={{ fontSize:28, background:'none', border:'none', cursor:'pointer', color:n<=form.rating?'#F59E0B':'#E5E7EB', transition:'color .1s' }}>★</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Source</label>
                  <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {['whatsapp','in-store','online','manual'].map(s=><option key={s} value={s} style={{ textTransform:'capitalize' }}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Review Text</label><textarea value={form.review} onChange={e=>setForm(f=>({...f,review:e.target.value}))} rows={3} style={{ ...inp, resize:'vertical' }}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Saving…':'⭐ Add Review'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
