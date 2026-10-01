import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchMarkup} from '../static/research.js';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';
const email={from:'Jordan Lee <jordan@example.invalid>'};
test('email-backed role stays separate from researched fit and message content is escaped',()=>{
 const html=researchMarkup({company:'Acme',email_context:{from:email.from,text:'<script>bad()</script>',reported_role:'CEO'},inquiry:'Hello'}, {esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),date:String,icon:()=>''});
 assert.match(html,/Email-provided · Unverified/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('retired email endpoints reject both visitors and old external sync scripts',async()=>{
 const origin='https://assessment.test',network=createFetchMock();network.disableNetConnect();
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'email-test'},fetchMock:network});
 try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const response=await mf.dispatchFetch(origin+'/api/session'),cookie=response.headers.get('Set-Cookie').split(';')[0],session=await response.json();
 for(const suffix of ['','/connect','/disconnect','/stage','/approve','/dismiss','/ingest']){
  for(const method of ['GET','POST']){
   for(const headers of [{},{Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrf},{Authorization:'Bearer retired-token'}]){
    const r=await mf.dispatchFetch(origin+'/api/email'+suffix,{method,headers});assert.equal(r.status,404,suffix+' '+method);
   }
  }
 }
 assert.equal((await mf.dispatchFetch(origin+'/email-ui.js')).status,404);
 const html=await (await mf.dispatchFetch(origin)).text();
 assert.doesNotMatch(html,/emaildialog|email-open|Connect Gmail|Paste an email/);
 assert.match(html,/Connect Google Sheets/);assert.match(html,/Choose spreadsheet/);
 const app=await (await mf.dispatchFetch(origin+'/app.js')).text();assert.doesNotMatch(app,/setupEmail|email-ui/);assert.match(app,/Copy email/);
 const sheets=await mf.dispatchFetch(origin+'/api/sheets',{headers:{Cookie:cookie}});assert.equal(sheets.status,200);
 assert.equal((await db.prepare('SELECT count(*) AS total FROM email_connections').first()).total,0);
 assert.equal((await db.prepare('SELECT count(*) AS total FROM email_messages').first()).total,0);
 }finally{await mf.dispose()}
});
