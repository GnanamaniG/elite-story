import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCustomers } from '../lib/supabase';
import { sendToCustomerPhone } from '../lib/whatsapp';

const T = { bg:'#060710', srf:'#0f1220', card:'#141828', bdr:'#1e2540', blue:'#4f7cff', ink:'#eef0f8', sub:'#6b7598', muted:'#4a5175', green:'#00d68f', amber:'#ffb547', red:'#ff4d6a', teal:'#00c9b1' };
const fmt  = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
const fmtD = n => 'Rs.' + (n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

export default function CreditLedger({ tenant }) {
  const [customers,  setCustomers]  = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [ledger,     setLedger]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showPayment,setShowPayment]= useState(false);
  const [payAmount,  setPayAmount]  = useState('');
  const [payNote,    setPayNote]    = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { if (tenant?.id) loadCustomers(); }, [tenant?.id]);

  async function loadCustomers() {
    setLoading(true);
    const data = await getCustomers(tenant.id);
    setCustomers(data.filter(c => (c.outstanding||0) > 0 || c.credit_limit > 0));
    setLoading(false);
  }

  async function loadLedger(customerId) {
    const { data } = await supabase.from('credit_ledger').select('*').eq('customer_id', customerId).order('created_at', { ascending:false }).limit(50);
    // If no ledger entries, build from sales
    if (!data?.length) {
      const { data: sales } = await supabase.from('sales').select('*').eq('tenant_id', tenant.id).eq('customer_id', customerId).order('date', { ascending:false }).limit(20);
      setLedger((sales||[]).map(s => ({ id:s.id, txn_type:'sale', amount:s.total, balance:s.total-s.paid, note:`Invoice ${s.inv_num}`, created_at:s.created_at, due_date:s.date })));
    } else {
      setLedger(data);
    }
  }

  async function recordPayment() {
    if (!selected || !payAmount) return;
    setSaving(true);
    const amount = parseFloat(payAmount);
    await supabase.from('credit_ledger').insert({
      tenant_id: tenant.id, customer_id: selected.id,
      txn_type: 'payment', amount: -amount,
      note: payNote || 'Payment received',
    });
    const newOutstanding = Math.max(0, (selected.outstanding||0) - amount);
    await supabase.from('customers').update({ outstanding: newOutstanding }).eq('id', selected.id);
    setSelected({ ...selected, outstanding: newOutstanding });
    setCustomers(prev => prev.map(c => c.id===selected.id ? { ...c, outstanding:newOutstanding } : c));
    setShowPayment(false); setPayAmount(''); setPayNote('');
    await loadLedger(selected.id);
    setSaving(false);
  }

  function sendReminder(customer) {
    const msg = `Dear ${customer.name},\n\nThis is a friendly reminder that you have an outstanding balance of *${fmt(customer.outstanding)}* with ${tenant?.name||'Elite Store'}.\n\nKindly clear the payment at your earliest convenience.\n\nThank you! 🙏`;
    window.open('https://wa.me/' + (customer.phone?.replace(/\D/g,'').replace(/^0/,'91') || '') + '?text=' + encodeURIComponent(msg), '_blank');
  }

  const overdueCustomers = customers.filter(c => (c.outstanding||0) > 0);
  const totalOutstanding = customers.reduce((s,c) => s+(c.outstanding||0), 0);

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.ink }}>Credit Ledger</div>
          <div style={{ fontSize:13, color:T.sub }}>{overdueCustomers.length} customers with outstanding</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          ['Total Outstanding', fmt(totalOutstanding), T.red],
          ['Customers with Dues', overdueCustomers.length, T.amber],
          ['Avg Outstanding', fmt(overdueCustomers.length > 0 ? totalOutstanding/overdueCustomers.length : 0), T.blue],
        ].map(([label,val,color]) => (
          <div key={label} style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:T.sub, fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1.4fr':'1fr', gap:16 }}>
        {/* Customer list */}
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search customers…"
            style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', marginBottom:12 }} />
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            {loading ? <div style={{ padding:40, textAlign:'center', color:T.sub }}>Loading…</div>
            : customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).length === 0
            ? <div style={{ padding:40, textAlign:'center', color:T.muted }}>No customers with outstanding balance</div>
            : customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).map(c => (
              <div key={c.id}
                onClick={() => { setSelected(c); loadLedger(c.id); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderBottom:`1px solid ${T.bdr}22`, cursor:'pointer', background:selected?.id===c.id?T.card:'transparent' }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:T.red+'22', color:T.red, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, flexShrink:0 }}>
                  {c.name[0].toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{c.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{c.phone||'No phone'}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:T.red }}>{fmt(c.outstanding||0)}</div>
                  <div style={{ fontSize:10, color:T.muted }}>outstanding</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ledger detail */}
        {selected && (
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.bdr}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink }}>{selected.name}</div>
                <div style={{ fontSize:12, color:T.red, fontWeight:700 }}>Outstanding: {fmt(selected.outstanding||0)}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => sendReminder(selected)} style={{ background:'#25d36622', color:'#25d366', border:'none', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  💬 Remind
                </button>
                <button onClick={() => setShowPayment(true)} style={{ background:T.green+'22', color:T.green, border:'none', borderRadius:7, padding:'7px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  💰 Record Payment
                </button>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:18 }}>×</button>
              </div>
            </div>

            {/* Credit bar */}
            {selected.credit_limit > 0 && (
              <div style={{ padding:'10px 18px', background:T.card, borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.sub, marginBottom:5 }}>
                  <span>Credit Used</span>
                  <span>{fmt(selected.outstanding||0)} / {fmt(selected.credit_limit)}</span>
                </div>
                <div style={{ height:6, background:T.bdr, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100, (selected.outstanding||0)/selected.credit_limit*100)}%`, background: (selected.outstanding||0)/selected.credit_limit > 0.8 ? T.red : T.amber, borderRadius:3 }} />
                </div>
              </div>
            )}

            {/* Ledger entries */}
            <div style={{ maxHeight:400, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:T.card }}>
                    {['Date','Type','Note','Amount','Balance'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id} style={{ borderBottom:`1px solid ${T.bdr}22` }}>
                      <td style={{ padding:'9px 14px', color:T.muted }}>{(entry.created_at||entry.due_date||'').slice(0,10)}</td>
                      <td style={{ padding:'9px 14px' }}>
                        <span style={{ background: entry.txn_type==='payment'?T.green+'22':T.amber+'22', color:entry.txn_type==='payment'?T.green:T.amber, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' }}>{entry.txn_type}</span>
                      </td>
                      <td style={{ padding:'9px 14px', color:T.sub }}>{entry.note||'—'}</td>
                      <td style={{ padding:'9px 14px', color:entry.amount<0?T.green:T.red, fontWeight:700 }}>{entry.amount<0?'-':''}{fmt(Math.abs(entry.amount))}</td>
                      <td style={{ padding:'9px 14px', color:T.ink }}>{entry.balance !== undefined ? fmt(entry.balance) : '—'}</td>
                    </tr>
                  ))}
                  {!ledger.length && <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:T.muted }}>No transactions found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:14, padding:24, width:'100%', maxWidth:380 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:T.ink }}>Record Payment — {selected?.name}</div>
              <button onClick={() => setShowPayment(false)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ fontSize:13, color:T.sub, marginBottom:14 }}>Outstanding: <strong style={{ color:T.red }}>{fmt(selected?.outstanding||0)}</strong></div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Payment Amount (Rs.) *</label>
              <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0.00" autoFocus
                style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px 14px', color:T.ink, fontSize:16, fontFamily:'inherit', outline:'none', width:'100%' }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:5 }}>Note</label>
              <input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="e.g. Cash received, UPI transfer"
                style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'10px 14px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' }} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowPayment(false)} style={{ flex:1, background:T.card, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={recordPayment} disabled={saving||!payAmount} style={{ flex:2, background:T.green, color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
