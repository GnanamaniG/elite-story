import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Purchases       from './Purchases';
import PurchaseOrders  from './PurchaseOrders';
import Suppliers       from './Suppliers';
import SupplierRFQ     from './SupplierRFQ';
import PurchaseReturns from './PurchaseReturns';

const TABS = [
  { id:'history', label:'Purchase History',  icon:'📄' },
  { id:'orders',  label:'Purchase Orders',   icon:'📋' },
  { id:'suppliers',label:'Suppliers',        icon:'🏭' },
  { id:'rfq',     label:'Supplier RFQ',      icon:'📨' },
  { id:'returns', label:'Purchase Returns',  icon:'↩️' },
];

export default function PurchHub({ tenant }) {
  const [tab, setTab] = useState('history');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Purchases" subtitle="History, orders, suppliers and returns" icon="🛒"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='history'   && <Purchases       tenant={tenant}/>}
        {tab==='orders'    && <PurchaseOrders  tenant={tenant}/>}
        {tab==='suppliers' && <Suppliers       tenant={tenant}/>}
        {tab==='rfq'       && <SupplierRFQ     tenant={tenant}/>}
        {tab==='returns'   && <PurchaseReturns tenant={tenant}/>}
      </div>
    </div>
  );
}
