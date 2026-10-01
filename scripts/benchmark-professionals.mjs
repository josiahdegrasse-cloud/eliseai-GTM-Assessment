// Opt-in live benchmark: isolated visitor session, public professionals only.
// Uses the deployed site’s configured research provider; never reads its credentials.
import {readFile,writeFile} from 'node:fs/promises';
const origin=process.env.BENCHMARK_ORIGIN;
if(!origin||!process.argv.includes('--live'))throw Error('Explicit live origin required');
const corpus=JSON.parse(await readFile(process.env.BENCHMARK_CORPUS||'test-data/professional-benchmark.json','utf8')).cases;
const limit=Number(process.env.BENCHMARK_LIMIT||16),startIndex=Number(process.env.BENCHMARK_START||0);
const indices=process.env.BENCHMARK_INDICES?.split(',').map(Number);
if(indices?.some(i=>!Number.isInteger(i)||i<0||i>=corpus.length))throw Error('Invalid benchmark indices');
const cases=indices?indices.map(i=>corpus[i]):corpus.slice(startIndex,startIndex+limit);
const session=await fetch(origin+'/api/session',{headers:{Origin:origin}});if(!session.ok)throw Error('Session: '+session.status);
const cookie=session.headers.get('set-cookie').split(';')[0],{csrf}=await session.json();
const call=async(path,body)=>{const r=await fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});if(!r.ok)throw Error(path+': '+r.status+' '+(await r.text()).slice(0,160));return r.json()};
const results=[],output=process.env.BENCHMARK_OUTPUT||'/tmp/professional-live-results.json';
async function check(c,index){
 const started=Date.now(),added=await call('add',{name:c.name,company:c.company,website:c.website,email:'audit.'+index+'@example.invalid'}),id=added.ids[0];
 let p,attempts=0;
 do{
  const lead=await call('professional',{id});p=lead.professional_context;attempts++;
  if(p?.status!=='pending')break;
  await new Promise(r=>setTimeout(r,Math.max(13000,Math.min(30000,Date.parse(p.retry_after)-Date.now()))));
 }while(Date.now()-started<300000);
 const current=(p?.people||[]).filter(s=>!s.historical),roleMatch=current.length>0&&current.every(s=>new RegExp(c.expected_role,'i').test(s.role));
 const out={case_index:corpus.indexOf(c),...c,status:p?.status,match:p?.match,elapsed_ms:Date.now()-started,polls:attempts,current_roles:current.map(s=>s.role),outcome:c.expected==='role'?(current.length?(roleMatch?'role_found':'role_mismatch'):'unresolved'):(current.length?'false_current_match':p?.status==='complete'?'correct_abstention':'unassessed_control'),professional_context:p};
 results.push(out);await writeFile(output,JSON.stringify({started_at:new Date().toISOString(),limitations:'Public-profile convenience sample, not representative of all inbound contacts; expected roles and source URLs are not sent to research. Titles are checked against pre-audited labels; unresolved cases are not counted as correct matches.',results},null,2));
 console.log(JSON.stringify({name:c.name,company:c.company,status:out.status,match:out.match,roles:out.current_roles,outcome:out.outcome,elapsed_ms:out.elapsed_ms,cost:p?.cost_dollars,agent_cost:p?.agent_cost_dollars,passes:p?.research_diagnostics?.passes,reasons:p?.research_diagnostics?.rejections?.map(x=>x.reason),retry_code:p?.retry_code}));
}
try{
 let next=0;const settled=await Promise.allSettled(Array.from({length:Math.min(4,cases.length)},async()=>{while(next<cases.length){const i=next++;await check(cases[i],startIndex+i);}}));if(settled.some(r=>r.status==='rejected'))throw new AggregateError(settled.filter(r=>r.status==='rejected').map(r=>r.reason),'Benchmark request failures');
}finally{await call('session/delete',{});}
