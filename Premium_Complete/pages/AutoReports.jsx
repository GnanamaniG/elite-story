import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSales, getExpenses, getInventory } from '../lib/supabase';

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

export default function AutoReports({ tenant, user }) {
  const [config,    setConfig]    = useState(null);
  const [form,      setForm]      = useState({ enabled:false, frequency:'daily', send_time:'08:00', send_day:1, email:'', include_revenue:true, include_inventory:true, include_expenses:true, include_customers:false });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [preview,   setPreview]   = useState('');
  const [generating,setGenerating]= useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('auto_report_config').select('*').eq('tenant_id', tenant.id).single();
    if (data) {
      setConfig(data);
      setForm({ enabled:data.enabled, frequency:data.frequency||'daily', send_time:(data.send_time||'08:00:00').slice(0,5), send_day:data.send_day||1, email:data.email||user?.email||'', include_revenue:data.include_revenue!==false, include_inventory:data.include_inventory!==false, include_expenses:data.include_expenses!==false, include_customers:data.include_customers||false });
    } else {
      setForm(f=>({ ...f, email:user?.email||'' }));
    }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    const payload = { tenant_id:tenant.id, ...form, send_time:form.send_time+':00' };
    if (config?.id) await supabase.from('auto_report_config').update(payload).eq('id', config.id);
    else await supabase.from('auto_report_config').insert(payload);
    setSaving(false); await load();
    alert('✅ Report schedule saved!');
  }

  async function generateAndSendNow() {
    setGenerating(true);
    const report = await buildReport();
    setPreview(report);
    // In production, this would call a Supabase Edge Function to send email
    // For now, we show the preview and offer to copy
    setGenerating(false);
  }

  async function buildReport() {
    const now        = new Date();
    const today      = now.toISOString().slice(0,10);
    const yesterday  = new Date(now-86400000).toISOString().slice(0,10);
    const monthStart = today.slice(0,7)+'-01';
    const [sales, expenses, inventory] = await Promise.all([
      getSales(tenant.id, 500),
      getExpenses(tenant.id),
      getInventory(tenant.id),
    ]);

    const todaySales  = sales.filter(s=>s.date===today);
    const monthSales  = sales.filter(s=>(s.date||'').startsWith(today.slice(0,7)));
    const todayRev    = todaySales.reduce((s,x)=>s+(x.total||0),0);
    const monthRev    = monthSales.reduce((s,x)=>s+(x.total||0),0);
    const monthExp    = expenses.filter(e=>(e.date||'').startsWith(today.slice(0,7))).reduce((s,x)=>s+(x.amount||0),0);
    const lowStock    = inventory.filter(i=>(i.stock||0)<=(i.alert||10));

    let report = `📊 ELITE STORE DAILY REPORT
${tenant?.name||'Elite Store'}
Date: ${today}
Generated: ${now.toLocaleTimeString('en-IN')}

`;
    if (form.include_revenue) {
      report += `💰 REVENUE
Today:      ${fmt(todayRev)} (${todaySales.length} orders)
This Month: ${fmt(monthRev)} (${monthSales.length} orders)

`;
    }
    if (form.include_expenses) {
      report += `💸 EXPENSES
This Month: ${fmt(monthExp)}
Net Profit: ${fmt(monthRev - monthExp)}

`;
    }
    if (form.include_inventory) {
      report += `📦 INVENTORY
Total Items:   ${inventory.length}
Low Stock (${lowStock.length}): ${lowStock.slice(0,5).map(i=>`${i.name} (${i.stock||0} left)`).join(', ')||'None'}

`;
    }
    report += `─────────────────────────
Powered by Elite Store Platform`;
    return report;
  }

  async function sendViaWhatsApp() {
    const report = await buildReport();
    window.open('https://wa.me/?text='+encodeURIComponent(report), '_blank');
  }

  const FREQ_OPTIONS = [
    { id:'daily',   label:'Daily',   desc:'Every morning at selected time' },
    { id:'weekly',  label:'Weekly',  desc:'Once a week on selected day' },
    { id:'monthly', label:'Monthly', desc:'Once a month on selected date' },
  ];
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>📧 Automated Reports</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Schedule daily/weekly business summaries</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Config */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Report Schedule</div>

            {/* Enable toggle */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'10px 14px', background:T.card, borderRadius:9 }}>
              <span style={{ fontSize:13, color:T.ink }}>Auto Reports</span>
              <button onClick={()=>setForm(f=>({...f,enabled:!f.enabled}))} style={{ background:form.enabled?T.green:T.bdr, color:'#fff', border:'none', borderRadius:20, padding:'5px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {form.enabled?'🟢 Enabled':'🔴 Disabled'}
              </button>
            </div>

            {/* Frequency */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:8 }}>Frequency</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {FREQ_OPTIONS.map(f=>(
                  <div key={f.id} onClick={()=>setForm(fm=>({...fm,frequency:f.id}))}
                    style={{ background:form.frequency===f.id?T.blue+'22':T.card, border:`1px solid ${form.frequency===f.id?T.blue:T.bdr}`, borderRadius:8, padding:'10px 14px', cursor:'pointer' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:form.frequency===f.id?T.blue:T.ink }}>{f.label}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Send Time</label>
                <input type="time" value={form.send_time} onChange={e=>setForm(f=>({...f,send_time:e.target.value}))}
                  style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
              </div>
              {form.frequency==='weekly' && (
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Day</label>
                  <select value={form.send_day} onChange={e=>setForm(f=>({...f,send_day:parseInt(e.target.value)}))}
                    style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', cursor:'pointer' }}>
                    {DAYS.map((d,i)=><option key={i+1} value={i+1}>{d}</option>)}
                  </select>
                </div>
              )}
              {form.frequency==='monthly' && (
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Date</label>
                  <input type="number" min={1} max={28} value={form.send_day} onChange={e=>setForm(f=>({...f,send_day:parseInt(e.target.value)||1}))}
                    style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
                </div>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Send To Email</label>
              <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="owner@business.com"
                style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }}/>
            </div>

            {/* Include sections */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:8 }}>Include in Report</label>
              {[['include_revenue','💰 Revenue & Orders'],['include_expenses','💸 Expenses & Profit'],['include_inventory','📦 Inventory & Low Stock'],['include_customers','👥 Customer Summary']].map(([key,label])=>(
                <div key={key} onClick={()=>setForm(f=>({...f,[key]:!f[key]}))} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', cursor:'pointer' }}>
                  <div style={{ width:18, height:18, border:`2px solid ${form[key]?T.blue:T.bdr}`, borderRadius:4, background:form[key]?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', flexShrink:0 }}>{form[key]?'✓':''}</div>
                  <span style={{ fontSize:13, color:T.ink }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={saveConfig} disabled={saving} style={{ flex:1, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Schedule'}</button>
            </div>
          </div>

          <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'12px 16px', fontSize:12, color:T.amber, lineHeight:1.7 }}>
            <strong>⚠️ Email delivery</strong> requires a Supabase Edge Function + email service (Resend/SendGrid). The schedule is saved — wire up the Edge Function to trigger emails automatically.
          </div>
        </div>

        {/* Preview + manual send */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Send Report Now</div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={generateAndSendNow} disabled={generating} style={{ flex:1, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {generating?'Generating…':'👁 Preview Report'}
              </button>
              <button onClick={sendViaWhatsApp} style={{ flex:1, background:'#25d36622', color:'#25d366', border:'none', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                💬 Send via WhatsApp
              </button>
            </div>
            {preview ? (
              <>
                <pre style={{ background:T.card, borderRadius:9, padding:14, fontSize:12, color:T.ink, fontFamily:'monospace', whiteSpace:'pre-wrap', lineHeight:1.6, maxHeight:360, overflowY:'auto' }}>{preview}</pre>
                <button onClick={()=>navigator.clipboard.writeText(preview).then(()=>alert('Copied!'))} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:7, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:10 }}>📋 Copy to Clipboard</button>
              </>
            ) : (
              <div style={{ background:T.card, borderRadius:9, padding:40, textAlign:'center', color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📊</div>
                <div style={{ fontSize:12 }}>Click Preview to generate today's report</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
