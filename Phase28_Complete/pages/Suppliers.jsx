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

async function getSuppliers(tenantId) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId).eq('active', true).order('name');
  if (error) throw error;
  return data || [];
}

async function saveSupplier(supplier) {
  const { data, error } = supplier.id
    ? await supabase.from('suppliers').update(supplier).eq('id', supplier.id).select().single()
    : await supabase.from('suppliers').insert(supplier).select().single();
  if (error) throw error;
  return data;
}

function SupplierForm({ supplier, tenantId, onSave, onCancel }) {
  const [form,   setForm]   = useState(supplier || { name:'', phone:'', email:'', gstin:'', address:'', payment_terms:30, credit_limit:0, bank_name:'', account_no:'', ifsc:'', upi_id:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [tab,    setTab]    = useState('basic');
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 };

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Supplier name required');
    setSaving(true);
    try { await saveSupplier({ ...form, tenant_id: tenantId }); onSave(); }
    catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:540, margin:'20px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{supplier?.id ? 'Edit Supplier' : 'Add Supplier'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:18 }}>
          {[['basic','Basic Info'],['payment','Payment'],['bank','Bank Details']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background:tab===id?T.blue:T.card, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
        </div>
        <form onSubmit={handleSave}>
          {tab === 'basic' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Supplier Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Nike India Pvt Ltd" style={inp} required/></div>
              <div><label style={lbl}>Phone</label><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} style={inp}/></div>
              <div><label style={lbl}>GSTIN</label><input value={form.gstin||''} onChange={e=>set('gstin',e.target.value.toUpperCase())} maxLength={15} style={inp}/></div>
              <div><label style={lbl}>UPI ID</label><input value={form.upi_id||''} onChange={e=>set('upi_id',e.target.value)} placeholder="supplier@upi" style={inp}/></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Address</label><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={inp}/></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Notes</label><input value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Any notes about this supplier" style={inp}/></div>
            </div>
          )}
          {tab === 'payment' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Payment Terms (Days)</label><input type="number" value={form.payment_terms||30} onChange={e=>set('payment_terms',parseInt(e.target.value)||30)} style={inp}/><div style={{ fontSize:10, color:T.muted, marginTop:3 }}>e.g. 30 = Net 30 days</div></div>
              <div><label style={lbl}>Credit Limit (Rs.)</label><input type="number" value={form.credit_limit||0} onChange={e=>set('credit_limit',parseFloat(e.target.value)||0)} style={inp}/></div>
            </div>
          )}
          {tab === 'bank' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Bank Name</label><input value={form.bank_name||''} onChange={e=>set('bank_name',e.target.value)} placeholder="e.g. HDFC Bank" style={inp}/></div>
              <div><label style={lbl}>Account No.</label><input value={form.account_no||''} onChange={e=>set('account_no',e.target.value)} style={inp}/></div>
              <div><label style={lbl}>IFSC Code</label><input value={form.ifsc||''} onChange={e=>set('ifsc',e.target.value.toUpperCase())} style={inp}/></div>
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving…' : supplier?.id ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Suppliers({ tenant }) {
  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [purchases,  setPurchases]  = useState([]);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getSuppliers(tenant.id);
    setSuppliers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  async function loadPurchases(supplierId) {
    const { data } = await supabase.from('purchases').select('*').eq('tenant_id', tenant.id).eq('supplier', supplierId).order('date', { ascending:false }).limit(20);
    setPurchases(data || []);
  }

  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone||'').includes(search));
  const totalOwed = suppliers.reduce((s, x) => s + (x.outstanding||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Suppliers</div>
          <div style={{ fontSize:13, color:T.sub }}>{suppliers.length} suppliers · Total payable {fmt(totalOwed)}</div>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Supplier
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Total Suppliers', suppliers.length, T.blue],['Total Payable', fmt(totalOwed), T.red],['Overdue', suppliers.filter(s=>(s.outstanding||0)>0).length + ' suppliers', T.amber]].map(([label,val,color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search suppliers…"
        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14 }} />

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:16 }}>
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['Name','Phone','GSTIN','Terms','Outstanding','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No suppliers yet — add your first supplier</td></tr>
              : filtered.map(s => (
                <tr key={s.id} style={{ borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===s.id?T.card:'transparent' }}
                  onClick={() => { setSelected(s); loadPurchases(s.name); }}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{s.name}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{s.phone||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.sub, fontFamily:'monospace', fontSize:11 }}>{s.gstin||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>Net {s.payment_terms||30}</td>
                  <td style={{ padding:'10px 14px', color:(s.outstanding||0)>0?T.red:T.muted, fontWeight:700 }}>{fmt(s.outstanding||0)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={e => { e.stopPropagation(); setEditItem(s); setShowForm(true); }}
                      style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, color:T.ink }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ padding:16 }}>
              {[['Phone', selected.phone],['Email', selected.email],['GSTIN', selected.gstin],['UPI', selected.upi_id],['Payment Terms', `Net ${selected.payment_terms} days`],['Bank', selected.bank_name ? `${selected.bank_name} · ${selected.account_no}` : '—']].map(([label,val]) => val ? (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
                  <span style={{ color:T.sub }}>{label}</span>
                  <span style={{ color:T.ink }}>{val}</span>
                </div>
              ) : null)}
              <div style={{ marginTop:14, fontWeight:700, color:T.ink, marginBottom:10 }}>Recent Purchases</div>
              {purchases.map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                  <span style={{ color:T.sub }}>{p.date}</span>
                  <span style={{ color:T.sub }}>{p.invoice_ref||'—'}</span>
                  <span style={{ color:T.amber, fontWeight:700 }}>{fmt(p.total)}</span>
                </div>
              ))}
              {!purchases.length && <div style={{ color:T.muted, fontSize:12 }}>No purchases recorded for this supplier</div>}
            </div>
          </div>
        )}
      </div>

      {showForm && <SupplierForm supplier={editItem} tenantId={tenant?.id} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
