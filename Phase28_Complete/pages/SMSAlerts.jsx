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

const TEMPLATES = {
  order:       (biz,name,total,inv) => `Hi ${name}! Your order ${inv} of Rs.${total} at ${biz} is confirmed. Thank you! -${biz}`,
  payment:     (biz,name,amt)       => `Hi ${name}! Rs.${amt} payment due at ${biz}. Please clear at your earliest. -${biz}`,
  appointment: (biz,name,date,time) => `Hi ${name}! Reminder: Appointment at ${biz} on ${date} at ${time}. -${biz}`,
  promo:       (biz,code,disc)      => `Exclusive offer from ${biz}! Use code ${code} to get ${disc}. Shop now! -${biz}`,
  custom:      ()                   => '',
};

export default function SMSAlerts({ tenant }) {
  const [logs,      setLogs]      = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales,     setSales]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('compose'); // compose | bulk | log
  const [sending,   setSending]   = useState(false);

  // Compose
  const [composeType,  setComposeType]  = useState('order');
  const [composeTo,    setComposeTo]    = useState('');
  const [composeMsg,   setComposeMsg]   = useState('');
  const [selectedSale, setSelectedSale] = useState(null);

  // Bulk
  const [bulkSeg,  setBulkSeg]  = useState('all');
  const [bulkMsg,  setBulkMsg]  = useState('');
  const [bulkPrev, setBulkPrev] = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [logRes, custs, salesData] = await Promise.all([
      supabase.from('sms_log').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(50),
      (await supabase.from('customers').select('*').eq('tenant_id',tenant.id).then(r=>r.data||[])),
      (await supabase.from('sales').select('id,inv_num,total,customer,customer_id,date').eq('tenant_id',tenant.id).order('date',{ascending:false}).limit(50).then(r=>r.data||[])),
    ]);
    setLogs(logRes.data||[]);
    setCustomers(custs);
    setSales(salesData.slice(0,30));
    setLoading(false);
  }

  function buildMessage() {
    const biz  = tenant?.name || 'Elite Store';
    const sale = selectedSale;
    switch(composeType) {
      case 'order':   return TEMPLATES.order(biz, sale?.customer||'Customer', (sale?.total||0).toLocaleString('en-IN'), sale?.inv_num||'');
      case 'payment': {
        const cust = customers.find(c=>c.phone===composeTo);
        return TEMPLATES.payment(biz, cust?.name||'Customer', (cust?.outstanding||0).toLocaleString('en-IN'));
      }
      case 'promo':   return TEMPLATES.promo(biz, 'SAVE10', '10% OFF');
      default:        return composeMsg;
    }
  }

  async function sendSMS(phone, message, type) {
    // In production: call SMS provider API (Fast2SMS, MSG91, Twilio)
    // For now, open WhatsApp as the delivery channel
    const ph = (phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(message)}`, '_blank');
    await supabase.from('sms_log').insert({ tenant_id:tenant.id, phone, message, type, status:'sent', provider:'whatsapp' });
    await load();
  }

  async function sendCompose() {
    if (!composeTo) return alert('Enter recipient phone');
    const msg = buildMessage()||composeMsg;
    if (!msg) return alert('Message is empty');
    setSending(true);
    await sendSMS(composeTo, msg, composeType);
    setSending(false);
    setComposeTo(''); setComposeMsg('');
    alert('✅ Message sent via WhatsApp!');
  }

  async function sendBulk() {
    const targets = bulkSeg==='all'?customers:bulkSeg==='vip'?customers.filter(c=>c.segment==='vip'):bulkSeg==='dormant'?customers.filter(c=>c.segment==='dormant'):customers.filter(c=>c.outstanding>0);
    const withPhone = targets.filter(c=>c.phone);
    if (!withPhone.length) return alert('No customers with phone numbers in this segment');
    if (!bulkMsg) return alert('Enter a message');
    if (!confirm(`Send to ${withPhone.length} customers?`)) return;
    setSending(true);
    const biz = tenant?.name||'Elite Store';
    const msg = bulkMsg.replace('{biz}', biz);
    const first = withPhone[0];
    const ph    = (first.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    // Log bulk
    for (const c of withPhone) {
      await supabase.from('sms_log').insert({ tenant_id:tenant.id, phone:c.phone, message:msg, type:'bulk', status:'sent', provider:'whatsapp' });
    }
    setSending(false); await load();
    alert(`✅ Message queued for ${withPhone.length} customers. Opens one by one via WhatsApp.`);
  }

  const todaySent = logs.filter(l=>l.created_at?.startsWith(new Date().toISOString().slice(0,10))).length;
  const segments  = [['all','All Customers'],['vip','VIP'],['dormant','Dormant'],['outstanding','Has Outstanding']];

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📱 SMS & Message Alerts</div>
          <div style={{ fontSize:13, color:T.sub }}>{logs.length} messages sent · {todaySent} today</div>
        </div>
        <div style={{ background:T.green+'22', border:`1px solid ${T.green}44`, borderRadius:8, padding:'7px 14px', fontSize:12, color:T.green, fontWeight:700 }}>
          💬 Delivered via WhatsApp
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['compose','✍️ Compose'],['bulk','📢 Bulk Send'],['log','📋 Message Log']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {tab === 'compose' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Compose Message</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Message Type</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[['order','🧾 Order Confirm'],['payment','💰 Payment Due'],['promo','🎁 Promotion'],['custom','✍️ Custom']].map(([id,label])=>(
                  <button key={id} onClick={()=>setComposeType(id)} style={{ background:composeType===id?T.blue:T.card, color:composeType===id?'#fff':T.sub, border:`1px solid ${composeType===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 8px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
                ))}
              </div>
            </div>
            {composeType==='order'&&(
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Select Invoice</label>
                <select onChange={e=>{ const s=sales.find(x=>x.id===e.target.value); setSelectedSale(s); setComposeTo(s?.customer_phone||''); }} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:'100%', cursor:'pointer' }}>
                  <option value="">Select invoice…</option>
                  {sales.map(s=><option key={s.id} value={s.id}>{s.inv_num} — {s.customer} — Rs.{(s.total||0).toLocaleString('en-IN')}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Phone Number *</label>
              <input value={composeTo} onChange={e=>setComposeTo(e.target.value)} placeholder="10-digit mobile number" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            </div>
            {composeType==='custom'&&(
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Message *</label>
                <textarea value={composeMsg} onChange={e=>setComposeMsg(e.target.value)} rows={4} placeholder="Type your message…" style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', resize:'vertical' }}/>
              </div>
            )}
            <button onClick={sendCompose} disabled={sending} style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:9, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
              {sending?'Sending…':'💬 Send via WhatsApp'}
            </button>
          </div>

          {/* Preview */}
          <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Message Preview</div>
            <div style={{ background:'#e5ddd5', borderRadius:10, padding:12, minHeight:200 }}>
              <div style={{ background:'#fff', borderRadius:'12px 12px 12px 3px', padding:'10px 14px', maxWidth:'80%', fontSize:13, color:'#000', lineHeight:1.5, boxShadow:'0 1px 2px rgba(0,0,0,.1)' }}>
                {buildMessage()||composeMsg||<span style={{ color:'#999' }}>Select type and fill in details…</span>}
              </div>
            </div>
            <div style={{ fontSize:11, color:T.muted, marginTop:10 }}>
              {(buildMessage()||composeMsg||'').length} characters · Delivers via WhatsApp Business
            </div>
          </div>
        </div>
      )}

      {tab === 'bulk' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Bulk Message Campaign</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Target Segment</label>
              {segments.map(([id,label])=>{
                const count = id==='all'?customers.length:id==='vip'?customers.filter(c=>c.segment==='vip').length:id==='dormant'?customers.filter(c=>c.segment==='dormant').length:customers.filter(c=>c.outstanding>0).length;
                return (
                  <div key={id} onClick={()=>setBulkSeg(id)} style={{ display:'flex', justifyContent:'space-between', padding:'9px 12px', background:bulkSeg===id?T.blue+'22':T.card, border:`1px solid ${bulkSeg===id?T.blue:T.bdr}`, borderRadius:8, cursor:'pointer', marginBottom:6 }}>
                    <span style={{ fontSize:13, color:bulkSeg===id?T.blue:T.ink }}>{label}</span>
                    <span style={{ fontSize:12, color:T.muted }}>{count} customers</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Message (use {'{biz}'} for business name)</label>
              <textarea value={bulkMsg} onChange={e=>setBulkMsg(e.target.value)} rows={5} placeholder={`Hi! Special offer at {biz}. Visit us today for exclusive deals! 🛍️`} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', resize:'vertical' }}/>
            </div>
            <button onClick={sendBulk} disabled={sending||!bulkMsg} style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:9, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
              {sending?'Sending…':'📢 Send Bulk Campaign'}
            </button>
          </div>
          <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>Campaign Preview</div>
            <div style={{ background:'#e5ddd5', borderRadius:10, padding:12, marginBottom:14, minHeight:160 }}>
              <div style={{ background:'#fff', borderRadius:'12px 12px 12px 3px', padding:'10px 14px', maxWidth:'85%', fontSize:13, color:'#000', lineHeight:1.5 }}>
                {bulkMsg.replace('{biz}', tenant?.name||'Elite Store')||<span style={{ color:'#999' }}>Type your message above…</span>}
              </div>
            </div>
            <div style={{ background:T.srf, borderRadius:8, padding:'10px 14px', fontSize:12, color:T.sub }}>
              Will send to <strong style={{ color:T.ink }}>{(bulkSeg==='all'?customers:customers.filter(c=>bulkSeg==='vip'?c.segment==='vip':bulkSeg==='dormant'?c.segment==='dormant':c.outstanding>0)).filter(c=>c.phone).length}</strong> customers with phone numbers
            </div>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Message Log ({logs.length})</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:T.card }}>
              {['Phone','Message','Type','Provider','Sent At'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading?<tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              :logs.length===0?<tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:T.muted }}>No messages sent yet</td></tr>
              :logs.map(log=>(
                <tr key={log.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'9px 14px', color:T.blue, fontFamily:'monospace' }}>{log.phone}</td>
                  <td style={{ padding:'9px 14px', color:T.sub, maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.message}</td>
                  <td style={{ padding:'9px 14px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{log.type}</span></td>
                  <td style={{ padding:'9px 14px', color:T.muted }}>💬 {log.provider}</td>
                  <td style={{ padding:'9px 14px', color:T.muted }}>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
