import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

const PRESET_LISTS = [
  { name:'Wholesale', description:'For bulk buyers', discount:20 },
  { name:'VIP Customer', description:'Loyal premium customers', discount:10 },
  { name:'Staff', description:'Employee discount', discount:25 },
  { name:'Dealer', description:'Authorized dealers', discount:15 },
];

export default function PriceLists({ tenant }) {
  const [lists,      setLists]      = useState([]);
  const [inventory,  setInventory]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [listItems,  setListItems]  = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ name:'', description:'', discount:0 });
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [listsRes, inv] = await Promise.all([
      supabase.from('price_lists').select('*').eq('tenant_id', tenant.id).order('name'),
      getInventory(tenant.id),
    ]);
    setLists(listsRes.data || []);
    setInventory(inv);
    setLoading(false);
  }

  async function loadListItems(listId) {
    const { data } = await supabase.from('price_list_items').select('*').eq('price_list_id', listId);
    setListItems(data || []);
  }

  async function saveList(e) {
    e.preventDefault();
    setSaving(true);
    const { data } = await supabase.from('price_lists').insert({ ...form, tenant_id: tenant.id }).select().single();
    setLists(prev => [...prev, data]);
    setShowForm(false); setForm({ name:'', description:'', discount:0 });
    setSaving(false);
  }

  async function deleteList(id) {
    if (!confirm('Delete this price list?')) return;
    await supabase.from('price_lists').delete().eq('id', id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function updateItemPrice(listId, itemId, price, discount) {
    await supabase.from('price_list_items').upsert({
      tenant_id: tenant.id, price_list_id: listId, item_id: itemId, price: price||null, discount: discount||null
    }, { onConflict: 'price_list_id,item_id' });
    await loadListItems(listId);
  }

  function getEffectivePrice(item, list) {
    const override = listItems.find(li => li.item_id === item.id);
    if (override?.price) return override.price;
    if (override?.discount) return item.sp * (1 - override.discount/100);
    return item.sp * (1 - (list?.discount||0)/100);
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Price Lists</div>
          <div style={{ fontSize:13, color:T.sub }}>Wholesale, VIP, dealer pricing</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + Create Price List
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '280px 1fr':'1fr', gap:16 }}>
        {/* Price lists sidebar */}
        <div>
          {/* Quick presets */}
          {!lists.length && !loading && (
            <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>Quick Setup</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {PRESET_LISTS.map(preset => (
                  <button key={preset.name} onClick={async () => {
                    const { data } = await supabase.from('price_lists').insert({ ...preset, tenant_id: tenant.id }).select().single();
                    setLists(prev => [...prev, data]);
                  }} style={{ background:T.card, color:T.ink, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    + {preset.name} ({preset.discount}% off)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            : lists.length === 0 ? <div style={{ padding:40, textAlign:'center', color:T.muted, fontSize:12 }}>No price lists — use Quick Setup above</div>
            : lists.map(list => (
              <div key={list.id}
                onClick={() => { setSelected(list); loadListItems(list.id); }}
                style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===list.id?T.card:'transparent', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:T.ink }}>{list.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{list.description || `${list.discount}% discount`}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ background:T.green+'22', color:T.green, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{list.discount}% off</span>
                  <button onClick={e => { e.stopPropagation(); deleteList(list.id); }} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:14 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Item prices for selected list */}
        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{selected.name}</div>
                <div style={{ fontSize:12, color:T.sub }}>Base discount: {selected.discount}% · Override individual items below</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ maxHeight:500, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:T.card }}>
                    {['Item','Base Price','List Price','Override Price','Override Disc%'].map(h => (
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const override = listItems.find(li => li.item_id === item.id);
                    const effectivePrice = getEffectivePrice(item, selected);
                    return (
                      <tr key={item.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                        <td style={{ padding:'9px 14px', color:T.ink }}>{item.name}</td>
                        <td style={{ padding:'9px 14px', color:T.sub }}>{fmt(item.sp)}</td>
                        <td style={{ padding:'9px 14px', color:T.green, fontWeight:700 }}>{fmt(effectivePrice)}</td>
                        <td style={{ padding:'9px 14px' }}>
                          <input type="number" placeholder="Custom price" defaultValue={override?.price||''}
                            onBlur={e => updateItemPrice(selected.id, item.id, parseFloat(e.target.value)||null, override?.discount||null)}
                            style={{ ...inp, width:100, padding:'4px 8px', fontSize:12 }} />
                        </td>
                        <td style={{ padding:'9px 14px' }}>
                          <input type="number" placeholder="%" defaultValue={override?.discount||''}
                            onBlur={e => updateItemPrice(selected.id, item.id, override?.price||null, parseFloat(e.target.value)||null)}
                            style={{ ...inp, width:70, padding:'4px 8px', fontSize:12 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create list modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>Create Price List</div>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <form onSubmit={saveList} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>List Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Wholesale, VIP" style={inp} required/></div>
              <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Description</label>
                <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Who is this for?" style={inp}/></div>
              <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Base Discount (%)</label>
                <input type="number" value={form.discount} onChange={e=>setForm(f=>({...f,discount:parseFloat(e.target.value)||0}))} min={0} max={100} style={inp}/>
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>Applied to all items unless overridden</div></div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving ? 'Creating…' : 'Create Price List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
