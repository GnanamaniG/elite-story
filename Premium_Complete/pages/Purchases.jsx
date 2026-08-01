import { useState, useEffect } from 'react';
import { getPurchases, savePurchase, getInventory, updateStock } from '../lib/supabase';

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
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

export default function Purchases({ tenant }) {
  const [purchases, setPurchases] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({ date: new Date().toISOString().slice(0,10), supplier:'', invoice_ref:'', items:[], notes:'' });
  const [cartItem,  setCartItem]  = useState({ item_id:'', name:'', qty:1, rate:0, gst:18 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [pur, inv] = await Promise.all([getPurchases(tenant.id), getInventory(tenant.id)]);
    setPurchases(pur); setInventory(inv);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  function addItem() {
    if (!cartItem.name || !cartItem.qty || !cartItem.rate) return alert('Fill item details');
    const amount = cartItem.qty * cartItem.rate;
    const gstAmt = amount * cartItem.gst / (100 + cartItem.gst);
    setForm(f => ({ ...f, items: [...f.items, { ...cartItem, amount, gstAmt }] }));
    setCartItem({ item_id:'', name:'', qty:1, rate:0, gst:18 });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.supplier || !form.items.length) return alert('Supplier and items required');
    setSaving(true);
    try {
      const subtotal  = form.items.reduce((s, i) => s + i.amount, 0);
      const gstAmount = form.items.reduce((s, i) => s + i.gstAmt, 0);
      const purchase  = { ...form, tenant_id: tenant.id, subtotal, gst_amount: gstAmount, total: subtotal, paid: subtotal, status: 'received' };
      await savePurchase(purchase);

      // Update stock for each item
      for (const item of form.items) {
        if (item.item_id) {
          const inv = inventory.find(i => i.id === item.item_id);
          if (inv) await updateStock(item.item_id, (inv.stock||0) + item.qty);
        }
      }
      setShowForm(false);
      setForm({ date: new Date().toISOString().slice(0,10), supplier:'', invoice_ref:'', items:[], notes:'' });
      load();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const total = purchases.reduce((s, p) => s + (p.total||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Purchases</div>
          <div style={{ fontSize:13, color:T.sub }}>{purchases.length} orders · Total {fmt(total)}</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Purchase
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Orders', purchases.length, T.blue],
          ['Total Value', fmt(total), T.amber],
          ['This Month', fmt(purchases.filter(p => p.date >= new Date().toISOString().slice(0,7)).reduce((s,p)=>s+(p.total||0),0)), T.green],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Purchases table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.card }}>
              {['Date','Supplier','Invoice Ref','Items','Total','Status'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No purchases yet — click "+ Add Purchase" to record your first</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', color:T.sub }}>{p.date}</td>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{p.supplier}</td>
                <td style={{ padding:'10px 14px', color:T.sub, fontFamily:'monospace', fontSize:12 }}>{p.invoice_ref||'—'}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{(p.items||[]).length} items</td>
                <td style={{ padding:'10px 14px', color:T.amber, fontWeight:700 }}>{fmt(p.total)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:T.green+'22', color:T.green, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:600 }}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add purchase modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Purchase</div>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Date</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Supplier *</label>
                  <input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Supplier name" style={inp} required />
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Invoice Ref</label>
                  <input value={form.invoice_ref} onChange={e => set('invoice_ref', e.target.value)} placeholder="Supplier invoice no" style={inp} />
                </div>
              </div>

              {/* Add items */}
              <div style={{ background:T.card, borderRadius:10, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.sub, marginBottom:10 }}>ADD ITEMS</div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:8, alignItems:'end' }}>
                  <div>
                    <label style={{ fontSize:10, color:T.muted, display:'block', marginBottom:4 }}>Item</label>
                    <select value={cartItem.item_id} onChange={e => {
                      const inv = inventory.find(i => i.id === e.target.value);
                      setCartItem(c => ({ ...c, item_id: e.target.value, name: inv?.name||'', rate: inv?.cp||0, gst: inv?.gst||18 }));
                    }} style={{ ...inp, padding:'7px 10px', fontSize:12 }}>
                      <option value="">Select item…</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:T.muted, display:'block', marginBottom:4 }}>Qty</label>
                    <input type="number" value={cartItem.qty} onChange={e => setCartItem(c => ({ ...c, qty: parseFloat(e.target.value)||1 }))} style={{ ...inp, padding:'7px 10px', fontSize:12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:T.muted, display:'block', marginBottom:4 }}>Rate ₹</label>
                    <input type="number" value={cartItem.rate} onChange={e => setCartItem(c => ({ ...c, rate: parseFloat(e.target.value)||0 }))} style={{ ...inp, padding:'7px 10px', fontSize:12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:T.muted, display:'block', marginBottom:4 }}>GST %</label>
                    <select value={cartItem.gst} onChange={e => setCartItem(c => ({ ...c, gst: parseFloat(e.target.value) }))} style={{ ...inp, padding:'7px 10px', fontSize:12 }}>
                      {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={addItem} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>+</button>
                </div>

                {form.items.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    {form.items.map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.sub, padding:'5px 0', borderBottom:`1px solid ${T.bdr}33` }}>
                        <span style={{ color:T.ink }}>{item.name}</span>
                        <span>{item.qty} × ₹{item.rate} = {fmt(item.amount)}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_,j) => j!==i) }))} style={{ background:'none', border:'none', color:T.red, cursor:'pointer' }}>×</button>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'flex-end', fontSize:13, fontWeight:700, color:T.amber, marginTop:8 }}>
                      Total: {fmt(form.items.reduce((s,i) => s+i.amount, 0))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" style={inp} />
              </div>

              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving ? 'Saving…' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
