import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import Loyalty       from './Loyalty';
import LoyaltyTiers  from './LoyaltyTiers';
import GiftCards     from './GiftCards';
import CouponManager from './CouponManager';
import Referrals     from './Referrals';
import SalesPipeline from './SalesPipeline';
import Subscriptions from './Subscriptions';

const TABS = [
  { id:'points',   label:'Loyalty Points', icon:'🎁' },
  { id:'tiers',    label:'Tiers',          icon:'👑' },
  { id:'coupons',  label:'Coupons',        icon:'🏷️' },
  { id:'gifts',    label:'Gift Cards',     icon:'🎀' },
  { id:'referrals',label:'Referrals',      icon:'🔗' },
  { id:'pipeline', label:'Pipeline',       icon:'🎯' },
  { id:'subs',     label:'Subscriptions',  icon:'🔁' },
];

export default function LoyaltyHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('points');
  const visibleTabs = filterTabs(TABS, role, 'loyaltyhub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Loyalty & CRM" subtitle="Points, tiers, coupons, referrals and pipeline" icon="👑"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='points'   && <Loyalty       tenant={tenant}/>}
        {tab==='tiers'    && <LoyaltyTiers  tenant={tenant}/>}
        {tab==='coupons'  && <CouponManager tenant={tenant}/>}
        {tab==='gifts'    && <GiftCards     tenant={tenant}/>}
        {tab==='referrals'&& <Referrals     tenant={tenant}/>}
        {tab==='pipeline' && <SalesPipeline tenant={tenant}/>}
        {tab==='subs'     && <Subscriptions tenant={tenant}/>}
      </div>
    </div>
  );
}
