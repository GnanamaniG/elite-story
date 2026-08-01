import { useState, useEffect } from 'react';
import { getExpenses, saveExpense } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};
const fmt = n => '₹' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const CATEGORIES = ['Rent','Salaries','Electricity','Internet','Packaging','Transport','Marketing','Maintenance','Purchases','Miscellaneous'];

export default function Expenses({ tenant }) {
  const [expenses, setExpenses] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ date: new Date().toISOString().slice(0,10), category:'', amount:'', note:'' });
  const [saving,   setSaving]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getExpenses(tenant.id);
    setExpenses(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.category || !form.amount) return alert('Category and amount required');
    setSaving(true);
    try {
      await saveExpense({ ...form, amount: parseFloat(form.amount), tenant_id: tenant.id });
      setShowForm(false);
      setForm({ date: new Date().toISOString().slice(0,10), category:'', amount:'', note:'' });
      load();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  const total     = expenses.reduce((s, e) => s + (e.amount||0), 0);
  const thisMonth = expenses.filter(e => e.date >= new Date().toISOString().slice(0,7)).reduce((s, e) => s + (e.amount||0), 0);

  // Category breakdown
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category]||0) + (e.amount||0);
    return acc;
  }, {});

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Expenses</div>
          <div style={{ fontSize:13, color:T.sub }}>{expenses.length} records · Total {fmt(total)}</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Expense
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
        {[
          ['This Month', fmt(thisMonth), T.amber],
          ['Total', fmt(total), T.red],
          ['Categories', Object.keys(byCategory).length, T.blue],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Expenses list */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Recent Expenses</div>
          {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div> : (
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {expenses.map(exp => (
                <div key={exp.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{exp.category}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{exp.date}{exp.note ? ' · ' + exp.note : ''}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.red }}>{fmt(exp.amount)}</div>
                </div>
              ))}
              {!expenses.length && <div style={{ padding:40, textAlign:'center', color:T.muted }}>No expenses recorded yet</div>}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>By Category</div>
          <div style={{ padding:12 }}>
            {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
              <div key={cat} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:T.ink }}>{cat}</span>
                  <span style={{ color:T.amber, fontWeight:700 }}>{fmt(amt)}</span>
                </div>
                <div style={{ height:5, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:T.amber, width:`${Math.min(100,(amt/total*100))}%`, borderRadius:3 }} />
                </div>
              </div>
            ))}
            {!Object.keys(byCategory).length && <div style={{ color:T.muted, fontSize:12, textAlign:'center', padding:20 }}>No data yet</div>}
          </div>
        </div>
      </div>

      {/* Add expense modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Expense</div>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} style={inp} required>
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Amount (₹) *</label>
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" style={inp} required />
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Note</label>
                <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional description" style={inp} />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving ? 'Saving…' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
