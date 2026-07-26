// ── GST Computation Utilities ─────────────────────────────────

/** Compute GSTR-1 B2B and B2C summary from sales array */
export function computeGSTR1(sales, tenantGstin) {
  const b2b = {}; // GSTIN → invoices
  const b2c = []; // B2C invoices
  const hsn = {}; // HSN → { qty, taxable, igst, cgst, sgst }

  sales.forEach(sale => {
    const items = sale.items || [];
    const isB2B = !!sale.customer_gstin;

    if (isB2B) {
      const gstin = sale.customer_gstin;
      if (!b2b[gstin]) b2b[gstin] = { gstin, name: sale.customer, invoices: [] };
      b2b[gstin].invoices.push({
        num:  sale.inv_num,
        date: sale.date,
        val:  sale.total,
        pos:  gstin.slice(0, 2), // place of supply
        rev:  false,
        itms: items.map(item => {
          const taxable = (item.amount || 0) - ((item.amount || 0) * (item.gst || 18) / (100 + (item.gst || 18)));
          const gstAmt  = (item.amount || 0) - taxable;
          const isSame  = tenantGstin?.slice(0, 2) === gstin.slice(0, 2);
          return {
            num:    item.gst || 18,
            itqty:  item.qty || 1,
            ival:   taxable,
            iamt:   isSame ? 0 : gstAmt,
            camt:   isSame ? gstAmt / 2 : 0,
            samt:   isSame ? gstAmt / 2 : 0,
            csamt:  0,
          };
        }),
      });
    } else {
      b2c.push({
        typ: 'OE',
        pos: tenantGstin?.slice(0, 2) || '33',
        inv: [{ val: sale.total, pos: tenantGstin?.slice(0, 2) || '33', etin: '', diff_percent: 0 }],
        itms: items.map(item => {
          const taxable = (item.amount || 0) - ((item.amount || 0) * (item.gst || 18) / (100 + (item.gst || 18)));
          const gstAmt  = (item.amount || 0) - taxable;
          return {
            num:  item.gst || 18,
            ival: taxable,
            camt: gstAmt / 2,
            samt: gstAmt / 2,
            csamt: 0,
          };
        }),
      });
    }

    // HSN summary
    items.forEach(item => {
      const hsnCode = item.hsn || 'NA';
      if (!hsn[hsnCode]) hsn[hsnCode] = { hsn: hsnCode, desc: item.name, uqc: 'NOS', qty: 0, val: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      const taxable = (item.amount || 0) - ((item.amount || 0) * (item.gst || 18) / (100 + (item.gst || 18)));
      const gstAmt  = (item.amount || 0) - taxable;
      hsn[hsnCode].qty     += item.qty || 1;
      hsn[hsnCode].val     += item.amount || 0;
      hsn[hsnCode].taxable += taxable;
      hsn[hsnCode].cgst    += gstAmt / 2;
      hsn[hsnCode].sgst    += gstAmt / 2;
    });
  });

  return {
    b2b: Object.values(b2b),
    b2cs: b2c,
    hsn: { details: Object.values(hsn) },
  };
}

/** Export GSTR-1 as JSON for GSTN portal upload */
export function exportGSTR1JSON(sales, tenant, period) {
  const [yr, mo] = period.split('-');
  const months   = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const retPrd   = months[parseInt(mo)] + yr;
  const gstr1    = computeGSTR1(sales, tenant.gstin);

  const json = {
    gstin:      tenant.gstin || '',
    fp:         retPrd,
    gt:         sales.reduce((s, x) => s + (x.total || 0), 0),
    cur_gt:     sales.reduce((s, x) => s + (x.total || 0), 0),
    cdnr:       [],
    b2b:        gstr1.b2b,
    b2cs:       gstr1.b2cs,
    b2cl:       [],
    hsn:        gstr1.hsn,
    exp:        { exwop: [], exwp: [] },
    nil:        { inv: [] },
    doc_issue:  { doc_det: [] },
  };

  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `GSTR1_${tenant.gstin || 'NA'}_${retPrd}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Compute GSTR-3B summary */
export function computeGSTR3B(sales, purchases) {
  const outward = sales.reduce((acc, s) => {
    const items = s.items || [];
    items.forEach(item => {
      const taxable = (item.amount || 0) - ((item.amount || 0) * (item.gst || 18) / (100 + (item.gst || 18)));
      const gstAmt  = (item.amount || 0) - taxable;
      acc.taxable += taxable;
      acc.igst    += 0;
      acc.cgst    += gstAmt / 2;
      acc.sgst    += gstAmt / 2;
    });
    return acc;
  }, { taxable: 0, igst: 0, cgst: 0, sgst: 0 });

  const itc = purchases.reduce((acc, p) => {
    const items = p.items || [];
    items.forEach(item => {
      const taxable = (item.amount || 0) - ((item.amount || 0) * (item.gst || 18) / (100 + (item.gst || 18)));
      const gstAmt  = (item.amount || 0) - taxable;
      acc.igst += 0;
      acc.cgst += gstAmt / 2;
      acc.sgst += gstAmt / 2;
    });
    return acc;
  }, { igst: 0, cgst: 0, sgst: 0 });

  const netTax = {
    igst: Math.max(0, outward.igst - itc.igst),
    cgst: Math.max(0, outward.cgst - itc.cgst),
    sgst: Math.max(0, outward.sgst - itc.sgst),
  };

  return { outward, itc, netTax, totalNetTax: netTax.igst + netTax.cgst + netTax.sgst };
}
