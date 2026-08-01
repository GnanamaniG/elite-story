import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import Purchases             from './Purchases';
import PurchaseOrders        from './PurchaseOrders';
import GoodsReceiptNote      from './GoodsReceiptNote';
import BillScanner           from './BillScanner';
import PurchaseRequisitions  from './PurchaseRequisitions';
import Suppliers             from './Suppliers';
import SupplierPayments      from './SupplierPayments';
import SupplierScorecard     from './SupplierScorecard';
import SupplierRFQ           from './SupplierRFQ';
import PurchaseReturns       from './PurchaseReturns';
import DemandForecast        from './DemandForecast';

const TABS = [
  { id:'history',    label:'Purchase History', icon:'📄' },
  { id:'orders',     label:'Purchase Orders',  icon:'📋' },
  { id:'scan',       label:'Bill Scanner',     icon:'📸' },
  { id:'grn',        label:'Goods Receipt',    icon:'📥' },
  { id:'requisitions',label:'Requisitions',    icon:'📝' },
  { id:'suppliers',  label:'Suppliers',        icon:'🏭' },
  { id:'payments',   label:'Payments',         icon:'🏦' },
  { id:'scorecard',  label:'Scorecard',        icon:'🏅' },
  { id:'rfq',        label:'RFQ',              icon:'📨' },
  { id:'returns',    label:'Returns',          icon:'↩️' },
  { id:'forecast',   label:'Demand Forecast',  icon:'🔮' },
];

export default function PurchHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('history');
  const visibleTabs = filterTabs(TABS, role, 'purchhub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Purchases" subtitle="Orders, suppliers, payables and performance" icon="🛒"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='history'     && <Purchases            tenant={tenant}/>}
        {tab==='orders'      && <PurchaseOrders       tenant={tenant}/>}
        {tab==='scan'        && <BillScanner          tenant={tenant}/>}
        {tab==='grn'         && <GoodsReceiptNote     tenant={tenant}/>}
        {tab==='requisitions'&& <PurchaseRequisitions tenant={tenant}/>}
        {tab==='suppliers'   && <Suppliers            tenant={tenant}/>}
        {tab==='payments'    && <SupplierPayments     tenant={tenant}/>}
        {tab==='scorecard'   && <SupplierScorecard    tenant={tenant}/>}
        {tab==='rfq'         && <SupplierRFQ          tenant={tenant}/>}
        {tab==='returns'     && <PurchaseReturns      tenant={tenant}/>}
        {tab==='forecast'    && <DemandForecast       tenant={tenant}/>}
      </div>
    </div>
  );
}
