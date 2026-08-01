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

const STATUS_COLORS  = { new:T.blue, in_progress:T.amber, ready:T.green, completed:T.teal, cancelled:T.red };
const STATUS_LABELS  = { new:'🆕 New', in_progress:'⚙️ In Progress', ready:'✅ Ready', completed:'📦 Done', cancelled:'❌ Cancelled' };
const BAY_ICONS      = { bay:'🔧', table:'🍽️', counter:'🛒', fitting_room:'👗' };

const DEFAULT_BAYS = [
  { name:'Counter 1', type:'counter' },
  { name:'Counter 2', type:'counter' },
  { name:'Fitting Room A', type:'fitting_room' },
  { name:'Fitting Room B', type:'fitting_room' },
  { name:'Service Bay 1', type:'bay' },
];

export default function ServiceBays({ tenant }) {
  const [bays,      setBays]      = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState('floor'); // floor | queue | display
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedBay,  setSelectedBay]  = useState(null);

  // Order form
  const [customer,  setCustomer]  = useState('');
  const [items,     setItems]     = useState([]);
  const [notes,     setNotes]     = useState('');
  const [search,    setSearch]    = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  // Auto-refresh every 30s for display mode
  useEffect(() => {
    if (view !== 'display') return;
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [view, tenant?.id]);

  async function load() {
    setLoading(true);
    const [bayRes, orderRes, inv] = await Promise.all([
      supabase.from('service_bays').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
      supabase.from('service_orders').select('*').eq('tenant_id', tenant.id).neq('status', 'cancelled').order('created_at'),
      (await supabase.from('inventory').select('*').eq('tenant_id',tenant.id).eq('active',true).then(r=>r.data||[])),
    ]);
    let bayList = bayRes.data || [];
    // Seed default bays if none exist
    if (!bayList.length) {
      const { data: created } = await supabase.from('service_bays').insert(
        DEFAULT_BAYS.map(b => ({ ...b, tenant_id: tenant.id }))
      ).select();
      bayList = created || [];
    }
    setBays(bayList);
    setOrders(orderRes.data || []);
    setInventory(inv);
    setLoading(false);
  }

  async function createOrder() {
    if (!selectedBay || !items.length) return alert('Select a bay and add at least one item');
    setSaving(true);
    const total = items.reduce((s, i) => s + (i.price * i.qty), 0);
    const { data: order } = await supabase.from('service_orders').insert({
      tenant_id: tenant.id, bay_id: selectedBay.id, bay_name: selectedBay.name,
      customer: customer || 'Walk-in', items, total, notes, status: 'new',
    }).select().single();
    await supabase.from('service_bays').update({ status: 'occupied', current_order: order.id }).eq('id', selectedBay.id);
    setShowNewOrder(false); setCustomer(''); setItems([]); setNotes(''); setSelectedBay(null);
    setSaving(false); await load();
  }

  async function updateOrderStatus(order, status) {
    await supabase.from('service_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (status === 'completed' || status === 'cancelled') {
      await supabase.from('service_bays').update({ status: 'empty', current_order: null }).eq('id', order.bay_id);
    }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));
    await load();
  }

  function addItem(inv) {
    const existing = items.find(i => i.item_id === inv.id);
    if (existing) setItems(prev => prev.map(i => i.item_id === inv.id ? { ...i, qty: i.qty + 1 } : i));
    else setItems(prev => [...prev, { item_id: inv.id, name: inv.name, price: inv.sp || 0, qty: 1 }]);
    setSearch('');
  }

  const filteredInv = inventory.filter(i => search && i.name.toLowerCase().includes(search.toLowerCase()) && !items.find(x => x.item_id === i.id));
  const activeOrders = orders.filter(o => o.status !== 'completed');
  const readyOrders  = orders.filter(o => o.status === 'ready');

  return (
    <div style={{ padding: view === 'display' ? 0 : 20, background: view === 'display' ? '#000' : 'transparent', minHeight: view === 'display' ? '100vh' : 'auto' }}>
      {view !== 'display' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>🏪 Service Bays & Order Queue</div>
            <div style={{ fontSize: 13, color: T.sub }}>{activeOrders.length} active · {readyOrders.length} ready for pickup{readyOrders.length > 0 ? ' 🔔' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['floor', '🗺️ Floor'], ['queue', '📋 Queue'], ['display', '📺 Display']].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{ background: view === id ? T.blue : T.srf, color: view === id ? '#fff' : T.sub, border: `1px solid ${view === id ? T.blue : T.bdr}`, borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
            ))}
            <button onClick={() => setShowNewOrder(true)} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ New Order</button>
          </div>
        </div>
      )}

      {/* FLOOR VIEW */}
      {view === 'floor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
          {loading ? <div style={{ color: T.sub, padding: 40 }}>Loading…</div>
          : bays.map(bay => {
            const activeOrder = orders.find(o => o.bay_id === bay.id && o.status !== 'completed' && o.status !== 'cancelled');
            const isOccupied  = !!activeOrder;
            return (
              <div key={bay.id} style={{ background: isOccupied ? T.amber + '18' : T.srf, border: `2px solid ${isOccupied ? T.amber : T.bdr}`, borderRadius: 14, padding: 18, cursor: 'pointer' }}
                onClick={() => { if (!isOccupied) { setSelectedBay(bay); setShowNewOrder(true); } }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{BAY_ICONS[bay.type] || '🔧'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{bay.name}</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, textTransform: 'capitalize' }}>{bay.type.replace('_', ' ')}</div>
                {isOccupied ? (
                  <div>
                    <div style={{ fontSize: 12, color: T.amber, fontWeight: 600 }}>{activeOrder.customer}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{fmt(activeOrder.total)} · {(activeOrder.items || []).length} items</div>
                    <span style={{ background: STATUS_COLORS[activeOrder.status] + '22', color: STATUS_COLORS[activeOrder.status], borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginTop: 6, display: 'inline-block' }}>{STATUS_LABELS[activeOrder.status]}</span>
                    <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                      {activeOrder.status === 'new' && <button onClick={e => { e.stopPropagation(); updateOrderStatus(activeOrder, 'in_progress'); }} style={{ flex: 1, background: T.amber + '22', color: T.amber, border: 'none', borderRadius: 5, padding: '4px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Start</button>}
                      {activeOrder.status === 'in_progress' && <button onClick={e => { e.stopPropagation(); updateOrderStatus(activeOrder, 'ready'); }} style={{ flex: 1, background: T.green + '22', color: T.green, border: 'none', borderRadius: 5, padding: '4px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅ Ready</button>}
                      {activeOrder.status === 'ready' && <button onClick={e => { e.stopPropagation(); updateOrderStatus(activeOrder, 'completed'); }} style={{ flex: 1, background: T.teal + '22', color: T.teal, border: 'none', borderRadius: 5, padding: '4px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📦 Done</button>}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: T.green + '22', color: T.green, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, textAlign: 'center', marginTop: 4 }}>🟢 Available</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* QUEUE VIEW */}
      {view === 'queue' && (
        <div style={{ background: T.srf, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: T.card }}>
              {['Bay', 'Customer', 'Items', 'Total', 'Time', 'Status', 'Action'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, color: T.sub, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${T.bdr}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: T.sub }}>Loading…</td></tr>
              : activeOrders.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: T.muted }}>No active orders</td></tr>
              : activeOrders.map(order => {
                const mins = Math.floor((Date.now() - new Date(order.created_at)) / 60000);
                return (
                  <tr key={order.id} style={{ borderBottom: `1px solid ${T.bdr}22`, background: order.status === 'ready' ? T.green + '08' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', color: T.ink, fontWeight: 600 }}>{order.bay_name}</td>
                    <td style={{ padding: '10px 14px', color: T.ink }}>{order.customer}</td>
                    <td style={{ padding: '10px 14px', color: T.sub }}>{(order.items || []).map(i => i.name).join(', ').slice(0, 40)}{(order.items || []).length > 2 ? '…' : ''}</td>
                    <td style={{ padding: '10px 14px', color: T.green, fontWeight: 700 }}>{fmt(order.total)}</td>
                    <td style={{ padding: '10px 14px', color: mins > 20 ? T.red : T.muted }}>{mins}m ago</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: STATUS_COLORS[order.status] + '22', color: STATUS_COLORS[order.status], borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{STATUS_LABELS[order.status]}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {order.status === 'new' && <button onClick={() => updateOrderStatus(order, 'in_progress')} style={{ background: T.amber + '22', color: T.amber, border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶</button>}
                        {order.status === 'in_progress' && <button onClick={() => updateOrderStatus(order, 'ready')} style={{ background: T.green + '22', color: T.green, border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅</button>}
                        {order.status === 'ready' && <button onClick={() => updateOrderStatus(order, 'completed')} style={{ background: T.teal + '22', color: T.teal, border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📦</button>}
                        <button onClick={() => updateOrderStatus(order, 'cancelled')} style={{ background: T.red + '22', color: T.red, border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DISPLAY MODE - big screen kitchen/service display */}
      {view === 'display' && (
        <div style={{ padding: 20, minHeight: '100vh', background: '#000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>🏪 {tenant?.name} — Service Display</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 18, color: '#aaa' }}>{new Date().toLocaleTimeString('en-IN')}</div>
              <button onClick={() => setView('floor')} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Exit</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {activeOrders.map(order => (
              <div key={order.id} style={{ background: order.status === 'ready' ? '#00d68f22' : order.status === 'in_progress' ? '#ffb54722' : '#ffffff11', border: `2px solid ${STATUS_COLORS[order.status]}`, borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{order.bay_name}</div>
                  <span style={{ background: STATUS_COLORS[order.status], color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{STATUS_LABELS[order.status]}</span>
                </div>
                <div style={{ fontSize: 16, color: '#eee', marginBottom: 8 }}>{order.customer}</div>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#bbb', padding: '3px 0' }}>• {item.name} ×{item.qty}</div>
                ))}
                <div style={{ fontSize: 18, fontWeight: 800, color: STATUS_COLORS[order.status], marginTop: 10 }}>{fmt(order.total)}</div>
                {order.notes && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>📝 {order.notes}</div>}
              </div>
            ))}
            {!activeOrders.length && <div style={{ color: '#444', fontSize: 20, padding: 60, textAlign: 'center', gridColumn: '1/-1' }}>No active orders — all clear 🎉</div>}
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.srf, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>New Order{selectedBay ? ` — ${selectedBay.name}` : ''}</div>
              <button onClick={() => { setShowNewOrder(false); setSelectedBay(null); setItems([]); }} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>

            {!selectedBay && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: T.sub, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Select Bay / Counter</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {bays.filter(b => !orders.find(o => o.bay_id === b.id && ['new', 'in_progress', 'ready'].includes(o.status))).map(bay => (
                    <button key={bay.id} onClick={() => setSelectedBay(bay)} style={{ background: T.card, color: T.ink, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{BAY_ICONS[bay.type]}</span><span>{bay.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: T.sub, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Customer</label>
              <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name (optional)" style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 7, padding: '8px 12px', color: T.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }} />
            </div>

            <div style={{ marginBottom: 12, position: 'relative' }}>
              <label style={{ fontSize: 10, color: T.sub, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Add Items</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory…" style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 7, padding: '8px 12px', color: T.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }} />
              {filteredInv.length > 0 && search && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 8, zIndex: 10, maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                  {filteredInv.slice(0, 6).map(i => (
                    <div key={i.id} onClick={() => addItem(i)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.bdr}22`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: T.ink }}>{i.name}</span>
                      <span style={{ color: T.green, fontWeight: 700 }}>{fmt(i.sp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div style={{ background: T.card, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                {items.map(item => (
                  <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: T.ink }}>{item.name}</span>
                    <button onClick={() => setItems(p => p.map(i => i.item_id === item.item_id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i))} style={{ background: T.bdr, color: T.ink, border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontFamily: 'inherit' }}>-</button>
                    <span style={{ fontSize: 12, color: T.ink, minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => setItems(p => p.map(i => i.item_id === item.item_id ? { ...i, qty: i.qty + 1 } : i))} style={{ background: T.blue, color: '#fff', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
                    <span style={{ fontSize: 12, color: T.green, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{fmt(item.price * item.qty)}</span>
                    <button onClick={() => setItems(p => p.filter(i => i.item_id !== item.item_id))} style={{ background: T.red + '22', color: T.red, border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 700, fontSize: 14, borderTop: `1px solid ${T.bdr}`, paddingTop: 8 }}>
                  <span style={{ color: T.sub }}>Total</span>
                  <span style={{ color: T.green }}>{fmt(items.reduce((s, i) => s + i.price * i.qty, 0))}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ background: T.card, border: `1px solid ${T.bdr}`, borderRadius: 7, padding: '8px 12px', color: T.ink, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }} />
            </div>

            <button onClick={createOrder} disabled={saving || !items.length || !selectedBay} style={{ width: '100%', background: T.green, color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : `🚀 Create Order${selectedBay ? ` — ${selectedBay.name}` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
