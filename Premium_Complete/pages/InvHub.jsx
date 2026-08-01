import { useState } from 'react';
import { HubTabs, HubHeader } from './_HubShell';
import Inventory    from './Inventory';
import Variants     from './Variants';
import PriceLists   from './PriceLists';
import StockAudit   from './StockAudit';
import BulkImport   from './BulkImport';
import BarcodeGenerator from './BarcodeGenerator';
import QRLabels     from './QRLabels';
import InventoryAging from './InventoryAging';

const TABS = [
  { id:'products',  label:'Products',        icon:'📦' },
  { id:'variants',  label:'Variants',        icon:'🎨' },
  { id:'prices',    label:'Price Lists',     icon:'🏷️' },
  { id:'audit',     label:'Stock Audit',     icon:'📋' },
  { id:'import',    label:'Bulk Import',     icon:'⬆️' },
  { id:'barcode',   label:'Barcode',         icon:'🔲' },
  { id:'qr',        label:'QR Labels',       icon:'📱' },
  { id:'aging',     label:'Inventory Aging', icon:'📉' },
];

export default function InvHub({ tenant }) {
  const [tab, setTab] = useState('products');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Inventory" subtitle="Products, variants, pricing, audit and labels" icon="📦"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='products' && <Inventory    tenant={tenant}/>}
        {tab==='variants' && <Variants     tenant={tenant}/>}
        {tab==='prices'   && <PriceLists   tenant={tenant}/>}
        {tab==='audit'    && <StockAudit   tenant={tenant}/>}
        {tab==='import'   && <BulkImport   tenant={tenant}/>}
        {tab==='barcode'  && <BarcodeGenerator tenant={tenant}/>}
        {tab==='qr'       && <QRLabels     tenant={tenant}/>}
        {tab==='aging'    && <InventoryAging tenant={tenant}/>}
      </div>
    </div>
  );
}
