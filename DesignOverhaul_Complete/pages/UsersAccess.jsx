import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};

const ROLES = {
  owner:      { label:'Owner',      color:'#9b72ff', perms:['all'],                              desc:'Full access to everything' },
  manager:    { label:'Manager',    color:'#4f7cff', perms:['sales','inventory','reports','hr'], desc:'Manage operations, view reports' },
  cashier:    { label:'Cashier',    color:'#00d68f', perms:['sales','customers'],                desc:'POS and customer management only' },
  accountant: { label:'Accountant', color:'#ffb547', perms:['reports','expenses','purchases'],   desc:'Financial modules access' },
  staff:      { label:'Staff',      color:'#00c9b1', perms:['sales','inventory'],               desc:'Basic sales and inventory' },
  viewer:     { label:'Viewer',     color:'#6b7598', perms:['reports'],                          desc:'Read-only access to reports' },
};

const MODULES = ['sales','inventory','customers','purchases','expenses','payroll','reports','hr','settings','gst'];

export default function UsersAccess({ tenant }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name:'', email:'', phone:'', role:'staff', pin:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('staff_users').select('*').eq('tenant_id', tenant.id).order('role').order('name');
    setUsers(data||[]);
    setLoading(false);
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    const permissions = ROLES[form.role]?.perms.includes('all') ? Object.fromEntries(MODULES.map(m=>[m,true])) : Object.fromEntries(MODULES.map(m=>[m, (ROLES[form.role]?.perms||[]).includes(m)]));
    try {
      if (editUser) await supabase.from('staff_users').update({ ...form, permissions }).eq('id', editUser.id);
      else await supabase.from('staff_users').insert({ ...form, tenant_id:tenant.id, permissions });
      setShowForm(false); setEditUser(null); setForm({ name:'', email:'', phone:'', role:'staff', pin:'' });
      await load();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(user) {
    await supabase.from('staff_users').update({ active:!user.active }).eq('id', user.id);
    setUsers(prev=>prev.map(u=>u.id===user.id?{...u,active:!user.active}:u));
  }

  function openEdit(u) { setEditUser(u); setForm({ name:u.name, email:u.email, phone:u.phone||'', role:u.role, pin:u.pin||'' }); setShowForm(true); }

  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔐 Users & Access</div>
          <div style={{ fontSize:13, color:T.sub }}>{users.filter(u=>u.active).length} active users · Role-based permissions</div>
        </div>
        <button onClick={()=>{setEditUser(null);setForm({name:'',email:'',phone:'',role:'staff',pin:''});setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add User</button>
      </div>

      {/* Role overview */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        {Object.entries(ROLES).map(([key,role])=>(
          <div key={key} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${role.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:700, color:role.color }}>{role.label}</span>
              <span style={{ fontSize:12, color:T.sub }}>{users.filter(u=>u.role===key).length} user{users.filter(u=>u.role===key).length!==1?'s':''}</span>
            </div>
            <div style={{ fontSize:11, color:T.muted }}>{role.desc}</div>
          </div>
        ))}
      </div>

      {/* Users list */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Name','Email','Phone','Role','Permissions','Last Login','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :users.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No users added yet. Add staff members to control access.</td></tr>
            :users.map(u=>(
              <tr key={u.id} style={{ borderBottom:`1px solid ${T.bdr}22`, opacity:u.active?1:0.5 }}>
                <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{u.name}</td>
                <td style={{ padding:'10px 14px', color:T.sub, fontSize:12 }}>{u.email}</td>
                <td style={{ padding:'10px 14px', color:T.muted, fontSize:12 }}>{u.phone||'—'}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:(ROLES[u.role]?.color||T.sub)+'22', color:ROLES[u.role]?.color||T.sub, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{ROLES[u.role]?.label||u.role}</span></td>
                <td style={{ padding:'10px 14px', fontSize:11, color:T.muted }}>
                  {Object.entries(u.permissions||{}).filter(([,v])=>v).map(([k])=>k).slice(0,3).join(', ')}{Object.entries(u.permissions||{}).filter(([,v])=>v).length>3?'…':''}
                </td>
                <td style={{ padding:'10px 14px', color:T.muted, fontSize:11 }}>{u.last_login?new Date(u.last_login).toLocaleDateString('en-IN'):'Never'}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ background:u.active?T.green+'22':T.muted+'22', color:u.active?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{u.active?'Active':'Inactive'}</span></td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>openEdit(u)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                    <button onClick={()=>toggleActive(u)} style={{ background:u.active?T.amber+'22':T.green+'22', color:u.active?T.amber:T.green, border:'none', borderRadius:5, padding:'4px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>{u.active?'Disable':'Enable'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{editUser?'Edit':'Add'} User</div>
              <button onClick={()=>{setShowForm(false);setEditUser(null);}} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveUser}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Full Name *','text','name'],['Email *','email','email'],['Phone','tel','phone'],['PIN (4-digit)','password','pin']].map(([label,type,key])=>(
                  <div key={key}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required={label.includes('*')} maxLength={key==='pin'?4:undefined} style={inp}/></div>
                ))}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:6 }}>Role</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                    {Object.entries(ROLES).map(([key,role])=>(
                      <div key={key} onClick={()=>setForm(f=>({...f,role:key}))} style={{ background:form.role===key?role.color+'22':T.card, border:`1px solid ${form.role===key?role.color:T.bdr}`, borderRadius:8, padding:'8px 10px', cursor:'pointer' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:role.color }}>{role.label}</div>
                        <div style={{ fontSize:10, color:T.muted }}>{role.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Permission preview */}
              <div style={{ background:T.card, borderRadius:8, padding:10, marginTop:14, marginBottom:14 }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Access Preview</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {MODULES.map(m=>{
                    const hasAccess = ROLES[form.role]?.perms.includes('all') || (ROLES[form.role]?.perms||[]).includes(m);
                    return <span key={m} style={{ background:hasAccess?T.green+'22':T.bdr, color:hasAccess?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, textTransform:'capitalize' }}>{hasAccess?'✓':''} {m}</span>;
                  })}
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>{setShowForm(false);setEditUser(null);}} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':(editUser?'Update User':'Add User')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
