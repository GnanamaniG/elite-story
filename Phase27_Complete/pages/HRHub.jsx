import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Attendance     from './Attendance';
import Payroll        from './Payroll';
import LeaveManagement from './LeaveManagement';
import HRDashboard    from './HRDashboard';
import StaffPerformance from './StaffPerformance';
import Commissions    from './Commissions';
import StaffScheduler from './StaffScheduler';
import Appointments   from './Appointments';

const TABS = [
  { id:'attendance', label:'Attendance',        icon:'📅' },
  { id:'payroll',    label:'Payroll',           icon:'💰' },
  { id:'leave',      label:'Leave Management',  icon:'🗓️' },
  { id:'dashboard',  label:'HR Dashboard',      icon:'👥' },
  { id:'performance',label:'Performance',       icon:'🏆' },
  { id:'commissions',label:'Commissions',       icon:'🎯' },
  { id:'scheduler',  label:'Staff Scheduler',   icon:'📆' },
  { id:'appointments',label:'Appointments',     icon:'📍' },
];

export default function HRHub({ tenant }) {
  const [tab, setTab] = useState('attendance');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="HR & Payroll" subtitle="Attendance, payroll, leave, performance and scheduling" icon="👷"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='attendance'   && <Attendance      tenant={tenant}/>}
        {tab==='payroll'      && <Payroll         tenant={tenant}/>}
        {tab==='leave'        && <LeaveManagement tenant={tenant}/>}
        {tab==='dashboard'    && <HRDashboard     tenant={tenant}/>}
        {tab==='performance'  && <StaffPerformance tenant={tenant}/>}
        {tab==='commissions'  && <Commissions     tenant={tenant}/>}
        {tab==='scheduler'    && <StaffScheduler  tenant={tenant}/>}
        {tab==='appointments' && <Appointments    tenant={tenant}/>}
      </div>
    </div>
  );
}
