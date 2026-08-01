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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const STATUS_COLORS = { pending:T.amber, contacted:T.blue, converted:T.green, rewarded:T.purple, expired:T.red };

export default function Referrals({ tenant }) {
  const [referrals,  setReferrals]  = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [saving,     setSaving]     = useState(false);
  const [settings,   setSettings]   = useState({ reward_type:'points', reward_value:100, referrer_bonus:50 });
  const [form,       setForm]       = useState({ referrer_id:'', referrer:'', referee_name:'', referee_phone:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [refRes, custRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name,phone,loyalty_points').eq('tenant_id', tenant.id).order('name'),
    ]);
    setReferrals(refRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  async function addReferral(e) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('referrals').insert({ ...form, tenant_id:tenant.id, reward_type:settings.reward_type, reward_value:settings.reward_value });
    setShowForm(false); setForm({ referrer_id:'', referrer:'', referee_name:'', referee_phone:'', notes:'' });
    setSaving(false); await load();
  }

  async function updateStatus(id, status) {
    await supabase.from('referrals').update({ status }).eq('id', id);
    setReferrals(prev=>prev.map(r=>r.id===id?{...r,status}:r));
  }

  async function markRewarded(ref) {
    await supabase.from('referrals').update({ status:'rewarded', reward_paid:true }).eq('id', ref.id);
    if (ref.referrer_id && settings.reward_type==='points') {
      const cust = customers.find(c=>c.id===ref.referrer_id);
      if (cust) {
        await supabase.from('customers').update({ loyalty_points:(cust.loyalty_points||0)+settings.referrer_bonus }).eq('id', ref.referrer_id);
        await supabase.from('loyalty_txns').insert({ tenant_id:tenant.id, customer_id:ref.referrer_id, type:'earn', points:settings.referrer_bonus, description:'Referral reward' });
      }
    }
    await load();
  }

  function shareReferralLink(cust) {
    const msg = `Hi ${cust.name}! 🎁\n\nKnow someone who would love *${tenant?.name||'Elite Store'}*?\n\nRefer a friend and earn:\n⭐ *${settings.referrer_bonus} loyalty points* for each successful referral\n🎁 Your friend gets *${settings.reward_type==='points'?settings.reward_value+' pts':fmt(settings.reward_value)+' off'}* on first purchase\n\nJust share our number: ${tenant?.phone||'Contact us'}\nAsk them to mention your name: *${cust.name}*\n\nThank you for spreading the word! 🙏`;
    const ph = (cust.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const displayed   = filter==='all'?referrals:referrals.filter(r=>r.status===filter);
  const totalRewards= referrals.filter(r=>r.reward_paid).length * settings.reward_value;
  const convRate    = referrals.length>0?Math.round(referrals.filter(r=>['converted','rewarded'].includes(r.status)).length/referrals.length*100):0;
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔗 Customer Referrals</div>
          <div style={{ fontSize:13, color:T.sub }}>{referrals.length} referrals · {convRate}% conversion · {fmt(totalRewards)} rewarded</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add Referral</button>
      </div>

      {/* Program settings */}
      <div style={{ background:T.srf, border:`1px solid ${T.blue}44`, borderRadius:12, padding:18, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>⚙️ Referral Program Settings</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, alignItems:'end' }}>
          <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referee Reward</label>
            <div style={{ display:'flex', gap:6 }}>
              <select value={settings.reward_type} onChange={e=>setSettings(s=>({...s,reward_type:e.target.value}))} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                {['points','discount','cash'].map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
              <input type="number" value={settings.reward_value} onChange={e=>setSettings(s=>({...s,reward_value:parseFloat(e.target.value)||0}))} style={{ width:80, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 10px', color:T.green, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
            </div>
          </div>
          <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referrer Bonus Points</label><input type="number" value={settings.referrer_bonus} onChange={e=>setSettings(s=>({...s,referrer_bonus:parseFloat(e.target.value)||0}))} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color:T.amber, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', textAlign:'center' }}/></div>
          <div style={{ background:T.blue+'12', borderRadius:9, padding:'10px 14px', fontSize:12, color:T.blue }}>
            📊 Referrer earns <strong>{settings.referrer_bonus} pts</strong> · Referee gets <strong>{settings.reward_type==='points'?settings.reward_value+' pts':fmt(settings.reward_value)+' off'}</strong> on first purchase
          </div>
        </div>
      </div>

      {/* Quick share for top customers */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:8 }}>💬 Quick Share — Send referral invite to customer</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {customers.filter(c=>c.phone).slice(0,6).map(c=>(
            <button key={c.id} onClick={()=>shareReferralLink(c)} style={{ background:T.card, color:T.teal, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>💬 {c.name}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
        {['pending','contacted','converted','rewarded','expired'].map(s=>(
          <div key={s} onClick={()=>setFilter(s===filter?'all':s)} style={{ background:T.srf, border:`1px solid ${filter===s?STATUS_COLORS[s]:T.bdr}`, borderRadius:9, padding:'10px 12px', cursor:'pointer' }}>
            <div style={{ fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{s}</div>
            <div style={{ fontSize:18, fontWeight:800, color:STATUS_COLORS[s] }}>{referrals.filter(r=>r.status===s).length}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Referred By','Referred Person','Phone','Reward','Status','Date','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No referrals yet. Start your referral program!</td></tr>
            :displayed.map(r=>(
              <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.blue, fontWeight:600 }}>{r.referrer}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{r.referee_name}</td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{r.referee_phone||'—'}</td>
                <td style={{ padding:'10px 14px', color:T.green }}>{r.reward_type==='points'?r.reward_value+' pts':fmt(r.reward_value)}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:(STATUS_COLORS[r.status]||T.muted)+'22', color:STATUS_COLORS[r.status]||T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.status}</span></td>
                <td style={{ padding:'10px 14px', color:T.muted, fontSize:11 }}>{r.created_at?.slice(0,10)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {r.status==='pending'&&<button onClick={()=>updateStatus(r.id,'contacted')} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Contacted</button>}
                    {r.status==='contacted'&&<button onClick={()=>updateStatus(r.id,'converted')} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Converted ✓</button>}
                    {r.status==='converted'&&!r.reward_paid&&<button onClick={()=>markRewarded(r)} style={{ background:T.purple+'22', color:T.purple, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🎁 Reward</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Referral</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={addReferral}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Referred By (existing customer)</label>
                <select value={form.referrer_id} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setForm(f=>({...f,referrer_id:e.target.value,referrer:c?.name||''}));}} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select customer…</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input value={form.referrer} onChange={e=>setForm(f=>({...f,referrer:e.target.value}))} placeholder="Or type referrer name" style={{ ...inp, marginTop:6 }} required/>
              </div>
              {[['Referred Person *','text','referee_name'],['Referred Phone','tel','referee_phone'],['Notes','text','notes']].map(([label,type,key])=>(
                <div key={key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} style={inp}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Add Referral'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
