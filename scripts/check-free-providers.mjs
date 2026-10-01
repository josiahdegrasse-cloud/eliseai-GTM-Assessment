// Opt-in live smoke check. Uses only public samples, an ephemeral D1 and keyless APIs.
// Never reads production configuration, secrets or visitor data. No Exa calls.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import Papa from 'papaparse';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live')){console.error('Use --live for up to four Jina, one GLEIF, one Census Reporter and two Census requests per sample. --extended adds five company-only cases; --aerial checks available imagery; --contacts checks the 12-contact set; --logos checks company marks; --one-line tests full pasted property addresses; --unique checks one contact per company.');process.exit(1)}
const outputIndex=process.argv.indexOf('--output'),output=outputIndex>=0?process.argv[outputIndex+1]:null,report=[];
const origin='https://assessment.test';
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'disposable-live-check'}});
try{
 const db=await mf.getD1Database('DB');
 for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const session=await mf.dispatchFetch(origin+'/api/session'),cookie=session.headers.get('Set-Cookie').split(';')[0],{csrf}=await session.json();
 let lastResearch=0;
 const post=async(path,body)=>{if(path==='/api/process'){await new Promise(resolve=>setTimeout(resolve,Math.max(0,11000-(Date.now()-lastResearch))));lastResearch=Date.now()}const r=await mf.dispatchFetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Application request failed: '+r.status);return r.json()};
 const samples=Papa.parse(await readFile(process.argv.includes('--contacts')?'test-data/contact-validation-samples.csv':'test-data/public-company-samples.csv','utf8'),{header:true,skipEmptyLines:true}).data;
 if(process.argv.includes('--extended'))samples.push(...Papa.parse(await readFile('test-data/additional-company-samples.csv','utf8'),{header:true,skipEmptyLines:true}).data);
 const companyIndex=process.argv.indexOf('--company');if(companyIndex>=0)samples.splice(0,samples.length,...samples.filter(s=>s.company===process.argv[companyIndex+1]));
 if(process.argv.includes('--unique')){const seen=new Set();samples.splice(0,samples.length,...samples.filter(s=>!seen.has(s.website)&&seen.add(s.website)))}
 if(process.argv.includes('--one-line'))for(const sample of samples){sample.property_address=[sample.property_address,sample.city,sample.state].filter(Boolean).join(', ');sample.city='';sample.state=''}
 const providerCount=async()=>Number((await db.prepare("SELECT coalesce(sum(n),0) AS n FROM request_limits WHERE bucket LIKE 'provider:%:global:%'").first()).n);
 const savedDrafts=new Map();
 for(const sample of samples){
  const started=Date.now();
  const {ids}=await post('/api/add',sample),initialCalls=await providerCount(),start=Date.now(),lead=await post('/api/process',{id:ids[0]});
  const first=sample.name.trim().split(/\s+/)[0];assert.ok(lead.draft.startsWith(`Hi ${first},\n`),'Greeting must use this contact’s first name');
  assert.equal(lead.priority.readiness,0,'An inquiry alone must not award buying-readiness points');
  const row={account_summary:lead.research_brief.summary?.text,account_context:lead.research_brief.context,property_count:lead.research_brief.property_count?.value,area_status:lead.area_context?.status,area_rent:lead.area_context?.median_gross_rent,area_period:lead.area_context?.period,priority:lead.priority,contact:sample.name,company:sample.company,greeting:lead.draft.split('\n')[0],initial_provider_calls:(await providerCount())-initialCalls,elapsed_ms:Date.now()-start,engine:lead.company_engine,company_stale:lead.company_stale,sample_snapshot:lead.company_snapshot,sources:lead.research_brief.sources.map(s=>({url:s.url,provider:s.provider})),fit:lead.fit.label,portfolio:lead.research_brief.portfolio?.value||null,footprint:lead.research_brief.footprint?.value||null,registry_status:lead.registry_context.status||'unavailable',census_status:lead.property_context.status,census_stale:!!lead.property_context.stale};
  console.log(JSON.stringify(row));
  // Cache validation calls the app only. Fresh results require no new provider call.
  const before=(await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%:global:%'").first()).n;
  await post('/api/process',{id:ids[0]});
  const after=(await db.prepare("SELECT sum(n) AS n FROM request_limits WHERE bucket LIKE 'provider:%:global:%'").first()).n;
  console.log(JSON.stringify({company:sample.company,repeat_provider_calls:after-before}));
  row.repeat_provider_calls=after-before;
  if(process.argv.includes('--aerial')&&lead.property_context.status==='matched'){const image=await post('/api/property-image',{id:ids[0]});row.aerial_status=image.status;console.log(JSON.stringify({company:sample.company,aerial_status:image.status,image_bytes:image.image?.length||0}));}
  if(process.argv.includes('--logos')){
   const beforeLogo=await providerCount(),logo=await post('/api/logo',{id:ids[0]});
   row.logo_status=logo.status;row.logo_kind=logo.kind||null;row.logo_reader_calls=(await providerCount())-beforeLogo;
   const beforeRepeat=await providerCount();await post('/api/logo',{id:ids[0]});row.repeat_logo_reader_calls=(await providerCount())-beforeRepeat;
   assert.equal(row.repeat_logo_reader_calls,0,'Repeated logo must reuse the result or cooldown');
   console.log(JSON.stringify({contact:sample.name,logo_status:row.logo_status,logo_reader_calls:row.logo_reader_calls}));
  }
  if(process.argv.includes('--contacts')){
   const edited=lead.draft+'\n\n[TEST saved draft for '+sample.name+']';
   await post('/api/save',{id:lead.id,subject:lead.subject,draft:edited,notes:'Private test note for '+sample.email,reviewed:true});
   savedDrafts.set(lead.id,{draft:edited,notes:'Private test note for '+sample.email});
   const refreshed=await post('/api/process',{id:lead.id});assert.equal(refreshed.draft,edited,'Research must preserve edited text');
   const state=await (await mf.dispatchFetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();
   for(const [id,saved] of savedDrafts){const current=state.leads.find(l=>l.id===id);assert.equal(current.draft,saved.draft);assert.equal(current.notes,saved.notes)}
   const duplicate=await post('/api/add',sample);assert.equal(duplicate.inserted,0);assert.equal(duplicate.duplicates,1);
   row.contact_checks='greeting, draft preservation, separate notes and duplicate intake passed';
  }
  report.push({...row,lead});if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
  if(sample!==samples.at(-1))await new Promise(resolve=>setTimeout(resolve,Math.max(0,(process.argv.includes('--contacts')?31000:22000)-(Date.now()-started))));
 }
}finally{await mf.dispose()}
