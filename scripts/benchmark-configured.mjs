// Explicit opt-in. Uses an isolated temporary visitor on the deployed site's normal
// configured provider path; no provider key is read, printed, copied or changed.
import {readFile,writeFile} from 'node:fs/promises';
import {researchProgress} from '../static/workflow.js';
const arg=name=>process.argv[process.argv.indexOf(name)+1];
if(!process.argv.includes('--live')||!process.argv.includes('--origin'))throw Error('Use --live --origin <deployed site URL>.');
const origin=new URL(arg('--origin')).origin;if(!origin.startsWith('https://'))throw Error('HTTPS required.');
const cases=JSON.parse(await readFile('test-data/fit-fresh-inputs.json','utf8')).cases;
const started_at=new Date().toISOString(),output='test-data/fit-configured-'+started_at.replace(/[:.]/g,'-')+'.json';
let cookie,csrf;const report={started_at,origin,mode:'Configured production path, isolated visitor; one attempt per case; no manual rescue, quota resets or provider configuration changes.',cleanup:'pending',results:[]};
const request=async(path,body)=>{
 const res=await fetch(origin+path,{method:body?'POST':'GET',redirect:'error',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(95000)});
 if(!res.ok)throw Error('HTTP '+res.status);
 if(path==='/api/session'){cookie=res.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Expected a new isolated session cookie.');}
 return res.json();
};
try{
 ({csrf}=await request('/api/session'));
 for(const c of cases){
  const start=Date.now();let row;
  try{
   const {ids}=await request('/api/add',c.input);const lead=await request('/api/process',{id:ids[0]});
   const actual=lead.lead_fit.rank===2?'housing_operator':lead.lead_fit.rank===0?'non_operator':'unresolved';
   row={id:c.id,company:c.input.company,expected:c.expected,actual,correct:actual===c.expected,elapsed_ms:Date.now()-start,score:lead.lead_fit.score,progress:researchProgress(lead),retry_code:lead.company_retry_code,company_stale:lead.company_stale,classification:lead.research_brief.classification,sources:lead.research_brief.sources};
  }catch(error){row={id:c.id,company:c.input.company,expected:c.expected,error:error.message,elapsed_ms:Date.now()-start};}
  report.results.push(row);await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({id:row.id,actual:row.actual,correct:row.correct,error:row.error,seconds:Math.round(row.elapsed_ms/1000)}));
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,12000-(Date.now()-start))));
 }
}finally{
 if(cookie&&csrf)try{await request('/api/session/delete',{});report.cleanup='Isolated visitor deleted.';}catch{report.cleanup='Deletion failed; normal session expiry still applies.';}
 report.finished_at=new Date().toISOString();await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(output+' — '+report.cleanup);
}
