import { useState, useEffect } from 'react';
import { HubTabs, HubHeader } from './HubShell';
import { filterTabs } from '../lib/roleAccess';
import MarketingDashboard from './MarketingDashboard';
import CampaignBot        from './CampaignBot';
import MarketingIntegrations from './MarketingIntegrations';
import Campaigns      from './Campaigns';
import WhatsAppCatalog from './WhatsAppCatalog';
import WAOrderBot     from './WAOrderBot';
import WATemplates    from './WATemplates';
import SMSAlerts      from './SMSAlerts';
import PromoCodes     from './PromoCodes';
import Bundles        from './Bundles';
import OnlineStore    from './OnlineStore';
import ProductCatalog from './ProductCatalog';

const TABS = [
  { id:'overview',  label:'Overview',      icon:'📊' },
  { id:'campaigns', label:'Campaigns',     icon:'📣' },
  { id:'bot',       label:'Campaign Bot',   icon:'🤖' },
  { id:'integrations', label:'Integrations', icon:'🔌' },
  { id:'wa',        label:'WA Catalog',    icon:'💬' },
  { id:'wabot',     label:'WA Order Bot',  icon:'🤖' },
  { id:'watpl',     label:'WA Templates',  icon:'📝' },
  { id:'sms',       label:'SMS Alerts',    icon:'📱' },
  { id:'promo',     label:'Promo Codes',   icon:'🏷️' },
  { id:'bundles',   label:'Bundles',       icon:'📦' },
  { id:'store',     label:'Online Store',  icon:'🌐' },
  { id:'catalog',   label:'Product Catalog',icon:'📱' },
];

export default function MarketingHub({ tenant, deepTab, role = 'owner' }) {
  const [tab, setTab] = useState('overview');
  const visibleTabs = filterTabs(TABS, role, 'marketinghub');
  useEffect(() => { if (visibleTabs.length && !visibleTabs.some(t=>t.id===tab)) setTab(visibleTabs[0].id); }, [role]);
  useEffect(() => { if (deepTab && TABS.some(t=>t.id===deepTab)) setTab(deepTab); }, [deepTab]);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <HubHeader title="Marketing" subtitle="Campaigns, WhatsApp, SMS, promo codes and online store" icon="📣"/>
      <HubTabs tabs={visibleTabs} active={tab} onChange={setTab}/>
      <div style={{ flex:1, overflow:'auto', background:'#F7F3F3' }}>
        {tab==='overview'  && <MarketingDashboard tenant={tenant} role={role} onSwitchTab={setTab}/>}
        {tab==='campaigns' && <Campaigns       tenant={tenant}/>}
        {tab==='bot'       && <CampaignBot     tenant={tenant} role={role}/>}
        {tab==='integrations' && <MarketingIntegrations tenant={tenant} role={role}/>}
        {tab==='wa'        && <WhatsAppCatalog tenant={tenant}/>}
        {tab==='wabot'     && <WAOrderBot      tenant={tenant}/>}
        {tab==='watpl'     && <WATemplates     tenant={tenant}/>}
        {tab==='sms'       && <SMSAlerts       tenant={tenant}/>}
        {tab==='promo'     && <PromoCodes      tenant={tenant}/>}
        {tab==='bundles'   && <Bundles         tenant={tenant}/>}
        {tab==='store'     && <OnlineStore     tenant={tenant}/>}
        {tab==='catalog'   && <ProductCatalog  tenant={tenant}/>}
      </div>
    </div>
  );
}
