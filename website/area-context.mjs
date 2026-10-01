// Public housing-market aggregates only. No contact data is sent to this API.
export const AREA_TABLES='B25064,B25003,B25024,B25070';
export function areaRequest(property){
 if(property?.status!=='matched'||!/^\d{11}$/.test(property.tract||''))return null;
 const geoid='14000US'+property.tract;
 return {geoid,url:'https://api.censusreporter.org/1.0/data/show/latest?'+new URLSearchParams({table_ids:AREA_TABLES,geo_ids:geoid}),options:{headers:{Accept:'application/json','User-Agent':'InboundDeskAssessment/1.0'},redirect:'manual',signal:AbortSignal.timeout(10000)}};
}
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<100000000?value:null;
const sum=values=>values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;
const pct=(n,d)=>n!==null&&d>0&&n<=d?Math.round(n/d*1000)/10:null;
export function areaEvidence(raw,property){
 const request=areaRequest(property),geoid=request?.geoid,record=raw?.data?.[geoid];
 if(!request||!record||!/^acs\d{4}_5yr$/.test(raw.release?.id||'')||!/^\d{4}-\d{4}$/.test(raw.release?.years||'')||typeof raw.geography?.[geoid]?.name!=='string')throw Error('Unexpected area data');
 const value=(table,column)=>numeric(record[table]?.estimate?.[column]);
 const error=(table,column)=>numeric(record[table]?.error?.[column]);
 const rent=value('B25064','B25064001'),rented=value('B25003','B25003003'),occupied=value('B25003','B25003001'),housing=value('B25024','B25024001');
 const groups=[['single','Single-family',[2,3]],['small','2–4 units',[4,5]],['apartments','5+ units',[6,7,8,9]],['other','Other',[10,11]]].map(([key,label,columns])=>{
  const cells=columns.map(n=>'B25024'+String(n).padStart(3,'0')),count=sum(cells.map(c=>value('B25024',c)));
  return {key,label,count,share:pct(count,housing),columns:cells};
 });
 const burden=sum([7,8,9,10].map(n=>value('B25070','B25070'+String(n).padStart(3,'0')))),burdenTotal=value('B25070','B25070001'),uncomputed=value('B25070','B25070011');
 const burdenBase=burdenTotal!==null&&uncomputed!==null?burdenTotal-uncomputed:null;
 if([rent,rented,housing].every(v=>v===null))throw Error('Area estimates unavailable');
 const retained=Object.fromEntries(AREA_TABLES.split(',').map(table=>[table,{estimate:Object.fromEntries(Object.entries(record[table]?.estimate||{}).filter(([key])=>new RegExp('^'+table+'\\d{3}$').test(key)).map(([key,v])=>[key,numeric(v)])),error:Object.fromEntries(Object.entries(record[table]?.error||{}).filter(([key])=>new RegExp('^'+table+'\\d{3}$').test(key)).map(([key,v])=>[key,numeric(v)]))}]));
 return {version:1,status:'available',geoid,tract:property.tract,geography:raw.geography[geoid].name.slice(0,180),period:raw.release.years,release:raw.release.id,provider:'U.S. Census ACS via Census Reporter',source_url:request.url,profile_url:'https://censusreporter.org/profiles/'+geoid+'/',retrieved_at:new Date().toISOString(),median_gross_rent:rent,rent_moe:error('B25064','B25064001'),renter_share:pct(rented,occupied),renter_households:rented,occupied_homes:occupied,housing_units:housing,housing_mix:groups,rent_burden_share:pct(burden,burdenBase),rent_burden_households:burden,rent_burden_base:burdenBase,estimates:retained};
}
