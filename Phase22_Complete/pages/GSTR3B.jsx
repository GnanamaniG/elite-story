import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function GSTR3B({ tenant }) {
  const [period,  setPeriod]  = useState(new Date().toISOString().slice(0,7));
  const [data,    setData]    = useState(null);
  const [saved,   setSaved]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { if (tenant?.id) { loadSaved(); compute(); } }, [tenant?.id, period]);

  async function loadSaved() {
    const { data:existing } = await supabase.from('gstr3b_returns').select('*').eq('tenant_id', tenant.id).eq('period', period).single();
    setSaved(existing||null);
  }

  async function compute() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);

    const [salesRes, purRes] = await Promise.all([
      supabase.from('sales').select('total,gst_amount,items').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('purchases').select('total,gst_amount').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);

    const sales     = salesRes.data||[];
    const purchases = purRes.data||[];

    // Outward supplies (sales)
    const outwardTaxable = sales.reduce((s,x)=>s+(x.total||0)-(x.gst_amount||0),0);
    const outwardGST     = sales.reduce((s,x)=>s+(x.gst_amount||0),0);
    const cgstLiability  = outwardGST/2;
    const sgstLiability  = outwardGST/2;

    // ITC from purchases
    const itcTotal    = purchases.reduce((s,p)=>s+(p.gst_amount||0),0);
    const cgstITC     = itcTotal/2;
    const sgstITC     = itcTotal/2;

    // Net payable
    const netCGST = Math.max(0, cgstLiability - cgstITC);
    const netSGST = Math.max(0, sgstLiability - sgstITC);
    const netPayable = netCGST + netSGST;

    // GST-rate breakdown
    const rateBreakdown = {};
    sales.forEach(s=>(s.items||[]).forEach(i=>{
      const rate = i.gst||0;
      if (!rateBreakdown[rate]) rateBreakdown[rate] = { taxable:0, cgst:0, sgst:0 };
      const itemTaxable = (i.amount||0) * 100/(100+rate);
      const gstAmt = i.amount - itemTaxable;
      rateBreakdown[rate].taxable += itemTaxable;
      rateBreakdown[rate].cgst    += gstAmt/2;
      rateBreakdown[rate].sgst    += gstAmt/2;
    }));

    setData({ outwardTaxable, cgstLiability, sgstLiability, cgstITC, sgstITC, netCGST, netSGST, netPayable, itcTotal, rateBreakdown, salesCount:sales.length, purCount:purchases.length });
    setLoading(false);
  }

  async function saveDraft() {
    if (!data) return;
    setSaving(true);
    const payload = { tenant_id:tenant.id, period, outward_taxable:data.outwardTaxable, cgst_liability:data.cgstLiability, sgst_liability:data.sgstLiability, cgst_itc:data.cgstITC, sgst_itc:data.sgstITC, net_payable:data.netPayable, status:'draft' };
    if (saved) await supabase.from('gstr3b_returns').update(payload).eq('id', saved.id);
    else await supabase.from('gstr3b_returns').insert(payload);
    setSaving(false); await loadSaved();
    alert('✅ GSTR-3B draft saved!');
  }

  async function markFiled() {
    if (!saved) { alert('Save draft first'); return; }
    if (!confirm('Mark this return as filed? This cannot be undone.')) return;
    await supabase.from('gstr3b_returns').update({ status:'filed', filed_at:new Date().toISOString() }).eq('id', saved.id);
    await loadSaved();
    alert('✅ Return marked as filed!');
  }

  const Section = ({ title, rows }) => (
    <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
      <div style={{ background:T.card, padding:'10px 16px', fontWeight:700, color:T.ink, fontSize:13, borderBottom:`1px solid ${T.bdr}` }}>{title}</div>
      {rows.map(([label,val,color,indent])=>(
        <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 16px', borderBottom:`1px solid ${T.bdr}11`, paddingLeft:indent?28:16 }}>
          <span style={{ fontSize:13, color:indent?T.sub:T.ink }}>{label}</span>
          <span style={{ fontSize:13, fontWeight:color?700:400, color:color||T.ink }}>{val}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📊 GSTR-3B & ITC</div>
          <div style={{ fontSize:13, color:T.sub }}>Monthly summary return · Input Tax Credit reconciliation</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          {saved?.status==='filed'?<span style={{ background:T.green+'22', color:T.green, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700 }}>✅ Filed</span>
          :<><button onClick={saveDraft} disabled={saving||!data} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'💾 Save Draft'}</button>
          {saved&&<button onClick={markFiled} style={{ background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Mark Filed</button>}</>}
        </div>
      </div>

      {saved&&<div style={{ background:T.amber+'12', border:`1px solid ${T.amber}33`, borderRadius:9, padding:'8px 14px', marginBottom:14, fontSize:12, color:T.amber }}>
        📄 Saved draft for {period} · Status: {saved.status} {saved.filed_at?'· Filed: '+new Date(saved.filed_at).toLocaleDateString('en-IN'):''}
      </div>}

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:60 }}>Computing from sales & purchase data…</div>
      :data&&(
        <>
          {/* Net payable banner */}
          <div style={{ background:data.netPayable>0?T.red+'12':T.green+'12', border:`1px solid ${data.netPayable>0?T.red:T.green}44`, borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:T.sub, marginBottom:4 }}>NET TAX PAYABLE — {period}</div>
              <div style={{ fontSize:28, fontWeight:900, color:data.netPayable>0?T.red:T.green }}>{fmt(data.netPayable)}</div>
            </div>
            <div style={{ textAlign:'right', fontSize:12, color:T.sub }}>
              <div>Based on {data.salesCount} sales · {data.purCount} purchases</div>
              <div style={{ marginTop:4 }}>CGST: {fmt(data.netCGST)} · SGST: {fmt(data.netSGST)}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <Section title="3.1 — Outward Supplies" rows={[
                ['Total Taxable Value',        fmt(data.outwardTaxable),   T.blue],
                ['CGST Liability (½ of GST)',  fmt(data.cgstLiability),    T.amber],
                ['SGST Liability (½ of GST)',  fmt(data.sgstLiability),    T.amber],
                ['Total GST Liability',        fmt(data.cgstLiability+data.sgstLiability), T.red],
              ]}/>
              <Section title="4 — ITC Available" rows={[
                ['Total ITC from Purchases',    fmt(data.itcTotal),         T.green],
                ['CGST ITC',                    fmt(data.cgstITC),          T.green, true],
                ['SGST ITC',                    fmt(data.sgstITC),          T.green, true],
              ]}/>
              <Section title="6 — Net Tax Payable" rows={[
                ['CGST Payable (liability – ITC)', fmt(data.netCGST), data.netCGST>0?T.red:T.green],
                ['SGST Payable (liability – ITC)', fmt(data.netSGST), data.netSGST>0?T.red:T.green],
                ['Total Payable',                  fmt(data.netPayable), data.netPayable>0?T.red:T.green],
              ]}/>
            </div>
            <div>
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ background:T.card, padding:'10px 16px', fontWeight:700, color:T.ink, fontSize:13, borderBottom:`1px solid ${T.bdr}` }}>Tax Rate Breakdown</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:T.card+'88' }}>
                    {['GST Rate','Taxable Amt','CGST','SGST'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:9, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(data.rateBreakdown).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([rate,rb])=>(
                      <tr key={rate} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'9px 12px', color:T.blue, fontWeight:700 }}>{rate}%</td>
                        <td style={{ padding:'9px 12px', color:T.ink }}>{fmt(rb.taxable)}</td>
                        <td style={{ padding:'9px 12px', color:T.amber }}>{fmt(rb.cgst)}</td>
                        <td style={{ padding:'9px 12px', color:T.amber }}>{fmt(rb.sgst)}</td>
                      </tr>
                    ))}
                    {Object.keys(data.rateBreakdown).length===0&&<tr><td colSpan={4} style={{ textAlign:'center', padding:30, color:T.muted }}>No sales data this period</td></tr>}
                  </tbody>
                </table>
              </div>
              <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginTop:14 }}>
                <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>📋 Filing Checklist</div>
                {[['Sales data computed',true],['Purchase ITC calculated',data.purCount>0],['Net tax calculated',data.netPayable>=0],['Draft saved',!!saved],['Filed on GST portal',saved?.status==='filed']].map(([item,done])=>(
                  <div key={item} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
                    <span style={{ color:done?T.green:T.muted, fontSize:14 }}>{done?'✅':'⬜'}</span>
                    <span style={{ fontSize:12, color:done?T.ink:T.muted }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
