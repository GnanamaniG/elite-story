import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import Branches      from './Branches';
import CashRegister  from './CashRegister';
import ShiftHandover from './ShiftHandover';
import EODReport     from './EODReport';
import ServiceBays   from './ServiceBays';
import QualityControl from './QualityControl';
import ReorderManagement from './ReorderManagement';

const TABS = [
  { id:'branches',  label:'Branches',       icon:'🏪' },
  { id:'cash',      label:'Cash Register',  icon:'🖨️' },
  { id:'handover',  label:'Shift Handover', icon:'🔄' },
  { id:'eod',       label:'EOD Report',     icon:'🌙' },
  { id:'service',   label:'Service Bays',   icon:'🔧' },
  { id:'qc',        label:'Quality Control',icon:'✅' },
  { id:'reorder',   label:'Reorder Mgmt',   icon:'🔄' },
];

export default function OpsHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('branches');
  const visibleTabs = filterTabs(TABS, role, 'opshub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Operations" subtitle="Branches, cash, EOD, repairs, quality and reordering" icon="🏪"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='branches'   && <Branches           tenant={tenant}/>}
        {tab==='cash'       && <CashRegister       tenant={tenant}/>}
        {tab==='handover'   && <ShiftHandover      tenant={tenant}/>}
        {tab==='eod'        && <EODReport          tenant={tenant}/>}
        {tab==='service'    && <ServiceBays        tenant={tenant}/>}
        {tab==='qc'         && <QualityControl     tenant={tenant}/>}
        {tab==='reorder'    && <ReorderManagement  tenant={tenant}/>}
      </div>
    </div>
  );
}
