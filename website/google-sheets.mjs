import {normalizeRows} from '../static/import-data.js';
import {Failure} from './provider-control.mjs';
import {trackRun} from './quality-history.mjs';
import {identity,presentLead} from './domain.mjs';
export function sheetSettings(body){
 let id=String(body.spreadsheet_id||body.url||'').trim();
 if(id.startsWith('https://')){let u;try{u=new URL(id)}catch{}if(u?.hostname!=='docs.google.com')throw new Failure('Use a Google Sheets URL.');id=u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1]||'';}
 if(!/^[\w-]{20,160}$/.test(id))throw new Failure('Paste the Google Sheets URL.');
 const tab=String(body.tab_name||'').trim();if(!tab||tab.length>100)throw new Failure('Enter the worksheet tab name, for example Leads.');
 return {spreadsheet_id:id,tab_name:tab};
}
export async function sheetStatus(env,session,stmt){
 const c=await stmt(env,'SELECT id,spreadsheet_id,tab_name,created_at,expires,last_sync_at,received,last_error FROM sheet_connections WHERE session_id=?',session.id).first();
 return c?{...c,status:c.expires<=Math.floor(Date.now()/1000)?'expired':c.last_error?'attention':c.last_sync_at&&Date.now()/1000-c.last_sync_at>900?'overdue':c.last_sync_at?'connected':'awaiting_setup'}:null;
}
export async function sheetWebhook(req,env,ctx,h){
 const {stmt,digest,readBody,count,add,research,saveAssessment}=h,now=Math.floor(Date.now()/1000),token=req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(req.method!=='POST'||!token)throw new Failure('Invalid sheet connection.',401);
 const c=await stmt(env,'SELECT c.*,s.csrf FROM sheet_connections c JOIN visitor_sessions s ON s.id=c.session_id WHERE c.token_hash=? AND c.expires>? AND s.expires>?',await digest(token),now,now).first();
 if(!c)throw new Failure('Sheet connection expired or disconnected. Reconnect in Inbound Desk.',401);
 const session={id:c.session_id,csrf:c.csrf};await count(env,`sheets:${c.id}:${Math.floor(now/60)}`,30,now+120);
 const body=await readBody(req);if(body.spreadsheet_id!==c.spreadsheet_id||body.tab_name!==c.tab_name)throw new Failure('This key belongs to a different spreadsheet or tab.',403);
 return trackRun(env,session,null,'sheets',async()=>{try{
  if(new URL(req.url).pathname==='/api/sheets/review'){
   if(!Array.isArray(body.rows)||body.rows.length>25)throw new Failure('Review up to 25 rows at a time.');
   const reviews=[];
   for(const input of body.rows){
    const row=normalizeRows([input])[0];
    const record=await stmt(env,"SELECT id,data,version FROM visitor_leads WHERE session_id=? AND identity=? AND json_extract(data,'$.sheet_connection_id')=?",session.id,identity(row),c.id).first();
    if(!record){reviews.push({status:'Not imported yet'});continue}
    const lead=presentLead(JSON.parse(record.data)),revision=await digest(JSON.stringify([lead.subject,lead.draft]));
    let status='Ready for review';
    const verdict=String(input.would_send||'');
    if(verdict){
     if(!['Would send','Would not send'].includes(verdict))status='Choose Would send or Would not send';
     else if(input.draft_id!==revision)status='Draft changed — review this version';
     else{
      const reason=String(input.feedback_reason||'').slice(0,1500);
      if(lead.would_send!==verdict||lead.feedback_reason!==reason||lead.reviewed_draft_id!==revision){
       Object.assign(lead,{would_send:verdict,feedback_reason:reason,reviewed_draft_id:revision});
       const saved=await stmt(env,'UPDATE visitor_leads SET data=?,version=version+1 WHERE id=? AND session_id=? AND version=?',JSON.stringify(lead),lead.id,session.id,record.version).run();
       if(saved.meta.changes)await saveAssessment(env,session,lead,'sheet feedback');else{reviews.push({status:'Lead changed during sync — retry'});continue}
      }
      status='Feedback saved';
     }
    }
    reviews.push({draft_id:revision,subject:lead.subject,draft:lead.draft,fit:lead.company_fit.label,status,research_state:lead.research_state});
   }
   return {reviews};
  }
  if(new URL(req.url).pathname==='/api/sheets/ingest'){
   if(!Array.isArray(body.rows)||body.rows.length>25)throw new Failure('Send up to 25 complete rows at a time.');
   let rows;try{rows=body.rows.length?normalizeRows(body.rows,{max:25}):[]}catch(e){throw new Failure(e.message)}
   const result=rows.length?await add(env,session,rows,false,{source_type:'google_sheets',sheet_connection_id:c.id}):{inserted:0,duplicates:0,ids:[]};
   await stmt(env,'UPDATE sheet_connections SET last_sync_at=?,received=received+?,last_error=NULL WHERE id=?',now,result.inserted,c.id).run();
   return {inserted:result.inserted,duplicates:result.duplicates};
  }
  await count(env,`sheet-research:${session.id}:${Math.floor(now/60)}`,3,now+120);
  const record=await stmt(env,"SELECT id FROM visitor_leads WHERE session_id=? AND json_extract(data,'$.sheet_connection_id')=? AND json_extract(data,'$.automation_pending')=1 AND processing_until<? AND (json_extract(data,'$.company_retry_after') IS NULL OR json_extract(data,'$.company_retry_after')<=?) ORDER BY rowid LIMIT 1",session.id,c.id,now,new Date().toISOString()).first();
  if(!record)return {processed:false};
  const lead=await research(env,session,record.id);
  return {processed:true,research_state:lead.research_state};
 }catch(e){await stmt(env,'UPDATE sheet_connections SET last_error=? WHERE id=?',e instanceof Failure?e.message:'Sync interrupted. The next scheduled check will retry.',c.id).run();throw e;}});
}
