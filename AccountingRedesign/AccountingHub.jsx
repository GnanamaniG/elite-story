import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import AccountingDashboard from './AccountingDashboard';
import ProfitAndLoss       from './ProfitAndLoss';
import Accounting          from './Accounting';
import DailyCashBook       from './DailyCashBook';
import CashFlowForecast    from './CashFlowForecast';
import BudgetTracker       from './BudgetTracker';
import ExpenseClaims       from './ExpenseClaims';
import PartnershipAccounts from './PartnershipAccounts';

const TABS = [
  { id:'overview',    label:'Overview',         icon:'💰' },
  { id:'pl',          label:'Profit & Loss',    icon:'📊' },
  { id:'accounts',    label:'Balance Sheet',    icon:'📒' },
  { id:'cashbook',    label:'Daily Cash Book',  icon:'📔' },
  { id:'cashflow',    label:'Cash Flow',        icon:'💹' },
  { id:'budget',      label:'Budget',           icon:'📈' },
  { id:'claims',      label:'Expense Claims',   icon:'🧾' },
  { id:'partnership', label:'Partnership',      icon:'🤝' },
];

export default function AccountingHub({ tenant, deepTab, role = 'owner', onNavigate }) {
  const [tab, setTab] = useState('overview');
  const visibleTabs = filterTabs(TABS, role, 'accountinghub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Accounting" subtitle="P&L, cash book, cash flow and budgets" icon="📒"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='overview'    && <AccountingDashboard tenant={tenant} role={role} onSwitchTab={setTab} onNavigate={onNavigate}/>}
        {tab==='pl'          && <ProfitAndLoss       tenant={tenant}/>}
        {tab==='accounts'    && <Accounting          tenant={tenant}/>}
        {tab==='cashbook'    && <DailyCashBook       tenant={tenant}/>}
        {tab==='cashflow'    && <CashFlowForecast    tenant={tenant}/>}
        {tab==='budget'      && <BudgetTracker       tenant={tenant}/>}
        {tab==='claims'      && <ExpenseClaims       tenant={tenant}/>}
        {tab==='partnership' && <PartnershipAccounts tenant={tenant}/>}
      </div>
    </div>
  );
}
