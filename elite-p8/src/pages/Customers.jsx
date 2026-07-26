import { useState, useEffect } from 'react';
import { getCustomers, saveCustomer } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a' };
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:0 });

function CustomerForm({ customer, tenantId, onSave, onCancel }) {
  const [form, setForm] = useState(customer || { name:'', phone:'', email:'', gstin:'', address:'', credit_limit:0 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    try { await saveCustomer({ ...form, tenant_id: tenantId }); onSave(); }
    catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{customer?.id ? 'Edit Customer' : 'Add Customer'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Customer name" style={inp} required />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Mobile</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>GSTIN</label>
            <input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Credit Limit (₹)</label>
            <input type="number" value={form.credit_limit} onChange={e => set('credit_limit', parseFloat(e.target.value)||0)} style={inp} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Address</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" style={inp} />
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:8 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving…' : (customer?.id ? 'Update' : 'Add Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Customers({ tenant }) {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [editCust,  setEditCust]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getCustomers(tenant.id);
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  const filtered = customers.filter(c => !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone||'').includes(search) ||
    (c.gstin||'').toLowerCase().includes(search.toLowerCase()));

  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Customers</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>{customers.length} parties · Outstanding {fmt(totalOutstanding)}</div>
        </div>
        <button onClick={() => { setEditCust(null); setShowForm(true); }} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Customer
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Customers', customers.length, T.blue],
          ['With Outstanding', customers.filter(c => (c.outstanding||0) > 0).length, T.amber],
          ['Total Outstanding', fmt(totalOutstanding), T.red],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name, phone, GSTIN…"
        style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:14 }} />

      {loading ? <div style={{ textAlign:'center', color:T.sub, padding:40 }}>Loading…</div> : (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:T.card }}>
                {['Name','Phone','GSTIN','Outstanding','Credit Limit','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom:`1px solid ${T.bdr}44` }}
                  onMouseEnter={e => e.currentTarget.style.background=T.card}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{c.name}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{c.phone||'—'}</td>
                  <td style={{ padding:'10px 14px', color:T.sub, fontFamily:'monospace', fontSize:11 }}>{c.gstin||'—'}</td>
                  <td style={{ padding:'10px 14px', color:(c.outstanding||0)>0 ? T.red : T.muted, fontWeight:700 }}>{fmt(c.outstanding||0)}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{fmt(c.credit_limit||0)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={() => { setEditCust(c); setShowForm(true); }} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <CustomerForm customer={editCust} tenantId={tenant?.id} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
