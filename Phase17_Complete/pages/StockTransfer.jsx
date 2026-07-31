import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt = n => (n||0).toLocaleString('en-IN');

export default function StockTransfer({ tenant }) {
  const [branches,   setBranches]   = useState([]);
  const [inventory,  setInventory]  = useState([]);
  const [transfers,  setTransfers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [items,      setItems]      = useState([{ item_id:'', qty:1 }]);
  const [note,       setNote]       = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [brRes, invRes, trRes] = await Promise.all([
      supabase.from('branches').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      getInventory(tenant.id),
      supabase.from('stock_transfers').select('*, from_branch:branches!from_branch(name), to_branch:branches!to_branch(name)').eq('tenant_id', tenant.id).order('created_at', { ascending:false }).limit(50),
    ]);
    setBranches(brRes.data || []);
    setInventory(invRes);
    setTransfers(trRes.data || []);
    setLoading(false);
  }

  async function processTransfer(e) {
    e.preventDefault();
    if (!from || !to || from === to) return alert('Select different source and destination branches');
    const validItems = items.filter(i => i.item_id && i.qty > 0);
    if (!validItems.length) return alert('Add at least one item');
    setSaving(true);
    try {
      for (const line of validItems) {
        const item = inventory.find(i => i.id === line.item_id);
        if (!item) continue;
        if ((item.stock||0) < line.qty) { alert(`Insufficient stock for ${item.name}`); setSaving(false); return; }
        await supabase.from('stock_transfers').insert({
          tenant_id: tenant.id, from_branch: from, to_branch: to,
          item_id: line.item_id, item_name: item.name, qty: line.qty,
          note, status: 'completed',
        });
        await supabase.from('inventory').update({ stock: (item.stock||0) - line.qty }).eq('id', line.item_id);
      }
      setShowForm(false); setFrom(''); setTo(''); setItems([{ item_id:'', qty:1 }]); setNote('');
      await load();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
  const sel = { ...inp, cursor:'pointer' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Stock Transfer</div>
          <div style={{ fontSize:13, color:T.sub }}>Move stock between branches</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + New Transfer
        </button>
      </div>

      {branches.length < 2 && (
        <div style={{ background:T.amber+'18', border:`1px solid ${T.amber}44`, borderRadius:10, padding:'14px 18px', marginBottom:20, fontSize:13, color:T.amber }}>
          ⚠️ You need at least 2 branches to transfer stock. Add branches in the Branches section first.
        </div>
      )}

      {/* Transfer history */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, fontWeight:700, color:T.ink }}>Transfer History</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:T.card }}>
              {['Date','Item','Qty','From','To','Note','Status'].map(h => (
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.sub }}>Loading…</td></tr>
            : transfers.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:T.muted }}>No transfers yet</td></tr>
            : transfers.map(t => (
              <tr key={t.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                <td style={{ padding:'9px 14px', color:T.sub }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                <td style={{ padding:'9px 14px', color:T.ink, fontWeight:600 }}>{t.item_name}</td>
                <td style={{ padding:'9px 14px', color:T.blue, fontWeight:700 }}>{fmt(t.qty)}</td>
                <td style={{ padding:'9px 14px', color:T.red }}>{t.from_branch?.name||'—'}</td>
                <td style={{ padding:'9px 14px', color:T.green }}>{t.to_branch?.name||'—'}</td>
                <td style={{ padding:'9px 14px', color:T.muted }}>{t.note||'—'}</td>
                <td style={{ padding:'9px 14px' }}>
                  <span style={{ background:T.green+'22', color:T.green, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transfer form */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>New Stock Transfer</div>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={processTransfer}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>From Branch *</label>
                  <select value={from} onChange={e=>setFrom(e.target.value)} style={sel} required>
                    <option value="">Select source</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>To Branch *</label>
                  <select value={to} onChange={e=>setTo(e.target.value)} style={sel} required>
                    <option value="">Select destination</option>
                    {branches.filter(b=>b.id!==from).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontWeight:700, color:T.ink, marginBottom:10, fontSize:14 }}>Items to Transfer</div>
              {items.map((line, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                  <select value={line.item_id} onChange={e=>setItems(prev=>prev.map((l,i)=>i===idx?{...l,item_id:e.target.value}:l))} style={{ ...sel, flex:2 }}>
                    <option value="">Select item</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock||0})</option>)}
                  </select>
                  <input type="number" min={1} value={line.qty} onChange={e=>setItems(prev=>prev.map((l,i)=>i===idx?{...l,qty:parseInt(e.target.value)||1}:l))}
                    style={{ ...inp, width:70 }} placeholder="Qty" />
                  {items.length > 1 && <button type="button" onClick={()=>setItems(prev=>prev.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:18 }}>×</button>}
                </div>
              ))}
              <button type="button" onClick={()=>setItems(prev=>[...prev,{item_id:'',qty:1}])} style={{ background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', marginBottom:14 }}>
                + Add Item
              </button>

              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Note</label>
                <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason for transfer" style={inp} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving ? 'Transferring…' : 'Transfer Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
