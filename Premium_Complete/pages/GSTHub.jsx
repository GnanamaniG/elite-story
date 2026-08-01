import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import GSTFiling   from './GSTFiling';
import GSTR3B      from './GSTR3B';
import TDSManagement from './TDSManagement';
import EInvoice    from './EInvoice';
import EWayBill    from './EWayBill';

const TABS = [
  { id:'gstr1',  label:'GST Filing (GSTR-1)', icon:'📋' },
  { id:'gstr3b', label:'GSTR-3B & ITC',        icon:'📊' },
  { id:'tds',    label:'TDS Management',        icon:'🏦' },
  { id:'einv',   label:'E-Invoice',             icon:'🧾' },
  { id:'ewb',    label:'e-Way Bill',            icon:'🚚' },
];

export default function GSTHub({ tenant }) {
  const [tab, setTab] = useState('gstr1');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="GST & Tax" subtitle="Filing, ITC, TDS, e-Invoice and e-Way Bill" icon="📋"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='gstr1'  && <GSTFiling      tenant={tenant}/>}
        {tab==='gstr3b' && <GSTR3B         tenant={tenant}/>}
        {tab==='tds'    && <TDSManagement  tenant={tenant}/>}
        {tab==='einv'   && <EInvoice       tenant={tenant}/>}
        {tab==='ewb'    && <EWayBill        tenant={tenant}/>}
      </div>
    </div>
  );
}
