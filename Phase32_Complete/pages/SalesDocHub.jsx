import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Quotations    from './Quotations';
import EMIManager    from './EMIManager';
import EWayBill      from './EWayBill';
import EInvoice      from './EInvoice';
import CreditLedger  from './CreditLedger';

const TABS = [
  { id:'quotations', label:'Quotations',    icon:'📋' },
  { id:'emi',        label:'EMI / BNPL',   icon:'💳' },
  { id:'ewaybill',   label:'e-Way Bill',   icon:'🚚' },
  { id:'einvoice',   label:'E-Invoice',    icon:'🧾' },
  { id:'credit',     label:'Credit Ledger',icon:'📒' },
];

export default function SalesDocHub({ tenant, deepTab }) {
  const [tab, setTab] = useState('quotations');
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Sales Documents" subtitle="Quotations, EMI, e-Way Bill and e-Invoice" icon="📄"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='quotations' && <Quotations   tenant={tenant}/>}
        {tab==='emi'        && <EMIManager   tenant={tenant}/>}
        {tab==='ewaybill'   && <EWayBill     tenant={tenant}/>}
        {tab==='einvoice'   && <EInvoice     tenant={tenant}/>}
        {tab==='credit'     && <CreditLedger tenant={tenant}/>}
      </div>
    </div>
  );
}
