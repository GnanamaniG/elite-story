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

const DEFAULT_TEMPLATES = [
  { name:'Order Confirmation', category:'sales', message:'Hi {customer}! 🎉\n\nYour order *{invoice}* at *{store}* is confirmed!\n\nAmount: *Rs.{amount}*\nDate: {date}\n\nThank you for shopping with us! 🙏' },
  { name:'Payment Reminder', category:'payments', message:'Hi {customer}! 👋\n\nThis is a gentle reminder that you have an outstanding balance of *Rs.{amount}* at *{store}*.\n\nKindly clear at your earliest convenience.\n\nThank you! 🙏' },
  { name:'Appointment Reminder', category:'appointments', message:'Hi {customer}! ⏰\n\nReminder: Your appointment at *{store}* is scheduled for:\n📅 {date} at {time}\n\nPlease arrive 5 minutes early. See you soon! 😊' },
  { name:'Birthday Wish', category:'customers', message:'🎂 Happy Birthday, {customer}!\n\nWishing you a wonderful day! 🎉\n\nAs a special gift, enjoy *10% OFF* on your next visit to *{store}*.\n\nUse code: *BDAY10* at checkout! 🎁' },
  { name:'New Arrival', category:'promotions', message:'🆕 *New Arrivals at {store}!*\n\nWe have exciting new products just for you!\n\n✨ Fresh collection now available\n🏷️ Special launch prices\n\nVisit us or reply to order! 🛍️' },
  { name:'Sale Announcement', category:'promotions', message:'🎊 *SALE at {store}!*\n\nHuge discounts on selected items!\n\n💰 Up to {discount}% OFF\n📅 Limited time offer\n\nDon\'t miss out! Visit us today 🛍️' },
  { name:'Repair Ready', category:'repairs', message:'Hi {customer}! ✅\n\nGreat news! Your *{item}* is ready for pickup at *{store}*.\n\nAmount Due: *Rs.{amount}*\n\nPlease collect at your earliest. Thank you! 🙏' },
  { name:'Thank You', category:'customers', message:'Thank you for visiting *{store}*, {customer}! 🙏\n\nWe hope you loved your purchase. Do share your experience with friends and family!\n\nLooking forward to seeing you again! 😊' },
  { name:'Low Stock Alert (to supplier)', category:'purchases', message:'Hi! This is *{store}*.\n\nWe need to reorder the following items:\n{items}\n\nKindly send availability and pricing at your earliest.\n\nThank you!' },
  { name:'Subscription Due', category:'payments', message:'Hi {customer}! 📅\n\nYour *{plan}* subscription at *{store}* is due.\n\nAmount: *Rs.{amount}*\nDue Date: {date}\n\nPlease make your payment to continue uninterrupted service. 🙏' },
];

const CATEGORIES = ['all','sales','payments','appointments','customers','promotions','repairs','purchases'];
const CATEGORY_COLORS = { sales:T.blue, payments:T.amber, appointments:T.teal, customers:T.purple, promotions:T.green, repairs:T.orange, purchases:T.sub };

export default function WATemplates({ tenant }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [editing,   setEditing]   = useState(null);
  const [showNew,   setShowNew]   = useState(false);
  const [sending,   setSending]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [vars,      setVars]      = useState({});
  const [preview,   setPreview]   = useState('');
  const [newForm,   setNewForm]   = useState({ name:'', category:'sales', message:'' });
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('wa_templates').select('*').eq('tenant_id', tenant.id).order('category').order('name');
    if (!data?.length) {
      // Seed defaults on first load
      const toInsert = DEFAULT_TEMPLATES.map(t => ({ ...t, tenant_id:tenant.id, variables:extractVars(t.message) }));
      const { data:created } = await supabase.from('wa_templates').insert(toInsert).select();
      setTemplates(created||DEFAULT_TEMPLATES);
    } else {
      setTemplates(data);
    }
    setLoading(false);
  }

  function extractVars(msg) {
    const matches = msg.match(/\{([^}]+)\}/g)||[];
    return [...new Set(matches.map(m=>m.slice(1,-1)))];
  }

  function fillTemplate(msg, varValues) {
    let filled = msg;
    Object.entries(varValues).forEach(([k,v]) => { filled = filled.replace(new RegExp(`\\{${k}\\}`, 'g'), v||`{${k}}`); });
    filled = filled.replace(/\{store\}/g, tenant?.name||'Elite Store');
    return filled;
  }

  function selectTemplate(tmpl) {
    setEditing(tmpl);
    const varNames = extractVars(tmpl.message);
    const initVars = {};
    varNames.forEach(v => { if (v!=='store') initVars[v]=''; });
    setVars(initVars);
    setPreview(fillTemplate(tmpl.message, initVars));
  }

  function updateVars(key, val) {
    const newVars = { ...vars, [key]:val };
    setVars(newVars);
    setPreview(fillTemplate(editing.message, newVars));
  }

  function sendTemplate() {
    if (!phone.trim()) return alert('Enter a phone number');
    const msg = preview || fillTemplate(editing.message, vars);
    const ph  = phone.replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    setSending(editing.id);
    setTimeout(()=>setSending(''), 2000);
  }

  function copyTemplate() {
    const msg = preview || fillTemplate(editing.message, vars);
    navigator.clipboard.writeText(msg).then(()=>alert('Copied to clipboard!'));
  }

  async function saveNewTemplate(e) {
    e.preventDefault();
    if (!newForm.name || !newForm.message) return;
    setSaving(true);
    const { data } = await supabase.from('wa_templates').insert({ ...newForm, tenant_id:tenant.id, variables:extractVars(newForm.message) }).select().single();
    setTemplates(prev=>[...prev, data]);
    setShowNew(false); setNewForm({ name:'', category:'sales', message:'' });
    setSaving(false);
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    await supabase.from('wa_templates').delete().eq('id', id);
    setTemplates(prev=>prev.filter(t=>t.id!==id));
    if (editing?.id===id) setEditing(null);
  }

  async function updateTemplate() {
    if (!editing) return;
    await supabase.from('wa_templates').update({ message:editing.message, name:editing.name }).eq('id', editing.id);
    setTemplates(prev=>prev.map(t=>t.id===editing.id?editing:t));
    alert('✅ Template saved!');
  }

  const displayed = filter==='all'?templates:templates.filter(t=>t.category===filter);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>💬 WhatsApp Templates</div>
          <div style={{ fontSize:13, color:T.sub }}>{templates.length} templates · Quick send to customers</div>
        </div>
        <button onClick={()=>setShowNew(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Template</button>
      </div>

      {/* Category filter */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {CATEGORIES.map(cat=>(
          <button key={cat} onClick={()=>{ setFilter(cat); setEditing(null); }} style={{ background:filter===cat?T.blue:T.srf, color:filter===cat?'#fff':T.sub, border:`1px solid ${filter===cat?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {cat} {cat!=='all'&&`(${templates.filter(t=>t.category===cat).length})`}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Template list */}
        <div>
          {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
          :displayed.map(tmpl=>(
            <div key={tmpl.id} onClick={()=>selectTemplate(tmpl)}
              style={{ background:editing?.id===tmpl.id?T.blue+'18':T.srf, border:`1px solid ${editing?.id===tmpl.id?T.blue:T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:8, cursor:'pointer', transition:'all .15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{tmpl.name}</div>
                  <span style={{ background:(CATEGORY_COLORS[tmpl.category]||T.sub)+'22', color:CATEGORY_COLORS[tmpl.category]||T.sub, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{tmpl.category}</span>
                </div>
                <button onClick={e=>{e.stopPropagation();deleteTemplate(tmpl.id);}} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'3px 7px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
              </div>
              <div style={{ fontSize:11, color:T.muted, marginTop:6, lineHeight:1.5 }}>{tmpl.message.slice(0,80)}…</div>
              {extractVars(tmpl.message).filter(v=>v!=='store').length>0&&(
                <div style={{ fontSize:10, color:T.blue, marginTop:4 }}>Variables: {extractVars(tmpl.message).filter(v=>v!=='store').map(v=>`{${v}}`).join(', ')}</div>
              )}
            </div>
          ))}
        </div>

        {/* Send panel */}
        <div>
          {editing ? (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, position:'sticky', top:20 }}>
              <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:15 }}>{editing.name}</div>

              {/* Variable inputs */}
              {extractVars(editing.message).filter(v=>v!=='store').length>0&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Fill in variables</div>
                  {extractVars(editing.message).filter(v=>v!=='store').map(v=>(
                    <div key={v} style={{ marginBottom:8 }}>
                      <label style={{ fontSize:10, color:T.muted, display:'block', marginBottom:3, textTransform:'capitalize' }}>{v.replace(/_/g,' ')}</label>
                      <input value={vars[v]||''} onChange={e=>updateVars(v, e.target.value)} placeholder={`Enter ${v}…`} style={{ ...inp, fontSize:12, padding:'7px 10px' }}/>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit message */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Message</div>
                <textarea value={editing.message} onChange={e=>{ setEditing({...editing,message:e.target.value}); setPreview(fillTemplate(e.target.value,vars)); }} rows={5} style={{ ...inp, resize:'vertical' }}/>
                <button onClick={updateTemplate} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>💾 Save changes</button>
              </div>

              {/* Preview */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Preview</div>
                <div style={{ background:'#e5ddd5', borderRadius:10, padding:10 }}>
                  <div style={{ background:'#fff', borderRadius:'10px 10px 10px 3px', padding:'9px 12px', maxWidth:'90%' }}>
                    <pre style={{ fontSize:12, color:'#000', fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.5, margin:0 }}>{preview||fillTemplate(editing.message,vars)}</pre>
                  </div>
                </div>
              </div>

              {/* Phone + send */}
              <div style={{ marginBottom:10 }}>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter phone number to send…" style={{ ...inp, marginBottom:8 }}/>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <button onClick={copyTemplate} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📋 Copy</button>
                  <button onClick={sendTemplate} style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {sending===editing.id?'✅ Sent!':'💬 Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
              <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
              <div style={{ fontSize:13 }}>Select a template to preview and send</div>
            </div>
          )}
        </div>
      </div>

      {/* New template modal */}
      {showNew&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:500 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Template</div>
              <button onClick={()=>setShowNew(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveNewTemplate}>
              <div style={{ marginBottom:12 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Template Name *</label><input value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Welcome Message" style={inp} required/></div>
              <div style={{ marginBottom:12 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Category</label>
                <select value={newForm.category} onChange={e=>setNewForm(f=>({...f,category:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                  {CATEGORIES.filter(c=>c!=='all').map(c=><option key={c} value={c} style={{ textTransform:'capitalize' }}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:6 }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Message *</label><textarea value={newForm.message} onChange={e=>setNewForm(f=>({...f,message:e.target.value}))} rows={6} placeholder="Use {customer}, {amount}, {date} as dynamic variables. {store} is auto-filled." style={{ ...inp, resize:'vertical' }} required/></div>
              <div style={{ fontSize:10, color:T.muted, marginBottom:14 }}>Available variables: {'{customer}'} {'{amount}'} {'{date}'} {'{invoice}'} {'{store}'} {'{item}'} {'{time}'} {'{plan}'}</div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowNew(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Template'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
