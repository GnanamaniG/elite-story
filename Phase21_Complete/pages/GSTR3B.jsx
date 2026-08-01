import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1', purple:'#9b72ff' };
const fmtR = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const pct = (n,d) => d>0?(n/d*100).toFixed(1)+'%':'0%';

export default function GSTR3B({ tenant }) {
  const [period,   setPeriod]   = useState(new Date().toISOString().slice(0,7));
  const [data,     setData]     = useState(null);
  const [saved,    setSaved]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [itc,      setITC]      = useState({ cgst:0, sgst:0, igst:0 });

  useEffect(() => { if (tenant?.id) loadSaved(); }, [tenant?.id, period]);

  async function loadSaved() {
    const { data } = await supabase.from('gstr3b_records').select('*').eq('tenant_id', tenant.id).eq('period', period).single();
    if (data) { setSaved(data); setITC({ cgst:data.itc_cgst, sgst:data.itc_sgst, igst:data.itc_igst }); }
    else { setSaved(null); }
  }

  async function compute() {
    setLoading(true);
    const monthStart = period+'-01';
    const monthEnd   = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().slice(0,10);

    const [salesRes, purRes] = await Promise.all([
      supabase.from('sales').select('items,gst_amount,customer_id,total').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('purchases').select('total,gst_amount').eq('tenant_id', tenant.id).gte('date', monthStart).lte('date', monthEnd),
    ]);

    const sales    = salesRes.data||[];
    const purchases= purRes.data||[];

    // Aggregate sales by GST rate
    let b2bTaxable=0, b2cTaxable=0, cgst=0, sgst=0;
    sales.forEach(s=>{
      const taxable = (s.total||0) - (s.gst_amount||0);
      if (s.customer_id) b2bTaxable+=taxable; else b2cTaxable+=taxable;
      cgst += (s.gst_amount||0)/2;
      sgst += (s.gst_amount||0)/2;
    });

    // ITC from purchases
    const purGST = purchases.reduce((t,p)=>t+(p.gst_amount||0),0);
    const itcCGST = purGST/2;
    const itcSGST = purGST/2;

    // Net liability
    const netCGST = Math.max(0, cgst - itcCGST);
    const netSGST = Math.max(0, sgst - itcSGST);
    const totalLiability = netCGST + netSGST;

    setData({ taxable_b2b:b2bTaxable, taxable_b2c:b2cTaxable, cgst_b2b:cgst*(b2bTaxable/(b2bTaxable+b2cTaxable||1)), sgst_b2b:sgst*(b2bTaxable/(b2bTaxable+b2cTaxable||1)), cgst_b2c:cgst*(b2cTaxable/(b2bTaxable+b2cTaxable||1)), sgst_b2c:sgst*(b2cTaxable/(b2bTaxable+b2cTaxable||1)), cgst, sgst, itc_cgst:itcCGST, itc_sgst:itcSGST, itc_igst:0, net_cgst:netCGST, net_sgst:netSGST, net_igst:0, total_liability:totalLiability });
    setITC({ cgst:itcCGST, sgst:itcSGST, igst:0 });
    setLoading(false);
  }

  async function saveReturn() {
    setSaving(true);
    const payload = { tenant_id:tenant.id, period, ...data, itc_cgst:itc.cgst, itc_sgst:itc.sgst, itc_igst:itc.igst||0, net_cgst:Math.max(0,data.cgst-itc.cgst), net_sgst:Math.max(0,data.sgst-itc.sgst), total_liability:Math.max(0,data.cgst-itc.cgst)+Math.max(0,data.sgst-itc.sgst), status:'draft' };
    const { error } = await supabase.from('gstr3b_records').upsert(payload, { onConflict:'tenant_id,period' });
    setSaving(false);
    if (!error) { await loadSaved(); alert('✅ GSTR-3B saved for '+period); }
  }

  async function markFiled() {
    await supabase.from('gstr3b_records').update({ status:'filed', filed_at:new Date().toISOString() }).eq('tenant_id', tenant.id).eq('period', period);
    await loadSaved();
    alert('✅ GSTR-3B marked as filed for '+period);
  }

  const display = data || (saved ? { taxable_b2b:saved.taxable_b2b, taxable_b2c:saved.taxable_b2c, cgst:saved.cgst_b2b+saved.cgst_b2c, sgst:saved.sgst_b2b+saved.sgst_b2c, itc_cgst:saved.itc_cgst, itc_sgst:saved.itc_sgst, net_cgst:saved.net_cgst, net_sgst:saved.net_sgst, total_liability:saved.total_liability } : null);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📊 GSTR-3B & ITC</div>
          <div style={{ fontSize:13, color:T.sub }}>Auto-compute monthly return · Input Tax Credit reconciliation</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={compute} disabled={loading} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{loading?'Computing…':'⚡ Compute'}</button>
        </div>
      </div>

      {saved&&<div style={{ background:saved.status==='filed'?T.green+'12':T.amber+'12', border:`1px solid ${saved.status==='filed'?T.green:T.amber}33`, borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, color:saved.status==='filed'?T.green:T.amber, fontWeight:700 }}>{saved.status==='filed'?'✅ GSTR-3B Filed':'⏳ GSTR-3B Draft Saved'} for {period}</span>
        {saved.status!=='filed'&&<button onClick={markFiled} style={{ background:T.green, color:'#fff', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Mark as Filed</button>}
      </div>}

      {!display&&!loading&&<div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}><div style={{ fontSize:32, marginBottom:12 }}>📊</div><div>Select period and click Compute to generate GSTR-3B</div></div>}

      {loading&&<div style={{ textAlign:'center', padding:60, color:T.sub }}>Computing from your sales data…</div>}

      {display&&(
        <>
          {/* 3.1 Outward Supplies */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>3.1 Details of Outward Supplies</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Nature of Supply','Taxable Value','CGST','SGST','IGST'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:h==='Nature of Supply'?'left':'right', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  ['(a) Outward taxable supplies (B2B)', display.taxable_b2b, display.cgst_b2b||display.cgst/2, display.sgst_b2b||display.sgst/2, 0],
                  ['(b) Outward taxable supplies (B2C)', display.taxable_b2c, display.cgst_b2c||display.cgst/2, display.sgst_b2c||display.sgst/2, 0],
                ].map(([label,...vals])=>(
                  <tr key={label} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink }}>{label}</td>
                    {vals.map((v,i)=><td key={i} style={{ padding:'10px 14px', textAlign:'right', color:T.blue, fontWeight:600 }}>{fmtR(v)}</td>)}
                  </tr>
                ))}
                <tr style={{ background:T.card }}>
                  <td style={{ padding:'10px 14px', color:T.ink, fontWeight:700 }}>Total Outward</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:T.blue, fontWeight:800 }}>{fmtR((display.taxable_b2b||0)+(display.taxable_b2c||0))}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:T.blue, fontWeight:800 }}>{fmtR(display.cgst)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:T.blue, fontWeight:800 }}>{fmtR(display.sgst)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', color:T.muted }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. ITC */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>4. Eligible ITC (Input Tax Credit)</div>
            <div style={{ background:T.amber+'12', border:`1px solid ${T.amber}33`, borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:12, color:T.amber }}>
              ITC is auto-computed from your purchase records. You can adjust manually below.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[['CGST ITC','cgst',T.blue],['SGST ITC','sgst',T.green],['IGST ITC','igst',T.purple]].map(([label,key,color])=>(
                <div key={key} style={{ background:T.card, borderRadius:9, padding:14 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:8 }}>{label}</label>
                  <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>Auto-computed: {fmtR(display['itc_'+key]||0)}</div>
                  <input type="number" value={itc[key]} onChange={e=>setITC(i=>({...i,[key]:parseFloat(e.target.value)||0}))} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'8px 12px', color, fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', fontWeight:700, textAlign:'right' }}/>
                </div>
              ))}
            </div>
          </div>

          {/* Net Liability */}
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>6. Payment of Tax</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Tax Head','Tax Payable','ITC Available','Cash Payable'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:h==='Tax Head'?'left':'right', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[['CGST',display.cgst,itc.cgst],['SGST',display.sgst,itc.sgst],['IGST',0,itc.igst||0]].map(([head,payable,itcAvail])=>{
                  const cash = Math.max(0,payable-itcAvail);
                  return (
                    <tr key={head} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{head}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:T.red }}>{fmtR(payable)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:T.green }}>{fmtR(itcAvail)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:cash>0?T.amber:T.green, fontWeight:700 }}>{fmtR(cash)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background:T.card }}>
                  <td style={{ padding:'12px 14px', color:T.ink, fontWeight:800, fontSize:14 }}>Total Cash Payable</td>
                  <td colSpan={2}></td>
                  <td style={{ padding:'12px 14px', textAlign:'right', color:T.red, fontWeight:900, fontSize:16 }}>{fmtR(Math.max(0,display.cgst-itc.cgst)+Math.max(0,display.sgst-itc.sgst))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={saveReturn} disabled={saving} style={{ flex:1, background:T.teal, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'💾 Save Draft'}</button>
            <button onClick={()=>window.open('https://www.gst.gov.in','_blank')} style={{ flex:1, background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🌐 File on GST Portal</button>
            {saved&&saved.status==='draft'&&<button onClick={markFiled} style={{ flex:1, background:T.green, color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Mark Filed</button>}
          </div>
        </>
      )}
    </div>
  );
}
