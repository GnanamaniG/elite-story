import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInventory } from '../lib/supabase';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };

const PRESET_VARIANTS = {
  'Shoe Size': ['Size 5','Size 6','Size 7','Size 8','Size 9','Size 10','Size 11','Size 12'],
  'Clothing Size': ['XS','S','M','L','XL','XXL','XXXL'],
  'Colour': ['Black','White','Red','Blue','Green','Yellow','Brown','Grey','Pink','Orange'],
  'Custom': [],
};

export default function Variants({ tenant }) {
  const [items,       setItems]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [groups,      setGroups]      = useState([]);
  const [variants,    setVariants]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [showAddGrp,  setShowAddGrp]  = useState(false);
  const [newGrpName,  setNewGrpName]  = useState('');
  const [presetVals,  setPresetVals]  = useState([]);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  async function load() {
    setLoading(true);
    const data = await getInventory(tenant.id);
    setItems(data);
    setLoading(false);
  }

  async function loadVariants(itemId) {
    const [grpRes, varRes] = await Promise.all([
      supabase.from('variant_groups').select('*').eq('item_id', itemId).order('created_at'),
      supabase.from('variants').select('*').eq('item_id', itemId).eq('active', true).order('value'),
    ]);
    setGroups(grpRes.data || []);
    setVariants(varRes.data || []);
  }

  async function addGroup() {
    if (!newGrpName.trim() || !selected) return;
    setSaving(true);
    const { data: grp } = await supabase.from('variant_groups').insert({ tenant_id:tenant.id, item_id:selected.id, name:newGrpName }).select().single();
    // Add preset values as variants
    for (const val of presetVals) {
      await supabase.from('variants').insert({ tenant_id:tenant.id, item_id:selected.id, group_id:grp.id, value:val, stock:0 });
    }
    await loadVariants(selected.id);
    setShowAddGrp(false); setNewGrpName(''); setPresetVals([]);
    setSaving(false);
  }

  async function updateVariantStock(variantId, stock) {
    await supabase.from('variants').update({ stock: parseFloat(stock)||0 }).eq('id', variantId);
    setVariants(prev => prev.map(v => v.id===variantId ? { ...v, stock: parseFloat(stock)||0 } : v));
  }

  async function addCustomVariant(groupId, value) {
    if (!value.trim()) return;
    await supabase.from('variants').insert({ tenant_id:tenant.id, item_id:selected.id, group_id:groupId, value, stock:0 });
    await loadVariants(selected.id);
  }

  async function deleteVariant(variantId) {
    await supabase.from('variants').update({ active:false }).eq('id', variantId);
    setVariants(prev => prev.filter(v => v.id !== variantId));
  }

  const inp = { background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' };
  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const totalVariantStock = (itemId) => variants.filter(v => v.item_id === itemId).reduce((s,v) => s+(v.stock||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>Product Variants</div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>Manage size/colour variants for footwear, bags and clothing</div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1.5fr':'1fr', gap:16 }}>
        {/* Item list */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search items…"
            style={{ ...inp, width:'100%', marginBottom:12 }} />
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            : filtered.map(item => {
              const hasVariants = variants.filter(v => v.item_id === item.id).length > 0;
              return (
                <div key={item.id} onClick={() => { setSelected(item); loadVariants(item.id); }}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===item.id?T.card:'transparent' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{item.name}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{item.cat||'No category'} · Rs.{item.sp}</div>
                  </div>
                  {hasVariants
                    ? <span style={{ background:T.teal+'22', color:T.teal, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>Has Variants</span>
                    : <span style={{ background:T.bdr, color:T.muted, borderRadius:5, padding:'2px 8px', fontSize:10 }}>No Variants</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Variant editor */}
        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{selected.name}</div>
                <div style={{ fontSize:12, color:T.sub }}>Base price: Rs.{selected.sp} · GST: {selected.gst}%</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowAddGrp(true)} style={{ background:T.blue, color:'#fff', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  + Add Variant Group
                </button>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
              </div>
            </div>

            <div style={{ padding:16 }}>
              {groups.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:T.muted }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>📦</div>
                  <div style={{ fontSize:14, color:T.sub, marginBottom:8 }}>No variants yet</div>
                  <div style={{ fontSize:12 }}>Click "+ Add Variant Group" to add Size or Colour variants</div>
                </div>
              ) : groups.map(grp => {
                const grpVariants = variants.filter(v => v.group_id === grp.id);
                const [newVal, setNewVal] = useState('');
                return (
                  <div key={grp.id} style={{ background:T.card, borderRadius:10, padding:16, marginBottom:14 }}>
                    <div style={{ fontWeight:700, color:T.ink, marginBottom:12, fontSize:14 }}>{grp.name}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:12 }}>
                      {grpVariants.map(v => (
                        <div key={v.id} style={{ background:T.srf, borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:5 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:T.ink }}>{v.value}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <input type="number" value={v.stock||0} onChange={e => updateVariantStock(v.id, e.target.value)}
                              style={{ ...inp, width:60, padding:'4px 8px', fontSize:12 }} />
                            <span style={{ fontSize:10, color:T.muted }}>in stock</span>
                          </div>
                          <button onClick={() => deleteVariant(v.id)} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:10, textAlign:'left', padding:0 }}>Remove</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Add custom value…" style={{ ...inp, flex:1 }}
                        onKeyDown={e => { if(e.key==='Enter' && newVal.trim()) { addCustomVariant(grp.id, newVal); setNewVal(''); } }} />
                      <button onClick={() => { addCustomVariant(grp.id, newVal); setNewVal(''); }} style={{ background:T.blue+'22', color:T.blue, border:`1px solid ${T.blue}44`, borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Add</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add group modal */}
      {showAddGrp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:460 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>Add Variant Group</div>
              <button onClick={() => setShowAddGrp(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Group Name</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                {Object.keys(PRESET_VARIANTS).map(name => (
                  <button key={name} onClick={() => { setNewGrpName(name); setPresetVals(PRESET_VARIANTS[name]); }}
                    style={{ background:newGrpName===name?T.blue:T.card, color:newGrpName===name?'#fff':T.sub, border:`1px solid ${newGrpName===name?T.blue:T.bdr}`, borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{name}</button>
                ))}
              </div>
              <input value={newGrpName} onChange={e=>setNewGrpName(e.target.value)} placeholder="e.g. Size, Colour, Material" style={{ ...inp, width:'100%' }} />
            </div>
            {presetVals.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:8 }}>Select Values to Add</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {presetVals.map(v => (
                    <button key={v} onClick={() => setPresetVals(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v])}
                      style={{ background:T.card, color:T.ink, border:`1px solid ${T.bdr}`, borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                      {v}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:6 }}>Click to toggle selection. You can add more values later.</div>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowAddGrp(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={addGroup} disabled={saving||!newGrpName.trim()} style={{ flex:2, background:T.blue, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {saving ? 'Creating…' : 'Create Variant Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
