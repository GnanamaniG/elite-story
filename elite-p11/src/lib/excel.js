// ── Excel Export using SheetJS ────────────────────────────────
// Dynamically loads xlsx from CDN — no npm install needed

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
}

function downloadXLSX(workbook, filename) {
  const XLSX = window.XLSX;
  XLSX.writeFile(workbook, filename + '.xlsx');
}

// ── Sales Export ───────────────────────────────────────────────
export async function exportSalesToExcel(sales, tenant, period = '') {
  const XLSX = await loadXLSX();
  const rows = [
    ['Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'GST', 'Discount', 'Total', 'Paid', 'Status', 'Payment Mode'],
    ...sales.map(s => [
      s.inv_num, s.date, s.customer || 'Walk-in',
      (s.items||[]).map(i => `${i.name}(${i.qty})`).join('; '),
      s.subtotal || 0, s.gst_amount || 0, s.discount || 0,
      s.total || 0, s.paid || 0, s.status, s.payment_mode || 'cash'
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Style header row
  ws['!cols'] = [12,12,20,30,12,10,10,12,12,10,12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_Sales_${period||new Date().toISOString().slice(0,10)}`);
}

// ── Inventory Export ───────────────────────────────────────────
export async function exportInventoryToExcel(items, tenant) {
  const XLSX = await loadXLSX();
  const rows = [
    ['Name','Code','Category','HSN','Unit','Selling Price','Cost Price','GST%','Stock','Reorder Level','Stock Value (CP)','Stock Value (SP)'],
    ...items.map(i => [
      i.name, i.code||'', i.cat||'', i.hsn||'', i.unit||'Pcs',
      i.sp||0, i.cp||0, i.gst||18, i.stock||0, i.alert||10,
      Math.round((i.stock||0)*(i.cp||0)), Math.round((i.stock||0)*(i.sp||0))
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [25,12,14,10,8,14,12,8,8,12,16,16].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_Inventory_${new Date().toISOString().slice(0,10)}`);
}

// ── Customers Export ───────────────────────────────────────────
export async function exportCustomersToExcel(customers, tenant) {
  const XLSX = await loadXLSX();
  const rows = [
    ['Name','Phone','Email','GSTIN','Address','Outstanding','Credit Limit','Loyalty Points'],
    ...customers.map(c => [c.name, c.phone||'', c.email||'', c.gstin||'', c.address||'', c.outstanding||0, c.credit_limit||0, c.loyalty_pts||0])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [22,14,24,18,30,14,14,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_Customers_${new Date().toISOString().slice(0,10)}`);
}

// ── Expenses Export ────────────────────────────────────────────
export async function exportExpensesToExcel(expenses, tenant) {
  const XLSX = await loadXLSX();
  const rows = [
    ['Date','Category','Amount','Note'],
    ...expenses.map(e => [e.date, e.category, e.amount||0, e.note||''])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [12,18,14,40].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_Expenses_${new Date().toISOString().slice(0,10)}`);
}

// ── P&L Summary Export ─────────────────────────────────────────
export async function exportPLToExcel(data, tenant, period) {
  const XLSX = await loadXLSX();
  const wb   = XLSX.utils.book_new();

  // P&L Sheet
  const plRows = [
    ['Profit & Loss Summary', period],
    [],
    ['INCOME', ''],
    ['Revenue', data.revenue || 0],
    [],
    ['COST OF GOODS', ''],
    ['Purchases (COGS)', data.cogs || 0],
    ['Gross Profit', (data.revenue||0) - (data.cogs||0)],
    [],
    ['EXPENSES', ''],
    ...Object.entries(data.expByCat||{}).map(([cat,amt]) => [cat, amt]),
    ['Total Expenses', data.expTotal || 0],
    [],
    ['NET PROFIT', (data.revenue||0) - (data.cogs||0) - (data.expTotal||0)],
    [],
    ['GST Collected', data.gstColl || 0],
    ['Total Invoices', data.orders || 0],
    ['Avg Order Value', data.orders > 0 ? Math.round((data.revenue||0) / data.orders) : 0],
  ];
  const plSheet = XLSX.utils.aoa_to_sheet(plRows);
  plSheet['!cols'] = [28, 16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, plSheet, 'P&L Summary');

  // Top Items Sheet
  if (data.topItems?.length) {
    const itemRows = [['Item Name', 'Revenue'], ...data.topItems.map(([name,rev]) => [name, rev])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), 'Top Items');
  }

  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_PL_${period||new Date().toISOString().slice(0,7)}`);
}

// ── Payroll Export ─────────────────────────────────────────────
export async function exportPayrollToExcel(payroll, tenant, month) {
  const XLSX = await loadXLSX();
  const rows = [
    ['Staff Name', 'Basic Salary', 'Days Worked', 'Working Days', 'Advance', 'Deductions', 'Bonus', 'Net Pay', 'Status'],
    ...payroll.map(p => [p.staff_name, p.salary||0, p.days_worked||0, p.days_total||26, p.advance||0, p.deductions||0, p.bonus||0, p.net_pay||0, p.status||'pending']),
    [],
    ['TOTAL', '', '', '', '', '', '', payroll.reduce((s,p) => s+(p.net_pay||0), 0), ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [22,14,12,14,12,14,10,12,10].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Payroll ${month}`);
  downloadXLSX(wb, `${tenant?.name||'EliteStore'}_Payroll_${month}`);
}
