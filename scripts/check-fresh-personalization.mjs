// Opt-in smoke check through the normal hosted path. A fresh, isolated visitor;
// synthetic contact, real company, no outreach, no key access or quota resets.
import {mkdir,writeFile} from 'node:fs/promises';
import {sourceHasOldDate} from '../static/company-fit.js';
import {validHook} from '../website/draft-grounding.mjs';
if(!process.argv.includes('--live'))throw Error('Pass --live to use the existing free research allowance.');
const arg=key=>process.argv[process.argv.indexOf(key)+1];
if(!process.argv.includes('--origin'))throw Error('Provide --origin <https site URL>.');
const origin=new URL(arg('--origin')).origin;if(!origin.startsWith('https://'))throw Error('HTTPS required.');
const report={started_at:new Date().toISOString(),method:'Fresh isolated visitor; synthetic contact at a real company; one normal live processing attempt; no supplied source excerpts, provider key access, retries or quota resets. Smoke check, not an accuracy benchmark.',input:{name:'Jordan Pipeline (TEST)',email:'fresh-rubric-check@example.invalid',company:'Fogelman',website:'https://www.fogelman.com',country:'US',inquiry:'We need help answering leasing inquiries after hours. Could we see a demo?'},cleanup:'pending'};
let cookie,csrf;
const request=async(path,body)=>{
 const r=await fetch(origin+path,{method:body?'POST':'GET',redirect:'error',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});
 if(!r.ok)throw Error('HTTP '+r.status+' on '+path);
 if(path==='/api/session'){cookie=r.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Missing isolated session');}
 return r.json();
};
try{
 ({csrf}=await request('/api/session'));
 const {ids}=await request('/api/add',report.input),start=Date.now();
 const lead=await request('/api/process',{id:ids[0]});
 const hooks=(lead.draft_hooks||[]).filter(h=>h.kind==='company_observation');
 report.result={elapsed_ms:Date.now()-start,writer:lead.draft_version,priority:lead.lead_priority,company_fit:lead.company_fit,source_count:lead.research_brief?.sources?.length||0,source_urls:(lead.research_brief?.sources||[]).map(s=>s.url),personalization:lead.draft_personalization,subject:lead.subject,draft:lead.draft,company_hooks:hooks,guard:lead.draft_guard,research_state:lead.research_state,retry_code:lead.company_retry_code||null};
 report.checks={current_writer:lead.draft_version>=20,priority_model:lead.lead_priority?.model==='inbound-priority-v2',high_priority:lead.lead_priority?.tier==='A',five_questions:lead.lead_priority?.criteria?.length===5,one_grounded_company_fact:hooks.length===1&&hooks.every(h=>validHook(h,lead.draft_facts||[])&&lead.draft.includes(h.text)),no_old_article_hook:hooks.length>0&&hooks.every(h=>!sourceHasOldDate((lead.research_brief?.sources||[]).find(s=>s.url===h.url))),one_question:(lead.draft.match(/\?/g)||[]).length===1,concise:lead.draft.split(/\s+/).length<=100,guard_passed:lead.draft_guard?.status==='passed'};
}catch(e){report.error=e.message;process.exitCode=1;}
finally{
 if(cookie&&csrf)try{await request('/api/session/delete',{});report.cleanup='Isolated visitor deleted.';}catch{report.cleanup='Deletion failed; normal visitor expiry applies.';process.exitCode=1;}
 report.finished_at=new Date().toISOString();await mkdir('.quality-reports',{recursive:true});await writeFile('.quality-reports/fresh-personalization.json',JSON.stringify(report,null,2)+'\n');
 if(report.checks&&Object.values(report.checks).some(v=>!v))process.exitCode=1;
 console.log(JSON.stringify(report,null,2));
}
