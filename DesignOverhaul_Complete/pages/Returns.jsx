import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSales } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const REFUND_MODES = [
  { id:'cash',        label:'💵 Cash Refund' },
  { id:'upi',         label:'📱 UPI Refund' },
  { id:'credit_note', label:'📝 Credit Note' },
  { id:'exchange',    label:'🔄 Exchange' },
];

const RETURN_REASONS = ['Defective/Damaged','Wrong Size','Wrong Item','Customer Changed Mind','Quality Issue','Other'];

export default function Returns({ tenant }) {
  const [returns,    setReturns]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [step,       setStep]       = useState(1); // 1=find invoice, 2=select items, 3=confirm
  const [invSearch,  setInvSearch]  = useState('');
  const [foundSale,  setFoundSale]  = useState(null);
  const [returnItems,setReturnItems]= useState([]);
  const [reason,     setReason]     = useState('');
  const [refundMode, setRefundMode] = useState('cash');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('returns').select('*').eq('tenant_id', tenant.id).order('date', { ascending:false }).limit(100);
    setReturns(data || []);
    setLoading(false);
  }

  async function findInvoice() {
    if (!invSearch.trim()) return;
    const { data } = await supabase.from('sales').select('*').eq('tenant_id', tenant.id)
      .or(`inv_num.ilike.%${invSearch}%,customer.ilike.%${invSearch}%`).limit(5);
    if (data?.length === 1) { setFoundSale(data[0]); setStep(2); setReturnItems((data[0].items||[]).map(i => ({ ...i, return_qty: 0, selected: false }))); }
    else if (data?.length > 1) { setFoundSale({ multiple: data }); }
    else { alert('Invoice not found'); }
  }

  function toggleItem(idx) {
    setReturnItems(prev => prev.map((item, i) => i===idx ? { ...item, selected:!item.selected, return_qty: item.selected ? 0 : item.qty } : item));
  }

  function updateReturnQty(idx, qty) {
    setReturnItems(prev => prev.map((item, i) => i===idx ? { ...item, return_qty: Math.min(item.qty, Math.max(0, parseInt(qty)||0)) } : item));
  }

  const selectedItems = returnItems.filter(i => i.selected && i.return_qty > 0);
  const returnTotal   = selectedItems.reduce((s, i) => s + (i.return_qty * i.rate), 0);
  const returnGST     = selectedItems.reduce((s, i) => s + (i.return_qty * i.rate * (i.gst||18) / (100 + (i.gst||18))), 0);

  async function processReturn() {
    if (!selectedItems.length || !reason) return alert('Select items and reason');
    setSaving(true);
    try {
      const returnNum = `RET/${new Date().toISOString().slice(0,10).replace(/-/g,'')}/${String(Date.now()).slice(-4)}`;
      await supabase.from('returns').insert({
        tenant_id: tenant.id,
        original_sale_id: foundSale.id,
        return_num: returnNum,
        date: new Date().toISOString().slice(0,10),
        customer: foundSale.customer,
        customer_id: foundSale.customer_id,
        reason,
        items: selectedItems.map(i => ({ name:i.name, qty:i.return_qty, rate:i.rate, gst:i.gst||18, amount:i.return_qty*i.rate })),
        subtotal: returnTotal - returnGST,
        gst_amount: returnGST,
        total: returnTotal,
        refund_mode: refundMode,
        status: 'completed',
        notes,
      });

      // Restore stock
      for (const item of selectedItems) {
        const { data: inv } = await supabase.from('inventory').select('stock').eq('tenant_id', tenant.id).eq('name', item.name).single();
        if (inv) await supabase.from('inventory').update({ stock: (inv.stock||0) + item.return_qty }).eq('tenant_id', tenant.id).eq('name', item.name);
      }

      alert(`✅ Return processed!\nReturn No: ${returnNum}\nRefund: ${fmt(returnTotal)} via ${refundMode}`);
      setShowForm(false); setStep(1); setFoundSale(null); setReturnItems([]); setReason(''); setNotes('');
      await load();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const totalReturned = returns.reduce((s, r) => s + (r.total||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Returns & Refunds</div>
          <div style={{ fontSize:13, color:T.sub }}>{returns.length} returns · {fmt(totalReturned)} refunded</div>
        </div>
        <button onClick={() => { setShowForm(true); setStep(1); }} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Process Return
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Returns', returns.length, T.blue],
          ['Amount Refunded', fmt(totalReturned), T.red],
          ['This Month', returns.filter(r=>r.date>=new Date().toISOString().slice(0,7)).length, T.amber],
        ].map(([label,val,color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Returns table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.card }}>
              {['Return No','Date','Original Invoice','Customer','Items','Amount','Refund Mode','Status'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            : returns.length === 0 ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No returns yet</td></tr>
            : returns.map(r => (
              <tr key={r.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.amber, fontFamily:'monospace', fontSize:12 }}>{r.return_num}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{r.date}</td>
                <td style={{ padding:'10px 14px', color:T.blue, fontSize:12 }}>—</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{r.customer||'Walk-in'}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{(r.items||[]).length}</td>
                <td style={{ padding:'10px 14px', color:T.red, fontWeight:700 }}>{fmt(r.total)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:T.amber+'22', color:T.amber, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{r.refund_mode}</span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:T.green+'22', color:T.green, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Return form modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Process Return — Step {step}/3</div>
              <button onClick={() => { setShowForm(false); setStep(1); setFoundSale(null); }} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>

            {/* Progress */}
            <div style={{ display:'flex', gap:6, marginBottom:20 }}>
              {[1,2,3].map(n => <div key={n} style={{ flex:1, height:4, borderRadius:2, background:n<=step?T.blue:T.bdr }} />)}
            </div>

            {/* Step 1: Find invoice */}
            {step === 1 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:12 }}>Find Original Invoice</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Invoice number or customer name"
                    onKeyDown={e=>e.key==='Enter'&&findInvoice()}
                    style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }} />
                  <button onClick={findInvoice} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Search</button>
                </div>
                {foundSale?.multiple && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:12, color:T.sub, marginBottom:8 }}>Multiple invoices found — select one:</div>
                    {foundSale.multiple.map(s => (
                      <div key={s.id} onClick={() => { setFoundSale(s); setStep(2); setReturnItems((s.items||[]).map(i=>({...i,return_qty:0,selected:false}))); }}
                        style={{ background:T.card, borderRadius:8, padding:'10px 14px', marginBottom:8, cursor:'pointer', border:`1px solid ${T.bdr}` }}>
                        <div style={{ fontSize:13, fontWeight:600, color:T.blue }}>{s.inv_num}</div>
                        <div style={{ fontSize:11, color:T.sub }}>{s.date} · {s.customer||'Walk-in'} · {fmt(s.total)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select items */}
            {step === 2 && foundSale && (
              <div>
                <div style={{ background:T.card, borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.blue }}>{foundSale.inv_num}</div>
                  <div style={{ fontSize:11, color:T.sub }}>{foundSale.date} · {foundSale.customer||'Walk-in'} · {fmt(foundSale.total)}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>Select Items to Return</div>
                {returnItems.map((item, idx) => (
                  <div key={idx} style={{ background:T.card, borderRadius:8, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                    <input type="checkbox" checked={item.selected} onChange={() => toggleItem(idx)} style={{ width:16, height:16, cursor:'pointer' }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:T.ink }}>{item.name}</div>
                      <div style={{ fontSize:11, color:T.sub }}>Qty purchased: {item.qty} · {fmt(item.rate)} each</div>
                    </div>
                    {item.selected && (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:T.sub }}>Return qty:</span>
                        <input type="number" value={item.return_qty} min={0} max={item.qty} onChange={e=>updateReturnQty(idx,e.target.value)}
                          style={{ width:60, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 8px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }} />
                      </div>
                    )}
                  </div>
                ))}
                {selectedItems.length > 0 && (
                  <div style={{ background:T.red+'18', borderRadius:8, padding:'10px 14px', marginTop:10, display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:T.sub }}>Refund Amount</span>
                    <span style={{ fontSize:16, fontWeight:800, color:T.red }}>{fmt(returnTotal)}</span>
                  </div>
                )}
                <div style={{ display:'flex', gap:10, marginTop:16 }}>
                  <button onClick={() => setStep(1)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Back</button>
                  <button onClick={() => selectedItems.length && setStep(3)} disabled={!selectedItems.length} style={{ flex:2, background:selectedItems.length?T.blue:T.bdr, color:selectedItems.length?'#fff':T.muted, border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    Continue ({selectedItems.length} items)
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:14 }}>Confirm Return</div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Return Reason *</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {RETURN_REASONS.map(r => (
                      <button key={r} onClick={() => setReason(r)} style={{ background:reason===r?T.blue:T.card, color:reason===r?'#fff':T.sub, border:`1px solid ${reason===r?T.blue:T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{r}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Refund Method</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {REFUND_MODES.map(m => (
                      <button key={m.id} onClick={() => setRefundMode(m.id)} style={{ background:refundMode===m.id?T.blue+'22':T.card, color:refundMode===m.id?T.blue:T.sub, border:`1px solid ${refundMode===m.id?T.blue:T.bdr}`, borderRadius:8, padding:'10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{m.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
                  <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes"
                    style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
                </div>
                <div style={{ background:T.red+'18', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700 }}>
                    <span style={{ color:T.ink }}>Total Refund</span>
                    <span style={{ color:T.red }}>{fmt(returnTotal)}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>{selectedItems.length} items · via {refundMode}</div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setStep(2)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Back</button>
                  <button onClick={processReturn} disabled={saving||!reason} style={{ flex:2, background:T.red, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {saving ? 'Processing…' : `Process Refund ${fmt(returnTotal)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
