import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Accounting       from './Accounting';
import CashFlowForecast from './CashFlowForecast';
import BudgetTracker    from './BudgetTracker';
import ExpenseClaims    from './ExpenseClaims';
import PartnershipAccounts from './PartnershipAccounts';

const TABS = [
  { id:'accounts',     label:'P&L / Balance Sheet', icon:'📒' },
  { id:'cashflow',     label:'Cash Flow',            icon:'💹' },
  { id:'budget',       label:'Budget',               icon:'📊' },
  { id:'claims',       label:'Expense Claims',       icon:'🧾' },
  { id:'partnership',  label:'Partnership Accounts', icon:'🤝' },
];

export default function AccountingHub({ tenant }) {
  const [tab, setTab] = useState('accounts');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Accounting" subtitle="P&L, balance sheet, cash flow and budget management" icon="📒"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='accounts'    && <Accounting          tenant={tenant}/>}
        {tab==='cashflow'    && <CashFlowForecast    tenant={tenant}/>}
        {tab==='budget'      && <BudgetTracker       tenant={tenant}/>}
        {tab==='claims'      && <ExpenseClaims       tenant={tenant}/>}
        {tab==='partnership' && <PartnershipAccounts tenant={tenant}/>}
      </div>
    </div>
  );
}
