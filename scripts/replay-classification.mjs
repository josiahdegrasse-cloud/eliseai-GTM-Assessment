// Saved-evidence development replay, not a new live benchmark.
import {readFile,writeFile} from 'node:fs/promises';
import {intake,qualify} from '../website/domain.mjs';
const inputs=JSON.parse(await readFile('test-data/quality-holdout-inputs.json','utf8')).cases;
const captured=JSON.parse(await readFile('test-data/quality-holdout-results.json','utf8'));
const results=captured.results.map(row=>{
 const input=inputs.find(c=>c.id===row.id).input;
 const evidence=(row.sources||[]).map(s=>({url:s.url,title:s.title,text:s.excerpt,date:s.retrieved_at,verified:s.name_matched,identity:s.identity}));
 const lead=qualify(intake(input),{evidence,stale:row.company_stale},{},[]);
 const actual=lead.lead_fit.rank===2?'housing_operator':lead.lead_fit.rank===0?'non_operator':'unresolved';
 return {id:row.id,company:row.company,expected:row.expected.sector,before:row.actual,after:actual,correct:actual===row.expected.sector,evidence:lead.research_brief.classification.evidence};
});
const report={mode:'Development replay of previously captured evidence; zero network requests; excludes contact/property correctness and live retrieval coverage.',captured_at:captured.started_at,replayed_at:new Date().toISOString(),results};
await writeFile('test-data/classification-replay-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({original16:results.slice(0,16).filter(x=>x.after!=='unresolved').length,recovered:results.filter(x=>x.before==='unresolved'&&x.after==='housing_operator').map(x=>x.id),incorrect_assertions:results.filter(x=>x.after!=='unresolved'&&!x.correct).length}));
