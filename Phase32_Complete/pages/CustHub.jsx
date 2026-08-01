import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Customers         from './Customers';
import CustomerSegments  from './CustomerSegments';
import RFMAnalysis       from './RFMAnalysis';
import CustomerVisitLog  from './CustomerVisitLog';
import CreditLedger      from './CreditLedger';
import CustomerLedgerAging from './CustomerLedgerAging';
import PaymentReminders  from './PaymentReminders';
import WinBackCampaigns  from './WinBackCampaigns';
import RecurringOrders   from './RecurringOrders';
import ProductReviews    from './ProductReviews';
import CustomerPortal    from './CustomerPortal';
import Feedback          from './Feedback';

const TABS = [
  { id:'list',      label:'Customers',       icon:'👥' },
  { id:'visits',    label:'Visit Log',       icon:'🚶' },
  { id:'segments',  label:'Segments',        icon:'🎯' },
  { id:'rfm',       label:'RFM Analysis',    icon:'📐' },
  { id:'credit',    label:'Credit Ledger',   icon:'📒' },
  { id:'aging',     label:'Ledger & Aging',  icon:'📊' },
  { id:'reminders', label:'Payment Reminders',icon:'💰' },
  { id:'winback',   label:'Win-Back',        icon:'🔄' },
  { id:'recurring', label:'Recurring Orders',icon:'🔁' },
  { id:'reviews',   label:'Reviews',         icon:'⭐' },
  { id:'portal',    label:'Portal',          icon:'🌐' },
  { id:'feedback',  label:'Feedback',        icon:'💬' },
];

export default function CustHub({ tenant, deepTab }) {
  const [tab, setTab] = useState('list');
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Customers" subtitle="Customers, credit, retention and reviews" icon="👥"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='list'      && <Customers        tenant={tenant}/>}
        {tab==='visits'    && <CustomerVisitLog  tenant={tenant}/>}
        {tab==='segments'  && <CustomerSegments tenant={tenant}/>}
        {tab==='rfm'       && <RFMAnalysis       tenant={tenant}/>}
        {tab==='credit'    && <CreditLedger     tenant={tenant}/>}
        {tab==='aging'     && <CustomerLedgerAging tenant={tenant}/>}
        {tab==='reminders' && <PaymentReminders tenant={tenant}/>}
        {tab==='winback'   && <WinBackCampaigns tenant={tenant}/>}
        {tab==='recurring' && <RecurringOrders  tenant={tenant}/>}
        {tab==='reviews'   && <ProductReviews   tenant={tenant}/>}
        {tab==='portal'    && <CustomerPortal   tenant={tenant}/>}
        {tab==='feedback'  && <Feedback         tenant={tenant}/>}
      </div>
    </div>
  );
}
