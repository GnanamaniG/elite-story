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

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Chandigarh','Jammu & Kashmir','Ladakh','Puducherry'];
const TRANSPORT_MODES = ['road','rail','air','ship'];

export default function EWayBill({ tenant }) {
  const [bills,    setBills]    = useState([]);
  const [sales,    setSales]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState('all');
  const [saving,   setSaving]   = useState(false);
  const [invSearch,setInvSearch]= useState('');
  const [inventory,setInventory]= useState([]);

  const [form, setForm] = useState({ bill_type:'outward', doc_number:'', doc_date:new Date().toISOString().slice(0,10), to_name:'', to_address:'', to_pincode:'', to_state:'Tamil Nadu', to_gstin:'', transport_mode:'road', vehicle_no:'', transporter:'', distance_km:'', from_gstin:tenant?.gstin||'' });
  const [items, setItems] = useState([]);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [billRes, salesRes, invRes] = await Promise.all([
      supabase.from('eway_bills').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('sales').select('id,inv_num,total,customer,gst_amount,items,date').eq('tenant_id', tenant.id).order('date', { ascending:false }).limit(30),
      supabase.from('inventory').select('id,name,sp,gst,hsn').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setBills(billRes.data||[]);
    setSales(salesRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function prefillFromSale(saleId) {
    const sale = sales.find(s=>s.id===saleId);
    if (!sale) return;
    setForm(f=>({ ...f, doc_number:sale.inv_num, doc_date:sale.date, to_name:sale.customer }));
    setItems((sale.items||[]).map(i=>({ name:i.name, hsn:i.hsn||'', qty:i.qty||1, value:i.amount||0, gst_rate:i.gst||0 })));
  }

  function addItem(inv) {
    setItems(prev=>[...prev, { name:inv.name, hsn:inv.hsn||'', qty:1, value:inv.sp||0, gst_rate:inv.gst||0 }]);
    setInvSearch('');
  }

  const totalValue = items.reduce((s,i)=>s+(i.value*i.qty||0),0);
  const cgst = items.reduce((s,i)=>s+(i.value*i.qty*(i.gst_rate/2)/100||0),0);
  const sgst = cgst;

  function calcValidDate(distKm) {
    const d = new Date(); const days = distKm>200?distKm>500?3:2:1;
    d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);
  }

  async function createEWB(e) {
    e.preventDefault();
    if (!form.to_name || !items.length) return alert('Fill recipient and add items');
    setSaving(true);
    const ewb_number = `EWB${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
    const valid_until= calcValidDate(parseInt(form.distance_km)||0);
    try {
      await supabase.from('eway_bills').insert({ ...form, tenant_id:tenant.id, ewb_number, items, total_value:totalValue, cgst, sgst, igst:0, distance_km:parseInt(form.distance_km)||0, valid_until, status:'generated', from_gstin:tenant?.gstin||form.from_gstin });
      setShowForm(false);
      setForm({ bill_type:'outward', doc_number:'', doc_date:new Date().toISOString().slice(0,10), to_name:'', to_address:'', to_pincode:'', to_state:'Tamil Nadu', to_gstin:'', transport_mode:'road', vehicle_no:'', transporter:'', distance_km:'', from_gstin:tenant?.gstin||'' });
      setItems([]);
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function cancelEWB(id) {
    if (!confirm('Cancel this e-Way Bill?')) return;
    await supabase.from('eway_bills').update({ status:'cancelled' }).eq('id', id);
    setBills(prev=>prev.map(b=>b.id===id?{...b,status:'cancelled'}:b));
  }

  function printEWB(bill) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:6px 10px;border:1px solid #ccc}.section{background:#f0f4ff;padding:8px 12px;font-weight:bold;margin:10px 0 4px;border-radius:4px}</style></head><body>
    <div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:900">e-WAY BILL</div><div style="color:#4f7cff;font-size:14px">Generated under GST e-Way Bill System</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><b>EWB Number:</b> ${bill.ewb_number}</div><div><b>Date:</b> ${bill.doc_date}</div>
      <div><b>Valid Until:</b> ${bill.valid_until}</div><div><b>Bill Type:</b> ${bill.bill_type}</div>
    </div>
    <div class="section">From (Consignor)</div>
    <div><b>${tenant?.name||'Elite Store'}</b><br>GSTIN: ${bill.from_gstin||'—'}<br>${tenant?.address||''}</div>
    <div class="section">To (Consignee)</div>
    <div><b>${bill.to_name}</b><br>GSTIN: ${bill.to_gstin||'—'}<br>${bill.to_address||''} ${bill.to_pincode||''}<br>State: ${bill.to_state}</div>
    <div class="section">Goods Details</div>
    <table><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Value</th><th>GST%</th></tr>
    ${(bill.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.hsn||'—'}</td><td>${i.qty||1}</td><td>Rs.${((i.value||0)*(i.qty||1)).toFixed(2)}</td><td>${i.gst_rate||0}%</td></tr>`).join('')}
    <tr><td colspan="3"><b>Total</b></td><td><b>Rs.${(bill.total_value||0).toFixed(2)}</b></td><td></td></tr></table>
    <div class="section">Transport Details</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><b>Mode:</b> ${bill.transport_mode}</div><div><b>Vehicle No:</b> ${bill.vehicle_no||'—'}</div><div><b>Transporter:</b> ${bill.transporter||'—'}</div><div><b>Distance:</b> ${bill.distance_km||0} km</div></div>
    <div style="margin-top:16px;text-align:center;color:#888;font-size:11px">This is a system-generated e-Way Bill. Verify on GST portal before use.</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
    w.document.close();
  }

  const displayed   = filter==='all'?bills:bills.filter(b=>b.status===filter||b.bill_type===filter);
  const filteredInv = inventory.filter(i=>invSearch&&i.name.toLowerCase().includes(invSearch.toLowerCase()));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 11px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const today = new Date().toISOString().slice(0,10);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🚚 e-Way Bill</div>
          <div style={{ fontSize:13, color:T.sub }}>GST e-Way Bill generation for goods movement above Rs.50,000</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Generate EWB</button>
      </div>

      <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}33`, borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12, color:T.amber }}>
        ℹ️ e-Way Bills are required for interstate and intrastate goods movement exceeding Rs.50,000 value. Generated bills here are for record-keeping — submit to GST portal for official EWB numbers.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Generated',bills.filter(b=>b.status==='generated').length,T.green],['Active',bills.filter(b=>b.status==='generated'&&b.valid_until>=today).length,T.blue],['Expired',bills.filter(b=>b.valid_until<today&&b.status!=='cancelled').length,T.amber],['Cancelled',bills.filter(b=>b.status==='cancelled').length,T.red]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['all','generated','cancelled','outward','inward'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{f}</button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['EWB Number','Type','To','Doc No','Value','Valid Until','Status','Actions'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No e-Way Bills</td></tr>
            :displayed.map(b=>{
              const expired = b.status==='generated'&&b.valid_until<today;
              return (
                <tr key={b.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'9px 12px', color:T.blue, fontFamily:'monospace', fontSize:11 }}>{b.ewb_number}</td>
                  <td style={{ padding:'9px 12px' }}><span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 7px', fontSize:10, textTransform:'capitalize' }}>{b.bill_type}</span></td>
                  <td style={{ padding:'9px 12px', color:T.ink }}>{b.to_name}<br/><span style={{ fontSize:10, color:T.muted }}>{b.to_state}</span></td>
                  <td style={{ padding:'9px 12px', color:T.sub }}>{b.doc_number}</td>
                  <td style={{ padding:'9px 12px', color:T.green, fontWeight:700 }}>{fmt(b.total_value)}</td>
                  <td style={{ padding:'9px 12px', color:expired?T.red:T.muted }}>{b.valid_until}{expired?' ⚠️':''}</td>
                  <td style={{ padding:'9px 12px' }}><span style={{ background:b.status==='generated'?T.green+'22':T.red+'22', color:b.status==='generated'?T.green:T.red, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{b.status}</span></td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>printEWB(b)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                      {b.status==='generated'&&<button onClick={()=>cancelEWB(b.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:640, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Generate e-Way Bill</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>

            {/* Prefill from sale */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Prefill from Invoice (optional)</label>
              <select onChange={e=>prefillFromSale(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                <option value="">— Select invoice —</option>
                {sales.map(s=><option key={s.id} value={s.id}>{s.inv_num} · {s.customer} · {fmt(s.total)}</option>)}
              </select>
            </div>

            <form onSubmit={createEWB}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Bill Type</label>
                  <select value={form.bill_type} onChange={e=>setForm(f=>({...f,bill_type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {['outward','inward','other'].map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Doc Number *</label><input value={form.doc_number} onChange={e=>setForm(f=>({...f,doc_number:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Recipient Name *</label><input value={form.to_name} onChange={e=>setForm(f=>({...f,to_name:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Recipient GSTIN</label><input value={form.to_gstin} onChange={e=>setForm(f=>({...f,to_gstin:e.target.value}))} placeholder="22AAAAA0000A1Z5" style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>To State</label>
                  <select value={form.to_state} onChange={e=>setForm(f=>({...f,to_state:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {STATES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>PIN Code</label><input value={form.to_pincode} onChange={e=>setForm(f=>({...f,to_pincode:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Transport Mode</label>
                  <select value={form.transport_mode} onChange={e=>setForm(f=>({...f,transport_mode:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {TRANSPORT_MODES.map(m=><option key={m} value={m} style={{ textTransform:'capitalize' }}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Vehicle No</label><input value={form.vehicle_no} onChange={e=>setForm(f=>({...f,vehicle_no:e.target.value}))} placeholder="TN01AB1234" style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Transporter Name</label><input value={form.transporter} onChange={e=>setForm(f=>({...f,transporter:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Distance (km)</label><input type="number" value={form.distance_km} onChange={e=>setForm(f=>({...f,distance_km:e.target.value}))} style={inp}/></div>
              </div>

              {/* Items */}
              <div style={{ marginBottom:14, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Items *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search inventory to add…" style={inp}/>
                {filteredInv.length>0&&invSearch&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:140, overflowY:'auto', marginTop:4 }}>
                  {filteredInv.slice(0,5).map(i=><div key={i.id} onClick={()=>addItem(i)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:12 }}><span style={{ color:T.ink }}>{i.name}</span><span style={{ color:T.muted, fontSize:10 }}>HSN: {i.hsn||'—'}</span></div>)}
                </div>}
              </div>

              {items.length>0&&<div style={{ background:T.card, borderRadius:8, overflow:'hidden', marginBottom:14 }}>
                {items.map((it,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto', gap:6, padding:'7px 10px', borderBottom:`1px solid ${T.bdr}22`, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:T.ink }}>{it.name}</span>
                    {['hsn','qty','value','gst_rate'].map(f=>(
                      <input key={f} type={f==='hsn'?'text':'number'} value={it[f]||0} onChange={e=>setItems(prev=>prev.map((x,j)=>j===i?{...x,[f]:e.target.value}:x))} placeholder={f==='hsn'?'HSN':f} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.ink, fontSize:11, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                    ))}
                    <button type="button" onClick={()=>setItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button>
                  </div>
                ))}
                <div style={{ padding:'8px 12px', display:'flex', justifyContent:'flex-end', gap:16, fontSize:12 }}>
                  <span style={{ color:T.muted }}>CGST: {fmt(cgst)}</span>
                  <span style={{ color:T.muted }}>SGST: {fmt(sgst)}</span>
                  <span style={{ color:T.green, fontWeight:700 }}>Total: {fmt(totalValue)}</span>
                </div>
              </div>}

              {form.distance_km&&parseInt(form.distance_km)>0&&<div style={{ background:T.blue+'12', border:`1px solid ${T.blue}33`, borderRadius:8, padding:'8px 14px', marginBottom:14, fontSize:12, color:T.blue }}>
                📅 EWB will be valid for {parseInt(form.distance_km)>500?3:parseInt(form.distance_km)>200?2:1} day(s) — until {calcValidDate(parseInt(form.distance_km))}
              </div>}

              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Generating…':'🚚 Generate e-Way Bill'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
