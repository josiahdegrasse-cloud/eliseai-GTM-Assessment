// Re-evaluate archived evidence only. This makes no network calls and is not a
// second independent live test. Keep the original production response intact.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {presentLead} from '../website/domain.mjs';
import rules from '../website/rule-manifest.json' with {type:'json'};
const file=process.argv[2];if(!file)throw Error('Pass a completed live benchmark JSON.');
const text=await readFile(file,'utf8'),source=JSON.parse(text);if(!source.finished_at||source.results.length!==30)throw Error('A completed 30-case run is required.');
const report={...source,started_at:new Date().toISOString(),finished_at:new Date().toISOString(),mode:'offline_replay',baseline_deployment:'Final rules replayed against archived version81 evidence; no new retrieval',source_file:file,source_sha256:createHash('sha256').update(text).digest('hex'),rules_sha256:rules.rules_sha256,independent_first_pass:false,research_service_before:null,research_service_after:null,cleanup:'No workspace created; archived data only.',results:source.results.map(row=>{
 if(!row.lead)return {...row,elapsed_ms:0};
 const lead=presentLead(row.lead),actual=lead.company_fit.rank===2?'housing_operator':lead.company_fit.rank===0?'non_operator':'unresolved';
 return {...row,lead,actual,correct:actual===row.expected,classification:lead.research_brief.classification,sources:lead.research_brief.sources,elapsed_ms:0,original_live_result:row.actual,original_live_elapsed_ms:row.elapsed_ms};
})};
await writeFile('test-data/holdout-final-rules-replay.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:30,correct:report.results.filter(r=>r.correct).length,wrong:report.results.filter(r=>r.actual!=='unresolved'&&!r.correct).length,unresolved:report.results.filter(r=>r.actual==='unresolved').length,changes:report.results.filter(r=>r.actual!==r.original_live_result).map(r=>({id:r.id,before:r.original_live_result,after:r.actual}))}));
