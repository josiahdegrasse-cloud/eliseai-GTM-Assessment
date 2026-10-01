// The caller supplies the shared, dependency-free row parser as source text.
export function appsScript({origin,token,spreadsheet_id,tab_name},parser){
 const settings=JSON.stringify({origin,token,spreadsheet_id,tab_name}).replace(/</g,'\\u003c');
 return `/** @OnlyCurrentDoc */
// Inbound Desk — free Google Sheets connection.
// Connector v2: draft review columns and version-bound feedback.
// Run installInboundDesk once and approve Google's permission request.
${parser.replaceAll('export ','')}
const INBOUND_DESK = ${settings};
function installInboundDesk() {
 const config=INBOUND_DESK.token?INBOUND_DESK:JSON.parse(PropertiesService.getScriptProperties().getProperty('INBOUND_DESK_CONFIG')||'{}');
 if(!config.token)throw new Error('Create a connection in Inbound Desk before installing.');
 const sheet = SpreadsheetApp.getActiveSpreadsheet();
 if(!sheet || sheet.getId()!==config.spreadsheet_id) throw new Error('Install this script from Extensions → Apps Script in the connected sheet.');
 if (!sheet.getSheetByName(config.tab_name)) throw new Error('Worksheet tab not found: ' + config.tab_name);
 const tab=sheet.getSheetByName(config.tab_name);
 if(tab.getLastRow()===0){tab.getRange(1,1,1,9).setValues([['Name','Email','Company','Website','Property Address','City','State','Country','Inquiry']]);tab.setFrozenRows(1);}
 PropertiesService.getScriptProperties().setProperty('INBOUND_DESK_CONFIG', JSON.stringify(config));
 for (const trigger of ScriptApp.getProjectTriggers()) {
  if (['inboundDeskOnEdit','inboundDeskSync'].includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
 }
 ScriptApp.newTrigger('inboundDeskOnEdit').forSpreadsheet(sheet).onEdit().create();
 ScriptApp.newTrigger('inboundDeskOnEdit').forSpreadsheet(sheet).onFormSubmit().create();
 ScriptApp.newTrigger('inboundDeskSync').timeBased().everyMinutes(5).create();
 ensureInboundReviewColumns(tab);
 inboundDeskSync();
}
function inboundDeskOnEdit(event) {
 const config = JSON.parse(PropertiesService.getScriptProperties().getProperty('INBOUND_DESK_CONFIG') || '{}');
 if (event && event.range && event.range.getSheet().getName() !== config.tab_name) return;
 inboundDeskSync();
}
function inboundDeskSync() {
 const lock = LockService.getScriptLock();
 if (!lock.tryLock(1000)) return;
 try {
  const props = PropertiesService.getScriptProperties();
  const config = JSON.parse(props.getProperty('INBOUND_DESK_CONFIG') || '{}');
  if (!config.token) throw new Error('Run installInboundDesk first.');
  const book=SpreadsheetApp.getActiveSpreadsheet();
  if(!book||book.getId()!==config.spreadsheet_id)throw new Error('The script is not attached to the connected spreadsheet.');
  const sheet=book.getSheetByName(config.tab_name);
  if (!sheet) throw new Error('The connected worksheet was renamed or removed.');
  if (sheet.getLastRow() > 1001 || sheet.getLastColumn() > 100) throw new Error('Use a lead tab with at most 1,000 rows and 100 columns.');
  const call = (path,rows) => {
   const result = UrlFetchApp.fetch(config.origin + '/api/sheets/' + path, {
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer ' + config.token},
    payload:JSON.stringify({spreadsheet_id:config.spreadsheet_id,tab_name:config.tab_name,rows:rows || []}),muteHttpExceptions:true,followRedirects:false
   });
   let data;try{data=JSON.parse(result.getContentText());}catch(e){throw new Error('Inbound Desk is unavailable. The next check will retry.');}
   if(result.getResponseCode() !== 200) throw new Error(data.error || 'Sheet sync failed.');
   return data;
  };
  let pending=[];
  if(sheet.getLastRow()>1){
   const grid=sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getDisplayValues();
   const rows=normalizeRows(gridRows(grid),{max:1000,allowIncomplete:true});
   const saved=props.getProperties();
   for(const row of rows){
    const identity=[config.origin,config.token,row.email,row.company,row.property_address].join('|').toLowerCase();
    const key='inbound_sent_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,identity));
    if(!saved[key])pending.push({row,key});
   }
  }
  // Bounded work; the next five-minute check continues any remaining rows.
  for(let offset=0;offset<Math.min(pending.length,100);offset+=25){
   const batch=pending.slice(offset,offset+25);call('ingest',batch.map(x=>x.row));
   const saved={};for(const item of batch)saved[item.key]='1';props.setProperties(saved);
  }
  if(!pending.length)call('ingest',[]);
  // Research runs on the server even when the Inbound Desk page is closed.
  let researchError=null;try{for(let i=0;i<3;i++)if(!call('process').processed)break;}catch(error){researchError=error;}
  inboundDeskReviews(sheet,call);
  if(researchError)throw researchError;
  props.deleteProperty('INBOUND_LAST_ERROR');
  props.setProperty('INBOUND_LAST_SUCCESS',new Date().toISOString());
 } catch(error){
  PropertiesService.getScriptProperties().setProperty('INBOUND_LAST_ERROR',String(error.message||error).slice(0,300));
  throw error;
 } finally {lock.releaseLock();}
}
const INBOUND_REVIEW_HEADERS=['Inbound Draft ID','Email subject','Email draft','Company fit','Would send','Feedback reason','Review status'];
function ensureInboundReviewColumns(sheet){
 const columns=sheet.getLastColumn();
 const headers=sheet.getRange(1,1,1,columns).getDisplayValues()[0];
 const missing=INBOUND_REVIEW_HEADERS.filter(h=>!headers.some(v=>headerKey(v)===headerKey(h)));
 if(columns+missing.length>100)throw new Error('Make room for the review columns: this tab supports at most 100 columns.');
 if(missing.length)sheet.getRange(1,columns+1,1,missing.length).setValues([missing]);
}
function inboundDeskReviews(sheet,call){
 if(sheet.getLastRow()<2)return;
 ensureInboundReviewColumns(sheet);
 const grid=sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getDisplayValues(),headers=grid[0].map(headerKey),rows=[];
 for(let i=1;i<grid.length;i++){
  const raw=Object.fromEntries(headers.map((h,c)=>[h,grid[i][c]||'']));
  const normalized=normalizeRows([raw],{allowIncomplete:true});if(!normalized.length)continue;
  rows.push({number:i+1,raw,row:{...normalized[0],draft_id:raw.inbound_draft_id,would_send:raw.would_send,feedback_reason:raw.feedback_reason}});
 }
 const safe=value=>/^[=+@-]/.test(String(value||''))?"'"+value:String(value||'');
 for(let offset=0;offset<Math.min(rows.length,100);offset+=25){
  const batch=rows.slice(offset,offset+25),reviews=call('review',batch.map(r=>r.row)).reviews||[];
  reviews.forEach((r,i)=>{
   if(!r.draft_id)return;
   const entry=batch[i],changed=entry.raw.inbound_draft_id!==r.draft_id;
   const values={inbound_draft_id:r.draft_id,email_subject:r.subject,email_draft:r.draft,company_fit:r.fit,review_status:r.status};
   if(changed){values.would_send='';values.feedback_reason='';}
   for(const [key,value] of Object.entries(values)){const col=headers.indexOf(key);if(col>=0&&entry.raw[key]!==String(value||''))sheet.getRange(entry.number,col+1).setValue(safe(value));}
  });
 }
}
function disconnectInboundDeskTriggers(){
 for(const trigger of ScriptApp.getProjectTriggers())if(['inboundDeskOnEdit','inboundDeskSync'].includes(trigger.getHandlerFunction()))ScriptApp.deleteTrigger(trigger);
 const props=PropertiesService.getScriptProperties();for(const key of Object.keys(props.getProperties()))if(key==='INBOUND_DESK_CONFIG'||key.startsWith('inbound_sent_'))props.deleteProperty(key);
}
`;
}
