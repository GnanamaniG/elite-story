import { useState } from 'react';
import { HubTabs, HubHeader } from './_HubShell';
import Documents     from './Documents';
import BackupRestore from './BackupRestore';
import TallyExport   from './TallyExport';
import AuditLog      from './AuditLog';
import UsersAccess   from './UsersAccess';
import Notifications from './Notifications';
import AutoReports   from './AutoReports';
import AdvancedReports from './AdvancedReports';

const TABS = [
  { id:'users',    label:'Users & Access', icon:'🔐' },
  { id:'docs',     label:'Documents',      icon:'📂' },
  { id:'backup',   label:'Backup',         icon:'💾' },
  { id:'tally',    label:'Tally Export',   icon:'📊' },
  { id:'audit',    label:'Audit Trail',    icon:'🔍' },
  { id:'alerts',   label:'Notifications',  icon:'🔔' },
  { id:'auto',     label:'Auto Reports',   icon:'📧' },
  { id:'adv',      label:'Adv. Reports',   icon:'📈' },
];

export default function ToolsHub({ tenant }) {
  const [tab, setTab] = useState('users');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Tools & Admin" subtitle="Users, documents, backup, audit and reports" icon="🔧"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='users'  && <UsersAccess    tenant={tenant}/>}
        {tab==='docs'   && <Documents      tenant={tenant}/>}
        {tab==='backup' && <BackupRestore  tenant={tenant}/>}
        {tab==='tally'  && <TallyExport    tenant={tenant}/>}
        {tab==='audit'  && <AuditLog       tenant={tenant}/>}
        {tab==='alerts' && <Notifications  tenant={tenant}/>}
        {tab==='auto'   && <AutoReports    tenant={tenant}/>}
        {tab==='adv'    && <AdvancedReports tenant={tenant}/>}
      </div>
    </div>
  );
}
