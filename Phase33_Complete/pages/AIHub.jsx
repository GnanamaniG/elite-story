import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import AIAssistant from './AIAssistant';
import AIAnalytics from './AIAnalytics';

const TABS = [
  { id:'assistant', label:'AI Assistant',  icon:'🤖' },
  { id:'analytics', label:'AI Analytics',  icon:'📊' },
];

export default function AIHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('assistant');
  const visibleTabs = filterTabs(TABS, role, 'aihub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="AI Tools" subtitle="AI-powered assistant and business analytics" icon="🤖"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='assistant' && <AIAssistant tenant={tenant}/>}
        {tab==='analytics' && <AIAnalytics tenant={tenant}/>}
      </div>
    </div>
  );
}
