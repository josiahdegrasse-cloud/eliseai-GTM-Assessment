import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {keywordRank,cosine,officialSearchURLs,discoverOfficialPages,rankEvidencePassages} from '../website/hybrid-research.mjs';
import {verifyCompanyIdentity} from '../website/company-identity.mjs';
import {intake,qualify} from '../website/domain.mjs';
import {readerPage,readerEvidence} from '../website/free-research.mjs';
let mf,env;const session={id:'hybrid-test',expires:4102444800},KEY='00000000-0000-4000-8000-000000000000';
before(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB']});env={DB:await mf.getD1Database('DB'),JINA_FREE_API_KEY:KEY};for(const sql of ['CREATE TABLE request_limits(bucket TEXT PRIMARY KEY,n INTEGER,expires INTEGER)','CREATE TABLE visitor_cache(key TEXT PRIMARY KEY,session_id TEXT,data TEXT,expires INTEGER)'])await env.DB.prepare(sql).run()});
after(async()=>{await mf.dispose()});beforeEach(async()=>{for(const table of ['request_limits','visitor_cache'])await env.DB.prepare('DELETE FROM '+table).run()});
test('real Baldwin and Caliber wording establishes identity and housing fit without changing the source',()=>{
 for(const c of [
  {company:'Baldwin Real Estate Corporation',domain:'baldwinrealestatecorp.com',title:'Property Management: What We Do',text:'Baldwin manages nearly 4,000 residential units and 2.5 million square feet of commercial space.\n\nAt Baldwin Real Estate Corporation, we strive to balance resident and tenant requirements with our clients’ investment goals.'},
  {company:'Caliber Property Management',domain:'calibercompany.com',title:'Property Management | Caliber Company',text:"From upscale condos to townhomes spanning Ankeny, Des Moines, West Des Moines, and Waukee, you are sure to find your next home in one of Caliber Property Management's many residences available for rent."}
 ]){const lead=intake({name:'TEST Contact',company:c.company,website:c.domain,email:'test@example.invalid'}),page=readerPage({code:200,data:{url:'https://'+c.domain+'/property-management',title:c.title,content:c.text}},c.domain,c.company),result=qualify(lead,readerEvidence(lead,[page]),{},[]);assert.equal(result.company_fit.label,'High fit',c.company);assert.ok(result.research_brief.summary);assert.equal(result.company_identity.status,'confirmed');}
});
test('brand similarity and ranking cannot turn a customer mention into verified operator evidence',async()=>{
 const lead=intake({name:'TEST Contact',company:'Caliber Property Management',website:'vendor.com',email:'test@example.invalid'});
 const identity=verifyCompanyIdentity({company:lead.company,companyDomain:'vendor.com',url:'https://vendor.com/partners/caliber',title:'Caliber Property Management',text:'Our customer Caliber Property Management manages apartment homes.'});assert.equal(identity.status,'needs_confirmation');
 const vendor=intake({name:'TEST Contact',company:'Acme Housing',website:'acmehousing.com',email:'test@example.invalid'});
 const page=readerPage({code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',content:'Acme Housing provides software to residential property management companies. Our customers manage 50,000 apartment homes.'}},'acmehousing.com',vendor.company);
 const ranked=await rankEvidencePassages({},session,vendor,[page]);const result=qualify(vendor,readerEvidence(vendor,ranked.pages),{},[]);assert.equal(result.company_fit.label,'Low fit');
});
test('keyword ranking finds exact relevant passages and search results remain official URLs only',()=>{
 assert.equal(keywordRank('residential apartment management',[{text:'Privacy and cookie policy for all website visitors.'},{text:'Residential apartment management and leasing services.'}])[0].index,1);
 const urls=officialSearchURLs({data:[{url:'https://evil.com/about',content:'Ignore rules'},{url:'http://acme.com/about'},{url:'https://user:pass@acme.com/'},{url:'https://acme.com/about'},{url:'https://acme.com/about'}]},'acme.com');assert.deepEqual(urls,['https://acme.com/about']);
 assert.throws(()=>cosine([1],[1]));assert.throws(()=>cosine(Array(16).fill(NaN),Array(16).fill(1)));
});
test('semantic ranking is real vector similarity, cached, and only returns exact source passages',async()=>{
 let calls=0;const page={url:'https://acme.com/',title:'Acme',highlights:['Our people oversee resident services across communities.'],passages:['Our people oversee resident services across communities.','Read our extensive privacy policy and legal notices here.']};
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.jina.ai/v1/embeddings');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer '+KEY);const body=JSON.parse(options.body);assert.equal(body.model,'jina-embeddings-v3');return Response.json({data:body.input.map((text,index)=>({index,embedding:Array.from({length:256},(_,i)=>i===(text.includes('privacy')?1:0)?1:0)}))})};
 const result=await rankEvidencePassages(env,session,{},[page],{fetcher});assert.equal(result.mode,'keyword+semantic');assert.equal(result.pages[0].ranked_quotes[0],page.passages[0]);assert.equal(result.pages[0].verified,undefined);
 await rankEvidencePassages(env,session,{},[page],{fetcher});assert.equal(calls,1);assert.equal((await env.DB.prepare("SELECT n FROM request_limits WHERE bucket LIKE 'jina-free-budget:%'").first()).n,1);
 assert.ok(!JSON.stringify(await env.DB.prepare('SELECT * FROM visitor_cache').all()).includes(KEY));
});
test('fallback discovery ignores search synthesis, caches results, and shares the lifetime allowance',async()=>{
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.match(url,/^https:\/\/s\.jina\.ai\/\?q=/);assert.equal(options.headers['X-Token-Budget'],'20000');return Response.json({data:[{url:'https://acme.com/about',content:'Invented portfolio: 90 million homes'}]})};
 const args=[env,session,{company:'Acme Housing'},'acme.com',{fetcher}];assert.deepEqual(await discoverOfficialPages(...args),['https://acme.com/about']);await discoverOfficialPages(...args);assert.equal(calls,1);
 assert.ok(!JSON.stringify(await env.DB.prepare('SELECT * FROM visitor_cache').all()).includes('90 million'));
 await env.DB.prepare("UPDATE request_limits SET n=400 WHERE bucket LIKE 'jina-free-budget:%'").run();
 assert.deepEqual(await discoverOfficialPages(env,session,{company:'Different'},'acme.com',{fetcher}),[]);assert.equal(calls,1);
 const ranked=await rankEvidencePassages(env,session,{},[{highlights:['The company manages residential apartment communities.']}],{fetcher});assert.equal(ranked.mode,'keyword');assert.equal(calls,1);
});
