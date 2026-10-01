// Shared by the browser and Worker: buyer context is supplied by a rep, never inferred from the web.
export const DISCOVERY_FIELDS = [
  {key:'scope', label:'Rollout scope', question:'Which communities or properties would you start with?'},
  {key:'process', label:'Current workflow & tools', question:'How does your team handle inquiries today, and which tools do you use?'},
  {key:'timing', label:'Timing', question:'When would you like to have a new approach in place?'},
  {key:'role', label:'Role & decision team', question:'Who would be involved in evaluating a change with you?'}
];

export const READINESS_FIELDS = [
 {key:'need_status',note:'inquiry',label:'Business need',choices:[['unknown','Not confirmed'],['confirmed','Need confirmed'],['none','No active need']]},
 {key:'scope_status',note:'scope',label:'Initial scope',choices:[['unknown','Not confirmed'],['defined','Scope agreed']]},
 {key:'timing_status',note:'timing',label:'Buying timeline',choices:[['unknown','Not confirmed'],['30_days','Within 30 days'],['90_days','Within 90 days'],['later','Later / exploring']]},
 {key:'role_status',note:'role',label:'Decision involvement',choices:[['unknown','Not confirmed'],['evaluator','Evaluator / champion'],['decision_maker','Decision-maker']]}
];
export const WORKFLOWS = [
 {key:'leasing',label:'Prospect follow-up',product:'LeasingAI',question:'How many prospect inquiries do you receive in a typical month?'},
 {key:'voice',label:'Missed calls',product:'VoiceAI',question:'How many prospect or resident calls go unanswered in a typical week?'},
 {key:'tours',label:'Tour coordination',product:'LeasingAI',question:'Where does your team lose the most time coordinating tours?'},
 {key:'maintenance',label:'Maintenance requests',product:'ResidentAI · Maintenance',question:'How are maintenance requests captured and handed to your team today?'},
 {key:'renewals',label:'Renewal follow-up',product:'ResidentAI · Renewals',question:'Which part of renewal follow-up takes the most manual work?'},
 {key:'payments',label:'Payment follow-up',product:'ResidentAI · Delinquency',question:'How does your team manage payment reminders and follow-up today?'}
];
export const SALES_CHOICES = {
 workflow_key:[['unknown','Not confirmed'],...WORKFLOWS.map(w=>[w.key,w.label])],
 impact_metric:[['unknown','Not measured'],['inquiries_month','Inquiries / month'],['missed_calls_week','Missed calls / week'],['response_minutes','Response time · minutes'],['manual_hours_week','Manual hours / week']],
 integration_status:[['unknown','Not checked'],['supported','Supported · rep checked'],['blocked','Blocker · rep checked']],
 account_status:[['unknown','Not checked'],['new','New prospect'],['existing','Existing customer'],['open_opportunity','Open opportunity'],['duplicate','Duplicate record']]
};
export const SALES_TEXT = ['workflow_note','impact_note','pms_name','pms_edition','integration_note','account_note','trigger_note','owner','next_step'];
export function validDate(value){const s=typeof value==='string'?value:'';return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:''}
export function officialIntegrationURL(value){try{if(typeof value!=='string'||value.length>2048)return '';const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['eliseai.com','www.eliseai.com','support.meetelise.com'].includes(u.hostname)?u.href:''}catch{return ''}}
export function qualificationAnswers(value={}) {
  const text=v=>typeof v==='string'?v.trim().slice(0,1500):'';
  const number=['number','string'].includes(typeof value?.impact_value)?String(value.impact_value).trim():'';
  return {...Object.fromEntries([...DISCOVERY_FIELDS.map(f=>f.key),'process_timing',...SALES_TEXT].map(k=>[k,text(value?.[k]).slice(0,({pms_name:120,pms_edition:80,owner:120,next_step:600})[k]||1500)])),
    ...Object.fromEntries([...READINESS_FIELDS,...Object.entries(SALES_CHOICES).map(([key,choices])=>({key,choices}))].map(f=>[f.key,f.choices.some(([v])=>v===value?.[f.key])?value[f.key]:'unknown'])),
    impact_value:/^\d{1,9}(?:\.\d{1,2})?$/.test(number)&&Number(number)<=1e8?String(Number(number)):'',
    integration_source_url:officialIntegrationURL(value?.integration_source_url),trigger_date:validDate(value?.trigger_date),next_due:validDate(value?.next_due)};
}

export function nextQuestion(lead,brief) {
  const answers=qualificationAnswers(lead.qualifications);
  if(!String(lead.inquiry||'').trim())return {key:'inquiry',label:'Reason for reaching out',question:'What prompted your inquiry, and what would you most like to improve?'};
  const missing=DISCOVERY_FIELDS.find(f=>!answers[f.key]);
  if(!missing)return {key:'meeting',label:'Agree on a next step',question:'Would a short walkthrough focused on your team’s workflow be useful?'};
  if(missing.key==='scope'){
    const footprint=brief?.footprint?.value||'';
    return {...missing,question:footprint==='Global operations'?'Which region and communities would you want to start with?':/markets|countries|states/i.test(footprint)&&footprint!=='United States'?'Which of your markets would be in scope for an initial rollout?':missing.question};
  }
  return missing;
}
