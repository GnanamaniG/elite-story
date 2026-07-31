// ── Role-Based Access Control ─────────────────────────────────

export const ROLES = {
  owner:   { label:'Owner',   color:'#4f7cff', icon:'👑' },
  manager: { label:'Manager', color:'#9b72ff', icon:'🏢' },
  cashier: { label:'Cashier', color:'#00d68f', icon:'💳' },
  staff:   { label:'Staff',   color:'#ffb547', icon:'👤' },
};

// Pages each role can access
const ROLE_PAGES = {
  owner: '*', // all pages
  manager: [
    'dashboard','pos','sales','inventory','customers','purchases','expenses',
    'reports','gst','ai','branches','suppliers','credit','variants',
    'attendance','payroll','loyalty','notifications','store','portal',
    'returns','pricelists','transfer','purchaseorders','catalog','segments',
    'documents','cashregister','repairs','qrlabels','team',
  ],
  cashier: [
    'dashboard','pos','sales','customers','cashregister','notifications',
  ],
  staff: [
    'dashboard','pos','sales','inventory','customers','attendance',
  ],
};

/**
 * Check if a user role can access a given page
 */
export function canAccess(role, page) {
  if (!role || role === 'owner') return true;
  const allowed = ROLE_PAGES[role];
  if (!allowed) return false;
  if (allowed === '*') return true;
  return allowed.includes(page);
}

/**
 * Filter nav items based on role
 */
export function filterNav(navItems, role) {
  if (!role || role === 'owner') return navItems;
  return navItems.filter(item => {
    if (item.divider) return true;
    return canAccess(role, item.id);
  });
}

/**
 * Get nav items visible for a role
 */
export function getAccessiblePages(role) {
  if (!role || role === 'owner') return '*';
  return ROLE_PAGES[role] || ['dashboard'];
}

/**
 * Default permissions JSON for each role
 */
export function defaultPermissions(role) {
  return {
    owner:   { all:true },
    manager: { pos:true, reports:true, inventory:true, customers:true, team:true, settings:false, billing:false },
    cashier: { pos:true, sales:true, customers:true, cashregister:true },
    staff:   { pos:true, inventory:true, attendance:true },
  }[role] || {};
}
