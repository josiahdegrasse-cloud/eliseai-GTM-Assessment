import rules from './rule-manifest.json' with {type:'json'};
import {presentLead,REQUIRED,OPTIONAL} from './domain.mjs';
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function resultState(source,r){
 if(r?.stale||r?.status==='unavailable')return {status:'failed',message:'Refresh failed; any saved evidence is retained.',code:r.retry_code||'source_unavailable'};
 if(['incomplete','unsupported','no_geography','skipped'].includes(r?.status))return {status:'skipped',message:'Required input or supported geography is absent.'};
 const found=source==='company'?r?.evidence?.length:source==='contact'?r?.people?.some(p=>!p.historical):source==='property'?r?.status==='matched':source==='area'?r?.status==='available':source==='entity'?r?.status==='name_match':['logo','imagery'].includes(source)?r?.status==='found':true;
 if(!found)return {status:'no_match',message:'Lookup completed without a usable match.'};
 const direct=source==='company'&&r?.evidence?.some(e=>e.provider==='Direct company website');
 return {status:r?.cached?'cached':'succeeded',message:r?.cached?'Reused saved provider result; original source dates are retained.':direct?'Lookup completed using direct public company pages.':'Lookup completed.'};
}
export async function trackRun(env,session,leadId,source,work){
 const id=crypto.randomUUID(),start=Date.now();
 await stmt(env,'INSERT INTO research_runs(id,session_id,lead_id,source,status,started_at,message) VALUES(?,?,?,?,?,?,?)',id,session.id,leadId,source,'running',start,'Lookup started.').run();
 try{
  const result=await work(),state=resultState(source,result);
  await stmt(env,'UPDATE research_runs SET status=?,finished_at=?,message=?,code=? WHERE id=? AND session_id=?',state.status,Date.now(),state.message,state.code||null,id,session.id).run();
  return result;
 }catch(e){
  const code=/^[a-z_]{1,40}$/.test(e?.code||'')?e.code:'unavailable';
  await stmt(env,'UPDATE research_runs SET status=?,finished_at=?,message=?,code=? WHERE id=? AND session_id=?','failed',Date.now(),'Request failed. Check the source status and retry when available.',code,id,session.id).run();
  throw e;
 }finally{
  await stmt(env,'DELETE FROM research_runs WHERE session_id=? AND id NOT IN (SELECT id FROM research_runs WHERE session_id=? ORDER BY started_at DESC,rowid DESC LIMIT 500)',session.id,session.id).run();
 }
}
export function assessmentSnapshot(lead,reason){
 const l=presentLead(lead);
 return {version:1,evaluated_at:new Date().toISOString(),reason,rules_sha256:rules.rules_sha256,processed_at:l.processed_at,model:l.company_fit.model,writer:l.draft_version,
  inputs:Object.fromEntries([...REQUIRED,...OPTIONAL].map(k=>[k,l[k]||''])),qualifications:l.qualifications,qualification_evidence:l.qualification_evidence||{},
  evidence:l.evidence||[],professional_context:l.professional_context||null,property_context:l.property_context||{},company_stale:!!l.company_stale,
  company_fetched_at:l.company_fetched_at,company_fresh_until:l.company_fresh_until,company_snapshot:!!l.company_snapshot,
  result:{label:l.company_fit.label,reason:l.company_fit.reason,evidence:l.company_fit.evidence,portfolio:l.research_brief.portfolio||null,lead_priority:l.lead_priority},
  email:{policy:l.draft_policy||null,subject:l.subject,text:l.draft,edited:!!l.draft_edited,reviewed:!!l.reviewed,facts:l.draft_facts||[],hooks:l.draft_hooks||[],basis:l.draft_basis||[]},
  feedback:{would_send:l.would_send||'',reason:l.feedback_reason||'',legacy_rating:l.feedback||''}};
}
export async function saveAssessment(env,session,lead,reason){
 const data=assessmentSnapshot(lead,reason),id=crypto.randomUUID();
 await env.DB.batch([
  stmt(env,'INSERT INTO assessment_snapshots(id,session_id,lead_id,at,reason,data) VALUES(?,?,?,?,?,?)',id,session.id,lead.id,Date.now(),reason,JSON.stringify(data)),
  stmt(env,'DELETE FROM assessment_snapshots WHERE session_id=? AND lead_id=? AND id NOT IN (SELECT id FROM assessment_snapshots WHERE session_id=? AND lead_id=? ORDER BY at DESC,rowid DESC LIMIT 20)',session.id,lead.id,session.id,lead.id)
 ]);
 return id;
}
export async function historyFor(env,session,leadId=null){
 const rows=await stmt(env,'SELECT id,lead_id,source,status,started_at,finished_at,message,code FROM research_runs WHERE session_id=?'+(leadId?' AND (lead_id=? OR source=?)':'')+' ORDER BY started_at DESC,rowid DESC LIMIT 100',session.id,...(leadId?[leadId,'sheets']:[])).all();
 const runs=rows.results.map(r=>r.status==='running'&&Date.now()-r.started_at>120000?{...r,status:'interrupted',message:'No completion recorded; the worker may have stopped.'}:r);
 const snapshots=leadId?(await stmt(env,'SELECT id,at,reason,data FROM assessment_snapshots WHERE session_id=? AND lead_id=? ORDER BY at DESC,rowid DESC LIMIT 20',session.id,leadId).all()).results.map(r=>({...r,data:JSON.parse(r.data)})):[];
 return {runs,snapshots,retention:'Last 500 source runs per workspace and 20 assessments per lead; deleted with the workspace.'};
}
