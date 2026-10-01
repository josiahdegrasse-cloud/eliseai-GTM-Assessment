import {Miniflare} from 'miniflare';
import {readFile,writeFile,readdir} from 'node:fs/promises';
if(!process.argv.includes('--live'))throw Error('Pass --live to run bounded public research with no credentials.');
const folder=new URL('../../evaluation/research-depth-2026-09-30/',import.meta.url),origin='https://assessment.test';
const {cases}=JSON.parse(await readFile(new URL('cases.json',folder),'utf8'));
const started_at=new Date().toISOString();
const outbound=[];const allowed=new Set(['dns.google','r.jina.ai','geocoding.geo.census.gov','api.gleif.org','api.censusreporter.org',...cases.map(c=>c.website).filter(Boolean)]);
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'disposable-practice-benchmark'},outboundService:async request=>{
 const u=new URL(request.url);if(u.protocol!=='https:'||request.method!=='GET'||![...allowed].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||request.headers.has('Authorization')||request.headers.has('x-api-key'))throw Error('Non-free or unrelated request blocked');
 const record={url:request.url,at:new Date().toISOString()};outbound.push(record);
 try{const r=await fetch(request.url,{method:'GET',headers:request.headers,redirect:'manual',signal:AbortSignal.timeout(10000)});record.status=r.status;return r}catch(e){record.error=e.name;throw e}
}});
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();

const bootstrap=await mf.dispatchFetch(origin+'/api/session',{headers:{Origin:origin}});
if(!bootstrap.ok)throw Error('Session '+bootstrap.status);
const cookie=bootstrap.headers.get('set-cookie').split(';')[0],{csrf}=await bootstrap.json();
const request=(path,body)=>mf.dispatchFetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
const post=async(path,body)=>{const r=await request(path,body);if(!r.ok)throw Error(path+' '+r.status+' '+(await r.text()).slice(0,200));return r.json()};
const results=[],checks=[];let cleaned=false;
const persist=()=>writeFile(new URL('local-results.json',folder),JSON.stringify({started_at,updated_at:new Date().toISOString(),site_version:"local research-depth changes",outbound,origin,limitations:'12-case convenience sample, not a representative accuracy estimate. Eight prechecked real professionals and four controls; example.invalid emails. No sending. Expected labels are not passed to the software. First-pass outcomes retained without selective retries. Source snapshots and live results reported separately.',results,checks,test_session_deleted:cleaned},null,2));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const [i,c] of cases.entries()){
  const start=Date.now(),row={case_number:i+1,input:c,events:[]};
  try{
   const {ids}=await post('add',{name:c.name,email:'practice.'+i+'@example.invalid',company:c.company,website:c.website,property_address:c.property_address||'',city:c.city||'',state:c.state||'',country:'US',inquiry:'Practice inquiry: interested in learning about automating leasing inquiries.'});
   const response=await request('process',{id:ids[0],stream:true});if(!response.ok)throw Error('Research '+response.status);
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',final;
   while(true){const chunk=await reader.read();buffer+=chunk.done?decoder.decode():decoder.decode(chunk.value,{stream:true});let end;
    while((end=buffer.indexOf('\n'))>=0){const event=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);row.events.push({type:event.type,elapsed_ms:Date.now()-start});
     if(event.type==='error')throw Error(event.error);
     if(event.type==='complete')final=event.lead;
     if(i===0&&event.type==='company'){await post('save',{id:ids[0],draft:'Practice draft saved while research is running.',reviewed:true});row.edit_during_research=true;}
    }if(chunk.done)break;
   }
   if(!final)throw Error('No complete result');row.lead=final;
   const p=final.professional_context,current=(p?.people||[]).filter(x=>!x.historical);
   row.role_outcome=c.expected==='role'?(current.length?(current.every(x=>new RegExp(c.expected_role,'i').test(x.role))?'correct_role':'incorrect_role'):'unresolved'):(current.length?'false_match':p?.status==='complete'?'abstained':'unassessed');
   row.fit_outcome=final.company_fit?.label===c.expected_fit?'expected':final.company_fit?.label==='Needs review'?'unresolved':'unexpected';
   row.elapsed_ms=Date.now()-start;
   row.brief_has_summary=!!final.research_brief?.summary?.text;row.contact_insights=p?.insights?.length||0;
   row.has_draft=!!final.draft;row.company_snapshot=!!final.company_snapshot;row.company_stale=!!final.company_stale;
   if(i===0){const response=await mf.dispatchFetch(origin+'/api/state',{headers:{Cookie:cookie}});const saved=(await response.json()).leads.find(l=>l.id===ids[0]);checks.push({check:'Saved draft persists after research completes',passed:saved?.draft==='Practice draft saved while research is running.'});}
   checks.push({check:'No reported paid contact research '+c.name,passed:p?.cost_dollars===0&&(p?.research_diagnostics?.paid_requests||0)===0});
   console.log(JSON.stringify({case:i+1,name:c.name,company:c.company,role:row.role_outcome,roles:current.map(x=>x.role),fit:final.company_fit?.label,summary:row.brief_has_summary,snapshot:row.company_snapshot,stale:row.company_stale,seconds:Math.round(row.elapsed_ms/1000)}));
   if(i===3){const repeat=await post('add',{name:c.name,email:'practice.'+i+'@example.invalid',company:c.company,website:c.website});checks.push({check:'Duplicate lead is not inserted twice',passed:repeat.duplicates===1});}
  }catch(e){row.error=e.message;row.elapsed_ms=Date.now()-start;console.log(JSON.stringify({case:i+1,name:c.name,error:e.message}));}
  results.push(row);await persist();if(i<cases.length-1)await wait(Math.max(0,14000-(Date.now()-start)));
 }
}finally{
 try{await post('session/delete',{});cleaned=true;}catch(e){checks.push({check:'Temporary session cleanup',passed:false,error:e.message})}
 await persist();await mf.dispose();
}
console.log('Complete: '+results.length+' cases. Temporary session deleted: '+cleaned);
