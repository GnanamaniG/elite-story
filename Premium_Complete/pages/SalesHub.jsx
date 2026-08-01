import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Sales         from './Sales';
import Returns       from './Returns';
import Quotations    from './Quotations';
import CreditNotes   from './CreditNotes';
import CustomerStatements from './CustomerStatements';

const TABS = [
  { id:'history',    label:'Sales History',        icon:'📄' },
  { id:'returns',    label:'Returns',              icon:'🔄' },
  { id:'quotations', label:'Quotations',           icon:'📋' },
  { id:'creditnotes',label:'Credit Notes',         icon:'📝' },
  { id:'statements', label:'Customer Statements',  icon:'📊' },
];

export default function SalesHub({ tenant }) {
  const [tab, setTab] = useState('history');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Sales" subtitle="History, returns, quotations and credit notes" icon="📄"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='history'     && <Sales              tenant={tenant}/>}
        {tab==='returns'     && <Returns            tenant={tenant}/>}
        {tab==='quotations'  && <Quotations         tenant={tenant}/>}
        {tab==='creditnotes' && <CreditNotes        tenant={tenant}/>}
        {tab==='statements'  && <CustomerStatements tenant={tenant}/>}
      </div>
    </div>
  );
}
