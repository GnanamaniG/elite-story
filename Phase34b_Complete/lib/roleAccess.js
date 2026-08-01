// ── Role-Based Access Control ─────────────────────────────────
// Enforced at three levels: sidebar nav, hub tabs, and sensitive data fields.

export const ROLES = {
  owner:      { label:'Owner',      color:'#8B0000', bg:'#FEF2F2', icon:'👑', rank:5, desc:'Full access to everything including financials' },
  manager:    { label:'Manager',    color:'#7C3AED', bg:'#F5F3FF', icon:'🏢', rank:4, desc:'Runs day-to-day operations, sees margins' },
  accountant: { label:'Accountant', color:'#2563EB', bg:'#EFF6FF', icon:'📊', rank:3, desc:'Books, GST, payments — no stock changes' },
  cashier:    { label:'Cashier',    color:'#16A34A', bg:'#F0FDF4', icon:'💳', rank:2, desc:'Billing and customers only' },
  staff:      { label:'Staff',      color:'#D97706', bg:'#FFFBEB', icon:'👤', rank:1, desc:'Stock handling and their own attendance' },
};

// ── Page-level access (sidebar items) ─────────────────────────
export const ROLE_PAGES = {
  owner: '*',

  // Manager runs the shop day to day — everything except owner-only Settings depth
  manager: [
    'dashboard','pos','saleshub','invhub','custhub','purchhub','expenses',
    'reportshub','accountinghub','gsthub','loyaltyhub','marketinghub',
    'hrhub','opshub','toolshub','settings',
  ],

  // Accountant: books, tax, payments. Sees stock value but cannot change stock.
  accountant: [
    'dashboard','saleshub','purchhub','expenses','reportshub',
    'accountinghub','gsthub','custhub','invhub','hrhub','opshub','toolshub',
  ],

  // Cashier: billing, customers, and the cash they are responsible for
  cashier: [
    'dashboard','pos','saleshub','custhub','invhub','opshub','loyaltyhub','toolshub','hrhub',
  ],

  // Staff: stock handling, deliveries, their own attendance
  staff: [
    'dashboard','pos','saleshub','invhub','custhub','purchhub','hrhub','opshub','toolshub',
  ],
};

// ── Tab-level access within hubs ──────────────────────────────
// Anything not listed is owner/manager only.
export const ROLE_TABS = {
  invhub: {
    manager:    '*',
    accountant: ['valuation','aging','history'],
    cashier:    ['products'],
    staff:      ['products','batches','audit','barcode','qr','adjust'],
  },
  saleshub: {
    manager:    '*',
    accountant: ['history','creditnotes','statements','b2b'],
    cashier:    ['history','returns','quotations'],
    staff:      ['history','delivery'],
  },
  custhub: {
    manager:    '*',
    accountant: ['list','credit','aging','reminders'],
    cashier:    ['list','visits','credit'],
    staff:      ['list','visits'],
  },
  purchhub: {
    manager:    '*',
    accountant: ['history','payments','orders'],
    cashier:    [],
    staff:      ['grn','requisitions'],
  },
  hrhub: {
    manager:    '*',
    accountant: ['payroll'],
    cashier:    ['qr'],
    staff:      ['qr','tasks','leave'],
  },
  reportshub: {
    manager:    '*',
    accountant: ['reports','advanced'],
    cashier:    [],
    staff:      [],
  },
  opshub: {
    manager:    '*',
    accountant: ['eod'],
    cashier:    ['cash','handover','eod'],
    staff:      ['repairs','service'],
  },
  toolshub: {
    manager:    ['alerts','ai','docs','notify','docexpiry'],
    accountant: ['docs','tally','audit'],
    cashier:    ['alerts'],
    staff:      ['alerts','docs'],
  },
  gsthub:        { manager:'*', accountant:'*', cashier:[], staff:[] },
  accountinghub: { manager:'*', accountant:'*', cashier:[], staff:[] },
  loyaltyhub:    { manager:'*', accountant:[], cashier:['points','coupons'], staff:[] },
  marketinghub:  { manager:'*', accountant:[], cashier:[], staff:[] },
};

// ── Field-level: who may see cost price, margin, profit ───────
export const SENSITIVE = {
  costPrice: ['owner','manager','accountant'],
  margin:    ['owner','manager','accountant'],
  profit:    ['owner','manager','accountant'],
  payroll:   ['owner','accountant'],
  discount:  ['owner','manager','cashier'],
  deleteAny: ['owner','manager'],
  export:    ['owner','manager','accountant'],
};

export function canAccess(role, page) {
  if (!role || role === 'owner') return true;
  const allowed = ROLE_PAGES[role];
  if (!allowed) return false;
  if (allowed === '*') return true;
  return allowed.includes(page);
}

export function canAccessTab(role, hub, tabId) {
  if (!role || role === 'owner') return true;
  const hubRules = ROLE_TABS[hub];
  if (!hubRules) return true;              // hub has no tab restrictions
  const allowed = hubRules[role];
  if (allowed === undefined) return false; // role not listed = denied
  if (allowed === '*') return true;
  return allowed.includes(tabId);
}

export function canSee(role, field) {
  if (!role || role === 'owner') return true;
  return (SENSITIVE[field] || []).includes(role);
}

export function filterNav(navItems, role) {
  if (!role || role === 'owner') return navItems;
  const out = [];
  navItems.forEach(item => {
    if (item.section) { out.push(item); return; }
    if (canAccess(role, item.id)) out.push(item);
  });
  // drop section headers with nothing under them
  return out.filter((item, i) => {
    if (!item.section) return true;
    const next = out[i+1];
    return next && !next.section;
  });
}

export function filterTabs(tabs, role, hub) {
  if (!role || role === 'owner') return tabs;
  return tabs.filter(t => canAccessTab(role, hub, t.id));
}

export function roleRank(role) { return ROLES[role]?.rank || 0; }
export function isAtLeast(role, minRole) { return roleRank(role) >= roleRank(minRole); }
