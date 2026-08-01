import { useState, useEffect } from 'react';
import { getInventory, saveItem, deleteItem } from '../lib/supabase';

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
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:0 });

const CATEGORIES = ['Footwear','Bags','Clothing','Electronics','FMCG','Lifestyle','Services','Other'];
const GST_RATES  = [0, 5, 12, 18, 28];

function ItemForm({ item, tenantId, onSave, onCancel }) {
  const [form, setForm] = useState(item || { name:'', code:'', cat:'', hsn:'', sp:0, cp:0, mrp:0, gst:18, stock:0, alert:10, type:'product', unit:'Pcs' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Item name is required');
    setSaving(true);
    try {
      await saveItem({ ...form, tenant_id: tenantId, active: true });
      onSave();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{item?.id ? 'Edit Item' : 'Add New Item'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Item Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Nike Air Max" style={inp} required />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Item Code</label>
            <input value={form.code} onChange={e => set('code', e.target.value)} placeholder="SKU / Barcode" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Category</label>
            <select value={form.cat} onChange={e => set('cat', e.target.value)} style={inp}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Selling Price (₹)</label>
            <input type="number" value={form.sp} onChange={e => set('sp', parseFloat(e.target.value)||0)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Cost Price (₹)</label>
            <input type="number" value={form.cp} onChange={e => set('cp', parseFloat(e.target.value)||0)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>GST Rate (%)</label>
            <select value={form.gst} onChange={e => set('gst', parseFloat(e.target.value))} style={inp}>
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Current Stock</label>
            <input type="number" value={form.stock} onChange={e => set('stock', parseFloat(e.target.value)||0)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Reorder Level</label>
            <input type="number" value={form.alert} onChange={e => set('alert', parseFloat(e.target.value)||0)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} style={inp}>
              {['Pcs','Pairs','Kg','Gram','Litre','Box','Set','Mtr'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>HSN Code</label>
            <input value={form.hsn} onChange={e => set('hsn', e.target.value)} placeholder="e.g. 6403" style={inp} />
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:8 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving…' : (item?.id ? 'Update Item' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory({ tenant }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [editItem,setEditItem]= useState(null);
  const [showForm,setShowForm]= useState(false);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getInventory(tenant.id);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  const handleDelete = async (item) => {
    if (!confirm(`Archive "${item.name}"?`)) return;
    await deleteItem(item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.code||'').toLowerCase().includes(search.toLowerCase()));
  const lowStock  = items.filter(i => (i.stock||0) <= (i.alert||10));
  const totalVal  = items.reduce((s, i) => s + (i.stock||0) * (i.cp||0), 0);

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Inventory</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>{items.length} items · Stock value {fmt(totalVal)}</div>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Item
        </button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:T.amber }}>
          ⚠️ {lowStock.length} item{lowStock.length > 1 ? 's' : ''} low on stock: {lowStock.slice(0,3).map(i => i.name).join(', ')}{lowStock.length > 3 ? '…' : ''}
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Items', items.length, T.blue],
          ['Low Stock',   lowStock.length, T.amber],
          ['Out of Stock',items.filter(i => (i.stock||0) === 0).length, T.red],
          ['Stock Value', fmt(totalVal), T.green],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name or code…"
        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14 }} />

      {/* Table */}
      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:40 }}>Loading…</div> : (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['Item Name','Code','Category','SP','CP','GST','Stock','Value','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}44` }}
                  onMouseEnter={e => e.currentTarget.style.background=T.card}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{item.name}</td>
                  <td style={{ padding:'10px 14px', color:T.sub, fontFamily:'monospace', fontSize:12 }}>{item.code||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{item.cat||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(item.sp)}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{fmt(item.cp)}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{item.gst||18}%</td>
                  <td style={{ padding:'10px 14px', color: (item.stock||0) <= (item.alert||10) ? T.amber : T.ink, fontWeight:700 }}>{item.stock||0}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{fmt((item.stock||0)*(item.cp||0))}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => { setEditItem(item); setShowForm(true); }} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                      <button onClick={() => handleDelete(item)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:T.muted }}>No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ItemForm item={editItem} tenantId={tenant?.id} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
