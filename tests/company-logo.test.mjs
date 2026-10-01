import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {logoCandidates,safeLogoURL,logoImageRequest,logoImage,retrieveLogo} from '../website/company-logo.mjs';
import {knownCompanyLogo} from '../static/company-brands.js';
const page=html=>({code:200,data:{url:'https://acmehousing.com/',httpStatus:200,html}});
test('empty metadata and partner logos on the same host cannot become company branding',()=>{
 const c=logoCandidates(page('<script type="application/ld+json">{"@type":"Organization","name":"Acme Housing"}</script><img alt="Charity partner logo" src="/partner.png"><img alt="Acme Housing logo" src="data:image/svg+xml,placeholder" data-lazy-src="/acme-white.png">'),'acmehousing.com','Acme Housing');
 assert.equal(safeLogoURL(undefined,'https://acmehousing.com/'),'');
 assert.deepEqual(c.map(x=>x.url),['https://acmehousing.com/acme-white.png']);
});
test('real prospect logos require both their verified name and domain',()=>{
 for(const [name,domain] of [['Herzog Property Management','herzogapartments.com'],['Trimark Property Management','trimarkpm.com'],['CPManagement','cpmanagement.com'],['AAMCI','aamci.com']]){
  assert.equal(knownCompanyLogo(name,domain).status,'found');assert.equal(knownCompanyLogo('Different Company',domain),null);
 }
});
test('logo discovery prefers matching organization metadata, then branded header, then declared site icon',()=>{
 const c=logoCandidates(page('<script type="application/ld+json">{"@type":"Organization","name":"Acme Housing","logo":"/official.png"}</script><img alt="Acme logo" src="/header.png"><link rel="icon" href="/favicon.ico">'),'acmehousing.com','Acme Housing');
 assert.deepEqual(c.map(x=>x.kind),['logo','logo','icon']);assert.equal(c[0].url,'https://acmehousing.com/official.png');
});
test('logo discovery excludes marketing images and unrelated vendor marks, preserves light-on-dark assets',()=>{
 const c=logoCandidates(page('<img alt="Apartments" src="/property.jpg"><img alt="Powered by OneTrust" src="https://cdn.cookielaw.org/logo.png"><img alt="Acme Housing" data-testid="header-logo-image" src="/logo-white.svg"><link rel="apple-touch-icon" href="/touch.png">'),'acmehousing.com','Acme Housing');
 assert.equal(c.length,2);assert.equal(c[0].theme,'dark');assert.equal(c[1].kind,'icon');
 assert.throws(()=>logoCandidates({...page(''),data:{url:'https://wrong.com/',html:''}},'acmehousing.com','Acme'));
});
test('logo URLs reject executable, private, credential-bearing and oversized targets',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,bad','https://127.0.0.1/logo','http://acmehousing.com/logo','https://user:pass@acmehousing.com/logo','https://acmehousing.com:9000/logo','https://acmehousing.com/a.js','https://acmehousing.com/'+ 'x'.repeat(1800)])assert.equal(safeLogoURL(url,'https://acmehousing.com/'),'');
 const req=logoImageRequest({url:'https://cdn.acmehousing.com/logo.svg?a=1&b=2',page_url:'https://acmehousing.com/'});assert.equal(new URL(req.url).hostname,'wsrv.nl');assert.equal(new URL(req.url).searchParams.get('output'),'png');assert.equal(req.options.redirect,'manual');
});
test('only bounded PNG images are returned to the browser',async()=>{
 const bytes=await readFile('test-data/logo-fixture.png');assert.match(await logoImage(new Response(bytes,{headers:{'Content-Type':'image/png'}})),/^data:image\/png;base64,/);
 for(const r of [new Response('<svg onload="bad()"/>',{headers:{'Content-Type':'image/svg+xml'}}),new Response('<html>',{headers:{'Content-Type':'image/png'}}),new Response(new Uint8Array(120001),{headers:{'Content-Type':'image/png'}}),new Response(null,{status:302})])await assert.rejects(logoImage(r));
 const oversized=new Uint8Array(bytes);new DataView(oversized.buffer).setUint32(16,999999);await assert.rejects(logoImage(new Response(oversized,{headers:{'Content-Type':'image/png'}})));
});
test('verified sample marks require matching company and exact public domain',()=>{
 for(const [company,website] of [['Greystar','https://www.greystar.com'],['Camden Property Trust','camdenliving.com'],['AMLI','amli.com']])assert.match(knownCompanyLogo(company,website).image,/^\/company-marks\/.*-v2\.png$/);
 for(const [company,website] of [['Greystar','unrelated.com'],['Another company','greystar.com'],['Greystar','greystar.com.attacker.org'],['Greystar','http://greystar.com'],['Greystar','https://user:pass@greystar.com']])assert.equal(knownCompanyLogo(company,website),null);
 assert.ok(knownCompanyLogo('AMLI Residential','','contact@amli.com'));
});
test('logo candidates reserve icon fallbacks even when metadata contains many logos',()=>{
 const c=logoCandidates(page(Array.from({length:6},(_,i)=>`<img alt="Acme logo" src="/logo-${i}.png">`).join('')+'<link rel="icon" href="/favicon.ico">'),'acmehousing.com','Acme');
 assert.equal(c.filter(x=>x.kind==='logo').length,3);assert.equal(c.at(-1).kind,'icon');
 const params=new URL(logoImageRequest(c[0]).url).searchParams;assert.equal(params.get('w'),'480');assert.equal(params.get('page'),'-1');assert.ok(params.has('we'));
});
test('a missing logo falls back to a declared icon; total failure keeps initials available',async()=>{
 const bytes=await readFile('test-data/logo-fixture.png'),c=logoCandidates(page('<img alt="Acme logo" src="/logo.png"><link rel="icon" href="/favicon.ico">'),'acmehousing.com','Acme');let calls=0;
 const r=await retrieveLogo(c,async()=>++calls===1?new Response(null,{status:404}):new Response(bytes,{headers:{'Content-Type':'image/png'}}));assert.equal(r.kind,'icon');assert.equal(calls,2);
 assert.equal((await retrieveLogo(c,async()=>new Response(null,{status:503}))).status,'missing');
});
