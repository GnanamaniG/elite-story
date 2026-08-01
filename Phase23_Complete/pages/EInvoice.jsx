import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSales } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => (n||0).toFixed(2);

function generateIRN(sale, tenant) {
  // IRN = SHA256-like hash of SupplierGSTIN+DocNo+DocDate+DocType
  // For actual implementation, this must go through NIC GST portal API
  // This generates a mock IRN for preview purposes
  const str = `${tenant?.gstin||''}${sale.inv_num}${sale.date}INV`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  return Math.abs(hash).toString(16).padStart(64,'a').slice(0,64);
}

function buildEInvoiceJSON(sale, tenant) {
  const items = (sale.items||[]).map((item, i) => {
    const taxable = (item.amount||0) * 100 / (100 + (item.gst||18));
    const gstAmt  = (item.amount||0) - taxable;
    return {
      SlNo: String(i+1),
      PrdDesc: item.name,
      IsServc: 'N',
      HsnCd: item.hsn||'',
      Qty: item.qty||1,
      Unit: 'NOS',
      UnitPrice: parseFloat(fmt(item.rate||0)),
      TotAmt: parseFloat(fmt(item.amount||0)),
      Discount: 0,
      PreTaxVal: parseFloat(fmt(taxable)),
      AssAmt: parseFloat(fmt(taxable)),
      GstRt: item.gst||18,
      IgstAmt: 0,
      CgstAmt: parseFloat(fmt(gstAmt/2)),
      SgstAmt: parseFloat(fmt(gstAmt/2)),
      CesRt: 0,
      CesAmt: 0,
      TotItemVal: parseFloat(fmt(item.amount||0)),
    };
  });

  return {
    Version: '1.1',
    TranDtls: { TaxSch:'GST', SupTyp:'B2C', RegRev:'N' },
    DocDtls: { Typ:'INV', No:sale.inv_num, Dt:sale.date?.split('-').reverse().join('/') },
    SellerDtls: {
      Gstin: tenant?.gstin||'',
      LglNm: tenant?.name||'',
      TrdNm: tenant?.name||'',
      Addr1: tenant?.address||'',
      Loc: 'Tamil Nadu',
      Pin: tenant?.pincode||600001,
      Stcd: '33',
      Ph: tenant?.phone||'',
      Em: tenant?.email||'',
    },
    BuyerDtls: {
      Gstin: sale.customer_gstin||'URP',
      LglNm: sale.customer||'Walk-in Customer',
      TrdNm: sale.customer||'Walk-in Customer',
      Pos: '33',
      Addr1: '',
      Loc: 'Tamil Nadu',
      Pin: 600001,
      Stcd: '33',
    },
    ValDtls: {
      AssVal: parseFloat(fmt(sale.subtotal||0)),
      CgstVal: parseFloat(fmt((sale.gst_amount||0)/2)),
      SgstVal: parseFloat(fmt((sale.gst_amount||0)/2)),
      IgstVal: 0,
      CesVal: 0,
      Discount: parseFloat(fmt(sale.discount||0)),
      RndOffAmt: 0,
      TotInvVal: parseFloat(fmt(sale.total||0)),
    },
    ItemList: items,
    EwbDtls: {},
  };
}

export default function EInvoice({ tenant }) {
  const [sales,    setSales]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [irns,     setIrns]     = useState({});
  const [preview,  setPreview]  = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const data = await getSales(tenant.id, 200);
    setSales(data.filter(s=>(s.total||0)>=0).slice(0,100));
    setLoading(false);
  }

  function generateIRNForSale(sale) {
    const irn = generateIRN(sale, tenant);
    setIrns(prev => ({ ...prev, [sale.id]: irn }));
    setSelected(sale);
    setPreview(buildEInvoiceJSON(sale, tenant));
  }

  function downloadJSON(sale) {
    const json = buildEInvoiceJSON(sale, tenant);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `EInvoice_${sale.inv_num?.replace(/\//g,'_')}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAllJSON() {
    const all = sales.slice(0,50).map(s => buildEInvoiceJSON(s, tenant));
    const blob = new Blob([JSON.stringify(all, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `EInvoices_Bulk_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = sales.filter(s => !search || (s.inv_num||'').toLowerCase().includes(search.toLowerCase()) || (s.customer||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🧾 E-Invoice (IRN)</div>
          <div style={{ fontSize:13, color:T.sub }}>Generate GST e-invoices · GSTIN: <span style={{ color:T.teal, fontFamily:'monospace' }}>{tenant?.gstin||'Not set — add in Settings'}</span></div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={downloadAllJSON} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:8, padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⬇️ Bulk JSON Export</button>
        </div>
      </div>

      {!tenant?.gstin && (
        <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'12px 18px', marginBottom:16, fontSize:13, color:T.amber }}>
          ⚠️ GSTIN not set. Go to Settings → add your GSTIN to generate valid e-invoices.
        </div>
      )}

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:12, color:T.sub, lineHeight:1.7 }}>
        <strong style={{ color:T.ink }}>About E-Invoice:</strong> Mandatory for businesses with turnover &gt; ₹5 crore. The IRN (Invoice Reference Number) is generated via NIC GST portal.
        Use this page to generate the JSON payload, then upload to <strong style={{ color:T.blue }}>einvoice1.gst.gov.in</strong> to get the official IRN and QR code.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Sales list */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search invoices…"
            style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:12 }} />
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', maxHeight:520, overflowY:'auto' }}>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :filtered.map(sale=>(
              <div key={sale.id} onClick={()=>generateIRNForSale(sale)}
                style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===sale.id?T.card:'transparent', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.blue, fontFamily:'monospace' }}>{sale.inv_num}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{sale.date} · {sale.customer||'Walk-in'}</div>
                  {sale.customer_gstin&&<div style={{ fontSize:10, color:T.teal }}>B2B · {sale.customer_gstin}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:T.green }}>Rs.{(sale.total||0).toLocaleString('en-IN')}</div>
                  {irns[sale.id] && <div style={{ fontSize:9, color:T.green }}>✅ IRN Ready</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IRN Preview */}
        <div>
          {selected && preview ? (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>E-Invoice Preview</div>
                <button onClick={()=>downloadJSON(selected)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⬇️ Download JSON</button>
              </div>
              <div style={{ padding:16 }}>
                {/* IRN */}
                <div style={{ background:T.green+'18', border:`1px solid ${T.green}44`, borderRadius:9, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:10, color:T.green, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>IRN (Mock — submit to NIC portal for official IRN)</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', color:T.ink, wordBreak:'break-all' }}>{irns[selected.id]}</div>
                </div>
                {/* Invoice summary */}
                {[
                  ['Invoice No', preview.DocDtls.No],
                  ['Date', preview.DocDtls.Dt],
                  ['Seller GSTIN', preview.SellerDtls.Gstin||'Not set'],
                  ['Buyer GSTIN', preview.BuyerDtls.Gstin],
                  ['Buyer Name', preview.BuyerDtls.LglNm],
                  ['Taxable Value', `Rs.${preview.ValDtls.AssVal}`],
                  ['CGST', `Rs.${preview.ValDtls.CgstVal}`],
                  ['SGST', `Rs.${preview.ValDtls.SgstVal}`],
                  ['Total', `Rs.${preview.ValDtls.TotInvVal}`],
                ].map(([label,val])=>(
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${T.bdr}22`, fontSize:12 }}>
                    <span style={{ color:T.sub }}>{label}</span>
                    <span style={{ color:T.ink, fontFamily:label.includes('GSTIN')||label.includes('No')?'monospace':'inherit' }}>{val}</span>
                  </div>
                ))}
                <div style={{ marginTop:14, fontSize:11, color:T.muted }}>Items: {preview.ItemList.length}</div>
                <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', marginTop:12, background:T.blue, color:'#fff', borderRadius:8, padding:'10px', fontSize:12, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
                  🔗 Open NIC GST Portal to Submit
                </a>
              </div>
            </div>
          ) : (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🧾</div>
              <div style={{ fontSize:13 }}>Select an invoice to generate IRN</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
