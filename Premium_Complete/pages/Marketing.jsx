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

const CHANNELS = { whatsapp:{icon:'💬',color:'#25d366',label:'WhatsApp'}, sms:{icon:'📱',color:T.amber,label:'SMS'}, email:{icon:'📧',color:T.blue,label:'Email'}, social:{icon:'📸',color:'#e1306c',label:'Social'}, offline:{icon:'🏪',color:T.teal,label:'Offline'} };
const TYPES = ['promotion','new_arrival','seasonal','loyalty','referral','reactivation'];

export default function Marketing({ tenant }) {
  const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [selCamp,   setSelCamp]   = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({ name:'', channel:'whatsapp', type:'promotion', target:'all', message:'', budget:'', start_date:new Date().toISOString().slice(0,10), end_date:'', notes:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [campRes, custRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('customers').select('id,name,phone,segment').eq('tenant_id', tenant.id),
    ]);
    setCampaigns(campRes.data||[]);
    setCustomers(custRes.data||[]);
    setLoading(false);
  }

  async function saveCampaign(e) {
    e.preventDefault();
    setSaving(true);
    const targetCount = form.target==='all'?customers.length:customers.filter(c=>c.segment===form.target).length;
    await supabase.from('campaigns').insert({ ...form, tenant_id:tenant.id, budget:parseFloat(form.budget)||0, reach:targetCount });
    setShowForm(false); setForm({ name:'', channel:'whatsapp', type:'promotion', target:'all', message:'', budget:'', start_date:new Date().toISOString().slice(0,10), end_date:'', notes:'' });
    setSaving(false); await load();
  }

  async function updateCamp(id, updates) {
    await supabase.from('campaigns').update(updates).eq('id', id);
    setCampaigns(prev=>prev.map(c=>c.id===id?{...c,...updates}:c));
  }

  async function launchCampaign(camp) {
    const targets = camp.target==='all'?customers:customers.filter(c=>c.segment===camp.target);
    if (!targets.length) { alert('No customers match this target'); return; }
    const phone = targets[0]?.phone;
    if (camp.channel==='whatsapp' && phone) {
      const msg = camp.message.replace('{store}', tenant?.name||'Elite Store').replace('{name}', targets[0]?.name||'Customer');
      window.open(`https://wa.me/${phone.replace(/\D/g,'').replace(/^0/,'91')}?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (camp.channel==='sms' && phone) {
      window.open(`sms:${phone}?body=${encodeURIComponent(camp.message)}`, '_blank');
    } else {
      alert(`Campaign ready to send to ${targets.length} ${camp.target==='all'?'customers':camp.target+' customers'}\n\nMessage:\n${camp.message}`);
    }
    await updateCamp(camp.id, { status:'active', reach:targets.length });
    alert(`✅ Campaign launched to ${targets.length} customers!`);
  }

  const displayed = filter==='all'?campaigns:campaigns.filter(c=>c.status===filter||c.channel===filter);
  const totalBudget= campaigns.reduce((s,c)=>s+(c.budget||0),0);
  const totalROI   = campaigns.reduce((s,c)=>s+(c.revenue||0)-(c.spent||0),0);
  const totalReach = campaigns.reduce((s,c)=>s+(c.reach||0),0);
  const segs = ['all',...new Set(customers.map(c=>c.segment).filter(Boolean))];
  const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📣 Marketing Campaigns</div>
          <div style={{ fontSize:13, color:T.sub }}>{campaigns.filter(c=>c.status==='active').length} active · {totalReach.toLocaleString('en-IN')} total reach</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New Campaign</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[['Total Budget',fmt(totalBudget),T.blue],['Total Reach',totalReach.toLocaleString('en-IN'),T.purple],['ROI',fmt(totalROI),totalROI>=0?T.green:T.red],['Conversions',campaigns.reduce((s,c)=>s+(c.conversions||0),0),T.amber]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Channel filter */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {['all','draft','active','completed',...Object.keys(CHANNELS)].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.blue:T.srf, color:filter===f?'#fff':T.sub, border:`1px solid ${filter===f?T.blue:T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {CHANNELS[f]?.icon||''} {f}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:selCamp?'1fr 1fr':'1fr', gap:16 }}>
        {/* Campaign cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {loading?<div style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</div>
          :displayed.length===0?<div style={{ textAlign:'center', padding:40, color:T.muted, background:T.srf, borderRadius:12, border:`1px solid ${T.bdr}` }}>No campaigns found</div>
          :displayed.map(c=>{
            const ch = CHANNELS[c.channel]||CHANNELS.whatsapp;
            const roi = (c.revenue||0)-(c.spent||0);
            return (
              <div key={c.id} onClick={()=>setSelCamp(selCamp?.id===c.id?null:c)} style={{ background:T.srf, border:`1px solid ${selCamp?.id===c.id?T.blue:T.bdr}`, borderRadius:12, padding:16, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{c.name}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <span style={{ background:ch.color+'22', color:ch.color, borderRadius:5, padding:'1px 8px', fontSize:10, fontWeight:700 }}>{ch.icon} {ch.label}</span>
                      <span style={{ background:T.blue+'22', color:T.blue, borderRadius:5, padding:'1px 8px', fontSize:10, textTransform:'capitalize' }}>{c.type?.replace(/_/g,' ')}</span>
                      <span style={{ background:c.status==='active'?T.green+'22':c.status==='completed'?T.blue+'22':T.muted+'22', color:c.status==='active'?T.green:c.status==='completed'?T.blue:T.muted, borderRadius:5, padding:'1px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{c.status}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {c.status==='draft'&&<button onClick={e=>{e.stopPropagation();launchCampaign(c);}} style={{ background:T.green, color:'#fff', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:4 }}>🚀 Launch</button>}
                    {c.status==='active'&&<button onClick={e=>{e.stopPropagation();updateCamp(c.id,{status:'completed'});}} style={{ background:T.amber+'22', color:T.amber, border:'none', borderRadius:7, padding:'5px 10px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Complete</button>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {[['Reach',c.reach||0,T.blue],['Leads',c.leads||0,T.purple],['Conv.',c.conversions||0,T.green],['ROI',fmt(roi),roi>=0?T.green:T.red]].map(([label,val,color])=>(
                    <div key={label} style={{ background:T.card, borderRadius:7, padding:'7px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:T.muted, fontWeight:700 }}>{label}</div>
                      <div style={{ fontSize:14, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                {c.start_date&&<div style={{ fontSize:10, color:T.muted, marginTop:8 }}>{c.start_date}{c.end_date?' → '+c.end_date:''}</div>}
              </div>
            );
          })}
        </div>

        {/* Campaign detail */}
        {selCamp&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, position:'sticky', top:20 }}>
          <div style={{ fontWeight:700, color:T.ink, fontSize:15, marginBottom:14 }}>📊 Campaign Details</div>
          <div style={{ marginBottom:14, background:T.card, borderRadius:9, padding:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.sub, marginBottom:8, textTransform:'uppercase' }}>Message</div>
            <pre style={{ fontSize:12, color:T.ink, fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{selCamp.message||'No message set'}</pre>
          </div>
          {[['Target Segment',selCamp.target==='all'?'All Customers':selCamp.target,T.blue],['Estimated Reach',customers.filter(c=>selCamp.target==='all'||c.segment===selCamp.target).length+' customers',T.purple],['Budget',fmt(selCamp.budget),T.amber],['Spent',fmt(selCamp.spent),T.red],['Revenue',fmt(selCamp.revenue),T.green]].map(([label,val,color])=>(
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:13 }}>
              <span style={{ color:T.sub }}>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop:14, display:'flex', gap:8 }}>
            {selCamp.status==='draft'&&<button onClick={()=>launchCampaign(selCamp)} style={{ flex:1, background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🚀 Launch Campaign</button>}
          </div>
          {selCamp.notes&&<div style={{ marginTop:12, background:T.card, borderRadius:7, padding:10, fontSize:12, color:T.sub }}>{selCamp.notes}</div>}
        </div>}
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:20, overflowY:'auto' }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:540, margin:'20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Campaign</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveCampaign}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Campaign Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Channel</label>
                  <select value={form.channel} onChange={e=>setForm(f=>({...f,channel:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {Object.entries(CHANNELS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {TYPES.map(t=><option key={t} value={t} style={{ textTransform:'capitalize' }}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Target Segment</label>
                  <select value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {segs.map(s=><option key={s} value={s} style={{ textTransform:'capitalize' }}>{s==='all'?`All (${customers.length})`:s+` (${customers.filter(c=>c.segment===s).length})`}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Budget</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Start Date</label><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>End Date</label><input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Message *</label>
                  <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={4} placeholder="Use {name} for customer name, {store} for store name" required style={{ ...inp, resize:'vertical' }}/>
                  <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>Variables: {'{name}'} {'{store}'}</div>
                </div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Create Campaign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
