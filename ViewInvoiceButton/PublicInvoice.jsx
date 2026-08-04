import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', green:'#16A34A', amber:'#D97706',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF',
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:2 });

/**
 * Public, no-login invoice viewer — this is what the "View Invoice"
 * WhatsApp button links to. Reachable by anyone with the link (the
 * sale's UUID functions as the access token, same pattern most
 * invoicing/e-commerce order-confirmation links use), but shows only
 * that one specific sale — nothing else in the business is exposed.
 */
export default function PublicInvoice({ saleId }) {
  const [sale, setSale] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | notfound

  useEffect(() => { if (saleId) load(); else setStatus('notfound'); }, [saleId]);

  async function load() {
    // Calls the locked-down get_public_invoice() function — it can only
    // ever return one row, for this exact id, never the raw sales table.
    const { data, error } = await supabase.rpc('get_public_invoice', { p_sale_id: saleId });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) { setStatus('notfound'); return; }
    setSale(row);
    setTenant({ name: row.tenant_name, phone: row.tenant_phone });
    setStatus('ok');
  }

  if (status === 'loading') return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:40, height:40, border:`3px solid ${T.red}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  if (status === 'notfound') return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, padding:20, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>🧾</div>
      <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>Invoice not found</div>
      <div style={{ fontSize:13, color:T.sub }}>This link may be incorrect or the invoice may have been removed.</div>
    </div>
  );

  const cgst = (sale.gst_amount||0)/2, sgst = (sale.gst_amount||0)/2;
  const balanceDue = Math.max(0, (sale.total||0) - (sale.amount_paid ?? sale.total ?? 0));

  return (
    <div style={{ minHeight:'100vh', background:T.bg, padding:'30px 16px', fontFamily:'Arial, sans-serif' }}>
      <div style={{ maxWidth:480, margin:'0 auto', background:T.srf, borderRadius:16, overflow:'hidden', boxShadow:'0 3px 16px rgba(0,0,0,.08)' }}>

        <div style={{ background:'linear-gradient(90deg,#7B1E1E,#8B0000)', padding:'26px 24px', textAlign:'center' }}>
          <div style={{ color:'#fff', fontSize:20, fontWeight:900, letterSpacing:'-0.01em' }}>{tenant?.name||'Invoice'}</div>
          <div style={{ color:'rgba(255,255,255,.8)', fontSize:12, marginTop:4 }}>Invoice {sale.inv_num} · {sale.date}</div>
        </div>

        <div style={{ padding:'24px' }}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:11, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Amount Paid</div>
            <div style={{ fontSize:38, fontWeight:900, color:T.ink, margin:'6px 0' }}>{fmt(sale.total)}</div>
            <span style={{ background: balanceDue<=0.5?'#F0FDF4':'#FFFBEB', color: balanceDue<=0.5?T.green:T.amber, borderRadius:20, padding:'5px 16px', fontSize:12, fontWeight:700 }}>
              {balanceDue<=0.5 ? 'Fully Paid' : `Balance Due ${fmt(balanceDue)}`}
            </span>
          </div>

          <div style={{ borderTop:`1px solid ${T.bdr}`, paddingTop:16, marginBottom:16 }}>
            <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Items</div>
            {(sale.items||[]).map((it,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', fontSize:13.5, borderBottom: i<(sale.items.length-1)?`1px solid ${T.bdr}33`:'none' }}>
                <div><span style={{ color:T.ink, fontWeight:600 }}>{it.name}</span><span style={{ color:T.muted }}> ×{it.qty}</span></div>
                <span style={{ color:T.red, fontWeight:700 }}>{fmt(it.amount)}</span>
              </div>
            ))}
          </div>

          <div style={{ background:T.bg, borderRadius:10, padding:'14px 16px' }}>
            {[['Subtotal',sale.subtotal],['CGST',cgst],['SGST',sgst],sale.discount>0&&['Discount',-sale.discount]].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'3px 0', color:T.sub }}>
                <span>{l}</span><span style={{ color: v<0?T.green:T.ink }}>{v<0?'-':''}{fmt(Math.abs(v))}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:900, color:T.ink, paddingTop:8, marginTop:6, borderTop:`1px solid ${T.bdr}` }}>
              <span>Total</span><span>{fmt(sale.total)}</span>
            </div>
          </div>

          <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:T.muted }}>
            Thank you for shopping with us! 🙏
            {tenant?.phone && <div style={{ marginTop:4 }}>{tenant.phone}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
