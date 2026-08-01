import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };

const ROLES = {
  owner:      { label:'Owner',      color:T.purple, desc:'Full access to everything', icon:'👑' },
  manager:    { label:'Manager',    color:T.blue,   desc:'All modules except billing', icon:'🏢' },
  accountant: { label:'Accountant', color:T.teal,   desc:'Finance modules only',      icon:'📊' },
  staff:      { label:'Staff',      color:T.green,  desc:'POS, inventory, customers', icon:'👤' },
  cashier:    { label:'Cashier',    color:T.amber,  desc:'POS and cash register only',icon:'💵' },
  viewer:     { label:'Viewer',     color:T.muted,  desc:'Read-only access',          icon:'👁️' },
};

const MODULE_PERMS = [
  { group:'Sales',    modules:['pos','sales_history','returns','quotations','einvoice'] },
  { group:'Inventory',modules:['inventory','stock_transfer','stock_audit','variants','price_lists','purchase_orders'] },
  { group:'Finance',  modules:['expenses','payroll','gst_filing','gstr3b','tally_export','cash_register','advance_reports'] },
  { group:'HR',       modules:['attendance','leave_management','hr_dashboard','commissions','expense_claims'] },
  { group:'CRM',      modules:['customers','crm_pipeline','referrals','loyalty','segments','feedback'] },
  { group:'Settings', modules:['settings','app_users','branches','backup_restore','audit_log'] },
];

const ROLE_DEFAULT_PERMS = {
  owner:      MODULE_PERMS.flatMap(g=>g.modules),
  manager:    MODULE_PERMS.flatMap(g=>g.modules).filter(m=>!['app_users','backup_restore','tally_export'].includes(m)),
  accountant: ['expenses','payroll','gst_filing','gstr3b','tally_export','advance_reports','cash_register'],
  staff:      ['pos','sales_history','inventory','customers','attendance'],
  cashier:    ['pos','cash_register'],
  viewer:     ['sales_history','inventory','customers'],
};

export default function AppUsers({ tenant }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPerms,setShowPerms]= useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name:'', email:'', role:'staff' });
  const [perms,    setPerms]    = useState([]);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('app_users').select('*').eq('tenant_id', tenant.id).order('role').order('name');
    setUsers(data||[]);
    setLoading(false);
  }

  function openNew() { setEditUser(null); setForm({ name:'', email:'', role:'staff' }); setPerms(ROLE_DEFAULT_PERMS['staff']||[]); setShowForm(true); }
  function openEdit(u) { setEditUser(u); setForm({ name:u.name, email:u.email, role:u.role }); setPerms(u.permissions?.modules||ROLE_DEFAULT_PERMS[u.role]||[]); setShowForm(true); }

  function handleRoleChange(role) {
    setForm(f=>({...f,role}));
    setPerms(ROLE_DEFAULT_PERMS[role]||[]);
  }

  function togglePerm(mod) { setPerms(prev=>prev.includes(mod)?prev.filter(m=>m!==mod):[...prev,mod]); }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tenant_id:tenant.id, permissions:{ modules:perms } };
    if (editUser) await supabase.from('app_users').update(payload).eq('id', editUser.id);
    else          await supabase.from('app_users').insert(payload);
    setShowForm(false); setSaving(false); await load();
  }

  async function toggleActive(u) {
    await supabase.from('app_users').update({ active:!u.active }).eq('id', u.id);
    setUsers(prev=>prev.map(x=>x.id===u.id?{...x,active:!x.active}:x));
  }

  async function deleteUser(id) {
    if (!confirm('Remove this user?')) return;
    await supabase.from('app_users').delete().eq('id', id);
    setUsers(prev=>prev.filter(u=>u.id!==id));
  }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔐 Users & Access</div>
          <div style={{ fontSize:13, color:T.sub }}>{users.filter(u=>u.active).length} active users · Role-based permissions</div>
        </div>
        <button onClick={openNew} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add User</button>
      </div>

      {/* Role overview */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        {Object.entries(ROLES).map(([key,role])=>(
          <div key={key} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:role.color+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{role.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:role.color }}>{role.label}</div>
              <div style={{ fontSize:10, color:T.muted }}>{role.desc}</div>
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:T.ink }}>{users.filter(u=>u.role===key).length}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Name','Email','Role','Permissions','Status','Last Login','Actions'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :users.length===0?<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No users added yet</td></tr>
            :users.map(u=>{
              const role = ROLES[u.role]||ROLES.staff;
              const modCount = (u.permissions?.modules||[]).length;
              return (
                <tr key={u.id} style={{ borderBottom:`1px solid ${T.bdr}22`, opacity:u.active?1:.5 }}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{role.icon} {u.name}</td>
                  <td style={{ padding:'10px 14px', color:T.sub }}>{u.email}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:role.color+'22', color:role.color, borderRadius:5, padding:'2px 9px', fontSize:10, fontWeight:700 }}>{role.label}</span></td>
                  <td style={{ padding:'10px 14px' }}><button onClick={()=>setShowPerms(showPerms===u.id?null:u.id)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'3px 9px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{modCount} modules</button>
                    {showPerms===u.id&&<div style={{ position:'absolute', background:T.card, border:`1px solid ${T.bdr}`, borderRadius:10, padding:14, zIndex:50, width:260, marginTop:4, boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                      {MODULE_PERMS.map(g=><div key={g.group} style={{ marginBottom:8 }}><div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{g.group}</div><div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{g.modules.map(m=><span key={m} style={{ background:(u.permissions?.modules||[]).includes(m)?T.green+'22':T.bdr, color:(u.permissions?.modules||[]).includes(m)?T.green:T.muted, borderRadius:4, padding:'2px 6px', fontSize:9, textTransform:'capitalize' }}>{m.replace(/_/g,' ')}</span>)}</div></div>)}
                    </div>}
                  </td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:u.active?T.green+'22':T.red+'22', color:u.active?T.green:T.red, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{u.active?'Active':'Inactive'}</span></td>
                  <td style={{ padding:'10px 14px', color:T.muted, fontSize:11 }}>{u.last_login?new Date(u.last_login).toLocaleDateString('en-IN'):'Never'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>openEdit(u)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                      <button onClick={()=>toggleActive(u)} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{u.active?'Disable':'Enable'}</button>
                      <button onClick={()=>deleteUser(u.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
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
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{editUser?'Edit':'Add'} User</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveUser}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Full Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Email *</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required style={inp}/></div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:8 }}>Role</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {Object.entries(ROLES).map(([key,role])=>(
                    <div key={key} onClick={()=>handleRoleChange(key)} style={{ background:form.role===key?role.color+'22':T.card, border:`1px solid ${form.role===key?role.color:T.bdr}`, borderRadius:8, padding:'10px 12px', cursor:'pointer' }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{role.icon}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:form.role===key?role.color:T.ink }}>{role.label}</div>
                      <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>{role.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase' }}>Module Permissions ({perms.length})</label>
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="button" onClick={()=>setPerms(MODULE_PERMS.flatMap(g=>g.modules))} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>All</button>
                    <button type="button" onClick={()=>setPerms([])} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>None</button>
                  </div>
                </div>
                <div style={{ background:T.card, borderRadius:9, padding:12, maxHeight:220, overflowY:'auto' }}>
                  {MODULE_PERMS.map(g=>(
                    <div key={g.group} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{g.group}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {g.modules.map(mod=>(
                          <span key={mod} onClick={()=>togglePerm(mod)} style={{ background:perms.includes(mod)?T.blue+'22':T.bdr+'44', color:perms.includes(mod)?T.blue:T.muted, borderRadius:5, padding:'3px 9px', fontSize:11, cursor:'pointer', textTransform:'capitalize', border:`1px solid ${perms.includes(mod)?T.blue:T.bdr}` }}>{mod.replace(/_/g,' ')}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':(editUser?'Update User':'Add User')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
