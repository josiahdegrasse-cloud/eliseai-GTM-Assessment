export function setupSheets({api,esc,load,toast}){
 const $=s=>document.querySelector(s);let connection=null,script='',polling=false;
 const stamp=seconds=>new Date(seconds*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 function render(c){
  connection=c;$('#sheets-status').textContent=!c?'New rows can arrive even while this page is closed.':c.status==='awaiting_setup'?'Waiting for setup in Google Sheets':c.status==='expired'?'Connection expired. Reconnect to resume.':c.last_error?'Sync needs attention: '+c.last_error+(c.last_sync_at?' · Last successful import '+stamp(c.last_sync_at):''):c.status==='overdue'?'No successful sync in over 15 minutes. Check Apps Script → Executions. Last sync '+stamp(c.last_sync_at):`Connected · ${c.tab_name} · ${c.received} leads added · Last successful import ${stamp(c.last_sync_at)}`;
  $('#sheets-upgrade').hidden=!c;$('#sheets-disconnect').hidden=!c;$('#sheets-open').textContent=c?'Connection settings':'Connect Google Sheets';
  if(c){$('#sheets-url').value='https://docs.google.com/spreadsheets/d/'+c.spreadsheet_id+'/edit';$('#sheets-tab').value=c.tab_name;}
  $('#sheets-live-status').textContent=c?$('#sheets-status').textContent:'';
 }
 $('#sheets-open').onclick=async()=>{try{render((await api('sheets')).connection);$('#sheetsdialog').showModal()}catch(e){toast(e.message)}};
 $('#sheets-upgrade').onclick=async()=>{try{script=(await api('sheets/script')).script;$('#sheets-script').value=script;$('#sheets-setup').hidden=false;$('#sheets-live-status').textContent='Replace the script in the same Apps Script project, then run installInboundDesk. Your existing connection key is reused; review columns are added.'}catch(e){toast(e.message)}};
 $('#close-sheets').onclick=()=>$('#sheetsdialog').close();
 $('#sheets-form').onsubmit=async e=>{
  e.preventDefault();$('#sheets-create').disabled=true;
  try{const result=await api('sheets/connect',{url:$('#sheets-url').value,tab_name:$('#sheets-tab').value});script=result.script;$('#sheets-script').value=script;$('#sheets-setup').hidden=false;await load();render((await api('sheets')).connection);$('#sheets-create').textContent='Replace connection key';}
  catch(error){$('#sheets-live-status').textContent=error.message}finally{$('#sheets-create').disabled=false}
 };
 $('#sheets-copy').onclick=async()=>{try{await navigator.clipboard.writeText(script);toast('Setup script copied.')}catch{$('#sheets-script').focus();$('#sheets-script').select();toast('Select and copy the setup script.')}};
 $('#sheets-download').onclick=()=>{const url=URL.createObjectURL(new Blob([script],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='InboundDesk.gs';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('#sheets-disconnect').onclick=async()=>{try{await api('sheets/disconnect',{});script='';$('#sheets-script').value='';$('#sheets-setup').hidden=true;render(null);await load();toast('Disconnected. Existing leads are kept.')}catch(e){toast(e.message)}};
 setInterval(async()=>{if(!connection||polling||document.hidden||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;polling=true;try{await load()}catch{}finally{polling=false}},20000);
 return {render};
}
