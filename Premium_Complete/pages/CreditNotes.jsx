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
const STATUS_COLORS = { open:T.blue, applied:T.green, void:T.red };

export default function CreditNotes({ tenant }) {
  const [notes,    setNotes]    = useState([]);
  const [sales,    setSales]    = useState([]);
  const [customers,setCustomers]= useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [form,     setForm]     = useState({ customer:'', customer_id:'', sale_id:'', amount:'', reason:'', notes:'' });
  const [saving,   setSaving]   = useState(false);
  const [selSale,  setSelSale]  = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [cnRes, salesRes, custRes] = await Promise.all([
      supabase.from('credit_notes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('sales').select('id,inv_num,total,customer,customer_id,date').eq('tenant_id', tenant.id).order('date', { ascending:false }).limit(100),
      supabase.from('customers').select('id,name,phone,outstanding').eq('tenant_id', tenant.id).order('name'),
    ]);
    setNotes(cnRes.data||[]);
    setSales(salesRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  function genCNNumber() {
    return `CN/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`;
  }

  async function createCreditNote(e) {
    e.preventDefault();
    if (!form.customer || !form.amount || !form.reason) return;
    setSaving(true);
    try {
      const cn_number = genCNNumber();
      await supabase.from('credit_notes').insert({ ...form, tenant_id:tenant.id, cn_number, amount:parseFloat(form.amount)||0, sale_id:form.sale_id||null, customer_id:form.customer_id||null });
      // Reduce customer outstanding if linked
      if (form.customer_id) {
        const cust = customers.find(c=>c.id===form.customer_id);
        if (cust) await supabase.from('customers').update({ outstanding:Math.max(0,(cust.outstanding||0)-parseFloat(form.amount)) }).eq('id', form.customer_id);
      }
      setShowForm(false);
      setForm({ customer:'', customer_id:'', sale_id:'', amount:'', reason:'', notes:'' });
      setSelSale(null);
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function voidNote(id) {
    if (!confirm('Void this credit note?')) return;
    await supabase.from('credit_notes').update({ status:'void' }).eq('id', id);
    setNotes(prev=>prev.map(n=>n.id===id?{...n,status:'void'}:n));
  }

  function printCreditNote(note) {
    const w = window.open('', '_blank', 'width=400,height=500');
    const biz = tenant?.name||'Elite Store';
    const html = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;}.center{text-align:center;}.row{display:flex;justify-content:space-between;padding:4px 0;}.divider{border-top:1px solid #ddd;margin:10px 0;}.bold{font-weight:bold;}.large{font-size:20px;}</style></head><body>
    <div class="center bold large">${biz}</div><div class="center" style="color:#4f7cff;font-size:18px;margin:10px 0;">CREDIT NOTE</div>
    <div class="divider"></div>
    <div class="row"><span>CN Number:</span><span class="bold">${note.cn_number}</span></div>
    <div class="row"><span>Date:</span><span>${note.issued_date}</span></div>
    <div class="row"><span>Customer:</span><span>${note.customer}</span></div>
    ${note.sale_id?`<div class="row"><span>Against Invoice:</span><span>${sales.find(s=>s.id===note.sale_id)?.inv_num||'—'}</span></div>`:''}
    <div class="divider"></div>
    <div class="row"><span>Reason:</span><span>${note.reason}</span></div>
    <div class="divider"></div>
    <div class="row bold large"><span>Credit Amount:</span><span style="color:green">Rs.${(note.amount||0).toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="center" style="margin-top:20px;color:#666;font-size:12px">This credit note can be applied against future purchases at ${biz}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`;
    w.document.write(html); w.document.close();
  }

  const displayed = filter==='all'?notes:notes.filter(n=>n.status===filter);
  const totalOpen = notes.filter(n=>n.status==='open').reduce((s,n)=>s+(n.amount||0),0);
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📝 Credit Notes</div>
          <div style={{ fontSize:13, color:T.sub }}>{notes.filter(n=>n.status==='open').length} open · {fmt(totalOpen)} outstanding credit</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Issue Credit Note</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Open Credit',fmt(notes.filter(n=>n.status==='open').reduce((s,n)=>s+(n.amount||0),0)),T.blue],['Applied',fmt(notes.filter(n=>n.status==='applied').reduce((s,n)=>s+(n.amount||0),0)),T.green],['Total Issued',fmt(notes.reduce((s,n)=>s+(n.amount||0),0)),T.sub]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','open','applied','void'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f} ({f==='all'?notes.length:notes.filter(n=>n.status===f).length})
          </button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['CN Number','Customer','Amount','Reason','Date','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No credit notes</td></tr>
            :displayed.map(n=>(
              <tr key={n.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.blue, fontFamily:'monospace', fontWeight:700 }}>{n.cn_number}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{n.customer}</td>
                <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(n.amount)}</td>
                <td style={{ padding:'10px 14px', color:T.sub, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.reason}</td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{n.issued_date}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_COLORS[n.status]+'22', color:STATUS_COLORS[n.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{n.status}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>printCreditNote(n)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                    {n.status==='open'&&<button onClick={()=>voidNote(n.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Void</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Issue Credit Note</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={createCreditNote}>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Link to Invoice (optional)</label>
                <select value={form.sale_id} onChange={e=>{const s=sales.find(x=>x.id===e.target.value);setSelSale(s);setForm(f=>({...f,sale_id:e.target.value,customer:s?.customer||f.customer,customer_id:s?.customer_id||f.customer_id,amount:s?.total||f.amount}));}} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">— No linked invoice —</option>
                  {sales.map(s=><option key={s.id} value={s.id}>{s.inv_num} · {s.customer} · {fmt(s.total)}</option>)}
                </select>
              </div>
              {[['Customer Name *','text','customer'],['Amount (Rs.) *','number','amount'],['Reason *','text','reason'],['Notes','text','notes']].map(([label,type,key])=>(
                <div key={key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} placeholder={label.replace(' *','')} style={inp}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Issuing…':'Issue Credit Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
