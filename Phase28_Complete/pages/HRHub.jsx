import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Attendance        from './Attendance';
import StaffAttendanceQR from './StaffAttendanceQR';
import Payroll           from './Payroll';
import LeaveManagement   from './LeaveManagement';
import HRDashboard       from './HRDashboard';
import StaffPerformance  from './StaffPerformance';
import Commissions       from './Commissions';
import StaffScheduler    from './StaffScheduler';
import StaffTaskBoard    from './StaffTaskBoard';
import SalesTargets      from './SalesTargets';

const TABS = [
  { id:'qr',          label:'QR Attendance',  icon:'📲' },
  { id:'attendance',  label:'Attendance Log', icon:'📅' },
  { id:'payroll',     label:'Payroll',        icon:'💰' },
  { id:'leave',       label:'Leave',          icon:'🗓️' },
  { id:'tasks',       label:'Task Board',     icon:'📋' },
  { id:'targets',     label:'Sales Targets',  icon:'🎯' },
  { id:'performance', label:'Performance',    icon:'🏆' },
  { id:'commissions', label:'Commissions',    icon:'💵' },
  { id:'scheduler',   label:'Scheduler',      icon:'📆' },
  { id:'dashboard',   label:'HR Dashboard',   icon:'👥' },
];

export default function HRHub({ tenant }) {
  const [tab, setTab] = useState('qr');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="HR & Payroll" subtitle="Attendance, payroll, tasks, targets and performance" icon="👷"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='qr'          && <StaffAttendanceQR tenant={tenant}/>}
        {tab==='attendance'  && <Attendance        tenant={tenant}/>}
        {tab==='payroll'     && <Payroll           tenant={tenant}/>}
        {tab==='leave'       && <LeaveManagement   tenant={tenant}/>}
        {tab==='tasks'       && <StaffTaskBoard    tenant={tenant}/>}
        {tab==='targets'     && <SalesTargets      tenant={tenant}/>}
        {tab==='performance' && <StaffPerformance  tenant={tenant}/>}
        {tab==='commissions' && <Commissions       tenant={tenant}/>}
        {tab==='scheduler'   && <StaffScheduler    tenant={tenant}/>}
        {tab==='dashboard'   && <HRDashboard       tenant={tenant}/>}
      </div>
    </div>
  );
}
