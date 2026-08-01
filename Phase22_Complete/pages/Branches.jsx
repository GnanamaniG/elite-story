import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff' };

// ── Branch CRUD helpers ────────────────────────────────────────
async function getBranches(tenantId) {
  const { data, error } = await supabase.from('branches').select('*').eq('tenant_id', tenantId).order('is_main', { ascending: false }).order('name');
  if (error) throw error;
  return data || [];
}

async function saveBranch(branch) {
  const { data, error } = branch.id
    ? await supabase.from('branches').update(branch).eq('id', branch.id).select().single()
    : await supabase.from('branches').insert(branch).select().single();
  if (error) throw error;
  return data;
}

async function getBranchStats(branchId) {
  const [sales, inventory, expenses] = await Promise.all([
    supabase.from('sales').select('total').eq('branch_id', branchId),
    supabase.from('inventory').select('stock,cp').eq('branch_id', branchId).eq('active', true),
    supabase.from('expenses').select('amount').eq('branch_id', branchId),
  ]);
  const revenue  = (sales.data||[]).reduce((s,x) => s+(x.total||0), 0);
  const stockVal = (inventory.data||[]).reduce((s,x) => s+(x.stock||0)*(x.cp||0), 0);
  const expTotal = (expenses.data||[]).reduce((s,x) => s+(x.amount||0), 0);
  return { revenue, stockVal, expTotal, items: (inventory.data||[]).length };
}

// ── Branch Form ────────────────────────────────────────────────
function BranchForm({ branch, tenantId, onSave, onCancel }) {
  const [form,   setForm]   = useState(branch || { name:'', address:'', phone:'', manager:'' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Branch name required');
    setSaving(true);
    try { await saveBranch({ ...form, tenant_id: tenantId }); onSave(); }
    catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{branch?.id ? 'Edit Branch' : 'Add New Branch'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Branch Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Elite Store - Coimbatore" style={inp} required />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Phone</label>
            <input value={form.phone||''} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Manager</label>
            <input value={form.manager||''} onChange={e => set('manager', e.target.value)} placeholder="Branch manager name" style={inp} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Address</label>
            <input value={form.address||''} onChange={e => set('address', e.target.value)} placeholder="Full branch address" style={inp} />
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:8 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving…' : branch?.id ? 'Update Branch' : 'Add Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Branch Card ────────────────────────────────────────────────
function BranchCard({ branch, onEdit, onSelect, isSelected }) {
  const [stats, setStats] = useState(null);
  const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

  useEffect(() => {
    getBranchStats(branch.id).then(setStats).catch(() => {});
  }, [branch.id]);

  return (
    <div style={{
      background: isSelected ? T.blue+'18' : T.srf,
      border: `1px solid ${isSelected ? T.blue : T.bdr}`,
      borderRadius:12, padding:20, cursor:'pointer',
      transition:'border-color .15s',
    }} onClick={() => onSelect(branch)}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{branch.name}</div>
            {branch.is_main && <span style={{ background:T.purple+'22', color:T.purple, borderRadius:5, padding:'1px 8px', fontSize:10, fontWeight:700 }}>MAIN</span>}
            {!branch.active && <span style={{ background:T.red+'22', color:T.red, borderRadius:5, padding:'1px 8px', fontSize:10, fontWeight:700 }}>INACTIVE</span>}
          </div>
          {branch.address && <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{branch.address}</div>}
          {branch.manager && <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>👤 {branch.manager}</div>}
          {branch.phone   && <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>📞 {branch.phone}</div>}
        </div>
        <button onClick={e => { e.stopPropagation(); onEdit(branch); }}
          style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>
          Edit
        </button>
      </div>

      {stats ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            ['Revenue', fmt(stats.revenue),  T.green],
            ['Expenses', fmt(stats.expTotal), T.red],
            ['Stock Value', fmt(stats.stockVal), T.amber],
            ['Items', stats.items, T.blue],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background:T.card, borderRadius:8, padding:'8px 12px' }}>
              <div style={{ fontSize:9, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:700, color }}>{val}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize:12, color:T.muted }}>Loading stats…</div>
      )}
    </div>
  );
}

// ── Main Branches Page ─────────────────────────────────────────
export default function Branches({ tenant }) {
  const [branches,    setBranches]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editBranch,  setEditBranch]  = useState(null);
  const [selected,    setSelected]    = useState(null);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getBranches(tenant.id);
    setBranches(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Branches</div>
          <div style={{ fontSize:13, color:T.sub }}>{branches.length} branch{branches.length !== 1 ? 'es' : ''}</div>
        </div>
        <button onClick={() => { setEditBranch(null); setShowForm(true); }}
          style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Branch
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading branches…</div>
      ) : branches.length === 0 ? (
        <div style={{ textAlign:'center', color:T.muted, padding:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏪</div>
          <div style={{ fontSize:16, fontWeight:600, color:T.sub, marginBottom:8 }}>No branches yet</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Run the SQL migration first, then add branches here</div>
          <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add First Branch
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {branches.map(branch => (
            <BranchCard
              key={branch.id}
              branch={branch}
              isSelected={selected?.id === branch.id}
              onSelect={setSelected}
              onEdit={b => { setEditBranch(b); setShowForm(true); }}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop:20, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px', fontSize:12, color:T.muted, lineHeight:1.8 }}>
        <strong style={{ color:T.ink }}>💡 Multi-branch setup:</strong><br/>
        1. Run <code style={{ background:T.srf, padding:'1px 6px', borderRadius:4 }}>004_branches.sql</code> in Supabase SQL Editor<br/>
        2. Add your branches here<br/>
        3. Select a branch in the POS topbar when billing<br/>
        4. Reports will show combined or per-branch data
      </div>

      {showForm && (
        <BranchForm
          branch={editBranch}
          tenantId={tenant?.id}
          onSave={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
