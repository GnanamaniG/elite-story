import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateInvoicePDF } from '../lib/pdf';

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
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

// ── Public invoice view ────────────────────────────────────────
export function InvoiceView({ invoiceId, tenantId }) {
  const [sale,   setSale]   = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading,setLoading]= useState(true);
  const [error,  setError]  = useState('');

  useEffect(() => {
    async function load() {
      const { data: saleData } = await supabase.from('sales').select('*').eq('id', invoiceId).single();
      if (!saleData) { setError('Invoice not found'); setLoading(false); return; }
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', saleData.tenant_id).single();
      setSale(saleData); setTenant(tenantData); setLoading(false);
    }
    if (invoiceId) load();
  }, [invoiceId]);

  if (loading) return <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', color:T.sub }}>Loading invoice…</div>;
  if (error)   return <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', color:T.red }}>{error}</div>;
  if (!sale)   return null;

  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:20 }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ background:T.srf, borderRadius:14, padding:24, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>{tenant?.name || 'Elite Store'}</div>
              {tenant?.gstin && <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>GSTIN: {tenant.gstin}</div>}
              {tenant?.phone && <div style={{ fontSize:12, color:T.sub }}>📞 {tenant.phone}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ background:T.blue, color:'#fff', borderRadius:8, padding:'4px 14px', fontSize:12, fontWeight:700 }}>TAX INVOICE</div>
              <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginTop:6 }}>{sale.inv_num}</div>
              <div style={{ fontSize:12, color:T.sub }}>{sale.date}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            <div style={{ background:T.bg, borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Bill To</div>
              <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{sale.customer || 'Walk-in'}</div>
              {sale.customer_gstin && <div style={{ fontSize:11, color:T.sub }}>GSTIN: {sale.customer_gstin}</div>}
            </div>
            <div style={{ background:T.bg, borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Payment</div>
              <div style={{ fontSize:14, fontWeight:600, color:T.ink, textTransform:'capitalize' }}>{sale.payment_mode || 'Cash'}</div>
              <div style={{ fontSize:12, color: sale.status==='paid'?T.green:T.amber }}>{(sale.status||'paid').toUpperCase()}</div>
            </div>
          </div>

          {/* Items */}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
            <thead>
              <tr style={{ background:T.bg }}>
                {['Item','Qty','Rate','GST','Amount'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:h==='Item'?'left':'right', fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sale.items||[]).map((item,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <td style={{ padding:'9px 10px', color:T.ink }}>{item.name}</td>
                  <td style={{ padding:'9px 10px', color:T.sub, textAlign:'right' }}>{item.qty}</td>
                  <td style={{ padding:'9px 10px', color:T.sub, textAlign:'right' }}>{fmt(item.rate)}</td>
                  <td style={{ padding:'9px 10px', color:T.sub, textAlign:'right' }}>{item.gst||18}%</td>
                  <td style={{ padding:'9px 10px', color:T.ink, fontWeight:700, textAlign:'right' }}>{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop:`1px solid ${T.bdr}`, paddingTop:12 }}>
            {[['Subtotal',fmt(sale.subtotal||0)],['GST',fmt(sale.gst_amount||0)],sale.discount>0?['Discount','−'+fmt(sale.discount)]:null].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:T.sub, marginBottom:5 }}><span>{l}</span><span>{v}</span></div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:800, color:T.green, marginTop:8 }}><span>Total</span><span>{fmt(sale.total)}</span></div>
            {sale.paid < sale.total && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:T.amber, marginTop:4 }}><span>Balance Due</span><span>{fmt(sale.total-sale.paid)}</span></div>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <button onClick={() => generateInvoicePDF(sale, tenant)} style={{ background:T.srf, color:T.ink, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            📄 Download PDF
          </button>
          <button onClick={() => window.print()} style={{ background:T.srf, color:T.ink, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            🖨️ Print
          </button>
        </div>

        {/* UPI payment */}
        {tenant?.upi_id && sale.status !== 'paid' && (
          <a href={`upi://pay?pa=${tenant.upi_id}&pn=${encodeURIComponent(tenant.name||'')}&am=${sale.total-sale.paid}&cu=INR&tn=${sale.inv_num}`}
            style={{ display:'block', background:T.green, color:'#fff', borderRadius:9, padding:'13px', fontSize:14, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
            💳 Pay Rs.{fmt(sale.total-sale.paid)} via UPI
          </a>
        )}

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:T.muted }}>
          Powered by Elite Store · Tax Invoice
        </div>
      </div>
    </div>
  );
}

// ── Customer Portal page (inside app) ─────────────────────────
export default function CustomerPortal({ tenant }) {
  const [invNum, setInvNum] = useState('');
  const [sale,   setSale]   = useState(null);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  async function lookupInvoice(e) {
    e.preventDefault();
    if (!invNum.trim()) return;
    setLoading(true); setError(''); setSale(null);
    const { data } = await supabase.from('sales').select('*').eq('tenant_id', tenant.id).eq('inv_num', invNum.trim()).single();
    if (!data) setError('Invoice not found. Check the invoice number and try again.');
    else setSale(data);
    setLoading(false);
  }

  function copyInvoiceLink(saleId) {
    const link = `${window.location.origin}/invoice/${saleId}`;
    navigator.clipboard.writeText(link).then(() => alert('Invoice link copied!\n\n' + link));
  }

  function shareInvoiceLink(sale) {
    const link = `${window.location.origin}/invoice/${sale.id}`;
    const msg  = `Hi! Here's your invoice from ${tenant?.name||'Elite Store'}:\n*${sale.inv_num}* — Rs.${(sale.total||0).toLocaleString('en-IN')}\n\nView online: ${link}`;
    window.open('https://wa.me/?text='+encodeURIComponent(msg), '_blank');
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>Customer Portal</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:24 }}>Share invoice links with customers — they can view and pay online without logging in</div>

      {/* Invoice lookup */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>🔍 Look Up Invoice</div>
        <form onSubmit={lookupInvoice} style={{ display:'flex', gap:10 }}>
          <input value={invNum} onChange={e=>setInvNum(e.target.value)} placeholder="Enter invoice number e.g. INV/2024-25/0001"
            style={{ flex:1, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }} />
          <button type="submit" disabled={loading} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {loading ? '…' : 'Search'}
          </button>
        </form>
        {error && <div style={{ color:T.red, fontSize:13, marginTop:10 }}>❌ {error}</div>}
        {sale && (
          <div style={{ background:T.card, borderRadius:10, padding:16, marginTop:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{sale.inv_num}</div>
                <div style={{ fontSize:12, color:T.sub }}>{sale.date} · {sale.customer||'Walk-in'} · Rs.{(sale.total||0).toLocaleString('en-IN')}</div>
                <span style={{ background:sale.status==='paid'?T.green+'22':T.amber+'22', color:sale.status==='paid'?T.green:T.amber, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{sale.status||'paid'}</span>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => copyInvoiceLink(sale.id)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🔗 Copy Link</button>
                <button onClick={() => shareInvoiceLink(sale)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 WhatsApp</button>
              </div>
            </div>
            <div style={{ marginTop:12, background:T.srf, borderRadius:7, padding:'8px 12px', fontSize:11, color:T.muted }}>
              Customer invoice link: <span style={{ color:T.blue }}>{window.location.origin}/invoice/{sale.id}</span>
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>How Customer Portal Works</div>
        {[
          ['1. Share Invoice Link', 'After any sale, look up the invoice and share the link via WhatsApp or SMS'],
          ['2. Customer Views Online', 'Customer clicks the link — no login needed, sees full invoice details'],
          ['3. Customer Pays', 'Customer can pay via UPI directly from the invoice page'],
          ['4. Sales History', 'All payments appear in your Sales History automatically'],
        ].map(([title,desc]) => (
          <div key={title} style={{ display:'flex', gap:12, marginBottom:14 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:T.blue, flexShrink:0, marginTop:5 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>{title}</div>
              <div style={{ fontSize:12, color:T.sub }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
