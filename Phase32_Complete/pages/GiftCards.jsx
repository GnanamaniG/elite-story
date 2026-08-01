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

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:12}, (_,i) => i===4||i===8 ? '-' : chars[Math.floor(Math.random()*chars.length)]).join('');
}

export default function GiftCards({ tenant }) {
  const [cards,    setCards]    = useState([]);
  const [txns,     setTxns]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checkCode,setCheckCode]= useState('');
  const [foundCard,setFoundCard]= useState(null);
  const [redeemAmt,setRedeemAmt]= useState('');
  const [filter,   setFilter]   = useState('active');
  const [form,     setForm]     = useState({ code:genCode(), initial_value:500, issued_to:'', expiry_date:'', notes:'' });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [cardsRes, txnsRes] = await Promise.all([
      supabase.from('gift_cards').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      supabase.from('gift_card_txns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(50),
    ]);
    setCards(cardsRes.data||[]);
    setTxns(txnsRes.data||[]);
    setLoading(false);
  }

  async function issueCard(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase.from('gift_cards').insert({
        ...form, tenant_id: tenant.id, balance: form.initial_value, status:'active',
      });
      setShowForm(false);
      setForm({ code:genCode(), initial_value:500, issued_to:'', expiry_date:'', notes:'' });
      await load();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  async function lookupCard() {
    if (!checkCode.trim()) return;
    const { data } = await supabase.from('gift_cards').select('*').eq('tenant_id', tenant.id).ilike('code', checkCode.trim()).single();
    setFoundCard(data || null);
    if (!data) alert('Gift card not found');
  }

  async function redeemCard() {
    if (!foundCard || !redeemAmt) return;
    const amount = parseFloat(redeemAmt);
    if (amount > foundCard.balance) return alert(`Insufficient balance. Available: ${fmt(foundCard.balance)}`);
    setSaving(true);
    const newBalance = foundCard.balance - amount;
    await supabase.from('gift_card_txns').insert({ tenant_id:tenant.id, card_id:foundCard.id, amount, balance_after:newBalance });
    await supabase.from('gift_cards').update({ balance:newBalance, status:newBalance===0?'redeemed':'active' }).eq('id', foundCard.id);
    setFoundCard({ ...foundCard, balance:newBalance });
    setRedeemAmt('');
    setSaving(false);
    await load();
    alert(`✅ Redeemed ${fmt(amount)}. Remaining balance: ${fmt(newBalance)}`);
  }

  async function cancelCard(id) {
    if (!confirm('Cancel this gift card?')) return;
    await supabase.from('gift_cards').update({ status:'cancelled' }).eq('id', id);
    await load();
  }

  function printCard(card) {
    const w = window.open('', '_blank', 'width=400,height=300');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#fff;}
      .card{width:340px;height:200px;border:3px solid #4f7cff;border-radius:16px;padding:20px;background:linear-gradient(135deg,#060710,#1a1f3e);color:#fff;display:flex;flex-direction:column;justify-content:space-between;}
      .logo{font-size:18px;font-weight:900;color:#4f7cff;}
      .code{font-family:monospace;font-size:22px;letter-spacing:2px;font-weight:bold;text-align:center;}
      .row{display:flex;justify-content:space-between;font-size:12px;}
    </style></head><body>
    <div class="card">
      <div class="logo">🎁 ${tenant?.name||'Elite Store'} Gift Card</div>
      <div class="code">${card.code}</div>
      <div class="row"><span>Value: Rs.${card.initial_value}</span><span>${card.issued_to||''}</span><span>Exp: ${card.expiry_date||'No expiry'}</span></div>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}<\/script>
    </body></html>`);
    w.document.close();
  }

  function shareCardWhatsApp(card) {
    const msg = `🎁 *Gift Card — ${tenant?.name||'Elite Store'}*\n\nCode: *${card.code}*\nValue: *${fmt(card.initial_value)}*\n${card.expiry_date?`Valid until: ${card.expiry_date}`:'No expiry'}\n\nUse this code at our store to redeem your gift card. 🎉`;
    window.open('https://wa.me/?text='+encodeURIComponent(msg), '_blank');
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const displayed = filter==='all' ? cards : cards.filter(c=>c.status===filter);
  const totalIssued   = cards.reduce((s,c)=>s+c.initial_value,0);
  const totalBalance  = cards.filter(c=>c.status==='active').reduce((s,c)=>s+c.balance,0);
  const totalRedeemed = cards.reduce((s,c)=>s+(c.initial_value-c.balance),0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>🎁 Gift Cards & Vouchers</div>
          <div style={{ fontSize:13, color:T.sub }}>{cards.length} cards issued</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Issue Gift Card
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Total Issued',fmt(totalIssued),T.blue],['Active Balance',fmt(totalBalance),T.green],['Total Redeemed',fmt(totalRedeemed),T.amber]].map(([label,val,color])=>(
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Quick redeem lookup */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:18, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>🔍 Check / Redeem Card</div>
        <div style={{ display:'flex', gap:8, marginBottom:foundCard?14:0 }}>
          <input value={checkCode} onChange={e=>setCheckCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&lookupCard()} placeholder="Enter gift card code e.g. ABCD-EFGH-1234" style={{ ...inp, flex:1, fontFamily:'monospace', letterSpacing:2 }} />
          <button onClick={lookupCard} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Check</button>
        </div>
        {foundCard && (
          <div style={{ background:foundCard.status==='active'?T.green+'18':T.red+'18', border:`1px solid ${foundCard.status==='active'?T.green:T.red}44`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
              <div><div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Card Code</div><div style={{ fontSize:14, fontWeight:700, color:T.ink, fontFamily:'monospace' }}>{foundCard.code}</div></div>
              <div><div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Balance</div><div style={{ fontSize:18, fontWeight:800, color:T.green }}>{fmt(foundCard.balance)}</div></div>
              <div><div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Status</div><span style={{ background:foundCard.status==='active'?T.green+'22':T.red+'22', color:foundCard.status==='active'?T.green:T.red, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{foundCard.status}</span></div>
            </div>
            {foundCard.status==='active' && foundCard.balance > 0 && (
              <div style={{ display:'flex', gap:8 }}>
                <input type="number" value={redeemAmt} onChange={e=>setRedeemAmt(e.target.value)} placeholder="Redeem amount" max={foundCard.balance} style={{ ...inp, flex:1 }} />
                <button onClick={redeemCard} disabled={saving} style={{ background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving?'…':'Redeem'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter + table */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['all','All'],['active','Active'],['redeemed','Redeemed'],['cancelled','Cancelled']].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?T.blue:T.srf, color:filter===id?'#fff':T.sub, border:`1px solid ${filter===id?T.blue:T.bdr}`, borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{label} ({id==='all'?cards.length:cards.filter(c=>c.status===id).length})</button>
        ))}
      </div>

      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.card }}>
            {['Code','Issued To','Value','Balance','Issued','Expiry','Status','Actions'].map(h=>(
              <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            :displayed.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:T.muted }}>No gift cards</td></tr>
            :displayed.map(card=>(
              <tr key={card.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', color:T.blue, fontSize:12, fontWeight:700 }}>{card.code}</td>
                <td style={{ padding:'10px 14px', color:T.ink }}>{card.issued_to||'—'}</td>
                <td style={{ padding:'10px 14px', color:T.sub }}>{fmt(card.initial_value)}</td>
                <td style={{ padding:'10px 14px', color:T.green, fontWeight:700 }}>{fmt(card.balance)}</td>
                <td style={{ padding:'10px 14px', color:T.muted }}>{card.issued_date}</td>
                <td style={{ padding:'10px 14px', color:card.expiry_date&&new Date(card.expiry_date)<new Date()?T.red:T.muted }}>{card.expiry_date||'—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:card.status==='active'?T.green+'22':T.muted+'22', color:card.status==='active'?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{card.status}</span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>printCard(card)} style={{ background:T.blue+'22', color:T.blue, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                    <button onClick={()=>shareCardWhatsApp(card)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>💬</button>
                    {card.status==='active'&&<button onClick={()=>cancelCard(card.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>×</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Issue form */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Issue Gift Card</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={issueCard}>
              {[['Code','text',form.code,v=>setForm(f=>({...f,code:v.toUpperCase()})),'monospace'],['Value (Rs.)','number',form.initial_value,v=>setForm(f=>({...f,initial_value:parseFloat(v)||0}))],['Issued To (Customer)','text',form.issued_to,v=>setForm(f=>({...f,issued_to:v}))],['Expiry Date','date',form.expiry_date,v=>setForm(f=>({...f,expiry_date:v}))],['Notes','text',form.notes,v=>setForm(f=>({...f,notes:v}))]].map(([label,type,val,setter,ff])=>(
                <div key={label} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>{label}</label>
                  <input type={type} value={val} onChange={e=>setter(e.target.value)} style={{ ...inp, fontFamily:ff||'inherit' }} required={label.includes('Code')||label.includes('Value')} />
                </div>
              ))}
              <button type="button" onClick={()=>setForm(f=>({...f,code:genCode()}))} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', marginBottom:14 }}>🔄 Generate New Code</button>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Issuing…':'Issue Gift Card'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
