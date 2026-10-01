// Opt-in public-source check in an isolated local Worker; no production data or keys.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
if(!process.argv.includes('--live'))throw Error('Pass --live to run bounded, keyless public research');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]};
const corpus=JSON.parse(await readFile('test-data/professional-benchmark-v2.json','utf8')).cases;
const cases=arg('--indices',process.argv.includes('--all')?Array.from({length:corpus.length},(_,i)=>i).join(','):'3,12,20,26,38,44,50,51').split(',').map(i=>corpus[Number(i)]);
const output=arg('--output','/tmp/free-people-check.json'),origin='https://assessment.test',calls=[];
const allowed=new Set(['dns.google','r.jina.ai',...cases.map(c=>c.website)]);
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'disposable-free-benchmark'},outboundService:async request=>{
 const u=new URL(request.url);if(u.protocol!=='https:'||![...allowed].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||request.headers.has('Authorization')||request.headers.has('x-api-key'))throw Error('Non-free or unrelated request blocked');
 const call={url:request.url,at:new Date().toISOString()};calls.push(call);
 try{const response=await fetch(request.url,{method:'GET',headers:request.headers,redirect:'manual',signal:AbortSignal.timeout(10000)});call.status=response.status;return response}catch(e){call.error=e.name;throw e}
}});
const results=[];
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const s=await mf.dispatchFetch(origin+'/api/session'),cookie=s.headers.get('set-cookie').split(';')[0],{csrf}=await s.json();
 let lastPost=0;
 const post=async(path,body)=>{await new Promise(r=>setTimeout(r,Math.max(0,1700-(Date.now()-lastPost))));lastPost=Date.now();const r=await mf.dispatchFetch(origin+'/api/'+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(path+': '+r.status);return r.json()};
 const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
 const csv=['name,company,website,email',...cases.map((c,i)=>[c.name,c.company,c.website,'audit'+i+'@example.invalid'].map(quote).join(','))].join('\n');
 const imported=await post('import',{csv});
 for(const [i,c] of cases.entries()){
  const ids=[imported.ids[i]],start=Date.now(),before=calls.length;
  const lead=await post('professional',{id:ids[0]}),p=lead.professional_context,current=(p?.people||[]).filter(p=>!p.historical);
  const outcome=c.expected==='role'?(current.length?current.every(p=>new RegExp(c.expected_role,'i').test(p.role))?'role_found':'role_mismatch':'unresolved'):current.length?'false_current_match':p?.status==='complete'&&p?.research_diagnostics?.pages_checked>p?.research_diagnostics?.source_failures?.length?'correct_abstention':'unassessed_control';
  const row={...c,outcome,elapsed_ms:Date.now()-start,requests:calls.slice(before),professional_context:p};results.push(row);
  await writeFile(output,JSON.stringify({at:new Date().toISOString(),limitations:'Public-biography convenience sample, not representative inbound accuracy. Expected labels and source URLs are not passed to research. Separate runs can encounter different availability. No paid endpoints or authorization permitted.',results},null,2));
  console.log(JSON.stringify({name:c.name,company:c.company,outcome,roles:current.map(p=>p.role),elapsed_ms:row.elapsed_ms,requests:row.requests.length}));
 }
 if(!calls.length)throw Error('Outbound accounting did not observe any requests');
}finally{await mf.dispose()}
