import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const T = {
  bg:'#F7F3F3', srf:'#FFFFFF', bdr:'#E8DEDE',
  red:'#C0392B', darkRed:'#8B0000', lightRed:'#FEF2F2',
  green:'#16A34A', amber:'#D97706', blue:'#2563EB', purple:'#7C3AED',
  ink:'#111827', sub:'#6B7280', muted:'#9CA3AF', white:'#FFFFFF'
};
const fmt = n => 'Rs.' + (n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });

// ── Full destination map: page id + hub tab ────────────────────
export const DESTINATIONS = [
  // Core
  { id:'dashboard',  label:'Dashboard',            group:'Core',      icon:'⚡', keys:'home overview pulse' },
  { id:'pos',        label:'Sales / POS',          group:'Core',      icon:'🧧', keys:'bill billing checkout counter' },
  { id:'expenses',   label:'Expenses',             group:'Core',      icon:'💸', keys:'spend cost outgoing' },

  // Sales hub
  { id:'saleshub', tab:'history',    label:'Sales History',       group:'Sales', icon:'📄', keys:'invoices bills sold' },
  { id:'saleshub', tab:'b2b',        label:'B2B / Wholesale',     group:'Sales', icon:'🏢', keys:'bulk wholesale business' },
  { id:'saleshub', tab:'quotations', label:'Quotations',          group:'Sales', icon:'📋', keys:'quote estimate proforma' },
  { id:'saleshub', tab:'delivery',   label:'Delivery Management', group:'Sales', icon:'🚚', keys:'dispatch courier shipping' },
  { id:'saleshub', tab:'warranty',   label:'Warranty Tracker',    group:'Sales', icon:'🛡️', keys:'guarantee claim' },
  { id:'saleshub', tab:'paylinks',   label:'Payment Links',       group:'Sales', icon:'💸', keys:'upi collect pay online' },
  { id:'saleshub', tab:'returns',    label:'Sales Returns',       group:'Sales', icon:'🔄', keys:'refund exchange' },
  { id:'saleshub', tab:'creditnotes',label:'Credit Notes',        group:'Sales', icon:'📝', keys:'cn adjustment' },
  { id:'saleshub', tab:'statements', label:'Customer Statements', group:'Sales', icon:'📊', keys:'account soa' },

  // Inventory hub
  { id:'invhub', tab:'products',  label:'Products / Items',    group:'Inventory', icon:'📦', keys:'stock sku catalogue goods' },
  { id:'invhub', tab:'variants',  label:'Variants',            group:'Inventory', icon:'🎨', keys:'size colour options' },
  { id:'invhub', tab:'prices',    label:'Price Lists',         group:'Inventory', icon:'🏷️', keys:'mrp rate pricing' },
  { id:'invhub', tab:'history',   label:'Price History',       group:'Inventory', icon:'📉', keys:'rate change log' },
  { id:'invhub', tab:'valuation', label:'Stock Valuation',     group:'Inventory', icon:'🏦', keys:'inventory value worth' },
  { id:'invhub', tab:'batches',   label:'Batch & Expiry',      group:'Inventory', icon:'🏷️', keys:'lot expiry fefo' },
  { id:'invhub', tab:'adjust',    label:'Stock Adjustments',   group:'Inventory', icon:'📋', keys:'damage theft writeoff' },
  { id:'invhub', tab:'transfer',  label:'Stock Transfers',     group:'Inventory', icon:'🔀', keys:'branch move sto' },
  { id:'invhub', tab:'audit',     label:'Stock Audit',         group:'Inventory', icon:'✅', keys:'physical count verify' },
  { id:'invhub', tab:'reorder',   label:'Reorder Management',  group:'Inventory', icon:'🔄', keys:'low stock replenish' },
  { id:'invhub', tab:'aging',     label:'Inventory Aging',     group:'Inventory', icon:'⏳', keys:'slow dead stock' },
  { id:'invhub', tab:'import',    label:'Bulk Import',         group:'Inventory', icon:'⬆️', keys:'excel csv upload' },
  { id:'invhub', tab:'barcode',   label:'Barcode Generator',   group:'Inventory', icon:'🔲', keys:'label print sticker' },
  { id:'invhub', tab:'qr',        label:'QR Labels',           group:'Inventory', icon:'📱', keys:'qrcode tag' },

  // Customers hub
  { id:'custhub', tab:'list',      label:'Customers',          group:'Customers', icon:'👥', keys:'party client buyer' },
  { id:'custhub', tab:'visits',    label:'Visit Log',          group:'Customers', icon:'🚶', keys:'walkin footfall conversion' },
  { id:'custhub', tab:'segments',  label:'Customer Segments',  group:'Customers', icon:'🎯', keys:'group category' },
  { id:'custhub', tab:'credit',    label:'Credit Ledger',      group:'Customers', icon:'📒', keys:'udhaar due outstanding' },
  { id:'custhub', tab:'aging',     label:'Ledger & Aging',     group:'Customers', icon:'📊', keys:'receivable statement' },
  { id:'custhub', tab:'reminders', label:'Payment Reminders',  group:'Customers', icon:'💰', keys:'chase collect overdue' },
  { id:'custhub', tab:'winback',   label:'Win-Back Campaigns', group:'Customers', icon:'🔄', keys:'lapsed inactive return' },
  { id:'custhub', tab:'recurring', label:'Recurring Orders',   group:'Customers', icon:'🔁', keys:'subscription standing' },
  { id:'custhub', tab:'reviews',   label:'Product Reviews',    group:'Customers', icon:'⭐', keys:'rating feedback stars' },

  // Purchases hub
  { id:'purchhub', tab:'history',     label:'Purchase History',   group:'Purchases', icon:'📄', keys:'buy bought inward' },
  { id:'purchhub', tab:'orders',      label:'Purchase Orders',    group:'Purchases', icon:'📋', keys:'po order supplier' },
  { id:'purchhub', tab:'grn',         label:'Goods Receipt (GRN)',group:'Purchases', icon:'📥', keys:'receive inward qc' },
  { id:'purchhub', tab:'requisitions',label:'Requisitions',       group:'Purchases', icon:'📝', keys:'request approve indent' },
  { id:'purchhub', tab:'suppliers',   label:'Suppliers',          group:'Purchases', icon:'🏭', keys:'vendor party' },
  { id:'purchhub', tab:'payments',    label:'Supplier Payments',  group:'Purchases', icon:'🏦', keys:'payable pay vendor' },
  { id:'purchhub', tab:'scorecard',   label:'Supplier Scorecard', group:'Purchases', icon:'🏅', keys:'rating performance' },

  // Finance
  { id:'accountinghub', tab:'pl',       label:'Profit & Loss',    group:'Finance', icon:'📊', keys:'pnl income statement' },
  { id:'accountinghub', tab:'cashbook', label:'Daily Cash Book',  group:'Finance', icon:'📔', keys:'petty cash daybook' },
  { id:'accountinghub', tab:'cashflow', label:'Cash Flow',        group:'Finance', icon:'💹', keys:'forecast liquidity' },
  { id:'accountinghub', tab:'budget',   label:'Budget Tracker',   group:'Finance', icon:'📈', keys:'plan target spend' },
  { id:'gsthub', tab:'calendar',        label:'Compliance Calendar',group:'Finance',icon:'📅', keys:'due date filing deadline' },
  { id:'gsthub', tab:'gstr1',           label:'GSTR-1 Filing',    group:'Finance', icon:'📋', keys:'gst return outward' },
  { id:'gsthub', tab:'gstr3b',          label:'GSTR-3B',          group:'Finance', icon:'📊', keys:'gst itc summary' },
  { id:'gsthub', tab:'recon',           label:'GST Reconciliation',group:'Finance',icon:'🔍', keys:'2b match itc' },
  { id:'gsthub', tab:'tds',             label:'TDS Management',   group:'Finance', icon:'🏦', keys:'tax deduct' },

  // Growth
  { id:'loyaltyhub', tab:'points',  label:'Loyalty Points',   group:'Growth', icon:'🎁', keys:'reward points' },
  { id:'loyaltyhub', tab:'coupons', label:'Coupon Manager',   group:'Growth', icon:'🏷️', keys:'discount code promo' },
  { id:'loyaltyhub', tab:'gifts',   label:'Gift Cards',       group:'Growth', icon:'🎀', keys:'voucher' },
  { id:'marketinghub', tab:'campaigns', label:'Campaigns',    group:'Growth', icon:'📣', keys:'promotion blast' },
  { id:'marketinghub', tab:'wa',        label:'WhatsApp Catalog',group:'Growth',icon:'💬', keys:'whatsapp share' },

  // Team
  { id:'hrhub', tab:'qr',          label:'QR Attendance',      group:'Team', icon:'📲', keys:'checkin punch' },
  { id:'hrhub', tab:'payroll',     label:'Payroll',            group:'Team', icon:'💰', keys:'salary wages' },
  { id:'hrhub', tab:'tasks',       label:'Staff Task Board',   group:'Team', icon:'📋', keys:'kanban todo' },
  { id:'hrhub', tab:'targets',     label:'Sales Targets',      group:'Team', icon:'🎯', keys:'goal quota' },
  { id:'hrhub', tab:'commrun',     label:'Commission Run',     group:'Team', icon:'💵', keys:'incentive payout' },

  // Operations
  { id:'opshub', tab:'branches', label:'Branches',        group:'Operations', icon:'🏪', keys:'store location outlet' },
  { id:'opshub', tab:'handover', label:'Shift Handover',  group:'Operations', icon:'🔄', keys:'closing cash count' },
  { id:'opshub', tab:'eod',      label:'EOD Report',      group:'Operations', icon:'🌙', keys:'day end closing' },
  { id:'opshub', tab:'repairs',  label:'Repairs',         group:'Operations', icon:'🔨', keys:'service job' },

  // Reports
  { id:'reportshub', tab:'health',      label:'Business Health Score', group:'Reports', icon:'💚', keys:'score grade kpi' },
  { id:'reportshub', tab:'reports',     label:'Sales Reports',         group:'Reports', icon:'📊', keys:'analytics summary' },
  { id:'reportshub', tab:'performance', label:'Product Performance',   group:'Reports', icon:'📈', keys:'margin velocity' },
  { id:'reportshub', tab:'wareport',    label:'WhatsApp Daily Report', group:'Reports', icon:'📱', keys:'daily summary send' },

  // System
  { id:'toolshub', tab:'alerts',    label:'Smart Alerts',    group:'System', icon:'🔔', keys:'reminder notification' },
  { id:'toolshub', tab:'docexpiry', label:'Document Expiry', group:'System', icon:'📜', keys:'licence renewal' },
  { id:'toolshub', tab:'users',     label:'Users & Access',  group:'System', icon:'🔐', keys:'permission role staff' },
  { id:'toolshub', tab:'backup',    label:'Backup & Restore',group:'System', icon:'💾', keys:'export save' },
  { id:'toolshub', tab:'audit',     label:'Audit Trail',     group:'System', icon:'🔍', keys:'log history who' },
  { id:'settings',                  label:'Settings',        group:'System', icon:'⚙️', keys:'config preference setup' },
];

// Quick actions
const ACTIONS = [
  { action:'new_sale',     label:'New Sale / Bill',       icon:'🧧', group:'Actions', keys:'create invoice bill', dest:'pos' },
  { action:'new_item',     label:'Add New Product',       icon:'📦', group:'Actions', keys:'create item sku',     dest:'invhub', tab:'products' },
  { action:'new_customer', label:'Add New Customer',      icon:'👤', group:'Actions', keys:'create party client', dest:'custhub', tab:'list' },
  { action:'new_purchase', label:'Record Purchase',       icon:'🛒', group:'Actions', keys:'create buy inward',   dest:'purchhub', tab:'history' },
  { action:'new_expense',  label:'Record Expense',        icon:'💸', group:'Actions', keys:'create spend',        dest:'expenses' },
  { action:'close_shift',  label:'Close Shift & Handover',icon:'🔄', group:'Actions', keys:'end day cash count',  dest:'opshub', tab:'handover' },
];

export default function CommandPalette({ open, onClose, onNavigate, tenant }) {
  const [q,        setQ]        = useState('');
  const [sel,      setSel]      = useState(0);
  const [records,  setRecords]  = useState([]);
  const [searching,setSearching]= useState(false);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setSel(0); setRecords([]); setTimeout(()=>inputRef.current?.focus(), 50); }
  }, [open]);

  // Live record search (debounced)
  useEffect(() => {
    if (!open || q.length < 2 || !tenant?.id) { setRecords([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const [inv, cust, sale] = await Promise.all([
        supabase.from('inventory').select('id,name,code,sp,stock').eq('tenant_id',tenant.id).ilike('name',`%${q}%`).limit(4),
        supabase.from('customers').select('id,name,phone').eq('tenant_id',tenant.id).ilike('name',`%${q}%`).limit(4),
        supabase.from('sales').select('id,inv_num,customer,total,date').eq('tenant_id',tenant.id).ilike('inv_num',`%${q}%`).limit(3),
      ]);
      const recs = [
        ...(inv.data ||[]).map(r=>({ type:'item',     id:r.id, label:r.name,    sub:`${r.code||''} · ${fmt(r.sp)} · ${r.stock} in stock`, icon:'📦', dest:'invhub',  tab:'products' })),
        ...(cust.data||[]).map(r=>({ type:'customer', id:r.id, label:r.name,    sub:r.phone||'No phone',                                  icon:'👤', dest:'custhub', tab:'list' })),
        ...(sale.data||[]).map(r=>({ type:'invoice',  id:r.id, label:r.inv_num, sub:`${r.customer} · ${fmt(r.total)} · ${r.date}`,        icon:'📄', dest:'saleshub',tab:'history' })),
      ];
      setRecords(recs); setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, tenant?.id]);

  // Fuzzy match scoring
  const results = useMemo(() => {
    const all = [
      ...ACTIONS.map(a=>({ ...a, isAction:true })),
      ...DESTINATIONS,
    ];
    if (!q.trim()) {
      return [
        ...ACTIONS.slice(0,4).map(a=>({ ...a, isAction:true })),
        ...DESTINATIONS.slice(0,8),
      ];
    }
    const term = q.toLowerCase();
    const scored = all.map(d=>{
      const label = d.label.toLowerCase();
      const keys  = (d.keys||'').toLowerCase();
      let score = 0;
      if (label === term)               score = 100;
      else if (label.startsWith(term))  score = 90;
      else if (label.includes(term))    score = 70;
      else if (keys.includes(term))     score = 50;
      else {
        // subsequence match (fuzzy)
        let i=0; for (const ch of label) { if (ch===term[i]) i++; }
        if (i===term.length) score = 30;
      }
      return { ...d, score };
    }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score).slice(0,10);
    return scored;
  }, [q]);

  const combined = [...results, ...records.map(r=>({ ...r, isRecord:true, group:'Records' }))];

  useEffect(()=>{ setSel(0); }, [q]);

  function go(item) {
    if (!item) return;
    onNavigate(item.dest || item.id, item.tab);
    onClose();
  }

  function onKey(e) {
    if (e.key==='ArrowDown') { e.preventDefault(); setSel(s=>Math.min(s+1, combined.length-1)); }
    if (e.key==='ArrowUp')   { e.preventDefault(); setSel(s=>Math.max(s-1, 0)); }
    if (e.key==='Enter')     { e.preventDefault(); go(combined[sel]); }
    if (e.key==='Escape')    { e.preventDefault(); onClose(); }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block:'nearest' });
  }, [sel]);

  if (!open) return null;

  // Group results for display
  let lastGroup = null;

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(17,24,39,.45)', backdropFilter:'blur(3px)', zIndex:900, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'12vh' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:T.white, borderRadius:16, width:'100%', maxWidth:600, boxShadow:'0 24px 70px rgba(0,0,0,.28)', overflow:'hidden', border:`1px solid ${T.bdr}` }}>

        {/* Search input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:`1px solid ${T.bdr}` }}>
          <span style={{ fontSize:18, color:T.red }}>🔍</span>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search pages, products, customers, invoices…"
            style={{ flex:1, border:'none', outline:'none', fontSize:15, color:T.ink, fontFamily:'inherit', background:'transparent' }}/>
          {searching&&<span style={{ fontSize:11, color:T.muted }}>searching…</span>}
          <kbd style={{ background:T.bg, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'3px 7px', fontSize:10, color:T.sub, fontFamily:'inherit' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight:'52vh', overflowY:'auto', padding:'6px 0' }}>
          {combined.length===0
            ? <div style={{ padding:'40px 20px', textAlign:'center', color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                <div style={{ fontSize:13, fontWeight:600 }}>No results for "{q}"</div>
                <div style={{ fontSize:11, marginTop:4 }}>Try a page name, product, customer or invoice number</div>
              </div>
            : combined.map((item, i) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                const active = i===sel;
                return (
                  <div key={i}>
                    {showGroup&&<div style={{ padding:'8px 20px 4px', fontSize:9, fontWeight:800, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em' }}>{item.group}</div>}
                    <div data-idx={i} onClick={()=>go(item)} onMouseEnter={()=>setSel(i)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 20px', cursor:'pointer', background:active?T.lightRed:'transparent', borderLeft:`3px solid ${active?T.red:'transparent'}` }}>
                      <span style={{ fontSize:17, width:24, textAlign:'center' }}>{item.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:active?700:500, color:active?T.darkRed:T.ink }}>{item.label}</div>
                        {item.sub&&<div style={{ fontSize:11, color:T.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.sub}</div>}
                      </div>
                      {item.isAction&&<span style={{ background:'#EFF6FF', color:T.blue, borderRadius:5, padding:'2px 8px', fontSize:9, fontWeight:700 }}>ACTION</span>}
                      {active&&<kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:5, padding:'2px 7px', fontSize:10, color:T.sub }}>↵</kbd>}
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Footer hints */}
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'10px 20px', borderTop:`1px solid ${T.bdr}`, background:T.bg, fontSize:10, color:T.sub }}>
          <span><kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'2px 5px', marginRight:4 }}>↑↓</kbd>navigate</span>
          <span><kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'2px 5px', marginRight:4 }}>↵</kbd>open</span>
          <span><kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'2px 5px', marginRight:4 }}>ESC</kbd>close</span>
          <span style={{ marginLeft:'auto' }}>Press <kbd style={{ background:T.white, border:`1px solid ${T.bdr}`, borderRadius:4, padding:'2px 5px' }}>?</kbd> for all shortcuts</span>
        </div>
      </div>
    </div>
  );
}
