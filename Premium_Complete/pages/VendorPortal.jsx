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

const STATUS_COLORS = { pending:T.amber, acknowledged:T.blue, dispatched:T.teal, delivered:T.green, cancelled:T.red };

export default function VendorPortal({ tenant }) {
  const [suppliers, setSuppliers]  = useState([]);
  const [pos,       setPOs]        = useState([]);
  const [selected,  setSelected]   = useState(null);
  const [loading,   setLoading]    = useState(true);
  const [copying,   setCopying]    = useState('');

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [supRes, poRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('purchase_orders').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
    ]);
    setSuppliers(supRes.data||[]);
    setPOs(poRes.data||[]);
    setLoading(false);
  }

  async function genToken(supplier) {
    const token = Math.random().toString(36).slice(2,12).toUpperCase();
    await supabase.from('suppliers').update({ portal_token:token, portal_enabled:true }).eq('id', supplier.id);
    setSuppliers(prev=>prev.map(s=>s.id===supplier.id?{...s,portal_token:token,portal_enabled:true}:s));
    return token;
  }

  async function togglePortal(supplier) {
    const token = supplier.portal_token || await (async()=>{ const t=Math.random().toString(36).slice(2,12).toUpperCase(); return t; })();
    await supabase.from('suppliers').update({ portal_enabled:!supplier.portal_enabled, portal_token:token }).eq('id', supplier.id);
    setSuppliers(prev=>prev.map(s=>s.id===supplier.id?{...s,portal_enabled:!s.portal_enabled,portal_token:token}:s));
  }

  async function updatePOStatus(po, vendor_status, vendor_note) {
    await supabase.from('purchase_orders').update({
      vendor_status, vendor_note,
      ...(vendor_status==='dispatched'?{dispatched_at:new Date().toISOString()}:{})
    }).eq('id', po.id);
    setPOs(prev=>prev.map(p=>p.id===po.id?{...p,vendor_status,vendor_note}:p));
    setSelected(prev=>prev?.id===po.id?{...prev,vendor_status,vendor_note}:prev);
  }

  function copyPortalLink(supplier) {
    const url = `${window.location.origin}/vendor/${supplier.portal_token}`;
    navigator.clipboard.writeText(url);
    setCopying(supplier.id);
    setTimeout(()=>setCopying(''), 2000);
  }

  function sharePortalWhatsApp(supplier) {
    const url  = `${window.location.origin}/vendor/${supplier.portal_token}`;
    const msg  = `Hi ${supplier.name}!\n\nYour Vendor Portal for ${tenant?.name||'Elite Store'} is now active.\n\nView your purchase orders and update delivery status:\n${url}\n\nNo login required — access it anytime! 🚚`;
    const ph   = (supplier.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const supplierPOs = selected ? pos.filter(p=>p.supplier_id===selected.id) : [];
  const pendingDeliveries = pos.filter(p=>p.vendor_status==='dispatched'||p.vendor_status==='acknowledged').length;

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>🏭 Vendor Portal</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Give suppliers a private link to view POs and update delivery status · {pendingDeliveries} pending deliveries</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Suppliers list */}
        <div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Suppliers ({suppliers.length})</div>
            {loading?<div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            :suppliers.length===0?<div style={{ padding:40, textAlign:'center', color:T.muted, fontSize:12 }}>No suppliers. Add them in Suppliers module.</div>
            :suppliers.map(sup=>{
              const supPOs   = pos.filter(p=>p.supplier_id===sup.id);
              const active   = supPOs.filter(p=>!['delivered','cancelled'].includes(p.status)).length;
              return (
                <div key={sup.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                  <div onClick={()=>setSelected(selected?.id===sup.id?null:sup)} style={{ padding:'12px 16px', cursor:'pointer', background:selected?.id===sup.id?T.card:'transparent', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{sup.name}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{sup.phone||'No phone'} · {supPOs.length} POs{active>0?` · ${active} active`:''}</div>
                    </div>
                    <span style={{ background:sup.portal_enabled?T.green+'22':T.bdr, color:sup.portal_enabled?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                      {sup.portal_enabled?'🟢 Portal On':'🔴 Off'}
                    </span>
                  </div>
                  {selected?.id===sup.id && (
                    <div style={{ padding:'12px 16px', background:T.card, borderTop:`1px solid ${T.bdr}22` }}>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button onClick={()=>togglePortal(sup)} style={{ background:sup.portal_enabled?T.red+'22':T.green+'22', color:sup.portal_enabled?T.red:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          {sup.portal_enabled?'Disable Portal':'Enable Portal'}
                        </button>
                        {sup.portal_enabled&&sup.portal_token&&<>
                          <button onClick={()=>copyPortalLink(sup)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            {copying===sup.id?'✅ Copied!':'📋 Copy Link'}
                          </button>
                          {sup.phone&&<button onClick={()=>sharePortalWhatsApp(sup)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>}
                        </>}
                      </div>
                      {sup.portal_enabled&&sup.portal_token&&(
                        <div style={{ marginTop:8, fontSize:10, color:T.muted, fontFamily:'monospace', background:T.srf, borderRadius:5, padding:'6px 10px', wordBreak:'break-all' }}>
                          {window.location.origin}/vendor/{sup.portal_token}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PO list for selected supplier */}
        <div>
          {selected ? (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>
                POs for {selected.name} ({supplierPOs.length})
              </div>
              {supplierPOs.length===0?<div style={{ padding:40, textAlign:'center', color:T.muted, fontSize:12 }}>No purchase orders for this supplier</div>
              :supplierPOs.map(po=>(
                <div key={po.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.blue, fontFamily:'monospace' }}>{po.po_number||po.id.slice(0,8)}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{po.order_date||po.created_at?.slice(0,10)} · {fmt(po.total)}</div>
                    </div>
                    <span style={{ background:STATUS_COLORS[po.vendor_status||'pending']+'22', color:STATUS_COLORS[po.vendor_status||'pending'], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>
                      {(po.vendor_status||'pending').replace('_',' ')}
                    </span>
                  </div>
                  {po.vendor_note&&<div style={{ fontSize:11, color:T.teal, marginBottom:8 }}>📝 {po.vendor_note}</div>}
                  {po.vendor_status!=='delivered'&&po.vendor_status!=='cancelled'&&(
                    <div style={{ display:'flex', gap:6 }}>
                      {po.vendor_status==='pending'&&<button onClick={()=>updatePOStatus(po,'acknowledged',po.vendor_note)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Acknowledge</button>}
                      {(po.vendor_status==='pending'||po.vendor_status==='acknowledged')&&<button onClick={()=>updatePOStatus(po,'dispatched','Items dispatched')} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🚚 Mark Dispatched</button>}
                      {po.vendor_status==='dispatched'&&<button onClick={()=>updatePOStatus(po,'delivered',po.vendor_note)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📦 Mark Delivered</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:60, textAlign:'center', color:T.muted }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🏭</div>
              <div style={{ fontSize:13 }}>Select a supplier to view their POs and manage delivery status</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
