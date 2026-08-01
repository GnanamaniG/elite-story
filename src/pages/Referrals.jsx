import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function Referrals({ tenant }) {
  const [referrals,  setReferrals]  = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [saving,     setSaving]     = useState(false);
  const [rewardType, setRewardType] = useState('points');
  const [rewardVal,  setRewardVal]  = useState('100');
  const [selCust,    setSelCust]    = useState('');
  const [refName,    setRefName]    = useState('');
  const [refPhone,   setRefPhone]   = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [refRes, custRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setReferrals(refRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function genCode(name) {
    const clean = name.replace(/[^A-Z]/gi,'').toUpperCase().slice(0,4).padEnd(4,'X');
    return clean + String(Date.now()).slice(-4);
  }

  async function createReferral(e) {
    e.preventDefault();
    const cust = customers.find(c=>c.id===selCust);
    if (!cust||!refName) return;
    setSaving(true);
    const ref_code = genCode(cust.name);
    await supabase.from('referrals').insert({ tenant_id:tenant.id, referrer_id:selCust, referrer:cust.name, referee_name:refName, referee_phone:refPhone, ref_code, reward_type:rewardType, reward_value:parseFloat(rewardVal)||0, status:'pending' });
    setShowForm(false); setSelCust(''); setRefName(''); setRefPhone('');
    setSaving(false); await load();
  }

  async function markConverted(ref) {
    await supabase.from('referrals').update({ status:'converted', converted_at:new Date().toISOString() }).eq('id', ref.id);
    setReferrals(prev=>prev.map(r=>r.id===ref.id?{...r,status:'converted',converted_at:new Date().toISOString()}:r));
  }

  async function rewardReferrer(ref) {
    if (ref.reward_type==='points' && ref.referrer_id) {
      const cust = customers.find(c=>c.id===ref.referrer_id);
      if (cust) {
        await supabase.from('customers').update({ loyalty_points:(cust.loyalty_points||0)+ref.reward_value }).eq('id', ref.referrer_id);
        await supabase.from('loyalty_txns').insert({ tenant_id:tenant.id, customer_id:ref.referrer_id, type:'earn', points:ref.reward_value, notes:`Referral reward for ${ref.referee_name}` });
      }
    }
    await supabase.from('referrals').update({ status:'rewarded' }).eq('id', ref.id);
    setReferrals(prev=>prev.map(r=>r.id===ref.id?{...r,status:'rewarded'}:r));
    alert(`✅ Reward of ${ref.reward_type==='points'?ref.reward_value+' points':fmt(ref.reward_value)} given to ${ref.referrer}!`);
  }

  function sendRefLink(ref) {
    const cust = customers.find(c=>c.id===ref.referrer_id);
    const msg = `Hi ${ref.referee_name}! 👋\n\n${ref.referrer} has referred you to *${tenant?.name||'Elite Store'}*!\n\n🎁 Use code *${ref.ref_code}* to get a special discount on your first purchase.\n\n📍 Visit us and mention this code at checkout!\n\nLooking forward to seeing you! 🛍️`;
    const ph = (ref.referee_phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function sendReferrerCode(ref) {
    const cust = customers.find(c=>c.id===ref.referrer_id);
    const msg = `Hi ${ref.referrer}! 🙏\n\nThank you for referring *${ref.referee_name}* to *${tenant?.name||'Elite Store'}*!\n\n📋 Your referral code: *${ref.ref_code}*\n\nWhen ${ref.referee_name} makes their first purchase using this code, you'll earn:\n🎁 ${ref.reward_type==='points'?ref.reward_value+' loyalty points':fmt(ref.reward_value)+' reward'}\n\nKeep referring and keep earning! 💰`;
    const ph = (cust?.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const STATUS_COLORS = { pending:T.amber, converted:T.blue, rewarded:T.green, expired:T.red };
  const displayed = filter==='all'?referrals:referrals.filter(r=>r.status===filter);
  const totalConverted = referrals.filter(r=>r.status!=='pending'&&r.status!=='expired').length;
  const convRate = referrals.length>0?Math.round(totalConverted/referrals.length*100):0;
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔗 Customer Referrals</div>
          <div style={{ fontSize:13, color:T.sub }}>{referrals.length} referrals · {convRate}% conversion rate</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Create Referral</button>
      </div>

      {/* Referral program box */}
      <div style={{ background:`linear-gradient(135deg,${T.purple}22,${T.blue}22)`, border:`1px solid ${T.purple}44`, borderRadius:12, padding:18, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:8 }}>🎁 Referral Program Setup</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          <div style={{ background:T.card, borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, marginBottom:3 }}>DEFAULT REWARD</div>
            <div style={{ display:'flex', gap:6 }}>
              <select value={rewardType} onChange={e=>setRewardType(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'5px 8px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                <option value="points">Points</option><option value="discount">Discount</option><option value="cash">Cash</option>
              </select>
              <input type="number" value={rewardVal} onChange={e=>setRewardVal(e.target.value)} style={{ width:70, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'5px 8px', color:T.amber, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center', fontWeight:700 }}/>
            </div>
          </div>
          {[['Total Referrals',referrals.length,T.blue],['Conversion Rate',convRate+'%',convRate>=30?T.green:T.amber]].map(([label,val,color])=>(
            <div key={label} style={{ background:T.card, borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {['pending','converted','rewarded','expired'].map(s=>(
          <div key={s} onClick={()=>setFilter(filter===s?'all':s)} style={{ background:T.srf, border:`1px solid ${filter===s?STATUS_COLORS[s]:T.bdr}`, borderRadius:9, padding:'10px 14px', cursor:'pointer' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{s}</div>
            <div style={{ fontSize:20, fontWeight:800, color:STATUS_COLORS[s] }}>{referrals.filter(r=>r.status===s).length}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Referrer','Referee','Code','Reward','Status','Date','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No referrals yet</td></tr>
            :displayed.map(r=>(
              <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{r.referrer}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{r.referee_name}<br/><span style={{ fontSize:10, color:T.muted }}>{r.referee_phone}</span></td>
                <td style={{ padding:'10px 14px', color:T.purple, fontFamily:'monospace', fontWeight:700, letterSpacing:1 }}>{r.ref_code}</td>
                <td style={{ padding:'10px 14px', color:T.amber, fontWeight:600 }}>{r.reward_type==='points'?r.reward_value+' pts':fmt(r.reward_value)}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[r.status]+'22', color:STATUS_COLORS[r.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.status}</span></td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{r.created_at?.slice(0,10)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {r.referee_phone&&<button onClick={()=>sendRefLink(r)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>}
                    <button onClick={()=>sendReferrerCode(r)} style={{ background:T.purple+'22', color:T.purple, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>📋</button>
                    {r.status==='pending'&&<button onClick={()=>markConverted(r)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Convert</button>}
                    {r.status==='converted'&&<button onClick={()=>rewardReferrer(r)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🎁 Reward</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Create Referral</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createReferral}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referring Customer *</label>
                <select value={selCust} onChange={e=>setSelCust(e.target.value)} required style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select customer…</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?' · '+c.phone:''}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referred Person Name *</label>
                <input value={refName} onChange={e=>setRefName(e.target.value)} placeholder="Friend/family name" required style={inp}/>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referred Person Phone</label>
                <input value={refPhone} onChange={e=>setRefPhone(e.target.value)} placeholder="10-digit number" type="tel" style={inp}/>
              </div>
              <div style={{ background:T.card, borderRadius:9, padding:12, marginBottom:16 }}>
                <div style={{ fontSize:11, color:T.sub, marginBottom:6, fontWeight:700, textTransform:'uppercase' }}>Referrer Reward</div>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={rewardType} onChange={e=>setRewardType(e.target.value)} style={{ flex:1, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                    <option value="points">Loyalty Points</option><option value="discount">Discount Amount</option><option value="cash">Cash Reward</option>
                  </select>
                  <input type="number" value={rewardVal} onChange={e=>setRewardVal(e.target.value)} style={{ width:90, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 10px', color:T.amber, fontSize:14, fontFamily:'inherit', outline:'none', textAlign:'center', fontWeight:700 }}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Creating…':'Create Referral'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
