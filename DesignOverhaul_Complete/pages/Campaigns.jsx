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
const STATUS_COLORS = { draft:T.muted, scheduled:T.blue, running:T.amber, completed:T.green, cancelled:T.red };

const TEMPLATES = [
  { name:'Festive Sale',    msg:'🎉 *{store} FESTIVE SALE!*\n\nDear {name},\n\nExclusive deals just for you! Up to *30% OFF* on selected items.\n\n🗓️ Valid this weekend only\n🏪 Visit us or reply to order\n\nHappy Shopping! 🛍️' },
  { name:'New Arrivals',    msg:'🆕 *New Arrivals at {store}!*\n\nHi {name},\n\nWe have exciting new products waiting for you!\n\n✨ Fresh collection\n💰 Best prices\n📦 In stock now\n\nCome check them out! 😊' },
  { name:'Re-engage',       msg:'Hi {name}! 👋\n\nWe miss you at *{store}*!\n\nIt\'s been a while since your last visit. Here\'s a *special 10% discount* just for you.\n\nUse: *COMEBACK10*\n\nSee you soon! 🙏' },
  { name:'Birthday Offer',  msg:'🎂 Happy Birthday, {name}!\n\nWishing you a wonderful day from *{store}*!\n\nCelebrate with a special *15% birthday discount* on your next purchase.\n\nCode: *BDAY15*\n\nEnjoy your day! 🎁' },
  { name:'Payment Reminder',msg:'Hi {name},\n\nThis is a reminder from *{store}* about your outstanding balance.\n\nAmount Due: *Rs.{amount}*\n\nKindly clear at your earliest convenience.\n\nThank you! 🙏' },
];

export default function Campaigns({ tenant }) {
  const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [preview,   setPreview]   = useState({ show:false, campaign:null, contacts:[] });
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({ name:'', type:'whatsapp', message:'', target:'all', scheduled_at:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [campRes, custRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name,phone,segment,total_spent,last_purchase').eq('tenant_id', tenant.id),
    ]);
    setCampaigns(campRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function getTargetContacts(target) {
    if (target==='all')      return customers.filter(c=>c.phone);
    if (target==='vip')      return customers.filter(c=>c.segment==='vip'&&c.phone);
    if (target==='regular')  return customers.filter(c=>c.segment==='regular'&&c.phone);
    if (target==='inactive') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-60);
      return customers.filter(c=>c.phone&&(!c.last_purchase||new Date(c.last_purchase)<cutoff));
    }
    return customers.filter(c=>c.phone);
  }

  function fillMessage(msg, customer) {
    return msg.replace(/\{name\}/g, customer.name||'Valued Customer').replace(/\{store\}/g, tenant?.name||'Elite Store').replace(/\{amount\}/g, customer.outstanding||'0');
  }

  async function saveCampaign(e) {
    e.preventDefault();
    const contacts = getTargetContacts(form.target);
    setSaving(true);
    await supabase.from('campaigns').insert({ ...form, tenant_id:tenant.id, total_contacts:contacts.length, status:form.scheduled_at?'scheduled':'draft' });
    setShowForm(false); setForm({ name:'', type:'whatsapp', message:'', target:'all', scheduled_at:'' });
    setSaving(false); await load();
  }

  async function launchCampaign(camp) {
    const contacts = getTargetContacts(camp.target);
    setPreview({ show:true, campaign:camp, contacts });
  }

  function sendBatch(camp, contacts) {
    // Open WhatsApp for each contact (first 5 to avoid popup blockers)
    contacts.slice(0,5).forEach((c,i) => {
      setTimeout(() => {
        const msg = fillMessage(camp.message, c);
        const ph  = (c.phone||'').replace(/\D/g,'').replace(/^0/,'91');
        window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
      }, i*600);
    });
    supabase.from('campaigns').update({ status:'running', sent_count:contacts.length }).eq('id', camp.id);
    setCampaigns(prev=>prev.map(c=>c.id===camp.id?{...c,status:'running',sent_count:contacts.length}:c));
    setPreview({ show:false, campaign:null, contacts:[] });
    alert(`✅ Opening WhatsApp for first 5 contacts. Continue manually for remaining ${Math.max(0,contacts.length-5)}.`);
  }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📣 Marketing Campaigns</div>
          <div style={{ fontSize:13, color:T.sub }}>{campaigns.length} campaigns · {customers.filter(c=>c.phone).length} reachable customers</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Campaign</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Total',campaigns.length,T.blue],['Draft',campaigns.filter(c=>c.status==='draft').length,T.muted],['Sent',campaigns.filter(c=>['running','completed'].includes(c.status)).length,T.green],['Contacts Reached',campaigns.reduce((s,c)=>s+(c.sent_count||0),0),T.amber]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Campaign','Type','Target','Contacts','Sent','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :campaigns.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No campaigns yet. Create your first campaign!</td></tr>
            :campaigns.map(c=>(
              <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{c.name}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{c.type}</span></td>
                <td style={{ padding:'10px 14px', color:T.sub, textTransform:'capitalize' }}>{c.target}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{c.total_contacts}</td>
                <td style={{ padding:'10px 14px', color:c.sent_count>0?T.green:T.muted }}>{c.sent_count}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:(STATUS_COLORS[c.status]||T.muted)+'22', color:STATUS_COLORS[c.status]||T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{c.status}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {c.status==='draft'&&<button onClick={()=>launchCampaign(c)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🚀 Launch</button>}
                    {['running','completed'].includes(c.status)&&<span style={{ fontSize:10, color:T.green }}>✅ Sent</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:580, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Campaign</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            {/* Quick templates */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Quick Templates</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {TEMPLATES.map(t=><button key={t.name} type="button" onClick={()=>setForm(f=>({...f,name:t.name,message:t.msg}))} style={{ background:T.card, color:T.blue, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{t.name}</button>)}
              </div>
            </div>
            <form onSubmit={saveCampaign}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Campaign Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Channel</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {['whatsapp','sms','email'].map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Target Audience</label>
                  <select value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {[['all','All Customers'],['vip','VIP Only'],['regular','Regular Customers'],['inactive','Inactive (60+ days)']].map(([v,l])=><option key={v} value={v}>{l} ({getTargetContacts(v).length})</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Schedule (optional)</label><input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm(f=>({...f,scheduled_at:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Message * <span style={{ color:T.muted, fontWeight:400 }}>Variables: {'{name}'} {'{store}'} {'{amount}'}</span></label>
                <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={5} required style={{ ...inp, resize:'vertical' }}/>
              </div>
              {/* Preview */}
              {form.message&&<div style={{ background:'#e5ddd5', borderRadius:10, padding:10, marginBottom:14 }}>
                <div style={{ fontSize:10, color:'#666', marginBottom:5 }}>Preview</div>
                <div style={{ background:'#fff', borderRadius:'10px 10px 10px 3px', padding:'9px 12px', maxWidth:'90%' }}>
                  <pre style={{ fontSize:12, color:'#000', fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.5, margin:0 }}>{fillMessage(form.message, { name:'Sample Customer' })}</pre>
                </div>
              </div>}
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Campaign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Launch preview */}
      {preview.show&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:480 }}>
            <div style={{ fontSize:17, fontWeight:700, color:T.ink, marginBottom:14 }}>🚀 Launch Campaign</div>
            <div style={{ background:T.card, borderRadius:9, padding:14, marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                <span style={{ color:T.sub }}>Campaign</span><span style={{ color:T.ink, fontWeight:600 }}>{preview.campaign?.name}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:T.sub }}>Recipients</span><span style={{ color:T.blue, fontWeight:700 }}>{preview.contacts.length} customers</span>
              </div>
            </div>
            <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}33`, borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.amber }}>
              ⚠️ WhatsApp will open for each customer. First 5 will open automatically. Ensure WhatsApp is installed on this device.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setPreview({show:false,campaign:null,contacts:[]})} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={()=>sendBatch(preview.campaign, preview.contacts)} style={{ flex:2, background:'#25d366', color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Send to {preview.contacts.length} Customers</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
