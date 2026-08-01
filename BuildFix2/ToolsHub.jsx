import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import SmartAlerts   from './SmartAlerts';
import UsersAccess   from './UsersAccess';
import Documents     from './Documents';
import DocumentExpiry from './DocumentExpiry';
import BackupRestore from './BackupRestore';
import TallyExport   from './TallyExport';
import AuditLog      from './AuditLog';
import Notifications from './Notifications';
import AIAssistant   from './AIAssistant';

const TABS = [
  { id:'alerts',   label:'Smart Alerts',  icon:'🔔' },
  { id:'ai',       label:'AI Assistant',  icon:'🤖' },
  { id:'users',    label:'Users & Access',icon:'🔐' },
  { id:'docexpiry',label:'Doc Expiry',    icon:'📜' },
  { id:'docs',     label:'Documents',     icon:'📂' },
  { id:'backup',   label:'Backup',        icon:'💾' },
  { id:'tally',    label:'Tally Export',  icon:'📊' },
  { id:'audit',    label:'Audit Trail',   icon:'🔍' },
  { id:'notify',   label:'Notifications', icon:'📬' },
];

export default function ToolsHub({ tenant, deepTab }) {
  const [tab, setTab] = useState('alerts');
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Tools & Admin" subtitle="Alerts, AI, users, backup and audit" icon="🔧"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='alerts' && <SmartAlerts   tenant={tenant}/>}
        {tab==='ai'     && <AIAssistant   tenant={tenant}/>}
        {tab==='users'  && <UsersAccess   tenant={tenant}/>}
        {tab==='docexpiry'&& <DocumentExpiry tenant={tenant}/>}
        {tab==='docs'   && <Documents     tenant={tenant}/>}
        {tab==='backup' && <BackupRestore tenant={tenant}/>}
        {tab==='tally'  && <TallyExport   tenant={tenant}/>}
        {tab==='audit'  && <AuditLog      tenant={tenant}/>}
        {tab==='notify' && <Notifications tenant={tenant}/>}
      </div>
    </div>
  );
}
