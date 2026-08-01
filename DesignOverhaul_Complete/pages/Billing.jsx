import { useState } from 'react';

const T = {
  bg:'#060710', srf:'#0b0d1a', card:'#0f1220', card2:'#141828',
  bdr:'#1a1e32', bdr2:'#222740',
  blue:'#4f7cff', green:'#00d68f', red:'#ff4d6a', amber:'#ffb547',
  purple:'#9b72ff', teal:'#00c9b1', orange:'#ff7043', gold:'#ffc107',
  cyan:'#00d4ff', pink:'#f06292',
  muted:'#4a5175', dim:'#2a3050', card3:'#181d2e',
  ink:'#eef0f8', sub:'#8892b0'
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    cycle: 'Free forever',
    color: T.muted,
    features: ['100 invoices/month', 'Basic GST billing', '1 user', 'Local storage only'],
    limits: ['No cloud sync', 'No team members', 'No WhatsApp', 'No PDF export'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 499,
    cycle: '₹499/month or ₹4,999/year',
    color: T.blue,
    highlight: true,
    features: ['Unlimited invoices', '3 users + cloud sync', 'GST PDF invoices', 'WhatsApp sharing', 'GSTR-1/3B reports', 'All modules', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1499,
    cycle: '₹1,499/month or ₹14,999/year',
    color: T.purple,
    features: ['Unlimited users', 'Multi-branch', 'White-label option', 'REST API access', 'Custom reports', 'Dedicated support'],
  },
];

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function Billing({ tenant, user }) {
  const [loading, setLoading] = useState('');
  const [annual,  setAnnual]  = useState(false);
  const current = tenant?.plan || 'starter';

  async function handleUpgrade(plan) {
    if (plan.id === 'starter' || plan.id === current) return;
    const RZP_KEY = import.meta.env.VITE_RZP_KEY_ID;
    if (!RZP_KEY) {
      alert('Razorpay key not configured.\n\nTo enable payments:\n1. Sign up at razorpay.com\n2. Get your Key ID\n3. Add VITE_RZP_KEY_ID to Vercel environment variables\n4. Redeploy');
      return;
    }

    setLoading(plan.id);
    const loaded = await loadRazorpay();
    if (!loaded) { alert('Could not load payment gateway. Check internet.'); setLoading(''); return; }

    const amount = (annual ? plan.price * 10 : plan.price) * 100; // in paise
    const rzp = new window.Razorpay({
      key: RZP_KEY,
      amount,
      currency: 'INR',
      name: 'Elite Store SaaS',
      description: `${plan.name} Plan - ${annual ? 'Annual' : 'Monthly'}`,
      prefill: { email: user?.email || '', contact: tenant?.phone || '' },
      notes: { tenant_id: tenant?.id, plan: plan.id, billing: annual ? 'annual' : 'monthly' },
      theme: { color: T.blue },
      handler: function(response) {
        alert(`✅ Payment successful!\nPayment ID: ${response.razorpay_payment_id}\n\nYour plan will be upgraded shortly. Contact support if not updated in 5 minutes.`);
      },
    });
    rzp.open();
    setLoading('');
  }

  return (
    <div style={{ padding:20, maxWidth:900 }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22, fontWeight:800, color:T.ink, marginBottom:6 }}>Billing & Plans</div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:13, color:T.sub }}>Current plan:</div>
          <span style={{ background:T.blue+'22', color:T.blue, borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700, textTransform:'capitalize' }}>{current}</span>
          {tenant?.plan_status === 'trial' && (
            <span style={{ background:T.amber+'22', color:T.amber, borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
              Trial · {Math.max(0, Math.ceil((new Date(tenant.trial_ends_at||Date.now()) - new Date()) / 86400000))} days left
            </span>
          )}
        </div>
      </div>

      {/* Annual toggle */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <span style={{ fontSize:13, color:T.sub }}>Monthly</span>
        <div onClick={() => setAnnual(a => !a)} style={{
          width:44, height:24, borderRadius:12, background:annual?T.green:T.bdr, cursor:'pointer', position:'relative', transition:'background .2s'
        }}>
          <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:annual?23:3, transition:'left .2s' }} />
        </div>
        <span style={{ fontSize:13, color:T.sub }}>Annual</span>
        {annual && <span style={{ background:T.green+'22', color:T.green, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>Save 2 months!</span>}
      </div>

      {/* Plan cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === current;
          const price     = annual && plan.price > 0 ? Math.round(plan.price * 10 / 12) : plan.price;
          return (
            <div key={plan.id} style={{
              background: plan.highlight ? plan.color+'10' : T.srf,
              border: `1px solid ${isCurrent ? T.green : plan.highlight ? plan.color : T.bdr}`,
              borderRadius:14, padding:24, position:'relative',
            }}>
              {plan.highlight && !isCurrent && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.color, color:'#fff', fontSize:10, fontWeight:700, padding:'3px 12px', borderRadius:20 }}>
                  ⭐ MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:T.green, color:'#fff', fontSize:10, fontWeight:700, padding:'3px 12px', borderRadius:20 }}>
                  ✓ CURRENT PLAN
                </div>
              )}

              <div style={{ fontSize:12, fontWeight:700, color:plan.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>{plan.name}</div>
              <div style={{ fontSize:plan.price===0?36:30, fontWeight:800, color:T.ink, marginBottom:4 }}>
                {plan.price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`}
                {plan.price > 0 && <span style={{ fontSize:14, color:T.muted }}>/month</span>}
              </div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:20 }}>{plan.cycle}</div>

              <div style={{ height:1, background:T.bdr, marginBottom:16 }} />

              {plan.features?.map(f => (
                <div key={f} style={{ display:'flex', gap:8, marginBottom:7 }}>
                  <span style={{ color:T.green, fontWeight:700, flexShrink:0 }}>✓</span>
                  <span style={{ fontSize:12.5, color:T.ink }}>{f}</span>
                </div>
              ))}
              {plan.limits?.map(f => (
                <div key={f} style={{ display:'flex', gap:8, marginBottom:7 }}>
                  <span style={{ color:T.muted, flexShrink:0 }}>✕</span>
                  <span style={{ fontSize:12, color:T.muted }}>{f}</span>
                </div>
              ))}

              <button onClick={() => handleUpgrade(plan)} disabled={isCurrent || loading === plan.id || plan.id === 'starter'}
                style={{
                  marginTop:20, width:'100%',
                  background: isCurrent ? T.green+'22' : plan.id==='starter' ? T.bdr : plan.highlight ? plan.color : T.bdr,
                  color: isCurrent ? T.green : plan.id==='starter' ? T.muted : plan.highlight ? '#fff' : T.ink,
                  border:'none', borderRadius:9, padding:'12px', fontSize:13, fontWeight:700,
                  cursor: isCurrent || plan.id==='starter' ? 'default' : 'pointer', fontFamily:'inherit',
                }}>
                {loading===plan.id ? 'Opening…' : isCurrent ? 'Current Plan' : plan.id==='starter' ? 'Free Plan' : `Upgrade to ${plan.name} →`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment info */}
      <div style={{ background:T.srf, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, color:T.ink, marginBottom:12 }}>💳 Payment Information</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, fontSize:13, color:T.sub, lineHeight:1.7 }}>
          <div>
            <div>✅ Payments secured by <strong style={{ color:T.ink }}>Razorpay</strong></div>
            <div>✅ UPI, Cards, Net Banking accepted</div>
            <div>✅ Auto-renewal with email reminder</div>
            <div>✅ GST invoice for every payment</div>
          </div>
          <div>
            <div>📧 Billing support: support@elitestore.in</div>
            <div>🔄 Cancel anytime — no lock-in</div>
            <div>📱 Works on mobile and desktop</div>
            <div>🇮🇳 Made for Indian businesses</div>
          </div>
        </div>
      </div>
    </div>
  );
}
