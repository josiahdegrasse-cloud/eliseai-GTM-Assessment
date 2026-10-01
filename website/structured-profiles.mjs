// Read public page data without executing scripts. Only explicit person records
// with sibling name and role fields become structured profile rows.
const compact=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\\u003[cC]/g,'<').replace(/\\u003[eE]/g,'>').replace(/&(?:amp|#38);/gi,'&').replace(/&(?:quot|#34);/gi,'"').replace(/\s+/g,' ').trim();
export function structuredProfiles(html){
 const profiles=[],links=[],seen=new Set();let budget=0;
 const visit=(value,depth=0)=>{
  if(depth>16||++budget>10000||!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const v of value.slice(0,500))visit(v,depth+1);return;}
  const name=typeof value.name==='string'?compact(value.name):'',role=compact(value.jobTitle||value.position||value.role||'');
  if(name&&name.length<100&&name.split(/\s+/).length>=2&&role.length<160&&/\b(chief|ceo|cfo|coo|president|director|manager|officer|founder|chair|head|partner|vice|vp|specialist|supervisor)\b/i.test(role)&&!seen.has(name+'|'+role)){
   seen.add(name+'|'+role);profiles.push({name,role});
  }
  for(const [k,v] of Object.entries(value)){
   if(['href','url','link'].includes(k)&&typeof v==='string'&&v.length<1500&&/^(?:https:\/\/|\/[^/])/.test(v))links.push({url:v,text:compact(value.text||value.label||value.title||'').slice(0,160)});
   if(typeof v==='object')visit(v,depth+1);
  }
 };
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/type\s*=\s*["']application\/(?:ld\+)?json["']|id\s*=\s*["']__NEXT_DATA__["']/i.test(m[1])||m[2].length>1000000)continue;
  try{visit(JSON.parse(m[2]))}catch{/* Invalid page data cannot become evidence. */}
 }
 return {profiles:profiles.slice(0,150),links:links.slice(0,500)};
}
