import { useState } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import Loyalty        from './Loyalty';
import LoyaltyTiers   from './LoyaltyTiers';
import GiftCards      from './GiftCards';
import Referrals      from './Referrals';
import SalesPipeline  from './SalesPipeline';
import Feedback       from './Feedback';

const TABS = [
  { id:'points',   label:'Loyalty Points', icon:'🎁' },
  { id:'tiers',    label:'Loyalty Tiers',  icon:'👑' },
  { id:'gifts',    label:'Gift Cards',     icon:'🎀' },
  { id:'referrals',label:'Referrals',      icon:'🔗' },
  { id:'pipeline', label:'Sales Pipeline', icon:'🎯' },
  { id:'feedback', label:'Feedback',       icon:'⭐' },
];

export default function LoyaltyHub({ tenant }) {
  const [tab, setTab] = useState('points');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Loyalty & CRM" subtitle="Points, tiers, gift cards, referrals and pipeline" icon="👑"/>
      <HubTabs tabs={TABS} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='points'   && <Loyalty       tenant={tenant}/>}
        {tab==='tiers'    && <LoyaltyTiers  tenant={tenant}/>}
        {tab==='gifts'    && <GiftCards     tenant={tenant}/>}
        {tab==='referrals'&& <Referrals     tenant={tenant}/>}
        {tab==='pipeline' && <SalesPipeline tenant={tenant}/>}
        {tab==='feedback' && <Feedback      tenant={tenant}/>}
      </div>
    </div>
  );
}
