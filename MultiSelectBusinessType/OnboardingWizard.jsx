import { useState } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const btn = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:9, padding:'12px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 13px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };
const lbl = { fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 };

// Retail & Commerce — the specific sub-verticals a shop might be
const RETAIL_TYPES = [
  { id:'mobile',      label:'Mobile & Electronics',    icon:'📱', cats:['Mobiles','Accessories','Chargers','Repairs'] },
  { id:'footwear',    label:'Footwear',                icon:'👟', cats:['Shoes','Sandals','Sports','Accessories'] },
  { id:'apparel',     label:'Fashion & Apparel',        icon:'👕', cats:['Shirts','Trousers','Sarees','Kids Wear','Innerwear'] },
  { id:'bags',        label:'Bags & Luggage',           icon:'👜', cats:['Handbags','Backpacks','Travel Bags','Wallets'] },
  { id:'furniture',   label:'Furniture',                icon:'🛋️', cats:['Living Room','Bedroom','Office','Outdoor'] },
  { id:'appliances',  label:'Home Appliances',          icon:'🏠', cats:['Kitchen','Cooling','Cleaning','Small Appliances'] },
  { id:'computers',   label:'Computers & IT',           icon:'💻', cats:['Laptops','Desktops','Peripherals','Networking'] },
  { id:'consumer_electronics', label:'Consumer Electronics', icon:'📺', cats:['TVs','Audio','Cameras','Wearables'] },
  { id:'grocery',     label:'Grocery & Supermarket',    icon:'🛒', cats:['Staples','Snacks','Beverages','Dairy','Household'] },
  { id:'jewellery',   label:'Jewellery',                icon:'💍', cats:['Gold','Silver','Diamond','Artificial'] },
  { id:'beauty',      label:'Beauty & Cosmetics',       icon:'💄', cats:['Skincare','Makeup','Haircare','Fragrance'] },
  { id:'pharmacy',    label:'Pharmacy',                 icon:'🏥', cats:['Prescription','OTC','Wellness','Baby Care'] },
  { id:'sports',      label:'Sports & Fitness',         icon:'🏋️', cats:['Equipment','Apparel','Supplements','Footwear'] },
  { id:'toys',        label:'Toys & Gifts',             icon:'🧸', cats:['Toys','Games','Gift Items','Party Supplies'] },
  { id:'hardware',    label:'Hardware',                 icon:'🛠️', cats:['Tools','Paint','Plumbing','Electrical','Fasteners'] },
  { id:'automobile',  label:'Automobile & Accessories', icon:'🚗', cats:['Parts','Accessories','Lubricants','Tyres'] },
  { id:'books',       label:'Books & Stationery',       icon:'📚', cats:['Books','Notebooks','Office Supplies','Art Supplies'] },
  { id:'pet',         label:'Pet Store',                icon:'🐶', cats:['Pet Food','Accessories','Grooming','Healthcare'] },
  { id:'watches',     label:'Watches & Accessories',    icon:'⌚', cats:['Watches','Straps','Sunglasses','Accessories'] },
  { id:'optical',     label:'Optical & Eyewear',        icon:'👓', cats:['Frames','Lenses','Sunglasses','Contact Lenses'] },
  { id:'baby',        label:'Baby & Kids Store',        icon:'🍼', cats:['Clothing','Feeding','Toys','Diapers'] },
  { id:'florist',     label:'Florist & Gift Shop',      icon:'🌸', cats:['Flowers','Bouquets','Gifts','Plants'] },
  { id:'meat',        label:'Meat, Fish & Poultry',     icon:'🐟', cats:['Meat','Fish','Poultry','Seafood'] },
  { id:'produce',     label:'Fruits & Vegetables',      icon:'🍎', cats:['Fruits','Vegetables','Organic'] },
  { id:'bakery',      label:'Bakery & Confectionery',   icon:'🍰', cats:['Bread','Cakes','Sweets','Snacks'] },
  { id:'liquor',      label:'Wine & Liquor Store',      icon:'🍷', cats:['Wine','Beer','Spirits','Mixers'] },
  { id:'bicycle',     label:'Bicycle & Motorcycle Store', icon:'🏍️', cats:['Bicycles','Motorcycles','Parts','Accessories'] },
  { id:'outdoor',     label:'Outdoor & Camping',        icon:'🏕️', cats:['Tents','Gear','Apparel','Accessories'] },
  { id:'gaming',      label:'Gaming & Entertainment',   icon:'🎮', cats:['Consoles','Games','Accessories','Merchandise'] },
  { id:'music',       label:'Musical Instruments',      icon:'🎵', cats:['Instruments','Accessories','Sheet Music'] },
  { id:'homedecor',   label:'Home Decor & Furnishings', icon:'🏡', cats:['Decor','Curtains','Lighting','Rugs'] },
  { id:'fabrics',     label:'Fabrics & Tailoring Materials', icon:'🧵', cats:['Fabric','Threads','Buttons','Trims'] },
  { id:'printing',    label:'Printing & Office Supplies', icon:'🖨️', cats:['Printing','Stationery','Office Supplies'] },
  { id:'department',  label:'Department Store',         icon:'🛒', cats:['General'] },
  { id:'multibrand',  label:'Multi-Brand Retail Store', icon:'🛍️', cats:['General'] },
];

// Everything that isn't a retail shop — services and other business models
const OTHER_TYPES = [
  { id:'healthcare',  label:'Healthcare',              icon:'🏥', cats:['General'] },
  { id:'salon',       label:'Salon & Spa',             icon:'💇', cats:['Services'] },
  { id:'food',        label:'Food & Hospitality',      icon:'🍽️', cats:['Menu Items'] },
  { id:'hotel',       label:'Hotel & Hospitality',     icon:'🏨', cats:['Room Types','Services'] },
  { id:'education',   label:'Education',               icon:'🎓', cats:['Courses'] },
  { id:'fitness',     label:'Fitness & Wellness',      icon:'🏋️', cats:['Memberships','Sessions'] },
  { id:'professional',label:'Professional Services',   icon:'💼', cats:['Services'] },
  { id:'auto_service',label:'Automotive Services',     icon:'🚗', cats:['Services','Parts'] },
  { id:'home_service', label:'Home Services',          icon:'🏡', cats:['Services'] },
  { id:'tech_service', label:'Technology Services',    icon:'💻', cats:['Services'] },
  { id:'finance',     label:'Financial Services',      icon:'💰', cats:['Services'] },
  { id:'travel',      label:'Travel & Tourism',        icon:'✈️', cats:['Packages','Services'] },
  { id:'realestate',  label:'Real Estate',             icon:'🏢', cats:['Listings','Services'] },
  { id:'events',      label:'Event Management',        icon:'🎉', cats:['Services','Packages'] },
  { id:'logistics',   label:'Logistics & Delivery',    icon:'🚚', cats:['Services'] },
  { id:'manufacturing',label:'Manufacturing',          icon:'🏭', cats:['Raw Materials','Finished Goods'] },
  { id:'wholesale',   label:'Wholesale & Distribution',icon:'📦', cats:['General'] },
  { id:'agriculture', label:'Agriculture',             icon:'🌾', cats:['Produce','Supplies'] },
  { id:'nonprofit',   label:'Non-Profit & Government', icon:'🏛️', cats:['General'] },
];

const ALL_TYPES = [...RETAIL_TYPES, ...OTHER_TYPES];

const STEPS = ['Business','Tax & Money','Categories','Team','Done'];

export default function OnboardingWizard({ tenant, user, onComplete }) {
  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [biz,    setBiz]    = useState({
    name: tenant?.name || '', types:[], phone:'', address:'', city:'', state:'Tamil Nadu', pincode:'',
    gstin:'', pan:'', upi_id:'', bank_name:'', invoice_prefix:'INV', currency:'INR',
    fy_start:'04-01', gst_registered:true, composition:false,
  });
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [otherTypes, setOtherTypes] = useState([]); // custom-typed entries
  const [cats,   setCats]   = useState([]);
  const [newCat, setNewCat] = useState('');
  const [staff,  setStaff]  = useState([{ name:'', email:'', role:'cashier' }]);

  function toggleType(id) {
    setBiz(b => {
      const types = b.types.includes(id) ? b.types.filter(x=>x!==id) : [...b.types, id];
      // Merge suggested categories from every selected type, deduped
      const merged = [...new Set(types.flatMap(tid => ALL_TYPES.find(t=>t.id===tid)?.cats || []))];
      setCats(prev => [...new Set([...merged, ...otherTypes])]);
      return { ...b, types };
    });
  }

  function addOtherType() {
    const val = otherText.trim();
    if (!val) return;
    setOtherTypes(prev => [...new Set([...prev, val])]);
    setCats(prev => [...new Set([...prev, val])]);
    setOtherText(''); setShowOther(false);
  }

  function removeOtherType(val) {
    setOtherTypes(prev => prev.filter(x=>x!==val));
  }

  const selectedLabels = () => [
    ...biz.types.map(id => ALL_TYPES.find(t=>t.id===id)?.label).filter(Boolean),
    ...otherTypes,
  ];

  async function finish() {
    setSaving(true); setError(null);
    try {
      // 1. Update tenant profile
      const { error:tErr } = await supabase.from('tenants').update({
        name: biz.name, phone: biz.phone, address: biz.address,
        city: biz.city, state: biz.state, pincode: biz.pincode,
        gstin: biz.gstin || null, pan: biz.pan || null,
        upi_id: biz.upi_id || null, bank_name: biz.bank_name || null,
        invoice_prefix: biz.invoice_prefix,
        business_type: selectedLabels()[0] || 'retail',
        business_types: [...biz.types.map(id=>ALL_TYPES.find(t=>t.id===id)?.label).filter(Boolean), ...otherTypes],
        onboarded: true,
      }).eq('id', tenant.id);
      if (tErr) throw tErr;

      // 2. Seed categories as placeholder inventory categories
      //    (stored on tenant so Inventory can offer them as options)
      await supabase.from('tenants').update({ categories: cats }).eq('id', tenant.id);

      // 3. Invite staff
      const rows = staff.filter(s=>s.name && s.email).map(s=>({
        tenant_id: tenant.id, name:s.name, email:s.email, role:s.role, active:true,
      }));
      if (rows.length) await supabase.from('staff_users').insert(rows);

      onComplete?.();
    } catch (e) {
      setError(e.message || 'Could not save. Please try again.');
    }
    setSaving(false);
  }

  const canNext = step===0 ? biz.name.trim().length>1
                : step===1 ? true
                : step===2 ? cats.length>0
                : true;

  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:1000, overflowY:'auto' }}>
      <div style={{ maxWidth:660, margin:'0 auto', padding:'40px 24px 60px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:15, background:'#7B1E1E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:900, color:T.white, margin:'0 auto 14px' }}>7SQ</div>
          <div style={{ fontSize:23, fontWeight:900, color:T.darkRed, letterSpacing:'-0.02em' }}>Let's set up your shop</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:4 }}>Four quick steps — about two minutes</div>
        </div>

        {/* Progress */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:26 }}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{ flex:i<STEPS.length-1?1:0, display:'flex', alignItems:'center' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                <div style={{
                  width:30, height:30, borderRadius:'50%',
                  background: i<step?T.green : i===step?T.red : T.white,
                  border:`2px solid ${i<=step?(i<step?T.green:T.red):T.bdr}`,
                  color: i<=step?T.white:T.muted,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:800, transition:'all .3s',
                }}>{i<step?'✓':i+1}</div>
                <span style={{ fontSize:9.5, color:i<=step?T.darkRed:T.muted, fontWeight:i===step?800:500, whiteSpace:'nowrap' }}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{ flex:1, height:2, background:i<step?T.green:T.bdr, margin:'0 6px', marginBottom:18, transition:'all .3s' }}/>}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:16, padding:'26px 28px', boxShadow:'0 3px 16px rgba(0,0,0,.06)' }}>

          {/* ── Step 0: Business ──────────────────────── */}
          {step===0&&(
            <>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:3 }}>About your business</div>
              <div style={{ fontSize:12, color:T.sub, marginBottom:20 }}>This appears on every invoice and report you print</div>

              <div style={{ marginBottom:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                  <label style={lbl}>What do you sell or offer? <span style={{ textTransform:'none', fontWeight:400 }}>(pick as many as apply)</span></label>
                  {(biz.types.length+otherTypes.length)>0 && <span style={{ fontSize:11, color:T.red, fontWeight:700 }}>{biz.types.length+otherTypes.length} selected</span>}
                </div>

                <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', margin:'10px 0 7px' }}>🛍️ Retail &amp; Commerce</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, maxHeight:220, overflowY:'auto', paddingRight:4 }}>
                  {RETAIL_TYPES.map(t=>{
                    const on = biz.types.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={()=>toggleType(t.id)}
                        style={{ background:on?T.lightRed:T.white, border:`1.5px solid ${on?T.red:T.bdr}`, borderRadius:9, padding:'9px 5px', cursor:'pointer', fontFamily:'inherit', textAlign:'center', position:'relative' }}>
                        {on && <span style={{ position:'absolute', top:3, right:4, color:T.red, fontSize:11, fontWeight:900 }}>✓</span>}
                        <div style={{ fontSize:17, marginBottom:2 }}>{t.icon}</div>
                        <div style={{ fontSize:9, fontWeight:on?700:500, color:on?T.red:T.sub, lineHeight:1.2 }}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', margin:'14px 0 7px' }}>💼 Services &amp; Other Businesses</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, maxHeight:180, overflowY:'auto', paddingRight:4 }}>
                  {OTHER_TYPES.map(t=>{
                    const on = biz.types.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={()=>toggleType(t.id)}
                        style={{ background:on?T.lightRed:T.white, border:`1.5px solid ${on?T.red:T.bdr}`, borderRadius:9, padding:'9px 5px', cursor:'pointer', fontFamily:'inherit', textAlign:'center', position:'relative' }}>
                        {on && <span style={{ position:'absolute', top:3, right:4, color:T.red, fontSize:11, fontWeight:900 }}>✓</span>}
                        <div style={{ fontSize:17, marginBottom:2 }}>{t.icon}</div>
                        <div style={{ fontSize:9, fontWeight:on?700:500, color:on?T.red:T.sub, lineHeight:1.2 }}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Other — manual entry for anything not listed */}
                <div style={{ marginTop:12 }}>
                  {otherTypes.map(v=>(
                    <span key={v} style={{ display:'inline-flex', alignItems:'center', gap:6, background:T.lightRed, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'5px 8px 5px 12px', fontSize:11.5, color:T.darkRed, fontWeight:600, marginRight:7, marginBottom:7 }}>
                      {v}
                      <button type="button" onClick={()=>removeOtherType(v)} style={{ background:'rgba(192,57,43,.15)', color:T.red, border:'none', borderRadius:'50%', width:16, height:16, cursor:'pointer', fontSize:11, lineHeight:1, fontFamily:'inherit' }}>×</button>
                    </span>
                  ))}
                  {!showOther ? (
                    <button type="button" onClick={()=>setShowOther(true)}
                      style={{ background:T.bg, border:`1.5px dashed ${T.bdr}`, borderRadius:20, padding:'6px 14px', fontSize:11.5, color:T.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      + Other — type your own
                    </button>
                  ) : (
                    <div style={{ display:'flex', gap:7, marginTop:4 }}>
                      <input value={otherText} onChange={e=>setOtherText(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addOtherType(); } }}
                        placeholder="e.g. Aquarium Supplies" autoFocus style={{ ...inp, flex:1 }}/>
                      <button type="button" onClick={addOtherType} style={btn(T.red, T.white, { padding:'9px 16px', fontSize:12 })}>Add</button>
                      <button type="button" onClick={()=>{ setShowOther(false); setOtherText(''); }} style={{ background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Shop Name *</label><input value={biz.name} onChange={e=>setBiz(b=>({...b,name:e.target.value}))} placeholder="e.g. Signals Elite" style={inp}/></div>
                <div><label style={lbl}>Phone</label><input value={biz.phone} onChange={e=>setBiz(b=>({...b,phone:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>City</label><input value={biz.city} onChange={e=>setBiz(b=>({...b,city:e.target.value}))} style={inp}/></div>
                <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Address</label><input value={biz.address} onChange={e=>setBiz(b=>({...b,address:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>State</label><input value={biz.state} onChange={e=>setBiz(b=>({...b,state:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>Pincode</label><input value={biz.pincode} onChange={e=>setBiz(b=>({...b,pincode:e.target.value}))} style={inp}/></div>
              </div>
            </>
          )}

          {/* ── Step 1: Tax & Money ───────────────────── */}
          {step===1&&(
            <>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:3 }}>Tax &amp; payments</div>
              <div style={{ fontSize:12, color:T.sub, marginBottom:20 }}>Leave anything blank if it doesn't apply — you can add it later in Settings</div>

              <div style={{ background:T.bg, borderRadius:10, padding:'13px 16px', marginBottom:18 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={biz.gst_registered} onChange={e=>setBiz(b=>({...b,gst_registered:e.target.checked}))} style={{ width:17, height:17, accentColor:T.red, cursor:'pointer' }}/>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>My business is GST registered</div>
                    <div style={{ fontSize:11, color:T.sub, marginTop:1 }}>Turns on GST invoices, filing and reconciliation</div>
                  </div>
                </label>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
                {biz.gst_registered&&<>
                  <div><label style={lbl}>GSTIN</label><input value={biz.gstin} onChange={e=>setBiz(b=>({...b,gstin:e.target.value.toUpperCase()}))} placeholder="33ABCDE1234F1Z5" style={{ ...inp, fontFamily:'monospace' }}/></div>
                  <div><label style={lbl}>PAN</label><input value={biz.pan} onChange={e=>setBiz(b=>({...b,pan:e.target.value.toUpperCase()}))} style={{ ...inp, fontFamily:'monospace' }}/></div>
                </>}
                <div><label style={lbl}>UPI ID (for payment links)</label><input value={biz.upi_id} onChange={e=>setBiz(b=>({...b,upi_id:e.target.value}))} placeholder="yourname@upi" style={inp}/></div>
                <div><label style={lbl}>Bank Name</label><input value={biz.bank_name} onChange={e=>setBiz(b=>({...b,bank_name:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>Invoice Prefix</label><input value={biz.invoice_prefix} onChange={e=>setBiz(b=>({...b,invoice_prefix:e.target.value.toUpperCase()}))} style={inp}/><div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Bills will read {biz.invoice_prefix||'INV'}/2026/00001</div></div>
                <div><label style={lbl}>Financial Year Starts</label>
                  <select value={biz.fy_start} onChange={e=>setBiz(b=>({...b,fy_start:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="04-01">April (Indian standard)</option>
                    <option value="01-01">January</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Categories ────────────────────── */}
          {step===2&&(
            <>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:3 }}>Product categories</div>
              <div style={{ fontSize:12, color:T.sub, marginBottom:20 }}>We've suggested some based on your business type — add, remove or rename freely</div>

              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16, minHeight:40 }}>
                {cats.map(c=>(
                  <div key={c} style={{ display:'flex', alignItems:'center', gap:7, background:T.lightRed, border:`1px solid ${T.bdr}`, borderRadius:20, padding:'6px 8px 6px 14px' }}>
                    <span style={{ fontSize:12, color:T.darkRed, fontWeight:600 }}>{c}</span>
                    <button onClick={()=>setCats(cs=>cs.filter(x=>x!==c))}
                      style={{ background:'rgba(192,57,43,.12)', color:T.red, border:'none', borderRadius:'50%', width:18, height:18, cursor:'pointer', fontSize:12, lineHeight:1, fontFamily:'inherit' }}>×</button>
                  </div>
                ))}
                {cats.length===0&&<div style={{ fontSize:12, color:T.muted, padding:'10px 0' }}>No categories yet — add at least one below</div>}
              </div>

              <div style={{ display:'flex', gap:9 }}>
                <input value={newCat} onChange={e=>setNewCat(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&newCat.trim()){ setCats(cs=>[...new Set([...cs,newCat.trim()])]); setNewCat(''); } }}
                  placeholder="Add a category and press Enter" style={{ ...inp, flex:1 }}/>
                <button onClick={()=>{ if(newCat.trim()){ setCats(cs=>[...new Set([...cs,newCat.trim()])]); setNewCat(''); } }}
                  style={btn(T.red, T.white, { padding:'10px 18px' })}>Add</button>
              </div>
            </>
          )}

          {/* ── Step 3: Team ──────────────────────────── */}
          {step===3&&(
            <>
              <div style={{ fontSize:16, fontWeight:800, color:T.darkRed, marginBottom:3 }}>Your team</div>
              <div style={{ fontSize:12, color:T.sub, marginBottom:20 }}>Add staff and set what each person can see. Skip this if you work alone.</div>

              {staff.map((s,i)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1.3fr 130px auto', gap:9, marginBottom:10, alignItems:'end' }}>
                  <div>{i===0&&<label style={lbl}>Name</label>}<input value={s.name} onChange={e=>setStaff(st=>st.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Staff name" style={inp}/></div>
                  <div>{i===0&&<label style={lbl}>Email (their login)</label>}<input type="email" value={s.email} onChange={e=>setStaff(st=>st.map((x,j)=>j===i?{...x,email:e.target.value}:x))} placeholder="name@email.com" style={inp}/></div>
                  <div>{i===0&&<label style={lbl}>Role</label>}
                    <select value={s.role} onChange={e=>setStaff(st=>st.map((x,j)=>j===i?{...x,role:e.target.value}:x))} style={{ ...inp, cursor:'pointer' }}>
                      <option value="manager">Manager</option>
                      <option value="accountant">Accountant</option>
                      <option value="cashier">Cashier</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <button onClick={()=>setStaff(st=>st.length>1?st.filter((_,j)=>j!==i):st)}
                    style={{ background:'#FEF2F2', color:T.red, border:'none', borderRadius:8, padding:'11px 12px', cursor:'pointer', fontFamily:'inherit' }}>×</button>
                </div>
              ))}
              <button onClick={()=>setStaff(st=>[...st,{ name:'', email:'', role:'cashier' }])}
                style={{ ...btn(T.bg, T.sub, { border:`1px solid ${T.bdr}`, padding:'9px 16px', fontSize:12 }), marginTop:4 }}>+ Add another</button>

              <div style={{ background:T.bg, borderRadius:10, padding:'14px 16px', marginTop:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.darkRed, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:9 }}>What each role can do</div>
                {[
                  ['🏢 Manager',    'Everything except owner-only settings and payroll'],
                  ['📊 Accountant', 'Books, GST, payments, reports — no stock edits'],
                  ['💳 Cashier',    'Billing, customers and cash register only'],
                  ['👤 Staff',      'Stock handling, deliveries, their own attendance'],
                ].map(([r,d])=>(
                  <div key={r} style={{ display:'flex', gap:10, padding:'3px 0', fontSize:11.5 }}>
                    <span style={{ color:T.ink, fontWeight:700, minWidth:105 }}>{r}</span>
                    <span style={{ color:T.sub }}>{d}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Step 4: Done ──────────────────────────── */}
          {step===4&&(
            <div style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ fontSize:52, marginBottom:14 }}>🎉</div>
              <div style={{ fontSize:19, fontWeight:900, color:T.darkRed, marginBottom:6 }}>{biz.name} is ready</div>
              <div style={{ fontSize:13, color:T.sub, marginBottom:24 }}>Here's what we've set up for you</div>

              <div style={{ background:T.bg, borderRadius:12, padding:'18px 22px', textAlign:'left', marginBottom:22 }}>
                {[
                  ['Business',   biz.name + (biz.city?` · ${biz.city}`:'')],
                  ['Type',       selectedLabels().length ? selectedLabels().join(', ') : 'Not specified'],
                  ['GST',        biz.gst_registered ? (biz.gstin || 'Registered — add GSTIN in Settings') : 'Not registered'],
                  ['Invoices',   `${biz.invoice_prefix||'INV'}/2026/00001`],
                  ['Categories', `${cats.length} set up`],
                  ['Team',       staff.filter(s=>s.name&&s.email).length ? `${staff.filter(s=>s.name&&s.email).length} member(s) invited` : 'Just you for now'],
                ].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bdr}44`, fontSize:12.5 }}>
                    <span style={{ color:T.sub }}>{k}</span>
                    <span style={{ color:T.ink, fontWeight:700, textAlign:'right', maxWidth:'60%' }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:T.lightRed, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px', textAlign:'left', fontSize:12, color:T.sub, lineHeight:1.7 }}>
                <strong style={{ color:T.darkRed }}>Next steps:</strong> add your products under <strong>Inventory</strong> (or bulk-import from Excel),
                then start billing from <strong>Sales / POS</strong>. Press <kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'1px 6px', fontSize:11 }}>Ctrl K</kbd> any time to jump anywhere.
              </div>

              {error&&<div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'11px 14px', marginTop:14, fontSize:12, color:T.red }}>⚠️ {error}</div>}
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display:'flex', gap:11, marginTop:24, paddingTop:20, borderTop:`1px solid ${T.bdr}` }}>
            {step>0&&step<4&&<button onClick={()=>setStep(s=>s-1)} style={{ ...btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` }) }}>← Back</button>}
            {step<3&&<button onClick={()=>setStep(s=>s+1)} disabled={!canNext} style={{ flex:1, ...btn(canNext?T.red:T.bdr, T.white) }}>Continue →</button>}
            {step===3&&<button onClick={()=>setStep(4)} style={{ flex:1, ...btn(T.red, T.white) }}>Review →</button>}
            {step===4&&<>
              <button onClick={()=>setStep(0)} style={{ ...btn(T.bg, T.sub, { border:`1px solid ${T.bdr}` }) }}>← Edit</button>
              <button onClick={finish} disabled={saving} style={{ flex:1, ...btn(T.green, T.white, { fontSize:14 }) }}>{saving?'Setting up…':'🚀 Start using 7SQ'}</button>
            </>}
          </div>
        </div>

        {step<4&&<div style={{ textAlign:'center', marginTop:16 }}>
          <button onClick={onComplete} style={{ background:'none', border:'none', color:T.muted, fontSize:12, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
            Skip setup — I'll configure later
          </button>
        </div>}
      </div>
    </div>
  );
}
