import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', card:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};

const CATEGORIES = ['Sales Receipt','Purchase Payment','Salary','Rent','Electricity','Transport','Stationery','Repairs','Miscellaneous','Other'];
const fmt  = n => 'Rs.' + Math.abs(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...extra });
const inp  = { background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'9px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%' };

export default function DailyCashBook({ tenant }) {
  const [entries,  setEntries]  = useState([]);
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10));
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [entryType,setEntryType]= useState('receipt'); // receipt | payment
  const [form, setForm] = useState({ description:'', category:'', ref_no:'', amount:'', entered_by:'' });

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id, date]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('cashbook_entries').select('*').eq('tenant_id', tenant.id).eq('entry_date', date).order('created_at');
    setEntries(data||[]);
    setLoading(false);
  }

  const totalReceipts = entries.filter(e=>e.type==='receipt'||e.type==='opening').reduce((s,e)=>s+(e.debit||0),0);
  const totalPayments = entries.filter(e=>e.type==='payment').reduce((s,e)=>s+(e.credit||0),0);
  const closingBal    = totalReceipts - totalPayments;

  async function addEntry(e) {
    e.preventDefault(); setSaving(true);
    const amount = parseFloat(form.amount)||0;
    const runBal = entryType==='receipt' ? closingBal + amount : closingBal - amount;
    await supabase.from('cashbook_entries').insert({
      ...form, tenant_id:tenant.id, entry_date:date,
      type: entryType,
      debit:  entryType==='receipt' ? amount : 0,
      credit: entryType==='payment' ? amount : 0,
      balance: runBal,
    });
    setShowForm(false);
    setForm({ description:'', category:'', ref_no:'', amount:'', entered_by:'' });
    setSaving(false); await load();
  }

  async function setOpening() {
    const bal = prompt('Enter opening cash balance (Rs.):');
    if (!bal || isNaN(bal)) return;
    await supabase.from('cashbook_entries').insert({ tenant_id:tenant.id, entry_date:date, type:'opening', description:'Opening Balance', debit:parseFloat(bal), credit:0, balance:parseFloat(bal) });
    await load();
  }

  function printCashBook() {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
      table{width:100%;border-collapse:collapse}th,td{padding:7px 10px;border:1px solid #ddd;text-align:left}
      th{background:#f5f0f0;font-weight:700;font-size:11px;text-transform:uppercase}
      .right{text-align:right}.green{color:#16A34A}.red{color:#C0392B}
      h2{color:#8B0000;margin-bottom:4px}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <div><h2>${tenant?.name||'7SQ'}</h2><div>Daily Cash Book — ${date}</div></div>
      <div style="text-align:right"><div>Opening: ${fmt(entries.find(e=>e.type==='opening')?.debit||0)}</div><div>Closing: <strong>${fmt(closingBal)}</strong></div></div>
    </div>
    <table><tr><th>Description</th><th>Category</th><th>Ref</th><th class="right">Receipt (Dr)</th><th class="right">Payment (Cr)</th><th class="right">Balance</th></tr>
    ${entries.map(e=>`<tr><td>${e.description}</td><td>${e.category||'—'}</td><td>${e.ref_no||'—'}</td>
    <td class="right green">${e.debit>0?fmt(e.debit):'—'}</td>
    <td class="right red">${e.credit>0?fmt(e.credit):'—'}</td>
    <td class="right"><strong>${fmt(e.balance)}</strong></td></tr>`).join('')}
    <tr style="background:#f5f0f0"><td colspan="3"><strong>TOTALS</strong></td>
    <td class="right green"><strong>${fmt(totalReceipts)}</strong></td>
    <td class="right red"><strong>${fmt(totalPayments)}</strong></td>
    <td class="right"><strong>${fmt(closingBal)}</strong></td></tr>
    </table>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`);
    w.document.close();
  }

  const hasOpening = entries.some(e=>e.type==='opening');

  return (
    <div style={{ padding:24, background:T.bg, minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:T.darkRed, letterSpacing:'-0.02em' }}>📔 Daily Cash Book</div>
          <div style={{ fontSize:13, color:T.sub, marginTop:2 }}>Track daily cash receipts and payments</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:8, padding:'8px 12px', color:T.ink, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={printCashBook} style={btn(T.lightRed, T.red, { border:`1px solid ${T.bdr}` })}>🖨️ Print</button>
          {!hasOpening&&<button onClick={setOpening} style={btn('#EFF6FF','#2563EB')}>Set Opening</button>}
          <button onClick={()=>setShowForm(true)} style={btn(T.red, T.white)}>+ Add Entry</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          ['Opening Balance', fmt(entries.find(e=>e.type==='opening')?.debit||0), T.blue, '🏦'],
          ['Total Receipts',  fmt(totalReceipts),  T.green, '⬆️'],
          ['Total Payments',  fmt(totalPayments),  T.red,   '⬇️'],
          ['Closing Balance', fmt(closingBal),     closingBal>=0?T.green:T.red, '💰'],
        ].map(([label,val,color,icon])=>(
          <div key={label} style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <span style={{ fontSize:18 }}>{icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.02em' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Cash book table */}
      <div style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:T.lightRed }}>
            {['#','Description','Category','Ref No','Receipt (Dr)','Payment (Cr)','Balance','By'].map(h=>(
              <th key={h} style={{ padding:'11px 14px', textAlign:h==='Receipt (Dr)'||h==='Payment (Cr)'||h==='Balance'?'right':'left', fontSize:10, color:T.darkRed, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:`1px solid ${T.bdr}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:T.muted }}>Loading…</td></tr>
            :entries.length===0?<tr><td colSpan={8} style={{ textAlign:'center', padding:50 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📔</div>
              <div style={{ color:T.muted, fontWeight:600 }}>No entries for {date}</div>
              <div style={{ color:T.muted, fontSize:12, marginTop:4 }}>Set opening balance and add receipts/payments</div>
            </td></tr>
            :entries.map((e,i)=>(
              <tr key={e.id} style={{ borderBottom:`1px solid ${T.bdr}33`, background:e.type==='opening'?'#EFF6FF':'transparent' }}>
                <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{i+1}</td>
                <td style={{ padding:'11px 14px', color:T.ink, fontWeight:e.type==='opening'?700:500 }}>{e.description}</td>
                <td style={{ padding:'11px 14px', color:T.sub }}>{e.category||'—'}</td>
                <td style={{ padding:'11px 14px', color:T.muted, fontFamily:'monospace', fontSize:11 }}>{e.ref_no||'—'}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', color:T.green, fontWeight:e.debit>0?700:400 }}>{e.debit>0?fmt(e.debit):'—'}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', color:T.red, fontWeight:e.credit>0?700:400 }}>{e.credit>0?fmt(e.credit):'—'}</td>
                <td style={{ padding:'11px 14px', textAlign:'right', color:e.balance>=0?T.ink:T.red, fontWeight:700 }}>{fmt(e.balance)}</td>
                <td style={{ padding:'11px 14px', color:T.muted, fontSize:11 }}>{e.entered_by||'—'}</td>
              </tr>
            ))}
            {entries.length>0&&<tr style={{ background:T.lightRed }}>
              <td colSpan={4} style={{ padding:'11px 14px', fontWeight:800, color:T.darkRed }}>CLOSING BALANCE</td>
              <td style={{ padding:'11px 14px', textAlign:'right', color:T.green, fontWeight:800 }}>{fmt(totalReceipts)}</td>
              <td style={{ padding:'11px 14px', textAlign:'right', color:T.red, fontWeight:800 }}>{fmt(totalPayments)}</td>
              <td style={{ padding:'11px 14px', textAlign:'right', fontWeight:900, fontSize:15, color:closingBal>=0?T.green:T.red }}>{fmt(closingBal)}</td>
              <td/>
            </tr>}
          </tbody>
        </table>
      </div>

      {showForm&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:T.white, borderRadius:16, padding:28, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:T.darkRed }}>Add Cash Entry</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted }}>×</button>
            </div>
            {/* Receipt / Payment toggle */}
            <div style={{ display:'flex', background:T.bg, borderRadius:10, padding:4, marginBottom:18, gap:4 }}>
              {[['receipt','⬆️ Receipt (Cash In)'],['payment','⬇️ Payment (Cash Out)']].map(([v,label])=>(
                <button key={v} onClick={()=>setEntryType(v)} style={{ flex:1, padding:'9px', background:entryType===v?(v==='receipt'?T.green:T.red):T.white, color:entryType===v?T.white:T.sub, border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>{label}</button>
              ))}
            </div>
            <form onSubmit={addEntry}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Description *</label><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Amount (Rs.) *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required style={{ ...inp, fontWeight:700, fontSize:15, color:entryType==='receipt'?T.green:T.red }}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Ref No</label><input value={form.ref_no} onChange={e=>setForm(f=>({...f,ref_no:e.target.value}))} placeholder="Invoice/Bill no." style={inp}/></div>
                <div><label style={{ fontSize:10, color:T.sub, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Entered By</label><input value={form.entered_by} onChange={e=>setForm(f=>({...f,entered_by:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:T.bg, color:T.sub, border:`1px solid ${T.bdr}`, borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, background:entryType==='receipt'?T.green:T.red, color:T.white, border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {saving?'Saving…':(entryType==='receipt'?'⬆️ Add Receipt':'⬇️ Add Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
