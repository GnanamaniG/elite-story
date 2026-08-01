import { useState, useEffect } from 'react';
import { getInventory } from '../lib/supabase';

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

export default function WhatsAppCatalog({ tenant }) {
  const [inventory,  setInventory]  = useState([]);
  const [selected,   setSelected]   = useState(new Set());
  const [cat,        setCat]        = useState('All');
  const [loading,    setLoading]    = useState(true);
  const [style,      setStyle]      = useState('detailed'); // detailed | compact | price-only
  const [preview,    setPreview]    = useState('');
  const [phone,      setPhone]      = useState('');

  useEffect(() => { if (tenant?.id) getInventory(tenant.id).then(setInventory).finally(()=>setLoading(false)); }, [tenant?.id]);

  const categories = ['All', ...new Set(inventory.map(i=>i.cat).filter(Boolean))];
  const filtered   = inventory.filter(i => (cat==='All'||i.cat===cat) && (i.stock||0)>0);

  function toggleItem(id) { setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function selectAll()    { setSelected(new Set(filtered.map(i=>i.id))); }
  function clearAll()     { setSelected(new Set()); }

  function generateCatalog() {
    const items = inventory.filter(i => selected.has(i.id));
    const biz   = tenant?.name || 'Elite Store';
    let msg = '';

    if (style === 'detailed') {
      msg = `🛍️ *${biz} — Product Catalog*\n`;
      msg += `📍 Tamil Nadu | 📞 ${tenant?.phone||''}\n\n`;
      const byCat = items.reduce((acc,i)=>{ const c=i.cat||'Products'; (acc[c]=acc[c]||[]).push(i); return acc; },{});
      Object.entries(byCat).forEach(([cat,catItems])=>{
        msg += `━━━ *${cat}* ━━━\n`;
        catItems.forEach(i=>{
          msg += `\n✅ *${i.name}*\n`;
          msg += `   💰 Price: *${fmt(i.sp)}*\n`;
          if (i.code) msg += `   🔖 Code: ${i.code}\n`;
          msg += `   📦 Stock: ${i.stock||0} available\n`;
        });
        msg += '\n';
      });
      msg += `\n💬 To order, reply with item name & quantity\n`;
      msg += `📦 Delivery available | UPI: ${tenant?.upi_id||'Available'}`;
    } else if (style === 'compact') {
      msg = `🛍️ *${biz}*\n\n`;
      items.forEach((i,idx)=>{ msg += `${idx+1}. ${i.name} — *${fmt(i.sp)}*\n`; });
      msg += `\nMessage us to order! 📲`;
    } else {
      msg = `💰 *${biz} Price List*\n\n`;
      const maxLen = Math.max(...items.map(i=>i.name.length));
      items.forEach(i=>{ msg += `${i.name.padEnd(maxLen)}  ${fmt(i.sp)}\n`; });
      msg += `\nAvailable at ${tenant?.name}`;
    }
    setPreview(msg);
    return msg;
  }

  function sendCatalog() {
    const msg = generateCatalog();
    const p   = phone.replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${p||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function copyCatalog() {
    const msg = generateCatalog();
    navigator.clipboard.writeText(msg).then(()=>alert('Catalog copied to clipboard!'));
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>💬 WhatsApp Catalog</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Auto-generate product catalog to share on WhatsApp Business</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Left: item picker */}
        <div>
          {/* Category filter */}
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            {categories.map(c=>(
              <button key={c} onClick={()=>setCat(c)} style={{ background:cat===c?T.blue:T.srf, color:cat===c?'#fff':T.sub, border:`1px solid ${cat===c?T.blue:T.bdr}`, borderRadius:20, padding:'5px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{c}</button>
            ))}
          </div>

          {/* Select controls */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={selectAll} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
            <button onClick={clearAll} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>
            <span style={{ fontSize:12, color:T.muted, lineHeight:'28px' }}>{selected.size} selected</span>
          </div>

          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden', maxHeight:400, overflowY:'auto' }}>
            {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            : filtered.map(item=>(
              <div key={item.id} onClick={()=>toggleItem(item.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected.has(item.id)?T.blue+'18':'transparent' }}>
                <div style={{ width:18, height:18, border:`2px solid ${selected.has(item.id)?T.blue:T.bdr}`, borderRadius:4, background:selected.has(item.id)?T.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', flexShrink:0 }}>
                  {selected.has(item.id)?'✓':''}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:T.ink, fontWeight:600 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{item.cat||'—'} · Stock: {item.stock||0}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:T.green }}>{fmt(item.sp)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: catalog options + preview */}
        <div>
          {/* Style */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.sub, textTransform:'uppercase', marginBottom:8 }}>Catalog Style</div>
            <div style={{ display:'flex', gap:8 }}>
              {[['detailed','📋 Detailed'],['compact','📝 Compact'],['price-only','💰 Price List']].map(([id,label])=>(
                <button key={id} onClick={()=>setStyle(id)} style={{ flex:1, background:style===id?T.blue:T.card, color:style===id?'#fff':T.sub, border:`1px solid ${style===id?T.blue:T.bdr}`, borderRadius:7, padding:'7px 8px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Phone number */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.sub, textTransform:'uppercase', marginBottom:6 }}>Send to Phone (optional)</div>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number"
              style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
          </div>

          {/* Action buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
            <button onClick={generateCatalog} disabled={!selected.size} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>👁 Preview</button>
            <button onClick={copyCatalog} disabled={!selected.size} style={{ background:T.teal+'22', color:T.teal, border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📋 Copy</button>
            <button onClick={sendCatalog} disabled={!selected.size} style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:8, padding:'9px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Send</button>
          </div>

          {/* Preview */}
          {preview && (
            <div style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:14, maxHeight:340, overflowY:'auto' }}>
              <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>PREVIEW</div>
              <pre style={{ fontSize:12, color:T.ink, fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{preview}</pre>
            </div>
          )}
          {!preview && selected.size > 0 && (
            <div style={{ background:T.card, borderRadius:12, padding:24, textAlign:'center', color:T.muted }}>
              <div style={{ fontSize:24, marginBottom:8 }}>💬</div>
              <div style={{ fontSize:13 }}>Click Preview to generate catalog</div>
            </div>
          )}
          {!selected.size && (
            <div style={{ background:T.card, borderRadius:12, padding:24, textAlign:'center', color:T.muted }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📦</div>
              <div style={{ fontSize:13 }}>Select items from the left to include in catalog</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
