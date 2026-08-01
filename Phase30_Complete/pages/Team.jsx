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

const ROLES = [
  { id:'admin',    label:'Admin',    desc:'Full access — can manage settings, team, and all data', color:T.red },
  { id:'manager',  label:'Manager',  desc:'Can view reports, manage inventory, customers, expenses', color:T.amber },
  { id:'staff',    label:'Staff',    desc:'Can use POS, add customers and inventory only', color:T.blue },
  { id:'readonly', label:'Read Only',desc:'View only — cannot create or modify any data', color:T.muted },
];

export default function Team({ tenant, user }) {
  const [members,    setMembers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email:'', name:'', role:'staff' });
  const [inviting,   setInviting]   = useState(false);
  const [message,    setMessage]    = useState('');

  useEffect(() => { if (tenant?.id) loadMembers(); }, [tenant?.id]);

  async function loadMembers() {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('tenant_id', tenant.id).order('created_at');
    if (!error) setMembers(data || []);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.name) return alert('Email and name required');
    setInviting(true); setMessage('');
    try {
      // Create user record (they'll sign up themselves)
      const { error } = await supabase.from('users').insert({
        tenant_id: tenant.id,
        name:      inviteForm.name,
        email:     inviteForm.email,
        role:      inviteForm.role,
        active:    true,
      });
      if (error) throw error;
      setMessage(`✅ ${inviteForm.name} added! Ask them to sign up at elite-story.vercel.app with ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email:'', name:'', role:'staff' });
      loadMembers();
    } catch (e) { setMessage('❌ Error: ' + e.message); }
    finally { setInviting(false); }
  }

  async function updateRole(memberId, newRole) {
    await supabase.from('users').update({ role: newRole }).eq('id', memberId);
    setMembers(m => m.map(x => x.id === memberId ? { ...x, role: newRole } : x));
  }

  async function toggleActive(member) {
    const newActive = !member.active;
    await supabase.from('users').update({ active: newActive }).eq('id', member.id);
    setMembers(m => m.map(x => x.id === member.id ? { ...x, active: newActive } : x));
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20, maxWidth:800 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Team</div>
          <div style={{ fontSize:13, color:T.sub }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={() => setShowInvite(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Add Member
        </button>
      </div>

      {message && (
        <div style={{ background:message.startsWith('✅')?T.green+'18':T.red+'18', border:`1px solid ${message.startsWith('✅')?T.green:T.red}44`, borderRadius:9, padding:'12px 16px', color:message.startsWith('✅')?T.green:T.red, fontSize:13, marginBottom:16 }}>
          {message}
        </div>
      )}

      {/* Role legend */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {ROLES.map(role => (
          <div key={role.id} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px 14px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:role.color, marginBottom:4 }}>{role.label}</div>
            <div style={{ fontSize:10.5, color:T.muted, lineHeight:1.5 }}>{role.desc}</div>
          </div>
        ))}
      </div>

      {/* Members list */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div> :
          members.map(member => {
            const role = ROLES.find(r => r.id === member.role) || ROLES[2];
            const isMe = member.email === user?.email;
            return (
              <div key={member.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom:`1px solid ${T.bdr}22`, opacity:member.active?1:0.5 }}>
                {/* Avatar */}
                <div style={{ width:40, height:40, borderRadius:'50%', background:role.color+'33', color:role.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 }}>
                  {(member.name||'?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>
                    {member.name} {isMe && <span style={{ fontSize:10, background:T.blue+'22', color:T.blue, borderRadius:4, padding:'1px 6px' }}>You</span>}
                  </div>
                  <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{member.email || 'No email'}</div>
                </div>

                {/* Role selector */}
                <select
                  value={member.role}
                  onChange={e => updateRole(member.id, e.target.value)}
                  disabled={isMe}
                  style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 10px', color:role.color, fontSize:12, fontFamily:'inherit', outline:'none', fontWeight:700, cursor:isMe?'not-allowed':'pointer' }}>
                  {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>

                {/* Active toggle */}
                {!isMe && (
                  <button onClick={() => toggleActive(member)} style={{
                    background: member.active ? T.green+'22' : T.red+'22',
                    color: member.active ? T.green : T.red,
                    border: `1px solid ${member.active ? T.green : T.red}44`,
                    borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit'
                  }}>
                    {member.active ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>
            );
          })
        }
      </div>

      {/* Add member modal */}
      {showInvite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Add Team Member</div>
              <button onClick={() => setShowInvite(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={handleInvite} style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Full Name *</label>
                <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name:e.target.value }))} placeholder="Staff member name" style={inp} required />
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Email *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email:e.target.value }))} placeholder="staff@example.com" style={inp} required />
              </div>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role:e.target.value }))} style={inp}>
                  {ROLES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.desc.slice(0,40)}…</option>)}
                </select>
              </div>
              <div style={{ background:T.card, borderRadius:8, padding:'10px 14px', fontSize:12, color:T.muted, lineHeight:1.6 }}>
                💡 The staff member needs to sign up at <strong style={{ color:T.blue }}>elite-story.vercel.app</strong> using this email address to access the app.
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={inviting} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {inviting ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
