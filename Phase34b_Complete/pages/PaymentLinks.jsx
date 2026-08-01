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
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function PaymentLinks({ tenant }) {
  const [links,    setLinks]    = useState([]);
  const [customers,setCustomers]= useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ customer:'', phone:'', amount:'', purpose:'', upi_id:tenant?.upi_id||'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [lRes, cRes] = await Promise.all([
      supabase.from('payment_links').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name,phone').eq('tenant_id', tenant.id).order('name'),
    ]);
    setLinks(lRes.data||[]);
    setCustomers(cRes.data||[]);
    setLoading(false);
  }

  function genRef() { return `PAY${Date.now().toString(36).toUpperCase().slice(-6)}`; }

  function buildUPILink(amount, upiId, name, ref) {
    const upi = upiId || tenant?.upi_id || '';
    return `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(ref)}`;
  }

  function buildWhatsAppMsg(link) {
    const upiDeepLink = buildUPILink(link.amount, link.upi_id, tenant?.name||'7SQ', link.link_ref);
    return `Hi ${link.customer}! 🙏\n\nPayment request from *${tenant?.name||'7SQ'}*\n\n💰 Amount: *${fmt(link.amount)}*\n📋 Ref: ${link.link_ref}\n${link.purpose?'📝 For: '+link.purpose+'\n':''}\n*Pay via UPI:*\nUPI ID: *${link.upi_id||tenant?.upi_id||''}*\n\nOr click to pay (if on mobile):\n${upiDeepLink}\n\nPlease confirm after payment. Thank you! 🙏`;
  }

  async function createLink(e) {
    e.preventDefault(); setSaving(true);
    const expiry = new Date(); expiry.setDate(expiry.getDate()+3);
    const ref    = genRef();
    await supabase.from('payment_links').insert({
      ...form, tenant_id:tenant.id, link_ref:ref,
      amount:parseFloat(form.amount)||0,
      expires_at:expiry.toISOString(),
      upi_id:form.upi_id||tenant?.upi_id||'',
    });
    setShowForm(false);
    setForm({ customer:'', phone:'', amount:'', purpose:'', upi_id:tenant?.upi_id||'' });
    setSaving(false); await load();
  }

  async function markPaid(id) {
    await supabase.from('payment_links').update({ status:'paid', paid_at:new Date().toISOString() }).eq('id', id);
    setLinks(prev=>prev.map(l=>l.id===id?{...l,status:'paid',paid_at:new Date().toISOString()}:l));
  }

  function shareLink(link) {
    const msg = buildWhatsAppMsg(link);
    const ph  = (link.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const totalPending = links.filter(l=>l.status==='pending').reduce((s,l)=>s+(l.amount||0),0);
  const totalPaid    = links.filter(l=>l.status==='paid').reduce((s,l)=>s+(l.amount||0),0);

  const StatusBadge = ({ status }) => {
    const cfg = { pending:{bg:'#FFFBEB',color:'#D97706',border:'#FDE68A',label:'Pending'}, paid:{bg:'#F0FDF4',color:'#16A34A',border:'#BBF7D0',label:'Paid'}, expired:{bg:'#F9FAFB',color:'#6B7280',border:'#E5E7EB',label:'Expired'}, cancelled:{bg:'#FEF2F2',color:'#C0392B',border:'#FECACA',label:'Cancelled'} };
    const c = cfg[status]||cfg.pending;
    return <span style={{ background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>{c.label}</span>;
  };

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>💸 Payment Links</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Generate UPI payment requests and track collections</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Create Link</button>
      </div>

      {!tenant?.upi_id&&<div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', marginBottom:18, fontSize:12, color:'#D97706' }}>
        ⚠️ Add your UPI ID in Settings to enable payment links
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[['Total Links',links.length,T.blue,'🔗'],['Pending Collection',fmt(totalPending),T.amber,'⏳'],['Collected',fmt(totalPaid),T.green,'✅'],['Paid Links',links.filter(l=>l.status==='paid').length,T.green,'💰']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['Ref','Customer','Amount','Purpose','Created','Expires','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:10, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :links.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}><div style={{ fontSize:32, marginBottom:8 }}>💸</div><div style={{ fontWeight:600 }}>No payment links yet</div></td></tr>
            :links.map(l=>(
              <tr key={l.id} style={{ borderBottom:`1px solid ${T.bdr}44` }}>
                <td style={{ padding:'12px 16px', fontFamily:'monospace', fontWeight:700, color:T.blue, fontSize:12 }}>{l.link_ref}</td>
                <td style={{ padding:'12px 16px', color:T.ink, fontWeight:600 }}>{l.customer}<br/><span style={{ fontSize:10, color:T.sub }}>{l.phone}</span></td>
                <td style={{ padding:'12px 16px', color:T.red, fontWeight:700, fontSize:15 }}>{fmt(l.amount)}</td>
                <td style={{ padding:'12px 16px', color:T.sub }}>{l.purpose||'—'}</td>
                <td style={{ padding:'12px 16px', color:T.muted, fontSize:11 }}>{l.created_at?.slice(0,10)}</td>
                <td style={{ padding:'12px 16px', color:T.muted, fontSize:11 }}>{l.expires_at?.slice(0,10)}</td>
                <td style={{ padding:'12px 16px' }}><StatusBadge status={l.status}/></td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {l.phone&&<button onClick={()=>shareLink(l)} style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:7, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>}
                    {l.status==='pending'&&<button onClick={()=>markPaid(l.id)} style={{ background:T.lightRed, color:T.red, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Paid</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Create Payment Link</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={createLink}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Customer</label>
                  <select onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)setForm(f=>({...f,customer:c.name,phone:c.phone||''}));}} style={{ ...inp, cursor:'pointer', marginBottom:6 }}>
                    <option value="">Select customer…</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Or type customer name" required style={inp}/>
                </div>
                {[['Phone','tel','phone'],['Amount (Rs.) *','number','amount'],['Purpose (e.g. Invoice #)','text','purpose'],['Your UPI ID','text','upi_id']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} placeholder={key==='upi_id'?'yourname@upi':''} style={inp}/></div>
                ))}
              </div>
              {form.amount&&form.upi_id&&<div style={{ background:T.lightRed, borderRadius:9, padding:'12px 16px', marginTop:14, fontSize:12 }}>
                <div style={{ fontWeight:700, color:T.darkRed, marginBottom:4 }}>Preview — WhatsApp message will include:</div>
                <div style={{ color:T.sub }}>UPI ID: {form.upi_id} · Amount: {fmt(parseFloat(form.amount)||0)}</div>
              </div>}
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'💸 Create & Share'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
