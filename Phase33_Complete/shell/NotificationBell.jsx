import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const SEV = {
  critical: { color:'#C0392B', bg:'#FEF2F2', bdr:'#FECACA' },
  warning:  { color:'#D97706', bg:'#FFFBEB', bdr:'#FDE68A' },
  info:     { color:'#2563EB', bg:'#EFF6FF', bdr:'#BFDBFE' },
};

export default function NotificationBell({ tenant, onNavigate }) {
  const [open,   setOpen]   = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading,setLoading]= useState(false);
  const [dismissed, setDismissed] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (!tenant?.id) return;
    scan();
    const iv = setInterval(scan, 5*60*1000); // refresh every 5 min
    return () => clearInterval(iv);
  }, [tenant?.id]);

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  async function scan() {
    setLoading(true);
    const today = new Date().toISOString().slice(0,10);
    const in7   = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    const in30  = new Date(Date.now()+30*86400000).toISOString().slice(0,10);

    const [inv, batches, docs, comp, reminders, tasks, smart] = await Promise.all([
      supabase.from('inventory').select('id,name,stock,alert').eq('tenant_id',tenant.id).eq('active',true),
      supabase.from('product_batches').select('id,item_name,expiry_date,qty_remaining').eq('tenant_id',tenant.id).eq('status','active').lte('expiry_date',in30).gt('qty_remaining',0).limit(10),
      supabase.from('document_expiry').select('id,doc_name,expiry_date').eq('tenant_id',tenant.id).lte('expiry_date',in30).limit(10),
      supabase.from('compliance_calendar').select('id,title,due_date').eq('tenant_id',tenant.id).eq('status','pending').lte('due_date',in7).limit(10),
      supabase.from('payment_reminders').select('id,customer,amount_due,days_overdue').eq('tenant_id',tenant.id).eq('status','pending').gt('days_overdue',30).limit(10),
      supabase.from('staff_tasks').select('id,title,due_date').eq('tenant_id',tenant.id).neq('status','done').lt('due_date',today).limit(10),
      supabase.from('smart_alerts').select('id,title,message,type,due_date').eq('tenant_id',tenant.id).eq('dismissed',false).lte('due_date',today).limit(10),
    ]);

    const out = [];
    const low = (inv.data||[]).filter(i=>(i.stock||0)<=(i.alert||5));
    const out_of = low.filter(i=>(i.stock||0)<=0);
    if (out_of.length) out.push({ id:'oos', sev:'critical', icon:'📦', title:`${out_of.length} products out of stock`, body:out_of.slice(0,3).map(i=>i.name).join(', ')+(out_of.length>3?`, +${out_of.length-3} more`:''), dest:'invhub', tab:'products' });
    const lowOnly = low.filter(i=>(i.stock||0)>0);
    if (lowOnly.length) out.push({ id:'low', sev:'warning', icon:'⚠️', title:`${lowOnly.length} products low on stock`, body:lowOnly.slice(0,3).map(i=>`${i.name} (${i.stock})`).join(', '), dest:'invhub', tab:'reorder' });

    (comp.data||[]).forEach(c=>{
      const d = Math.ceil((new Date(c.due_date)-new Date())/86400000);
      out.push({ id:'comp'+c.id, sev:d<0?'critical':'warning', icon:'📅', title:c.title, body:d<0?`Overdue by ${Math.abs(d)} days`:`Due in ${d} days`, dest:'gsthub', tab:'calendar' });
    });

    (reminders.data||[]).forEach(r=>{
      out.push({ id:'pr'+r.id, sev:r.days_overdue>60?'critical':'warning', icon:'💰', title:`${r.customer} — ${fmt(r.amount_due)} overdue`, body:`${r.days_overdue} days outstanding`, dest:'custhub', tab:'reminders' });
    });

    (batches.data||[]).forEach(b=>{
      const d = Math.ceil((new Date(b.expiry_date)-new Date())/86400000);
      out.push({ id:'bt'+b.id, sev:d<0?'critical':'warning', icon:'🏷️', title:`${b.item_name} batch expiring`, body:d<0?`Expired ${Math.abs(d)}d ago · ${b.qty_remaining} units`:`${d} days left · ${b.qty_remaining} units`, dest:'invhub', tab:'batches' });
    });

    (docs.data||[]).forEach(d=>{
      const days = Math.ceil((new Date(d.expiry_date)-new Date())/86400000);
      out.push({ id:'dx'+d.id, sev:days<0?'critical':'warning', icon:'📜', title:`${d.doc_name} ${days<0?'expired':'expiring'}`, body:days<0?`Expired ${Math.abs(days)}d ago`:`${days} days left`, dest:'toolshub', tab:'docexpiry' });
    });

    (tasks.data||[]).forEach(t=>{
      out.push({ id:'tk'+t.id, sev:'warning', icon:'📋', title:`Overdue task: ${t.title}`, body:`Was due ${t.due_date}`, dest:'hrhub', tab:'tasks' });
    });

    (smart.data||[]).forEach(s=>{
      out.push({ id:'sa'+s.id, sev:'info', icon:'🔔', title:s.title, body:s.message?.slice(0,80)||'', dest:'toolshub', tab:'alerts' });
    });

    const order = { critical:0, warning:1, info:2 };
    out.sort((a,b)=>order[a.sev]-order[b.sev]);
    setAlerts(out); setLoading(false);
  }

  const visible  = alerts.filter(a=>!dismissed.includes(a.id));
  const critical = visible.filter(a=>a.sev==='critical').length;
  const count    = visible.length;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} title="Notifications"
        style={{ background:count?T.lightRed:T.bg, border:`1px solid ${count?'#FECACA':T.bdr}`, borderRadius:8, padding:'6px 11px', cursor:'pointer', fontFamily:'inherit', position:'relative', display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ fontSize:15 }}>🔔</span>
        {count>0&&<span style={{
          background: critical?T.red:T.amber, color:T.white, borderRadius:20,
          minWidth:17, height:17, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:9, fontWeight:800, padding:'0 4px',
        }}>{count>99?'99+':count}</span>}
      </button>

      {open&&(
        <div style={{ position:'absolute', right:0, top:42, width:380, maxHeight:480, background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, boxShadow:'0 14px 44px rgba(0,0,0,.16)', zIndex:300, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, background:T.lightRed, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:T.darkRed }}>Notifications</div>
              <div style={{ fontSize:10, color:T.sub, marginTop:1 }}>{critical>0?`${critical} need immediate attention`:count>0?`${count} items to review`:'All clear'}</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={scan} title="Refresh" style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{loading?'…':'↻'}</button>
              {count>0&&<button onClick={()=>setDismissed(alerts.map(a=>a.id))} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 9px', fontSize:10, color:T.sub, cursor:'pointer', fontFamily:'inherit' }}>Clear all</button>}
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {loading&&visible.length===0
              ? <div style={{ padding:'40px 20px', textAlign:'center', color:T.muted, fontSize:12 }}>Scanning your business…</div>
              : visible.length===0
                ? <div style={{ padding:'40px 20px', textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.green }}>All caught up</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>No alerts need your attention</div>
                  </div>
                : visible.map(a=>{
                    const s = SEV[a.sev]||SEV.info;
                    return (
                      <div key={a.id} onClick={()=>{ onNavigate(a.dest, a.tab); setOpen(false); }}
                        style={{ display:'flex', gap:11, padding:'11px 16px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', borderLeft:`3px solid ${s.color}` }}
                        onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{ width:30, height:30, borderRadius:8, background:s.bg, border:`1px solid ${s.bdr}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{a.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:T.ink, marginBottom:2 }}>{a.title}</div>
                          <div style={{ fontSize:11, color:T.sub, lineHeight:1.4 }}>{a.body}</div>
                        </div>
                        <button onClick={e=>{ e.stopPropagation(); setDismissed(d=>[...d,a.id]); }}
                          style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:15, padding:'0 2px', alignSelf:'flex-start' }}>×</button>
                      </div>
                    );
                  })}
          </div>

          {visible.length>0&&<div style={{ padding:'9px 16px', borderTop:`1px solid ${T.bdr}`, background:T.bg, textAlign:'center' }}>
            <button onClick={()=>{ onNavigate('toolshub','alerts'); setOpen(false); }}
              style={{ background:'none', border:'none', color:T.red, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              View all alerts →
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}
