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

const STATUS = {
  draft:      { label:'Draft',      color:'#6B7280', bg:'#F9FAFB', bdr:'#E5E7EB', icon:'📝' },
  dispatched: { label:'Dispatched', color:'#2563EB', bg:'#EFF6FF', bdr:'#BFDBFE', icon:'🚚' },
  in_transit: { label:'In Transit', color:'#7C3AED', bg:'#F5F3FF', bdr:'#DDD6FE', icon:'🛣️' },
  received:   { label:'Received',   color:'#16A34A', bg:'#F0FDF4', bdr:'#BBF7D0', icon:'✅' },
  partial:    { label:'Partial',    color:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A', icon:'⚠️' },
  cancelled:  { label:'Cancelled',  color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA', icon:'❌' },
};

export default function StockTransferOrders({ tenant }) {
  const [orders,    setOrders]    = useState([]);
  const [branches,  setBranches]  = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [selSto,    setSelSto]    = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [invSearch, setInvSearch] = useState('');
  const [items,     setItems]     = useState([]);
  const [form, setForm] = useState({ from_branch:'', to_branch:'', dispatch_date:new Date().toISOString().slice(0,10), expected_date:'', transporter:'', lr_number:'', dispatched_by:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [oRes, bRes, invRes] = await Promise.all([
      supabase.from('stock_transfer_orders').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('branches').select('id,name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('inventory').select('id,name,code,stock,cp').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ]);
    setOrders(oRes.data||[]);
    setBranches(bRes.data||[]);
    setInventory(invRes.data||[]);
    setLoading(false);
  }

  function genNo() { return `STO/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`; }

  function addItem(inv) {
    setItems(prev=>[...prev, { id:inv.id, name:inv.name, code:inv.code||'', available:inv.stock||0, qty:1, received:0, rate:inv.cp||0 }]);
    setInvSearch('');
  }

  const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
  const totalVal = items.reduce((s,i)=>s+((i.qty||0)*(i.rate||0)),0);

  async function saveSto(e) {
    e.preventDefault(); setSaving(true);
    await supabase.from('stock_transfer_orders').insert({
      ...form, tenant_id:tenant.id, sto_no:genNo(), items,
      total_qty:totalQty, transfer_value:totalVal, status:'draft',
      expected_date:form.expected_date||null,
    });
    setShowForm(false); setItems([]);
    setForm({ from_branch:'', to_branch:'', dispatch_date:new Date().toISOString().slice(0,10), expected_date:'', transporter:'', lr_number:'', dispatched_by:'', notes:'' });
    setSaving(false); await load();
  }

  async function dispatch(sto) {
    // Deduct stock from source
    for (const it of (sto.items||[])) {
      const { data:inv } = await supabase.from('inventory').select('id,stock').eq('id', it.id).maybeSingle();
      if (inv) await supabase.from('inventory').update({ stock:Math.max(0,(inv.stock||0)-(it.qty||0)) }).eq('id', inv.id);
    }
    await supabase.from('stock_transfer_orders').update({ status:'dispatched', dispatch_date:new Date().toISOString().slice(0,10) }).eq('id', sto.id);
    await load();
  }

  async function receive(sto) {
    // Add stock at destination
    for (const it of (sto.items||[])) {
      const { data:inv } = await supabase.from('inventory').select('id,stock').eq('id', it.id).maybeSingle();
      if (inv) await supabase.from('inventory').update({ stock:(inv.stock||0)+(it.qty||0) }).eq('id', inv.id);
    }
    await supabase.from('stock_transfer_orders').update({
      status:'received', received_date:new Date().toISOString().slice(0,10),
      received_qty:sto.total_qty,
    }).eq('id', sto.id);
    await load();
  }

  function printChallan(sto) {
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:24px;max-width:700px;margin:0 auto}
      h2{color:#8B0000;margin-bottom:2px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{padding:7px 10px;border:1px solid #ddd;text-align:left}
      th{background:#f5f0f0;font-size:10px;text-transform:uppercase;font-weight:700}
      .right{text-align:right}
      .box{display:flex;justify-content:space-between;background:#f9f5f5;padding:12px;border-radius:6px;margin:12px 0}
      .sign{display:flex;justify-content:space-between;margin-top:50px}
      .sign div{border-top:1px solid #333;padding-top:5px;width:180px;text-align:center;font-size:11px}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h2>${tenant?.name||'7SQ'}</h2><div style="color:#666">Stock Transfer Challan</div></div>
      <div style="text-align:right;font-size:11px">
        <div><strong>${sto.sto_no}</strong></div>
        <div>Date: ${sto.dispatch_date||'—'}</div>
      </div>
    </div>
    <div class="box">
      <div><strong>FROM</strong><br/>${sto.from_branch}</div>
      <div style="font-size:22px;color:#C0392B">→</div>
      <div style="text-align:right"><strong>TO</strong><br/>${sto.to_branch}</div>
    </div>
    <div style="font-size:11px;color:#666">Transporter: ${sto.transporter||'—'} · LR No: ${sto.lr_number||'—'} · Expected: ${sto.expected_date||'—'}</div>
    <table>
      <tr><th>#</th><th>Product</th><th>Code</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Value</th></tr>
      ${(sto.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${i.name}</td><td>${i.code||'—'}</td><td class="right">${i.qty}</td><td class="right">${fmt(i.rate)}</td><td class="right">${fmt((i.qty||0)*(i.rate||0))}</td></tr>`).join('')}
      <tr style="background:#f5f0f0;font-weight:700"><td colspan="3">TOTAL</td><td class="right">${sto.total_qty}</td><td></td><td class="right">${fmt(sto.transfer_value)}</td></tr>
    </table>
    ${sto.notes?`<div style="margin-top:12px;font-size:11px"><strong>Notes:</strong> ${sto.notes}</div>`:''}
    <div class="sign"><div>Dispatched By</div><div>Transporter</div><div>Received By</div></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  const displayed  = filter==='all'?orders:orders.filter(o=>o.status===filter);
  const inTransit  = orders.filter(o=>['dispatched','in_transit'].includes(o.status));
  const transitVal = inTransit.reduce((s,o)=>s+(o.transfer_value||0),0);
  const filteredInv= inventory.filter(i=>invSearch&&i.name.toLowerCase().includes(invSearch.toLowerCase())&&!items.find(x=>x.id===i.id));

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:T.darkRed }}>🔀 Stock Transfer Orders</div>
          <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>Inter-branch transfers with dispatch challan and receipt confirmation</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ New Transfer</button>
      </div>

      {inTransit.length>0&&<div style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:10, padding:'11px 16px', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.purple }}>🛣️ {inTransit.length} transfer{inTransit.length>1?'s':''} in transit — <strong>{fmt(transitVal)}</strong> of stock on the move</span>
      </div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[['Total Transfers',orders.length,T.blue,'🔀'],['In Transit',inTransit.length,T.purple,'🛣️'],['Received',orders.filter(o=>o.status==='received').length,T.green,'✅'],['Transit Value',fmt(transitVal),T.amber,'💰']].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={()=>setFilter('all')} style={{ padding:'6px 14px', background:filter==='all'?T.red:T.white, color:filter==='all'?T.white:T.sub, border:`1px solid ${filter==='all'?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>All ({orders.length})</button>
        {Object.entries(STATUS).map(([k,v])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ padding:'6px 14px', background:filter===k?T.red:T.white, color:filter===k?T.white:T.sub, border:`1px solid ${filter===k?T.red:T.bdr}`, borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {v.icon} {v.label} ({orders.filter(o=>o.status===k).length})
          </button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.muted }}>Loading…</div>
        :displayed.length===0?<div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔀</div>
          <div style={{ color:T.muted, fontWeight:600 }}>No transfer orders</div>
          {branches.length<2&&<div style={{ color:T.muted, fontSize:11, marginTop:4 }}>Add at least 2 branches in Operations → Branches first</div>}
        </div>
        :displayed.map(o=>{
          const s = STATUS[o.status]||STATUS.draft;
          return (
            <div key={o.id} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 18px', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.bdr}`, borderRadius:6, padding:'3px 10px', fontSize:10, fontWeight:700 }}>{s.icon} {s.label}</span>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:T.blue, fontWeight:700 }}>{o.sto_no}</span>
                </div>
                <div style={{ fontSize:11, color:T.muted }}>{o.dispatch_date||'Not dispatched'}</div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12, background:T.bg, borderRadius:9, padding:'12px 16px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>From</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{o.from_branch}</div>
                </div>
                <div style={{ fontSize:22, color:T.red }}>→</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>To</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{o.to_branch}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:T.muted, textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>Items / Value</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.red }}>{(o.items||[]).length} items · {o.total_qty} units · {fmt(o.transfer_value)}</div>
                </div>
              </div>

              {(o.transporter||o.lr_number)&&<div style={{ fontSize:11, color:T.sub, marginBottom:10 }}>
                🚛 {o.transporter||'—'} {o.lr_number?`· LR: ${o.lr_number}`:''} {o.expected_date?`· Expected: ${o.expected_date}`:''}
              </div>}

              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {o.status==='draft'&&<button onClick={()=>dispatch(o)} style={btn('#EFF6FF', T.blue, { padding:'6px 14px', fontSize:11 })}>🚚 Dispatch & Deduct Stock</button>}
                {['dispatched','in_transit'].includes(o.status)&&<button onClick={()=>receive(o)} style={btn('#F0FDF4', T.green, { padding:'6px 14px', fontSize:11 })}>✅ Confirm Receipt & Add Stock</button>}
                <button onClick={()=>printChallan(o)} style={btn(T.lightRed, T.red, { padding:'6px 14px', fontSize:11, border:`1px solid ${T.bdr}` })}>🖨️ Print Challan</button>
                <button onClick={()=>setSelSto(selSto?.id===o.id?null:o)} style={btn(T.bg, T.sub, { padding:'6px 14px', fontSize:11, border:`1px solid ${T.bdr}` })}>{selSto?.id===o.id?'Hide':'View'} Items</button>
              </div>

              {selSto?.id===o.id&&<div style={{ marginTop:12, background:T.bg, borderRadius:9, padding:'10px 14px' }}>
                {(o.items||[]).map((i,n)=>(
                  <div key={n} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, borderBottom:n<(o.items.length-1)?`1px solid ${T.bdr}33`:'none' }}>
                    <span style={{ color:T.ink }}>{i.name} {i.code&&<span style={{ color:T.muted, fontSize:10 }}>· {i.code}</span>}</span>
                    <span style={{ color:T.sub }}>{i.qty} units × {fmt(i.rate)} = <strong style={{ color:T.red }}>{fmt((i.qty||0)*(i.rate||0))}</strong></span>
                  </div>
                ))}
              </div>}
            </div>
          );
        })}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:620, margin:'20px 0', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>New Stock Transfer</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            <form onSubmit={saveSto}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:12, alignItems:'end', marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>From Branch *</label>
                  <select value={form.from_branch} onChange={e=>setForm(f=>({...f,from_branch:e.target.value}))} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select…</option>
                    {branches.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}
                    <option value="Main Store">Main Store</option>
                  </select>
                </div>
                <div style={{ fontSize:22, color:T.red, paddingBottom:8 }}>→</div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>To Branch *</label>
                  <select value={form.to_branch} onChange={e=>setForm(f=>({...f,to_branch:e.target.value}))} required style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select…</option>
                    {branches.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}
                    <option value="Main Store">Main Store</option>
                  </select>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
                {[['Dispatch Date','date','dispatch_date'],['Expected Arrival','date','expected_date'],['Transporter','text','transporter'],['LR / Docket No','text','lr_number']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={inp}/></div>
                ))}
              </div>

              <div style={{ marginBottom:12, position:'relative' }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Products *</label>
                <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search products…" style={inp}/>
                {filteredInv.length>0&&<div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:150, overflowY:'auto', marginTop:4, boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
                  {filteredInv.slice(0,6).map(i=><div key={i.id} onClick={()=>addItem(i)} style={{ padding:'9px 14px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span style={{ color:T.ink }}>{i.name}</span>
                    <span style={{ color:i.stock>0?T.green:T.red, fontWeight:600 }}>{i.stock} in stock</span>
                  </div>)}
                </div>}
              </div>

              {items.length>0&&<div style={{ background:T.bg, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:T.lightRed }}>{['Product','Available','Transfer Qty','Value',''].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:T.darkRed, fontWeight:700, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                  <tbody>{items.map((it,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'7px 10px', color:T.ink, fontWeight:600 }}>{it.name}</td>
                      <td style={{ padding:'7px 10px', color:it.available>=it.qty?T.green:T.red, fontWeight:600 }}>{it.available}</td>
                      <td style={{ padding:'4px 6px' }}>
                        <input type="number" value={it.qty} max={it.available} onChange={e=>setItems(prev=>prev.map((x,j)=>j===i?{...x,qty:Math.min(parseInt(e.target.value)||0, x.available)}:x))}
                          style={{ width:75, background:T.white, border:`1px solid ${it.qty>it.available?T.red:T.bdr}`, borderRadius:5, padding:'5px 7px', fontSize:12, textAlign:'center', fontFamily:'inherit', outline:'none', fontWeight:700 }}/>
                      </td>
                      <td style={{ padding:'7px 10px', color:T.red, fontWeight:700 }}>{fmt((it.qty||0)*(it.rate||0))}</td>
                      <td style={{ padding:'4px 6px' }}><button type="button" onClick={()=>setItems(prev=>prev.filter((_,j)=>j!==i))} style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:5, padding:'4px 9px', cursor:'pointer', fontFamily:'inherit' }}>×</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div style={{ padding:'10px 14px', background:T.lightRed, display:'flex', justifyContent:'flex-end', gap:18, fontSize:12 }}>
                  <span style={{ color:T.sub }}>Total units: <strong>{totalQty}</strong></span>
                  <span style={{ color:T.red, fontWeight:800, fontSize:14 }}>Value: {fmt(totalVal)}</span>
                </div>
              </div>}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Dispatched By</label><input value={form.dispatched_by} onChange={e=>setForm(f=>({...f,dispatched_by:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving||!items.length} style={{ flex:2, ...btn(T.red, T.white), padding:'12px', fontSize:13 }}>{saving?'Creating…':'🔀 Create Transfer Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
