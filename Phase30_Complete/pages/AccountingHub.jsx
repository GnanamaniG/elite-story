import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import ProfitAndLoss       from './ProfitAndLoss';
import Accounting          from './Accounting';
import DailyCashBook       from './DailyCashBook';
import CashFlowForecast    from './CashFlowForecast';
import BudgetTracker       from './BudgetTracker';
import ExpenseClaims       from './ExpenseClaims';
import PartnershipAccounts from './PartnershipAccounts';

const TABS = [
  { id:'pl',          label:'Profit & Loss',    icon:'📊' },
  { id:'accounts',    label:'Balance Sheet',    icon:'📒' },
  { id:'cashbook',    label:'Daily Cash Book',  icon:'📔' },
  { id:'cashflow',    label:'Cash Flow',        icon:'💹' },
  { id:'budget',      label:'Budget',           icon:'📈' },
  { id:'claims',      label:'Expense Claims',   icon:'🧾' },
  { id:'partnership', label:'Partnership',      icon:'🤝' },
];

export default function AccountingHub({ tenant }) {
  const [tab, setTab] = useState('pl');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Accounting" subtitle="P&L, cash book, cash flow and budgets" icon="📒"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
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
