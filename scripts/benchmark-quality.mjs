// Explicit opt-in, isolated live first-pass evaluation. No production data or credentials.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {researchProgress} from '../static/workflow.js';
if(!process.argv.includes('--live'))throw Error('Pass --live to call anonymous public providers.');
const cases=JSON.parse(await readFile('test-data/quality-holdout-inputs.json','utf8')).cases;
const origin='https://assessment.test',results=[],started_at=new Date().toISOString();
const output='test-data/quality-run-'+started_at.replace(/[:.]/g,'-')+'.json';
const sha256=data=>createHash('sha256').update(data).digest('hex');
const run_metadata={source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),worker_sha256:sha256(await readFile('dist/server/index.js')),inputs_sha256:sha256(await readFile('test-data/quality-holdout-inputs.json'))};
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'isolated-quality-benchmark'}});
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const r=await mf.dispatchFetch(origin+'/api/session'),cookie=r.headers.get('Set-Cookie').split(';')[0],{csrf}=await r.json();
 const post=async(path,body)=>{const r=await mf.dispatchFetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('HTTP '+r.status+': '+(await r.text()).slice(0,300));return r.json()};
 for(const c of cases){
  const start=Date.now();let row;
  try{
   const {ids}=await post('/api/add',c.input),lead=await post('/api/process',{id:ids[0]});
   const f=lead.lead_fit,actual=f.rank===2?'housing_operator':f.rank===0?'non_operator':'unresolved';
   const roles=(lead.professional_context?.people||[]).filter(x=>!x.historical).map(x=>({role:x.role,name:x.name,url:x.url,quote:x.quote}));
   row={id:c.id,company:c.input.company,elapsed_ms:Date.now()-start,expected:c.expected,actual,classification_correct:actual===c.expected.sector,abstained:actual==='unresolved',progress:researchProgress(lead),roles,role_check:c.expected.role_absent?roles.length===0:c.expected.role_contains?roles.some(x=>x.role?.toLowerCase().includes(c.expected.role_contains)):null,score:f.score,coverage:f.coverage,source_count:lead.research_brief?.sources?.length||0,brief:{summary:lead.research_brief?.summary,portfolio:lead.research_brief?.portfolio,footprint:lead.research_brief?.footprint,context:lead.research_brief?.context},draft:lead.draft,draft_basis:lead.draft_basis,words:lead.draft.split(/\s+/).length,questions:(lead.draft.match(/\?/g)||[]).length,property:lead.property_context,sources:lead.research_brief?.sources,company_stale:lead.company_stale,retry_code:lead.company_retry_code,contact_status:lead.professional_context?.status,diagnostics:lead.professional_context?.research_diagnostics};
  }catch(error){row={id:c.id,company:c.input.company,elapsed_ms:Date.now()-start,error:error.message,expected:c.expected,classification_correct:false}}
  results.push(row);await writeFile(output,JSON.stringify({run_metadata,started_at,updated_at:new Date().toISOString(),mode:'Anonymous first pass; one workspace; no provider-counter resets, keys, manual rescue URLs or retries.',results},null,2)+'\n');
  console.log(JSON.stringify({id:row.id,company:row.company,actual:row.actual,correct:row.classification_correct,role_check:row.role_check,seconds:Math.round(row.elapsed_ms/1000),error:row.error}));
  // Deliberately below existing global free-provider pacing; limits are not reset.
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,12000-(Date.now()-start))));
 }
}finally{await mf.dispose()}
