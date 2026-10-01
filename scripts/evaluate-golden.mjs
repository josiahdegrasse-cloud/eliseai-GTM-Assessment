import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {intake,companyEvidence,qualify} from '../website/domain.mjs';
const ruleFiles=['static/company-fit.js','website/company-classification.mjs','website/company-identity.mjs','website/brief.mjs','website/portfolio-statements.mjs','website/outreach.mjs','website/email-policy.mjs','website/domain.mjs','website/draft-grounding.mjs','website/sales-insights.mjs','website/professional-personalization.mjs','website/qualification-evidence.mjs','website/scoring.mjs','website/decision.mjs'];
const rules_sha256=createHash('sha256').update(ruleFiles.map(p=>p+'\n'+readFileSync(new URL('../'+p,import.meta.url),'utf8')).join('\n')).digest('hex');
writeFileSync(new URL('../website/rule-manifest.json',import.meta.url),JSON.stringify({rules_sha256,files:ruleFiles},null,2)+'\n');
const suite=JSON.parse(readFileSync(new URL('../test-data/golden-leads.json',import.meta.url)));
const baselineURL=new URL('../test-data/golden-baseline.json',import.meta.url);
const baseline=existsSync(baselineURL)?JSON.parse(readFileSync(baselineURL)):null;
const NativeDate=Date;
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[suite.clock]))}static now(){return NativeDate.parse(suite.clock)}};
const rows=suite.cases.map(c=>{
 const lead=intake(c.input),evidence=companyEvidence(lead,{results:c.sources.map(s=>({...s,highlights:[s.text]}))},'Golden fixture');
 const out=qualify(lead,{...evidence,stale:!!c.stale},{status:'incomplete'},[]),fit=out.company_fit;
 const snapshot={priority:out.lead_priority,fit:fit.label,reason:fit.reason,criteria:fit.evidence.map(e=>({kind:e.kind,quote:e.quote})),portfolio:out.research_brief.portfolio?.value||null,subject:out.subject,email:out.draft,theme:out.theme};
 const checks={priority:out.lead_priority.tier===c.expected.priority,fit:fit.label===c.expected.fit,theme:out.theme===c.expected.theme,length:out.draft.split(/\s+/).length<=c.expected.max_words,one_ask:(out.draft.match(/\?/g)||[]).length===1,required:(c.expected.contains||[]).every(s=>out.draft.includes(s)),forbidden:(c.expected.excludes||[]).every(s=>!out.draft.includes(s)),grounding:(out.draft_basis||[]).every(f=>f.quote&&f.source?.excerpt?.includes(f.quote)),fact_ids:!out.draft_hooks||out.draft_hooks.every(h=>h.fact_ids.length&&h.fact_ids.every(id=>out.draft_facts?.some(f=>f.id===id)))};
 const previous=baseline?.cases?.find(x=>x.id===c.id)?.snapshot;
 return {id:c.id,title:c.title,input:c.input,expected:c.expected,checks,snapshot,changed:!previous||JSON.stringify(previous)!==JSON.stringify(snapshot),previous:previous&&JSON.stringify(previous)!==JSON.stringify(snapshot)?previous:null,human_would_send:null,human_reason:''};
});
globalThis.Date=NativeDate;
const failures=rows.filter(r=>Object.values(r.checks).some(v=>!v)),changed=rows.filter(r=>r.changed);
const report={rules_sha256,suite_version:suite.version,fixture_sha256:createHash('sha256').update(JSON.stringify(suite)).digest('hex'),evaluated_at:new Date().toISOString(),method:suite.method,total:rows.length,passed:rows.length-failures.length,failed:failures.length,snapshot_changes:changed.length,human_review:'Pending — automated checks do not establish would-send quality.',breakdown:Object.fromEntries(Object.keys(rows[0].checks).map(k=>[k,{pass:rows.filter(r=>r.checks[k]).length,total:rows.length}])),cases:rows};
const fixtureChanged=!!baseline&&baseline.fixture_sha256!==report.fixture_sha256;report.fixture_changed=fixtureChanged;
mkdirSync('.quality-reports',{recursive:true});writeFileSync('.quality-reports/golden-latest.json',JSON.stringify(report,null,2)+'\n');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
writeFileSync('.quality-reports/golden-latest.html',`<!doctype html><meta charset="utf-8"><title>Golden lead evaluation</title><style>body{font:16px/1.5 system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#202b36}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #ddd;padding:10px;vertical-align:top}pre{white-space:pre-wrap;background:#f2f5f8;padding:14px}.fail{color:#a22}.pass{color:#275d3a}summary{cursor:pointer}small{color:#586474}</style><h1>Golden lead evaluation</h1><p>${report.passed}/${report.total} pass · ${changed.length} snapshot changes</p><p>${esc(suite.method)} Human “would send” review is pending.</p><table><tr><th>Case</th><th>Fit / checks</th><th>Draft and changes</th></tr>${rows.map(r=>`<tr><td>${r.id} ${esc(r.title)}</td><td>${esc(r.snapshot.fit)}<br><small>${Object.entries(r.checks).map(([k,v])=>`<span class="${v?'pass':'fail'}">${esc(k)}: ${v?'pass':'FAIL'}</span>`).join('<br>')}</small></td><td><details ${r.changed?'open':''}><summary>${r.changed?'CHANGED — review before accepting':'View snapshot'}</summary><b>${esc(r.snapshot.subject)}</b><pre>${esc(r.snapshot.email)}</pre>${r.previous?`<b>Previous</b><pre>${esc(r.previous.email)}</pre>`:''}<b>Current fit and evidence</b><pre>${esc(JSON.stringify({fit:r.snapshot.fit,reason:r.snapshot.reason,criteria:r.snapshot.criteria,portfolio:r.snapshot.portfolio},null,2))}</pre>${r.previous?`<b>Previous fit and evidence</b><pre>${esc(JSON.stringify({fit:r.previous.fit,reason:r.previous.reason,criteria:r.previous.criteria,portfolio:r.previous.portfolio},null,2))}</pre>`:''}</details></td></tr>`).join('')}</table>`);
if(process.argv.includes('--approve')){
 if(failures.length)throw Error('Cannot approve a baseline with failed checks.');
 writeFileSync(baselineURL,JSON.stringify({suite_version:suite.version,fixture_sha256:report.fixture_sha256,method:suite.method,cases:rows.map(({id,snapshot})=>({id,snapshot}))},null,2)+'\n');
}
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:failures.map(r=>({id:r.id,checks:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k),actual:r.snapshot.fit,theme:r.snapshot.theme})),snapshot_changes:changed.map(r=>r.id),fixture_changed:fixtureChanged,report:'.quality-reports/golden-latest.html'},null,2));
if(failures.length||!process.argv.includes('--approve')&&(!baseline||changed.length||fixtureChanged))process.exitCode=1;
