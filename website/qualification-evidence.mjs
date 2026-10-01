import {qualificationAnswers} from '../static/sales-context.js';

// Server-owned timestamps are bound to the exact input. An unrelated edit cannot
// make a previous assessment fresh. No browser-supplied provenance is trusted.
export const EVIDENCE_GROUPS={
 need:['inquiry','need_status'],timing:['timing','timing_status'],role:['role','role_status'],scope:['scope','scope_status'],
 workflow:['workflow_key','workflow_note'],impact:['impact_metric','impact_value','impact_note'],
 integration:['workflow_key','pms_name','pms_edition','integration_status','integration_note','integration_source_url'],
 account:['account_status','account_note'],trigger:['trigger_note','trigger_date'],commitment:['owner','next_step','next_due']
};
export const REVIEW_DAYS={need:30,timing:30,role:90,scope:30,workflow:30,impact:30,integration:30,account:90,trigger:30,commitment:30};
export function evidenceInput(lead,key){const q=qualificationAnswers(lead.qualifications);return JSON.stringify(EVIDENCE_GROUPS[key].map(k=>k==='inquiry'?String(lead.inquiry||''):q[k]))}
export function evidenceState(lead,key,time=Date.now()){
 const e=lead.qualification_evidence?.[key],date=Date.parse(e?.recorded_at);
 const status=!e||!Number.isFinite(date)?'undated':e.input!==evidenceInput(lead,key)?'changed':date>time?'future':time-date>REVIEW_DAYS[key]*86400000?'stale':'current';
 return {status,recorded_at:Number.isFinite(date)?e.recorded_at:null,basis:'Rep assessment',review_days:REVIEW_DAYS[key]};
}
export function recordQualification(lead,previous,{reconfirm=false,time=Date.now()}={}){
 const q=qualificationAnswers(lead.qualifications),before=qualificationAnswers(previous.qualifications);
 // A compatibility assessment cannot follow a different workflow/system silently.
 if(before.integration_status!=='unknown'&&['workflow_key','pms_name','pms_edition'].some(k=>q[k]!==before[k]))q.integration_status='unknown';
 lead.qualifications=q;
 const recorded_at=new Date(time).toISOString(),evidence={...previous.qualification_evidence},changes=[];
 for(const key of Object.keys(EVIDENCE_GROUPS)){
  const input=evidenceInput(lead,key),old=evidenceInput(previous,key);
  const meaningful=EVIDENCE_GROUPS[key].some(k=>{const v=k==='inquiry'?lead.inquiry:q[k];return v&&v!=='unknown'});
  if(input!==old||meaningful&&(!evidence[key]||reconfirm)){
   evidence[key]={recorded_at,input};changes.push({key,before:old,after:input});
  }
 }
 lead.qualification_evidence=evidence;
 if(changes.length)lead.qualification_history=[...(previous.qualification_history||[]),{recorded_at,reason:reconfirm?'Reconfirmed by rep':'Buyer notes saved',changes}].slice(-10);
 return lead;
}
