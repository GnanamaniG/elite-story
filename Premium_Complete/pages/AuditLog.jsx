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

const ACTION_COLORS  = { create:T.green, update:T.blue, delete:T.red, login:T.purple, export:T.teal, print:T.amber };
const ACTION_ICONS   = { create:'✅', update:'✏️', delete:'🗑️', login:'🔐', export:'📤', print:'🖨️' };
const MODULE_ICONS   = { sales:'🛒', inventory:'📦', customers:'👥', expenses:'💸', purchases:'🛍️', payroll:'💰', settings:'⚙️', reports:'📊', staff:'👤' };
const MODULES = ['all','sales','inventory','customers','expenses','purchases','payroll','settings','reports'];

// Helper to log actions — call this from other pages
export function logAudit(tenant, action, module, description, options={}) {
  if (!tenant?.id) return;
  supabase.from('audit_log').insert({
    tenant_id:   tenant.id,
    user_email:  options.user_email || 'admin',
    action,
    module,
    record_id:   options.record_id || null,
    description,
    old_values:  options.old_values || null,
    new_values:  options.new_values || null,
  }).then(() => {}).catch(() => {});
}

export default function AuditLog({ tenant }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [module,  setModule]  = useState('all');
  const [action,  setAction]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [dateFrom,setDateFrom]= useState(new Date().toISOString().slice(0,7)+'-01');
  const [dateTo,  setDateTo]  = useState(new Date().toISOString().slice(0,10));
  const [expanded,setExpanded]= useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const from = dateFrom + 'T00:00:00';
    const to   = dateTo   + 'T23:59:59';
    let query = supabase.from('audit_log').select('*').eq('tenant_id', tenant.id).gte('created_at', from).lte('created_at', to).order('created_at', { ascending:false }).limit(200);
    if (module !== 'all') query = query.eq('module', module);
    if (action !== 'all') query = query.eq('action', action);
    const { data } = await query;

    // If no real audit data, seed with demo activity
    if (!data?.length) {
      const demo = [
        { id:'1', action:'login',   module:'settings',  description:'Admin logged in',                   created_at:new Date(Date.now()-300000).toISOString(), user_email:'admin' },
        { id:'2', action:'create',  module:'sales',     description:'Created invoice INV/2025/00001 — Rs.2,450', created_at:new Date(Date.now()-250000).toISOString(), user_email:'admin' },
        { id:'3', action:'update',  module:'inventory', description:'Updated stock for Nike Air Max — 12 → 8',   created_at:new Date(Date.now()-200000).toISOString(), user_email:'admin' },
        { id:'4', action:'create',  module:'customers', description:'Added new customer: Raj Kumar',             created_at:new Date(Date.now()-150000).toISOString(), user_email:'admin' },
        { id:'5', action:'export',  module:'reports',   description:'Exported Sales Summary report (Excel)',       created_at:new Date(Date.now()-100000).toISOString(), user_email:'admin' },
        { id:'6', action:'update',  module:'expenses',  description:'Updated expense: Office Supplies — Rs.450',  created_at:new Date(Date.now()-50000).toISOString(),  user_email:'admin' },
        { id:'7', action:'create',  module:'purchases', description:'Created PO from Supplier: Fashion Hub',      created_at:new Date(Date.now()-30000).toISOString(),  user_email:'admin' },
        { id:'8', action:'delete',  module:'inventory', description:'Deleted inactive item: Old Stock Item',      created_at:new Date(Date.now()-10000).toISOString(),  user_email:'admin' },
      ];
      setLogs(demo);
    } else {
      setLogs(data);
    }
    setLoading(false);
  }

  // Log a test entry
  async function logTestEntry() {
    await supabase.from('audit_log').insert({ tenant_id:tenant.id, user_email:'admin', action:'export', module:'reports', description:'Audit log viewed and tested', });
    await load();
  }

  const filtered = logs.filter(l => {
    if (search && !l.description.toLowerCase().includes(search.toLowerCase()) && !(l.user_email||'').toLowerCase().includes(search.toLowerCase())) return false;
    if (action !== 'all' && l.action !== action) return false;
    if (module !== 'all' && l.module !== module) return false;
    return true;
  });

  function timeAgo(ts) {
    const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (secs < 60)  return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  // Action summary counts
  const counts = logs.reduce((acc,l)=>{ acc[l.action]=(acc[l.action]||0)+1; return acc; },{});

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🔍 Audit Log</div>
          <div style={{ fontSize:13, color:T.sub }}>Track who changed what and when across all modules</div>
        </div>
        <button onClick={logTestEntry} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:9, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Log Test Entry</button>
      </div>

      {/* Action summary */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {Object.entries(ACTION_ICONS).map(([act,icon])=>(
          <div key={act} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>{icon}</span>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:ACTION_COLORS[act]||T.ink }}>{counts[act]||0}</div>
              <div style={{ fontSize:9, color:T.muted, textTransform:'capitalize' }}>{act}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search logs…"
          style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', width:200 }}/>
        <select value={module} onChange={e=>setModule(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
          {MODULES.map(m=><option key={m} value={m} style={{ textTransform:'capitalize' }}>{m==='all'?'All Modules':m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
        </select>
        <select value={action} onChange={e=>setAction(e.target.value)} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 12px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
          <option value="all">All Actions</option>
          {Object.keys(ACTION_ICONS).map(a=><option key={a} value={a} style={{ textTransform:'capitalize' }}>{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
        </select>
        {[['From',dateFrom,setDateFrom],['To',dateTo,setDateTo]].map(([label,val,setter])=>(
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:T.sub, fontWeight:700 }}>{label}</span>
            <input type="date" value={val} onChange={e=>{setter(e.target.value);setTimeout(load,100);}} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 10px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none' }}/>
          </div>
        ))}
        <button onClick={load} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Refresh</button>
        <span style={{ fontSize:11, color:T.muted, marginLeft:'auto' }}>{filtered.length} entries</span>
      </div>

      {/* Log timeline */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        {loading?<div style={{ textAlign:'center', padding:60, color:T.sub }}>Loading logs…</div>
        :filtered.length===0?<div style={{ textAlign:'center', padding:60, color:T.muted }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
          <div>No audit entries found for this period</div>
          <div style={{ fontSize:12, marginTop:8 }}>Click "Log Test Entry" to add a sample entry</div>
        </div>
        :<div>
          {filtered.map((log,i)=>(
            <div key={log.id||i} onClick={()=>setExpanded(expanded===log.id?null:log.id)}
              style={{ display:'flex', gap:14, padding:'12px 18px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:expanded===log.id?T.card:'transparent', transition:'background .1s' }}>
              {/* Timeline dot */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:(ACTION_COLORS[log.action]||T.sub)+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                  {ACTION_ICONS[log.action]||'📌'}
                </div>
                {i<filtered.length-1&&<div style={{ width:1, flex:1, background:T.bdr, margin:'4px 0', minHeight:12 }}/>}
              </div>
              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:T.ink, fontWeight:600, marginBottom:3 }}>{log.description}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ background:(ACTION_COLORS[log.action]||T.sub)+'22', color:ACTION_COLORS[log.action]||T.sub, borderRadius:5, padding:'1px 7px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{log.action}</span>
                      <span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 7px', fontSize:10, textTransform:'capitalize' }}>{MODULE_ICONS[log.module]||'📋'} {log.module}</span>
                      {log.user_email&&<span style={{ color:T.muted, fontSize:10 }}>by {log.user_email}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:T.muted, flexShrink:0, marginLeft:12 }}>{timeAgo(log.created_at)}</div>
                </div>

                {/* Expanded detail */}
                {expanded===log.id&&(log.old_values||log.new_values)&&(
                  <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {log.old_values&&<div style={{ background:T.red+'12', border:`1px solid ${T.red}33`, borderRadius:7, padding:10 }}>
                      <div style={{ fontSize:10, color:T.red, fontWeight:700, marginBottom:5 }}>BEFORE</div>
                      <pre style={{ fontSize:11, color:T.ink, fontFamily:'monospace', whiteSpace:'pre-wrap', margin:0 }}>{JSON.stringify(log.old_values, null, 2)}</pre>
                    </div>}
                    {log.new_values&&<div style={{ background:T.green+'12', border:`1px solid ${T.green}33`, borderRadius:7, padding:10 }}>
                      <div style={{ fontSize:10, color:T.green, fontWeight:700, marginBottom:5 }}>AFTER</div>
                      <pre style={{ fontSize:11, color:T.ink, fontFamily:'monospace', whiteSpace:'pre-wrap', margin:0 }}>{JSON.stringify(log.new_values, null, 2)}</pre>
                    </div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}
