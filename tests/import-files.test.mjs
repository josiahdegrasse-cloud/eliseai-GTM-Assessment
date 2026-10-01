import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../static/vendor/xlsx.mjs';
import {normalizeRows,gridRows} from '../static/import-data.js';
const grid=[['Full Name','Email Address','Company Name','Building Address','Website'],['Practice Person','practice@example.invalid','Acme Housing','12 Test Street','acmehousing.com']];
for(const bookType of ['xlsx','biff8','csv','txt'])test('reads lead values from '+bookType,()=>{
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(grid),'Leads');
 const bytes=XLSX.write(book,{type:'buffer',bookType}),loaded=XLSX.read(bytes,{type:'buffer',sheetRows:102,cellFormula:false});
 const rows=normalizeRows(gridRows(XLSX.utils.sheet_to_json(loaded.Sheets[loaded.SheetNames[0]],{header:1,raw:false,defval:''})));
 assert.equal(rows[0].name,'Practice Person');assert.equal(rows[0].property_address,'12 Test Street');assert.equal(rows[0].website,'acmehousing.com');
});
test('multiple worksheets retain selection and do not merge unrelated rows',()=>{
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Instructions'],['Use second tab']]),'Read me');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(grid),'Leads');const parsed=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.deepEqual(parsed.SheetNames,['Read me','Leads']);assert.equal(normalizeRows(gridRows(XLSX.utils.sheet_to_json(parsed.Sheets.Leads,{header:1})))[0].company,'Acme Housing');
});
test('validates required fields, aliases, duplicates and batch size',()=>{
 assert.throws(()=>normalizeRows([{name:'Only name'}]),/missing email, company/);
 assert.throws(()=>normalizeRows([{name:'A',email:'not-an-email',company:'C'}]),/email address/);
 assert.throws(()=>gridRows([['name','Name'],['A','B']]),/unique/);
 assert.throws(()=>normalizeRows([{name:'A',full_name:'B',email:'a@example.invalid',company:'C'}]),/conflicting/);
 assert.throws(()=>normalizeRows(Array(101).fill({})),/100/);
 assert.equal(normalizeRows([{first_name:'Jane',last_name:'Doe',email:'j@example.invalid',company:'Acme'}])[0].name,'Jane Doe');
 assert.deepEqual(normalizeRows([{name:'Partial'}],{allowIncomplete:true}),[]);
});
