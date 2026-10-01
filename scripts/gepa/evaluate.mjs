// Offline bridge: same production qualification, writer and grounding guard.
import {readFileSync} from 'node:fs';
import {intake,companyEvidence,qualify,draftFor} from '../../website/domain.mjs';
import {validateEmailPolicy} from '../../website/email-policy.mjs';
import {validHook} from '../../website/draft-grounding.mjs';
import {createHash} from 'node:crypto';
const request=JSON.parse(readFileSync(0,'utf8'));
if(!Array.isArray(request.cases)||request.cases.length>100)throw Error('Evaluate at most 100 frozen cases.');
const policy=validateEmailPolicy(request.policy);
const NativeDate=Date;
if(!Number.isFinite(NativeDate.parse(request.clock)))throw Error('A frozen clock is required.');
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[request.clock]))}static now(){return NativeDate.parse(request.clock)}};
globalThis.fetch=()=>{throw Error('External retrieval is disabled in GEPA evaluations.');};
const outputs=request.cases.map(c=>{
 const input=intake(c.input),evidence=companyEvidence(input,{results:c.sources.map(s=>({...s,highlights:[s.text]}))},'Golden fixture');
 const lead=qualify(input,{...evidence,stale:!!c.stale},{status:'incomplete'},[]),brief=lead.research_brief;
 const draft=draftFor(lead,brief.signals[0].supported,brief.signals[1].supported,brief,policy);
 const checks={fit:lead.company_fit.label===c.expected.fit,theme:draft.theme===c.expected.theme,length:draft.draft.split(/\s+/).length<=c.expected.max_words,one_ask:(draft.draft.match(/\?/g)||[]).length===1,required:(c.expected.contains||[]).every(s=>draft.draft.includes(s)),forbidden:(c.expected.excludes||[]).every(s=>!draft.draft.includes(s)),grounding:(draft.draft_basis||[]).every(f=>f.quote&&f.source?.excerpt?.includes(f.quote)),fact_ids:draft.draft_hooks.every(h=>validHook(h,draft.draft_facts))};
 return {id:c.id,title:c.title,input:c.input,expected:c.expected,checks,score:Object.values(checks).every(Boolean)?1:0,fit:lead.company_fit.label,reason:lead.company_fit.reason,fit_evidence:lead.company_fit.evidence,subject:draft.subject,email:draft.draft,theme:draft.theme,words:draft.draft.split(/\s+/).length,facts:draft.draft_facts,hooks:draft.draft_hooks,draft_id:createHash('sha256').update(JSON.stringify([draft.subject,draft.draft])).digest('hex')};
});
globalThis.Date=NativeDate;
process.stdout.write(JSON.stringify(outputs));
