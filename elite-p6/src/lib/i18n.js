// ── Elite Store Internationalization (i18n) ───────────────────
// Supports: English (en), Tamil (ta), Hindi (hi)

export const LANGUAGES = [
  { code:'en', label:'English',  nativeLabel:'English',   flag:'🇬🇧' },
  { code:'ta', label:'Tamil',    nativeLabel:'தமிழ்',      flag:'🇮🇳' },
  { code:'hi', label:'Hindi',    nativeLabel:'हिंदी',      flag:'🇮🇳' },
];

const translations = {
  en: {
    // Navigation
    dashboard:   'Dashboard',
    pos:         'POS / Sales',
    salesHistory:'Sales History',
    inventory:   'Inventory',
    customers:   'Customers',
    purchases:   'Purchases',
    expenses:    'Expenses',
    reports:     'Reports',
    gstFiling:   'GST Filing',
    aiAssistant: 'AI Assistant',
    team:        'Team',
    billing:     'Billing',
    settings:    'Settings',
    signOut:     'Sign Out',
    // POS
    searchItems: 'Search items…',
    customer:    'Customer',
    walkIn:      'Walk-in',
    cart:        'Cart',
    cartEmpty:   'Cart is empty\nClick items to add',
    discount:    'Discount %',
    subtotal:    'Subtotal',
    gst:         'GST',
    total:       'Total',
    checkout:    'Checkout',
    clear:       'Clear',
    cash:        '💵 Cash',
    upi:         '📱 UPI',
    card:        '💳 Card',
    credit:      '📒 Credit',
    saleComplete:'Sale Complete!',
    newSale:     'New Sale',
    downloadPDF: '📄 Download PDF',
    whatsapp:    '💬 WhatsApp',
    // Inventory
    addItem:     '+ Add Item',
    itemName:    'Item Name',
    category:    'Category',
    sellingPrice:'Selling Price',
    costPrice:   'Cost Price',
    gstRate:     'GST Rate',
    stock:       'Stock',
    reorderLevel:'Reorder Level',
    unit:        'Unit',
    edit:        'Edit',
    delete:      'Delete',
    lowStock:    'Low Stock',
    // Common
    save:        'Save',
    cancel:      'Cancel',
    loading:     'Loading…',
    search:      'Search…',
    date:        'Date',
    amount:      'Amount',
    status:      'Status',
    actions:     'Actions',
    noData:      'No data found',
    branch:      'Branch',
    allBranches: 'All Branches',
  },

  ta: {
    // Navigation
    dashboard:   'டாஷ்போர்டு',
    pos:         'விற்பனை',
    salesHistory:'விற்பனை வரலாறு',
    inventory:   'சரக்கு',
    customers:   'வாடிக்கையாளர்கள்',
    purchases:   'கொள்முதல்',
    expenses:    'செலவுகள்',
    reports:     'அறிக்கைகள்',
    gstFiling:   'GST தாக்கல்',
    aiAssistant: 'AI உதவியாளர்',
    team:        'குழு',
    billing:     'பில்லிங்',
    settings:    'அமைப்புகள்',
    signOut:     'வெளியேறு',
    // POS
    searchItems: 'பொருட்களை தேடுங்கள்…',
    customer:    'வாடிக்கையாளர்',
    walkIn:      'நேரடி வாடிக்கையாளர்',
    cart:        'கார்ட்',
    cartEmpty:   'கார்ட் காலியாக உள்ளது\nபொருட்களை சேர்க்க கிளிக் செய்யுங்கள்',
    discount:    'தள்ளுபடி %',
    subtotal:    'மொத்தம்',
    gst:         'GST',
    total:       'மொத்த தொகை',
    checkout:    'கட்டணம் செலுத்து',
    clear:       'அழி',
    cash:        '💵 பணம்',
    upi:         '📱 UPI',
    card:        '💳 கார்டு',
    credit:      '📒 கடன்',
    saleComplete:'விற்பனை முடிந்தது!',
    newSale:     'புதிய விற்பனை',
    downloadPDF: '📄 PDF பதிவிறக்கம்',
    whatsapp:    '💬 வாட்ஸ்அப்',
    // Inventory
    addItem:     '+ பொருள் சேர்க்க',
    itemName:    'பொருளின் பெயர்',
    category:    'வகை',
    sellingPrice:'விற்பனை விலை',
    costPrice:   'செலவு விலை',
    gstRate:     'GST விகிதம்',
    stock:       'சரக்கு',
    reorderLevel:'மீண்டும் ஆர்டர் அளவு',
    unit:        'அலகு',
    edit:        'திருத்து',
    delete:      'நீக்கு',
    lowStock:    'குறைந்த சரக்கு',
    // Common
    save:        'சேமி',
    cancel:      'ரத்து செய்',
    loading:     'ஏற்றுகிறது…',
    search:      'தேடு…',
    date:        'தேதி',
    amount:      'தொகை',
    status:      'நிலை',
    actions:     'செயல்கள்',
    noData:      'தரவு இல்லை',
    branch:      'கிளை',
    allBranches: 'அனைத்து கிளைகளும்',
  },

  hi: {
    // Navigation
    dashboard:   'डैशबोर्ड',
    pos:         'बिक्री',
    salesHistory:'बिक्री इतिहास',
    inventory:   'सूची',
    customers:   'ग्राहक',
    purchases:   'खरीद',
    expenses:    'खर्च',
    reports:     'रिपोर्ट',
    gstFiling:   'GST दाखिल',
    aiAssistant: 'AI सहायक',
    team:        'टीम',
    billing:     'बिलिंग',
    settings:    'सेटिंग्स',
    signOut:     'साइन आउट',
    // POS
    searchItems: 'आइटम खोजें…',
    customer:    'ग्राहक',
    walkIn:      'वॉक-इन',
    cart:        'कार्ट',
    cartEmpty:   'कार्ट खाली है\nआइटम जोड़ने के लिए क्लिक करें',
    discount:    'छूट %',
    subtotal:    'उप-योग',
    gst:         'GST',
    total:       'कुल',
    checkout:    'चेकआउट',
    clear:       'साफ करें',
    cash:        '💵 नकद',
    upi:         '📱 UPI',
    card:        '💳 कार्ड',
    credit:      '📒 उधार',
    saleComplete:'बिक्री पूर्ण!',
    newSale:     'नई बिक्री',
    downloadPDF: '📄 PDF डाउनलोड',
    whatsapp:    '💬 व्हाट्सएप',
    // Inventory
    addItem:     '+ आइटम जोड़ें',
    itemName:    'आइटम का नाम',
    category:    'श्रेणी',
    sellingPrice:'बिक्री मूल्य',
    costPrice:   'लागत मूल्य',
    gstRate:     'GST दर',
    stock:       'स्टॉक',
    reorderLevel:'रीऑर्डर स्तर',
    unit:        'इकाई',
    edit:        'संपादित करें',
    delete:      'हटाएं',
    lowStock:    'कम स्टॉक',
    // Common
    save:        'सहेजें',
    cancel:      'रद्द करें',
    loading:     'लोड हो रहा है…',
    search:      'खोजें…',
    date:        'तारीख',
    amount:      'राशि',
    status:      'स्थिति',
    actions:     'क्रियाएं',
    noData:      'कोई डेटा नहीं',
    branch:      'शाखा',
    allBranches: 'सभी शाखाएं',
  },
};

// ── Language storage ──────────────────────────────────────────
export function getStoredLang() {
  return localStorage.getItem('elite_lang') || 'en';
}

export function setStoredLang(code) {
  localStorage.setItem('elite_lang', code);
}

// ── Translation function ───────────────────────────────────────
export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// ── Hook for language ─────────────────────────────────────────
import { useState, useEffect } from 'react';

export function useLang() {
  const [lang, setLangState] = useState(getStoredLang);

  function setLang(code) {
    setLangState(code);
    setStoredLang(code);
  }

  const tr = (key) => t(key, lang);

  return { lang, setLang, tr, languages: LANGUAGES };
}
