import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import Inventory        from './Inventory';
import Variants         from './Variants';
import PriceLists       from './PriceLists';
import PriceHistory     from './PriceHistory';
import StockAudit       from './StockAudit';
import StockAdjustments from './StockAdjustments';
import BatchExpiryTracker from './BatchExpiryTracker';
import StockValuation   from './StockValuation';
import BulkImport       from './BulkImport';
import BarcodeGenerator from './BarcodeGenerator';
import QRLabels         from './QRLabels';
import InventoryAging   from './InventoryAging';
import ReorderManagement from './ReorderManagement';
import StockTransferOrders from './StockTransferOrders';

const TABS = [
  { id:'products',  label:'Products',       icon:'📦' },
  { id:'variants',  label:'Variants',       icon:'🎨' },
  { id:'prices',    label:'Price Lists',    icon:'🏷️' },
  { id:'history',   label:'Price History',  icon:'📉' },
  { id:'valuation', label:'Stock Valuation',icon:'🏦' },
  { id:'batches',   label:'Batch & Expiry', icon:'🏷️' },
  { id:'adjust',    label:'Adjustments',    icon:'📋' },
  { id:'audit',     label:'Stock Audit',    icon:'✅' },
  { id:'transfer',  label:'Transfers',      icon:'🔀' },
  { id:'reorder',   label:'Reorder',        icon:'🔄' },
  { id:'aging',     label:'Aging',          icon:'⏳' },
  { id:'import',    label:'Bulk Import',    icon:'⬆️' },
  { id:'barcode',   label:'Barcode',        icon:'🔲' },
  { id:'qr',        label:'QR Labels',      icon:'📱' },
];

export default function InvHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('products');
  const visibleTabs = filterTabs(TABS, role, 'invhub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Inventory" subtitle="Products, pricing, valuation, adjustments and labels" icon="📦"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='products'  && <Inventory        tenant={tenant}/>}
        {tab==='variants'  && <Variants         tenant={tenant}/>}
        {tab==='prices'    && <PriceLists       tenant={tenant}/>}
        {tab==='history'   && <PriceHistory     tenant={tenant}/>}
        {tab==='valuation' && <StockValuation   tenant={tenant}/>}
        {tab==='batches'   && <BatchExpiryTracker tenant={tenant}/>}
        {tab==='adjust'    && <StockAdjustments tenant={tenant}/>}
        {tab==='audit'     && <StockAudit       tenant={tenant}/>}
        {tab==='transfer'  && <StockTransferOrders tenant={tenant}/>}
        {tab==='reorder'   && <ReorderManagement tenant={tenant}/>}
        {tab==='aging'     && <InventoryAging   tenant={tenant}/>}
        {tab==='import'    && <BulkImport       tenant={tenant}/>}
        {tab==='barcode'   && <BarcodeGenerator tenant={tenant}/>}
        {tab==='qr'        && <QRLabels         tenant={tenant}/>}
      </div>
    </div>
  );
}
