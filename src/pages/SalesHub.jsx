import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Sales              from './Sales';
import B2BOrders          from './B2BOrders';
import Returns            from './Returns';
import Quotations         from './Quotations';
import DeliveryManagement from './DeliveryManagement';
import WarrantyTracker    from './WarrantyTracker';
import PaymentLinks       from './PaymentLinks';
import CreditNotes        from './CreditNotes';
import CustomerStatements from './CustomerStatements';

const TABS = [
  { id:'history',    label:'Sales History', icon:'📄' },
  { id:'b2b',        label:'B2B / Wholesale',icon:'🏢' },
  { id:'quotations', label:'Quotations',    icon:'📋' },
  { id:'delivery',   label:'Delivery',      icon:'🚚' },
  { id:'warranty',   label:'Warranty',      icon:'🛡️' },
  { id:'paylinks',   label:'Payment Links', icon:'💸' },
  { id:'returns',    label:'Returns',       icon:'🔄' },
  { id:'creditnotes',label:'Credit Notes',  icon:'📝' },
  { id:'statements', label:'Statements',    icon:'📊' },
];

export default function SalesHub({ tenant, deepTab }) {
  const [tab, setTab] = useState('history');
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Sales" subtitle="Retail, wholesale, delivery, warranty and collections" icon="📄"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='history'     && <Sales              tenant={tenant}/>}
        {tab==='b2b'         && <B2BOrders          tenant={tenant}/>}
        {tab==='quotations'  && <Quotations         tenant={tenant}/>}
        {tab==='delivery'    && <DeliveryManagement tenant={tenant}/>}
        {tab==='warranty'    && <WarrantyTracker    tenant={tenant}/>}
        {tab==='paylinks'    && <PaymentLinks       tenant={tenant}/>}
        {tab==='returns'     && <Returns            tenant={tenant}/>}
        {tab==='creditnotes' && <CreditNotes        tenant={tenant}/>}
        {tab==='statements'  && <CustomerStatements tenant={tenant}/>}
      </div>
    </div>
  );
}
