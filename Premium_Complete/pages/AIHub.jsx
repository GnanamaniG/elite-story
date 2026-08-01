import { useState } from 'react';
import { HubTabs, HubHeader } from './_HubShell';
import AIAssistant from './AIAssistant';
import AIAnalytics from './AIAnalytics';

const TABS = [
  { id:'assistant', label:'AI Assistant',  icon:'🤖' },
  { id:'analytics', label:'AI Analytics',  icon:'📊' },
];

export default function AIHub({ tenant }) {
  const [tab, setTab] = useState('assistant');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="AI Tools" subtitle="AI-powered assistant and business analytics" icon="🤖"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='assistant' && <AIAssistant tenant={tenant}/>}
        {tab==='analytics' && <AIAnalytics tenant={tenant}/>}
      </div>
    </div>
  );
}
