import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

const STATUS_COLORS = { pending:T.amber, confirmed:T.blue, processing:T.purple, delivered:T.green, cancelled:T.red };

export default function WAOrderBot({ tenant }) {
  const [config,    setConfig]    = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({ greeting:'', catalog_msg:'', order_msg:'', enabled:false });
  const [tab,       setTab]       = useState('orders'); // orders | config | setup | simulate

  // Simulator state
  const [simMsg,    setSimMsg]    = useState('');
  const [simConvo,  setSimConvo]  = useState([]);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [cfgRes, ordersRes, inv] = await Promise.all([
      supabase.from('wa_bot_config').select('*').eq('tenant_id', tenant.id).single(),
      supabase.from('wa_orders').select('*').eq('tenant_id', tenant.id).order('received_at', { ascending:false }),
      getInventory(tenant.id),
    ]);
    const cfg = cfgRes.data || { greeting:'Hi! Welcome to our store. Type "catalog" to see products or describe what you need.', catalog_msg:'Here are our products:', order_msg:'Thank you! We will contact you to confirm your order.', enabled:false };
    setConfig(cfg);
    setForm({ greeting:cfg.greeting, catalog_msg:cfg.catalog_msg, order_msg:cfg.order_msg, enabled:cfg.enabled||false });
    setOrders(ordersRes.data||[]);
    setInventory(inv);
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    const verifyToken = config?.webhook_verify_token || Math.random().toString(36).slice(2,12);
    const payload = { tenant_id:tenant.id, ...form, webhook_verify_token:verifyToken };
    if (config?.id) await supabase.from('wa_bot_config').update(payload).eq('id', config.id);
    else await supabase.from('wa_bot_config').insert(payload);
    setSaving(false); await load();
  }

  async function updateOrderStatus(id, status) {
    await supabase.from('wa_orders').update({ status }).eq('id', id);
    setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
  }

  function confirmOrderWhatsApp(order) {
    const msg = `Hi ${order.customer}! 🎉\n\nYour order with *${tenant?.name||'Elite Store'}* has been *confirmed*!\n\n*Items:*\n${(order.items||[]).map(i=>`• ${i.name} x${i.qty}`).join('\n')}\n\n*Total: ${fmt(order.total)}*\n\nWe will contact you for delivery. Thank you! 🙏`;
    const ph  = (order.phone||'').replace(/\D/g,'').replace(/^0/,'91');
    window.open(`https://wa.me/${ph||''}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Bot simulator
  function processBotMessage(msg) {
    const lower = msg.toLowerCase().trim();
    const botResponse = [];

    if (lower.includes('hi')||lower.includes('hello')||lower.includes('start')) {
      botResponse.push(form.greeting || 'Hi! Welcome!');
      botResponse.push('Type:\n• *catalog* — see our products\n• *order [item] [qty]* — place an order\n• *help* — for assistance');
    } else if (lower.includes('catalog')||lower.includes('products')||lower.includes('items')) {
      const cats = [...new Set(inventory.map(i=>i.cat).filter(Boolean))];
      let catalogText = form.catalog_msg + '\n\n';
      if (cats.length > 0) {
        cats.forEach(cat => {
          catalogText += `*${cat}*\n`;
          inventory.filter(i=>i.cat===cat&&(i.stock||0)>0).slice(0,5).forEach(i => {
            catalogText += `• ${i.name} — Rs.${(i.sp||0).toLocaleString('en-IN')}\n`;
          });
          catalogText += '\n';
        });
      } else {
        inventory.slice(0,8).forEach(i => { catalogText += `• ${i.name} — Rs.${(i.sp||0).toLocaleString('en-IN')}\n`; });
      }
      catalogText += '\nType *order [item name] [quantity]* to order';
      botResponse.push(catalogText);
    } else if (lower.includes('order')) {
      const parts   = lower.replace('order','').trim().split(' ');
      const qty     = parseInt(parts[parts.length-1])||1;
      const itemStr = parts.slice(0,parts.length-(parseInt(parts[parts.length-1])?1:0)).join(' ').trim();
      const found   = inventory.find(i=>i.name.toLowerCase().includes(itemStr));
      if (found) {
        botResponse.push(`Great choice! 🎉\n\n*${found.name}*\nQty: ${qty}\nPrice: Rs.${(found.sp||0).toLocaleString('en-IN')} each\nTotal: Rs.${((found.sp||0)*qty).toLocaleString('en-IN')}\n\nPlease share your delivery address to confirm.`);
      } else {
        botResponse.push(`Sorry, I couldn't find "${itemStr}" in our catalog. Type *catalog* to see available products.`);
      }
    } else if (lower.includes('price')||lower.includes('cost')) {
      botResponse.push('Type *catalog* to see all products with prices!');
    } else if (lower.includes('help')) {
      botResponse.push('*How to order:*\n1. Type *catalog* to see products\n2. Type *order [item] [qty]* to order\nExample: _order Nike Air Max 1_\n\nFor help, call us at: ' + (tenant?.phone||'our store'));
    } else {
      botResponse.push('I didn\'t understand that. Type *help* for available commands, or *catalog* to see our products! 😊');
    }
    return botResponse;
  }

  function simSend() {
    if (!simMsg.trim()) return;
    const userMsg = { type:'user', text:simMsg, time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) };
    const responses = processBotMessage(simMsg);
    const botMsgs = responses.map(text => ({ type:'bot', text, time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) }));
    setSimConvo(prev => [...prev, userMsg, ...botMsgs]);
    setSimMsg('');
  }

  const pendingOrders = orders.filter(o=>o.status==='pending').length;
  const totalOrderValue = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+(o.total||0),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>💬 WhatsApp Order Bot</div>
          <div style={{ fontSize:13, color:T.sub }}>{orders.length} orders received · {pendingOrders} pending</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ background:form.enabled?T.green+'22':T.red+'22', color:form.enabled?T.green:T.red, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:700 }}>{form.enabled?'🟢 Active':'🔴 Inactive'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {[['orders','📋 Orders'],['simulate','🤖 Simulator'],['config','⚙️ Bot Config'],['setup','📡 Setup Guide']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?T.blue:T.srf, color:tab===id?'#fff':T.sub, border:`1px solid ${tab===id?T.blue:T.bdr}`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
        ))}
      </div>

      {/* Orders tab */}
      {tab==='orders' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {[['Pending',orders.filter(o=>o.status==='pending').length,T.amber],['Confirmed',orders.filter(o=>o.status==='confirmed').length,T.blue],['Total Value',fmt(totalOrderValue),T.green]].map(([label,val,color])=>(
              <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'12px 16px' }}>
                <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label}</div>
                <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:T.card }}>
                {['Customer','Phone','Items','Total','Status','Actions'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading?<tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
                :orders.length===0?<tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:T.muted }}>No WhatsApp orders yet. Set up the bot to start receiving orders.</td></tr>
                :orders.map(o=>(
                  <tr key={o.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                    <td style={{ padding:'10px 14px', color:T.ink, fontWeight:600 }}>{o.customer||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.sub }}>{o.phone||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.sub, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(', ')||o.message||'—'}</td>
                    <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(o.total)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:STATUS_COLORS[o.status]+'22', color:STATUS_COLORS[o.status], borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{o.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        {o.status==='pending'&&<button onClick={()=>{ updateOrderStatus(o.id,'confirmed'); confirmOrderWhatsApp(o); }} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✅ Confirm</button>}
                        {['confirmed','processing'].includes(o.status)&&<button onClick={()=>updateOrderStatus(o.id,'delivered')} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📦 Deliver</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Simulator tab */}
      {tab==='simulate' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr', maxWidth:480, margin:'0 auto' }}>
          <div style={{ background:'#e5ddd5', borderRadius:14, overflow:'hidden' }}>
            <div style={{ background:'#075e54', padding:'14px 18px', color:'#fff', fontSize:15, fontWeight:700 }}>📱 {tenant?.name||'Elite Store'} WhatsApp Bot</div>
            <div style={{ height:360, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
              {simConvo.length===0&&<div style={{ textAlign:'center', color:'#666', padding:40, fontSize:13 }}>Test your bot — type a message below!</div>}
              {simConvo.map((msg,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:msg.type==='user'?'flex-end':'flex-start' }}>
                  <div style={{ background:msg.type==='user'?'#dcf8c6':'#fff', borderRadius:8, padding:'8px 12px', maxWidth:'80%', fontSize:13, color:'#000', boxShadow:'0 1px 2px rgba(0,0,0,.15)' }}>
                    <pre style={{ margin:0, fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{msg.text}</pre>
                    <div style={{ fontSize:10, color:'#666', marginTop:4, textAlign:'right' }}>{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:10, background:'#f0f0f0', display:'flex', gap:8 }}>
              <input value={simMsg} onChange={e=>setSimMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&simSend()} placeholder="Type a message…" style={{ flex:1, background:'#fff', border:'none', borderRadius:20, padding:'9px 16px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
              <button onClick={simSend} style={{ background:'#25d366', color:'#fff', border:'none', borderRadius:'50%', width:38, height:38, fontSize:16, cursor:'pointer' }}>▶</button>
            </div>
          </div>
          <div style={{ marginTop:12, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'10px 14px', fontSize:11, color:T.muted }}>
            Try: <code style={{ color:T.blue }}>hi</code> · <code style={{ color:T.blue }}>catalog</code> · <code style={{ color:T.blue }}>order Nike Air Max 2</code> · <code style={{ color:T.blue }}>help</code>
          </div>
        </div>
      )}

      {/* Config tab */}
      {tab==='config' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14 }}>Bot Configuration</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'12px 14px', background:T.card, borderRadius:9 }}>
            <span style={{ fontSize:13, color:T.ink }}>Bot Status</span>
            <div style={{ flex:1 }} />
            <button onClick={()=>setForm(f=>({...f,enabled:!f.enabled}))} style={{ background:form.enabled?T.green:T.bdr, color:'#fff', border:'none', borderRadius:20, padding:'5px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {form.enabled?'🟢 Enabled':'🔴 Disabled'}
            </button>
          </div>
          {[['Greeting Message','greeting','First message when customer says hi'],['Catalog Intro','catalog_msg','Message before showing product list'],['Order Confirmation','order_msg','Message after order is received']].map(([label,key,hint])=>(
            <div key={key} style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
              <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{hint}</div>
              <textarea value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} rows={3}
                style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', resize:'vertical' }} />
            </div>
          ))}
          <button onClick={saveConfig} disabled={saving} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'Saving…':'Save Config'}
          </button>
        </div>
      )}

      {/* Setup guide tab */}
      {tab==='setup' && (
        <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, color:T.ink, marginBottom:14, fontSize:15 }}>📡 WhatsApp Business Bot Setup</div>
          <div style={{ color:T.sub, fontSize:13, marginBottom:16 }}>Follow these steps to connect your WhatsApp Business account to Elite Store:</div>
          {[
            ['1. Get WhatsApp Business API Access', 'Go to developers.facebook.com → Create App → Add WhatsApp product → Get Phone Number ID and Access Token'],
            ['2. Add to Vercel Environment Variables', 'VITE_WA_PHONE_ID = your Phone Number ID\nVITE_WA_TOKEN = your permanent access token'],
            ['3. Configure Webhook', `In Meta Developer Console → WhatsApp → Configuration → Webhook URL:\nhttps://elite-story.vercel.app/api/wa-webhook\nVerify Token: ${config?.webhook_verify_token||'Set in bot config first'}`],
            ['4. Create Webhook Handler', 'Create a Supabase Edge Function to receive incoming messages and process orders. See documentation at docs.anthropic.com'],
            ['5. Test with Simulator', 'Use the Simulator tab to test bot responses before going live. The bot handles: catalog, ordering, help commands.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ background:T.card, borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:6 }}>{title}</div>
              <pre style={{ fontSize:12, color:T.sub, fontFamily:'inherit', whiteSpace:'pre-wrap', lineHeight:1.6, margin:0 }}>{desc}</pre>
            </div>
          ))}
          <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:9, padding:'12px 16px', fontSize:12, color:T.amber, marginTop:10 }}>
            💡 For a simpler alternative: Use the WhatsApp Catalog feature to share your product catalog manually, and use the Customer Portal for order tracking.
          </div>
        </div>
      )}
    </div>
  );
}
