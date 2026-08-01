import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Branches      from './Branches';
import CashRegister  from './CashRegister';
import ShiftHandover from './ShiftHandover';
import EODReport     from './EODReport';
import ServiceBays   from './ServiceBays';
import Repairs       from './Repairs';
import QualityControl from './QualityControl';
import MultiStoreAnalytics from './MultiStoreAnalytics';
import Subscriptions from './Subscriptions';
import ReorderManagement from './ReorderManagement';
import DemandForecast from './DemandForecast';

const TABS = [
  { id:'branches',  label:'Branches',       icon:'🏪' },
  { id:'cash',      label:'Cash Register',  icon:'🖨️' },
  { id:'handover',  label:'Shift Handover', icon:'🔄' },
  { id:'eod',       label:'EOD Report',     icon:'🌙' },
  { id:'service',   label:'Service Bays',   icon:'🔧' },
  { id:'repairs',   label:'Repairs',        icon:'🔨' },
  { id:'qc',        label:'Quality Control',icon:'✅' },
  { id:'reorder',   label:'Reorder Mgmt',   icon:'🔄' },
  { id:'forecast',  label:'Demand Forecast',icon:'🔮' },
  { id:'multistore',label:'Multi-Store',    icon:'🏬' },
  { id:'subs',      label:'Subscriptions',  icon:'🔁' },
];

export default function OpsHub({ tenant, deepTab }) {
  const [tab, setTab] = useState('branches');
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Operations" subtitle="Branches, cash, EOD, repairs, quality and reordering" icon="🏪"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='branches'   && <Branches           tenant={tenant}/>}
        {tab==='cash'       && <CashRegister       tenant={tenant}/>}
        {tab==='handover'   && <ShiftHandover      tenant={tenant}/>}
        {tab==='eod'        && <EODReport          tenant={tenant}/>}
        {tab==='service'    && <ServiceBays        tenant={tenant}/>}
        {tab==='repairs'    && <Repairs            tenant={tenant}/>}
        {tab==='qc'         && <QualityControl     tenant={tenant}/>}
        {tab==='reorder'    && <ReorderManagement  tenant={tenant}/>}
        {tab==='forecast'   && <DemandForecast     tenant={tenant}/>}
        {tab==='multistore' && <MultiStoreAnalytics tenant={tenant}/>}
        {tab==='subs'       && <Subscriptions      tenant={tenant}/>}
      </div>
    </div>
  );
}
