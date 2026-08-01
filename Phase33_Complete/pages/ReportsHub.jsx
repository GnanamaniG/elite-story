import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import BusinessHealthScore from './BusinessHealthScore';
import Reports             from './Reports';
import ProductPerformance  from './ProductPerformance';
import SalesHeatmap        from './SalesHeatmap';
import WhatsAppDailyReport from './WhatsAppDailyReport';
import AdvancedReports     from './AdvancedReports';
import AutoReports         from './AutoReports';
import MultiStoreAnalytics from './MultiStoreAnalytics';
import AIAnalytics         from './AIAnalytics';

const TABS = [
  { id:'health',      label:'Business Health',   icon:'💚' },
  { id:'reports',     label:'Sales Reports',     icon:'📊' },
  { id:'performance', label:'Product Performance',icon:'📈' },
  { id:'patterns',    label:'Sales Patterns',     icon:'🔥' },
  { id:'wareport',    label:'WA Daily Report',   icon:'📱' },
  { id:'advanced',    label:'Advanced',          icon:'🔬' },
  { id:'auto',        label:'Auto Reports',      icon:'📧' },
  { id:'multistore',  label:'Multi-Store',       icon:'🏬' },
  { id:'ai',          label:'AI Analytics',      icon:'🤖' },
];

export default function ReportsHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('health');
  const visibleTabs = filterTabs(TABS, role, 'reportshub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Reports & Analytics" subtitle="Business health, performance and insights" icon="📊"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='health'      && <BusinessHealthScore tenant={tenant}/>}
        {tab==='reports'     && <Reports             tenant={tenant}/>}
        {tab==='performance' && <ProductPerformance  tenant={tenant}/>}
        {tab==='patterns'    && <SalesHeatmap        tenant={tenant}/>}
        {tab==='wareport'    && <WhatsAppDailyReport tenant={tenant}/>}
        {tab==='advanced'    && <AdvancedReports     tenant={tenant}/>}
        {tab==='auto'        && <AutoReports         tenant={tenant}/>}
        {tab==='multistore'  && <MultiStoreAnalytics tenant={tenant}/>}
        {tab==='ai'          && <AIAnalytics         tenant={tenant}/>}
      </div>
    </div>
  );
}
