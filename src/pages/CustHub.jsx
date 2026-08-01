import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Customers        from './Customers';
import CustomerSegments from './CustomerSegments';
import CreditLedger     from './CreditLedger';
import CustomerPortal   from './CustomerPortal';
import Referrals        from './Referrals';
import SalesPipeline    from './SalesPipeline';
import Feedback         from './Feedback';

const TABS = [
  { id:'list',     label:'Customers',       icon:'👥' },
  { id:'segments', label:'Segments',        icon:'🎯' },
  { id:'credit',   label:'Credit Ledger',   icon:'📒' },
  { id:'referrals',label:'Referrals',       icon:'🔗' },
  { id:'pipeline', label:'Sales Pipeline',  icon:'🎯' },
  { id:'portal',   label:'Customer Portal', icon:'🌐' },
  { id:'feedback', label:'Feedback',        icon:'⭐' },
];

export default function CustHub({ tenant }) {
  const [tab, setTab] = useState('list');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Customers" subtitle="Manage customers, segments, credit and engagement" icon="👥"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='list'      && <Customers        tenant={tenant}/>}
        {tab==='segments'  && <CustomerSegments tenant={tenant}/>}
        {tab==='credit'    && <CreditLedger     tenant={tenant}/>}
        {tab==='referrals' && <Referrals        tenant={tenant}/>}
        {tab==='pipeline'  && <SalesPipeline    tenant={tenant}/>}
        {tab==='portal'    && <CustomerPortal   tenant={tenant}/>}
        {tab==='feedback'  && <Feedback         tenant={tenant}/>}
      </div>
    </div>
  );
}
