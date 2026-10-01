// Isolated local review: never reads production credentials or calls the Internet.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';
const port=Number(process.env.PREVIEW_PORT||8765),origin='https://assessment.test';
const recovery=process.env.PREVIEW_RESEARCH_MODE==='recover',blocked=process.env.PREVIEW_RESEARCH_MODE==='blocked',fixture=recovery||blocked||process.env.PREVIEW_RESEARCH_MODE==='fixture';
const network=createFetchMock();network.disableNetConnect();
// Optional captured public brand responses support offline visual review only.
const brands=process.env.PREVIEW_BRAND_DATA?JSON.parse(await readFile(process.env.PREVIEW_BRAND_DATA,'utf8')):{};
const logoFixture=await readFile('test-data/logo-fixture.png');
const areaFixture=JSON.parse(await readFile('test-data/area-fixture.json','utf8'));
network.get('https://api.censusreporter.org').intercept({path:/^\/1.0\/data\/show\/latest\?/,method:'GET'}).reply(fixture?200:503,fixture?areaFixture:{}).persist();
const aerials=process.env.PREVIEW_AERIAL_DATA?JSON.parse(await readFile(process.env.PREVIEW_AERIAL_DATA,'utf8')):{};
network.get('https://imagery.nationalmap.gov').intercept({path:/^\/arcgis\/rest\/services\/USGSNAIPImagery\/ImageServer\/exportImage\?/,method:'GET'}).reply(200,options=>{
 const bbox=new URL(options.path,'https://imagery.nationalmap.gov').searchParams.get('bbox'),image=aerials[bbox];
 return image?Buffer.from(image.split(',')[1],'base64'):Buffer.from('Unavailable');
},{headers:{'Content-Type':'image/jpeg'}}).persist();
network.get('https://r.jina.ai').intercept({path:/^\/https:\/\//,method:'GET',headers:{'x-respond-with':'html'}}).reply(200,options=>{
 const d=new URL(options.path.slice(1)).hostname.replace(/^www\./,'');
 return brands[d]?.page||{code:200,data:{url:'https://acmehousing.com/',httpStatus:200,html:'<header><img src="/logo.png" alt="Acme Housing logo"></header>'}};
}).persist();
network.get('https://wsrv.nl').intercept({path:/^\/\?/,method:'GET'}).reply(200,options=>{
 const source=new URL(options.path,'https://wsrv.nl').searchParams.get('url');
 const logo=Object.values(brands).find(b=>b.logo.source_url===source)?.logo;
 return logo?Buffer.from(logo.image.split(',')[1],'base64'):fixture?logoFixture:Buffer.from('Unavailable');
},{headers:{'Content-Type':'image/png'}}).persist();
// Synthetic professional pages exist only in the explicit offline fixture mode.
if(fixture){
 network.get('https://dns.google').intercept({path:/^\/resolve\?name=acmehousing.com&type=/,method:'GET'}).reply(200,o=>({Status:0,Answer:o.path.endsWith('type=A')?[{type:1,data:'93.184.216.34'}]:[]})).persist();
 network.get('https://acmehousing.com').intercept({path:'/robots.txt',method:'GET'}).reply(200,'User-agent: *\nAllow: /').persist();
 network.get('https://acmehousing.com').intercept({path:'/',method:'GET'}).reply(200,'<title>Acme Housing</title><a href="/our-team">Our team</a>',{headers:{'Content-Type':'text/html'}}).persist();
 network.get('https://acmehousing.com').intercept({path:'/our-team',method:'GET'}).reply(200,'<title>Acme Housing — synthetic preview</title><h2>Jordan Lee</h2><p>Director of Property Operations</p><p>Jordan Lee oversees property operations and leasing across eight communities at Acme Housing.</p>',{headers:{'Content-Type':'text/html'}}).delay(3000).persist();
}
if(blocked){
 network.get('https://r.jina.ai').intercept({path:'/https://acmehousing.com/company',method:'GET'}).reply(200,{code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/company',httpStatus:200,content:'Acme Housing manages residential communities and leasing inquiries. We own and manage 200 apartment homes.'}}).persist();
 network.get('https://r.jina.ai').intercept({path:/^\/https:\/\//,method:'GET'}).reply(403,{}).persist();
 network.get('https://s.jina.ai').intercept({path:/^\//,method:'GET'}).reply(200,{code:200,data:[]}).persist();
}
if(recovery)network.get('https://r.jina.ai').intercept({path:/^\/https:\/\//,method:'GET'}).reply(429,{}, {headers:{'Retry-After':'60'}});
network.get('https://r.jina.ai').intercept({path:/^\/https:\/\//,method:'GET'}).reply(fixture?200:503,fixture?{code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',httpStatus:200,content:'Acme Housing manages residential communities and leasing inquiries. We own and manage 200 apartment homes.',html:'<header><img src="/logo.png" alt="Acme Housing logo"></header><script type="application/ld+json">{"@type":"Organization","name":"Acme Housing","address":{"streetAddress":"12 Main Street, Suite 300","addressLocality":"Raleigh","addressRegion":"NC","postalCode":"27601","addressCountry":"US"}}</script>'}}:{}).delay(fixture?1800:1).persist();
network.get('https://api.gleif.org').intercept({path:/^\/api\/v1\/lei-records\?/,method:'GET'}).reply(200,{data:fixture?[{attributes:{lei:'549300TESTEXAMPLE001',entity:{legalName:{name:'Acme Housing'},status:'ACTIVE',headquartersAddress:{city:'Raleigh',region:'US-NC',country:'US'}},registration:{lastUpdateDate:'2026-09-01T00:00:00Z'}}}]:[]}).persist();
network.get('https://geocoding.geo.census.gov').intercept({path:/^\/geocoder\/geographies\/(?:onelineaddress|address)\?/,method:'GET'}).reply(fixture?200:503,fixture?{result:{addressMatches:[{matchedAddress:'12 TEST STREET, RALEIGH, NC',addressComponents:{city:'RALEIGH',state:'NC',zip:'27601'},coordinates:{x:-78.6382,y:35.7796},geographies:{Counties:[{NAME:'Wake County'}],'Census Tracts':[{GEOID:'37183000100'}]}}]}}:{}).delay(fixture?1800:1).persist();
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:{PUBLIC_ORIGIN:origin,RATE_LIMIT_SALT:'disposable-local-preview',...(fixture?{JINA_API_KEY:'preview-credential'}:{})},fetchMock:network});
const db=await mf.getD1Database('DB');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
const server=createServer(async(req,res)=>{try{
 const data=[];for await(const chunk of req)data.push(chunk);
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
 if(headers.get('origin')===`http://127.0.0.1:${port}`)headers.set('origin',origin);
 if(headers.get('cookie'))headers.set('cookie',headers.get('cookie').replaceAll('preview-visitor=','__Host-inbound-visitor='));
 const reply=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(data)});
 res.statusCode=reply.status;for(const [k,v] of reply.headers)res.setHeader(k,k==='set-cookie'?v.replace('__Host-inbound-visitor=','preview-visitor=').replace('; Secure',''):v);
 if(reply.body){for await(const chunk of reply.body)res.write(Buffer.from(chunk))}res.end();
}catch{res.statusCode=500;res.end('Local preview unavailable. Run pnpm build before pnpm preview.')}});
server.listen(port,'127.0.0.1',()=>console.log(`Local URL: http://127.0.0.1:${port}/ (${fixture?'synthetic Acme fixtures':'saved public-source fallback'}; no external API calls)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await mf.dispose();process.exit(0)});
