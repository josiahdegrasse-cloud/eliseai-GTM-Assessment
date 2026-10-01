// Each event carries only the saved, sanitized lead representation.
export async function readResearchStream(response,id,onPartial=()=>{}){
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error||'Research failed'),{status:response.status,code:data.code,retry_after:data.retry_after});
  if(data.id!==id)throw Error('Research returned a different lead');
  return data;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',complete=null;
 const event=line=>{
  if(!line.trim())return;
  const item=JSON.parse(line);
  if(item.type==='error')throw Object.assign(Error(item.error),{status:item.status,code:item.code,retry_after:item.retry_after});
  if(!['company','professional','complete'].includes(item.type)||item.lead?.id!==id)throw Error('Unexpected research result');
  if(item.type==='complete')complete=item.lead;else onPartial(item.lead,item.type);
 };
 try{
  while(true){const {done,value}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
   let end;while((end=buffer.indexOf('\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+1)}
   if(buffer.length>2000000)throw Error('Research response is too large');
   if(done)break;
  }
  if(buffer.trim())event(buffer);
  if(!complete)throw Error('Research connection ended early. Saved research remains available.');
  return complete;
 }catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
}
