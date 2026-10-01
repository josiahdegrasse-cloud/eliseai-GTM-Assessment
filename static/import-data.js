// Shared header normalization and validation for files and Google Sheets.
const aliases={name:['name','full_name','contact','contact_name','person','person_name'],email:['email','email_address','contact_email','work_email'],company:['company','company_name','organization','account','account_name'],website:['website','company_website','domain','company_domain'],property_address:['property_address','building_address','street_address','address'],city:['city','property_city'],state:['state','province','region'],postal_code:['postal_code','zip','zip_code','zipcode'],country:['country'],inquiry:['inquiry','message','notes','reason_for_reaching_out'],research_url:['research_url','official_research_page']};
export const headerKey=value=>String(value??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export function normalizeRows(rows,{max=100,allowIncomplete=false}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>max)throw Error(`Choose between 1 and ${max} leads.`);
 const out=[],errors=[];
 for(const [i,row] of rows.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Each lead must have named columns.');
  const columns=Object.fromEntries(Object.entries(row).map(([k,v])=>[headerKey(k),v]));
  const lead={};
  for(const [key,names] of Object.entries(aliases)){
   const used=names.filter(n=>Object.hasOwn(columns,n)&&String(columns[n]??'').trim());
   if(used.length>1&&new Set(used.map(n=>String(columns[n]).trim())).size>1)throw Error(`Row ${i+2}: conflicting ${key.replaceAll('_',' ')} columns.`);
   const value=columns[used[0]??names.find(n=>Object.hasOwn(columns,n))]??'';
   if(typeof value==='object')throw Error(`Row ${i+2}: use text values in each column.`);
   lead[key]=String(value).trim();if(lead[key].length>(key==='inquiry'?2000:1000))throw Error(`Row ${i+2}: ${key} is too long.`);
  }
  if(!lead.name)lead.name=[columns.first_name,columns.last_name].filter(Boolean).join(' ').trim();
  if(!Object.values(lead).some(Boolean))continue;
  const missing=['name','email','company'].filter(k=>!lead[k]);
  if(missing.length){if(allowIncomplete)continue;errors.push(`Row ${i+2}: missing ${missing.join(', ')}`);continue;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)){if(allowIncomplete)continue;errors.push(`Row ${i+2}: check the email address`);continue;}
  if(!lead.country)lead.country='US';out.push(lead);
 }
 if(errors.length)throw Error(errors.slice(0,3).join('. ')+(errors.length>3?` · ${errors.length-3} more rows need attention.`:'.'));
 if(!out.length&&!allowIncomplete)throw Error('No complete leads found. Include name, email and company columns.');
 return out;
}
export function gridRows(grid){
 if(!Array.isArray(grid)||grid.length<2)throw Error('Include a header row followed by leads.');
 const headers=grid[0].map(headerKey),used=headers.filter(Boolean);
 if(new Set(used).size!==used.length)throw Error('Column headers must be unique.');
 if(!headers.includes('name')&&!headers.some(h=>aliases.name.includes(h))&&!headers.includes('first_name'))throw Error('Add a Name or Full Name column.');
 return grid.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map(r=>Object.fromEntries(headers.flatMap((h,i)=>h?[[h,r[i]??'']]:[])));
}
