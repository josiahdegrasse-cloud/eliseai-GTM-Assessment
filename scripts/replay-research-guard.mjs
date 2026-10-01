// Development replay only: preserve live runs and measure the final portal guard
// against their saved inputs. This makes no network calls or accuracy claim.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {presentLead} from '../website/domain.mjs';
import rules from '../website/rule-manifest.json' with {type:'json'};

const paths=process.argv.slice(2);
if(paths.length!==2)throw Error('Pass the completed 30-company and 12-company live runs.');
const runs=[];
for(const [i,path] of paths.entries()){
 const text=await readFile(path,'utf8'),live=JSON.parse(text);
 if(!live.finished_at||live.results.length!==[30,12][i])throw Error('Complete live runs required.');
 const rows=live.results.map(row=>{
  const lead=row.lead?presentLead(row.lead):null;
  const after=lead?(lead.company_fit.rank===2?'housing_operator':lead.company_fit.rank===0?'non_operator':'unresolved'):'unresolved';
  return {id:row.id,company:row.company,expected:row.expected,before:row.actual,after,correct:after===row.expected,classification:lead?.research_brief?.classification};
 });
 runs.push({source:path,source_sha256:createHash('sha256').update(text).digest('hex'),live_deployment:live.baseline_deployment,total:rows.length,correct:rows.filter(x=>x.correct).length,wrong:rows.filter(x=>x.after!=='unresolved'&&!x.correct).length,unresolved:rows.filter(x=>x.after==='unresolved').length,changes:rows.filter(x=>x.before!==x.after),rows});
}
await writeFile('test-data/research-portal-guard-replay.json',JSON.stringify({created_at:new Date().toISOString(),mode:'Archived-evidence development replay; no new retrieval',independent_first_pass:false,rules_sha256:rules.rules_sha256,runs},null,2)+'\n');
console.log(JSON.stringify(runs.map(({rows,...summary})=>summary)));
