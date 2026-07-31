import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', purple:'#9b72ff', teal:'#00c9b1' };
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

function BundleForm({ bundle, tenantId, inventory, onSave, onCancel }) {
  const [name,        setName]        = useState(bundle?.name||'');
  const [description, setDescription] = useState(bundle?.description||'');
  const [bundlePrice, setBundlePrice] = useState(bundle?.bundle_price||'');
  const [items,       setItems]       = useState(bundle?.items||[]);
  const [search,      setSearch]      = useState('');
  const [saving,      setSaving]      = useState(false);

  const origTotal = items.reduce((s,i)=>s+(i.orig_price||0)*(i.qty||1),0);
  const savings   = origTotal - (parseFloat(bundlePrice)||0);
  const savingsPct= origTotal>0?Math.round(savings/origTotal*100):0;

  function addItem(inv) {
    if (items.find(i=>i.item_id===inv.id)) return;
    setItems(prev=>[...prev,{ item_id:inv.id, item_name:inv.name, qty:1, orig_price:inv.sp||0 }]);
    setSearch('');
  }
  function removeItem(id) { setItems(prev=>prev.filter(i=>i.item_id!==id)); }
  function updateQty(id, qty) { setItems(prev=>prev.map(i=>i.item_id===id?{...i,qty:parseInt(qty)||1}:i)); }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()||!bundlePrice||!items.length) return alert('Name, price, and at least one item required');
    setSaving(true);
    try {
      let bundleId = bundle?.id;
      if (bundle?.id) {
        await supabase.from('bundles').update({ name, description, bundle_price:parseFloat(bundlePrice) }).eq('id', bundle.id);
        await supabase.from('bundle_items').delete().eq('bundle_id', bundle.id);
      } else {
        const { data } = await supabase.from('bundles').insert({ tenant_id:tenantId, name, description, bundle_price:parseFloat(bundlePrice) }).select().single();
        bundleId = data.id;
      }
      for (const item of items) {
        await supabase.from('bundle_items').insert({ tenant_id:tenantId, bundle_id:bundleId, item_id:item.item_id, item_name:item.item_name, qty:item.qty, orig_price:item.orig_price });
      }
      onSave();
    } catch(e) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  }

  const filteredInv = inventory.filter(i => search && (i.name.toLowerCase().includes(search.toLowerCase())||( i.code||'').toLowerCase().includes(search.toLowerCase())) && !items.find(x=>x.item_id===i.id));
  const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:560, margin:'20px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.ink }}>{bundle?.id?'Edit Bundle':'Create Bundle'}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Bundle Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Work Combo — Shoes + Belt + Bag" style={inp} required/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Bundle Price (Rs.) *</label>
              <input type="number" value={bundlePrice} onChange={e=>setBundlePrice(e.target.value)} placeholder="e.g. 2999" style={inp} required min={0}/>
            </div>
            <div style={{ background:T.card, borderRadius:8, padding:'9px 12px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Savings</div>
              <div style={{ fontSize:16, fontWeight:800, color:savings>0?T.green:T.muted }}>{savings>0?fmt(savings)+` (${savingsPct}% off)`:'—'}</div>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Description</label>
            <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What's included in this combo?" style={inp}/>
          </div>

          {/* Item search */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Add Items *</label>
            <div style={{ position:'relative' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search inventory to add items…" style={inp}/>
              {filteredInv.length>0&&search&&(
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, zIndex:10, maxHeight:160, overflowY:'auto', marginTop:4 }}>
                  {filteredInv.slice(0,6).map(i=>(
                    <div key={i.id} onClick={()=>addItem(i)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${T.bdr}22`, display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:T.ink }}>{i.name}</span>
                      <span style={{ color:T.green, fontWeight:700 }}>{fmt(i.sp||0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bundle items */}
          <div style={{ background:T.card, borderRadius:10, padding:12, marginBottom:16, minHeight:60 }}>
            {items.length===0?<div style={{ textAlign:'center', color:T.muted, fontSize:12, padding:12 }}>No items added yet</div>
            :items.map(item=>(
              <div key={item.item_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:`1px solid ${T.bdr}22` }}>
                <span style={{ flex:1, fontSize:13, color:T.ink }}>{item.item_name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:T.muted }}>Qty:</span>
                  <input type="number" min={1} value={item.qty} onChange={e=>updateQty(item.item_id, e.target.value)} style={{ width:48, background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'4px 6px', color:T.ink, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center' }}/>
                  <span style={{ fontSize:12, color:T.green, fontWeight:700, minWidth:60, textAlign:'right' }}>{fmt((item.orig_price||0)*(item.qty||1))}</span>
                  <button type="button" onClick={()=>removeItem(item.item_id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:4, padding:'3px 7px', cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>×</button>
                </div>
              </div>
            ))}
            {items.length>0&&<div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:13, fontWeight:700 }}><span style={{ color:T.sub }}>Original Total</span><span style={{ color:T.amber }}>{fmt(origTotal)}</span></div>}
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onCancel} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{saving?'Saving…':bundle?.id?'Update Bundle':'Create Bundle'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Bundles({ tenant }) {
  const [bundles,   setBundles]   = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editBundle,setEditBundle]= useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const [bRes, inv] = await Promise.all([
      supabase.from('bundles').select('*, bundle_items(*)').eq('tenant_id', tenant.id).order('created_at', { ascending:false }),
      (await supabase.from('inventory').select('*').eq('tenant_id',tenant.id).eq('active',true).then(r=>r.data||[])),
    ]);
    setBundles(bRes.data?.map(b=>({...b, items:b.bundle_items||[]}))||[]);
    setInventory(inv);
    setLoading(false);
  }

  async function toggleActive(id, active) {
    await supabase.from('bundles').update({ active }).eq('id', id);
    setBundles(prev=>prev.map(b=>b.id===id?{...b,active}:b));
  }

  async function deleteBundle(id) {
    if (!confirm('Delete this bundle?')) return;
    await supabase.from('bundle_items').delete().eq('bundle_id', id);
    await supabase.from('bundles').delete().eq('id', id);
    setBundles(prev=>prev.filter(b=>b.id!==id));
  }

  function shareBundle(bundle) {
    const itemsList = (bundle.items||[]).map(i=>`• ${i.item_name} (×${i.qty})`).join('\n');
    const origTotal = (bundle.items||[]).reduce((s,i)=>s+(i.orig_price||0)*(i.qty||1),0);
    const savings   = origTotal - bundle.bundle_price;
    const msg = `🎁 *${bundle.name}* — Special Bundle!\n\n${itemsList}\n\n~~${fmt(origTotal)}~~\nBundle Price: *${fmt(bundle.bundle_price)}* ${savings>0?`(Save ${fmt(savings)})`:''}\n\n${bundle.description||''}\n\nAvailable at ${tenant?.name||'Elite Store'}! 🛍️`;
    window.open('https://wa.me/?text='+encodeURIComponent(msg), '_blank');
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>📦 Product Bundles</div>
          <div style={{ fontSize:13, color:T.sub }}>{bundles.filter(b=>b.active).length} active combos</div>
        </div>
        <button onClick={()=>{setEditBundle(null);setShowForm(true);}} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Create Bundle</button>
      </div>

      {loading?<div style={{ textAlign:'center', color:T.sub, padding:60 }}>Loading…</div>
      :bundles.length===0?(
        <div style={{ background:T.srf, border:`2px dashed ${T.bdr}`, borderRadius:14, padding:60, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.ink, marginBottom:6 }}>No bundles yet</div>
          <div style={{ fontSize:13, color:T.muted }}>Create combo packages to boost upselling</div>
        </div>
      ):(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
          {bundles.map(bundle=>{
            const origTotal = (bundle.items||[]).reduce((s,i)=>s+(i.orig_price||0)*(i.qty||1),0);
            const savings   = origTotal - bundle.bundle_price;
            const savingsPct= origTotal>0?Math.round(savings/origTotal*100):0;
            return (
              <div key={bundle.id} style={{ background:T.srf, border:`1px solid ${bundle.active?T.blue+'44':T.bdr}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{bundle.name}</div>
                    {bundle.description&&<div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{bundle.description}</div>}
                  </div>
                  <span style={{ background:bundle.active?T.green+'22':T.muted+'22', color:bundle.active?T.green:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{bundle.active?'Active':'Off'}</span>
                </div>
                <div style={{ padding:'12px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:14 }}>
                    <div>
                      {origTotal>0&&<div style={{ fontSize:12, color:T.muted, textDecoration:'line-through' }}>{fmt(origTotal)}</div>}
                      <div style={{ fontSize:24, fontWeight:900, color:T.green }}>{fmt(bundle.bundle_price)}</div>
                    </div>
                    {savings>0&&<div style={{ background:T.amber+'22', color:T.amber, borderRadius:8, padding:'5px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:900 }}>-{savingsPct}%</div>
                      <div style={{ fontSize:10 }}>Save {fmt(savings)}</div>
                    </div>}
                  </div>
                  <div style={{ background:T.card, borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                    <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Included Items</div>
                    {(bundle.items||[]).map(i=>(
                      <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', color:T.ink }}>
                        <span>• {i.item_name} {i.qty>1?`×${i.qty}`:''}</span>
                        <span style={{ color:T.muted }}>{fmt((i.orig_price||0)*(i.qty||1))}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>{setEditBundle(bundle);setShowForm(true);}} style={{ flex:1, background:T.blue+'22', color:T.blue, border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✏️ Edit</button>
                    <button onClick={()=>shareBundle(bundle)} style={{ flex:1, background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💬 Share</button>
                    <button onClick={()=>toggleActive(bundle.id,!bundle.active)} style={{ flex:1, background:bundle.active?T.red+'22':T.green+'22', color:bundle.active?T.red:T.green, border:'none', borderRadius:7, padding:'7px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{bundle.active?'Disable':'Enable'}</button>
                    <button onClick={()=>deleteBundle(bundle.id)} style={{ background:T.red+'22', color:T.red, border:'none', borderRadius:7, padding:'7px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm&&<BundleForm bundle={editBundle} tenantId={tenant?.id} inventory={inventory} onSave={()=>{setShowForm(false);load();}} onCancel={()=>setShowForm(false)}/>}
    </div>
  );
}
