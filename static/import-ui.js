import {normalizeRows,gridRows} from './import-data.js';
export function setupImport({api,done,esc}){
 const $=s=>document.querySelector(s);let workbook=null,rows=[];
 const status=message=>$('#import-status').textContent=message;
 const reset=()=>{rows=[];$('#confirm-import').disabled=true;$('#import-preview').hidden=true;$('#import-preview-body').replaceChildren();};
 async function preview(){
  reset();try{
   const XLSX=await import('/vendor/xlsx.mjs'),sheet=workbook.Sheets[$('#import-sheet').value];
   if(sheet['!ref']&&XLSX.utils.decode_range(sheet['!ref']).e.c>=100)throw Error('Choose a worksheet with at most 100 columns.');
   const grid=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
   rows=normalizeRows(gridRows(grid));
   $('#import-preview-body').innerHTML=rows.slice(0,5).map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.company)}</td></tr>`).join('');
   $('#import-preview').hidden=false;$('#confirm-import').disabled=false;status(`${rows.length} lead${rows.length===1?'':'s'} ready. Showing the first ${Math.min(5,rows.length)}.`);
  }catch(e){status(e.message)}
 }
 $('#choose-csv').onclick=()=>$('#csvfile').click();
 $('#import-sheet').onchange=preview;
 $('#csvfile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;reset();$('#import-sheet-wrap').hidden=true;
  try{
   if(!/\.(?:csv|tsv|xlsx|xls)$/i.test(file.name))throw Error('Choose a CSV, TSV, XLSX or XLS file.');
   if(file.size>2*1024*1024)throw Error('Choose a spreadsheet under 2 MB.');
   status('Reading spreadsheet…');const XLSX=await import('/vendor/xlsx.mjs');
   workbook=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:102,cellHTML:false,cellFormula:false,bookVBA:false});
   if(!workbook.SheetNames.length)throw Error('No worksheets found.');
   $('#import-sheet').innerHTML=workbook.SheetNames.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');$('#import-sheet-wrap').hidden=workbook.SheetNames.length<2;
   $('#import-filename').textContent=file.name;await preview();
  }catch(e){status(e.message)}finally{event.target.value=''}
 };
 $('#confirm-import').onclick=async()=>{
  if(!rows.length)return;$('#confirm-import').disabled=true;
  try{status('Importing…');const result=await api('import-rows',{rows});await done(result);reset();status('');}
  catch(e){status(e.message);$('#confirm-import').disabled=false}
 };
}
