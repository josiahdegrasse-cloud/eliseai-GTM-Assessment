import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {publicAddress,robotsAllowed,boundedText} from '../website/direct-research.mjs';
import {readerPage,readerEvidence} from '../website/free-research.mjs';
import {buildBrief} from '../website/brief.mjs';
let mf;
before(()=>{mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js','**/*.mjs']}],scriptPath:'tests/direct-worker.mjs',compatibilityDate:'2026-07-01'})});
after(()=>mf.dispose());
const run=async input=>(await mf.dispatchFetch('https://test/',{method:'POST',body:JSON.stringify(input)})).json();
const url='https://acmehousing.com/about-us';
const html='<title>Acme Housing</title><nav>Acme Housing owns 999 apartments.<a href="/company">About</a></nav><script>Acme Housing owns 99999 apartment homes.</script><div hidden>Acme Housing owns 666 homes.</div><p>Acme Housing manages <b>residential</b> communities</p><p>We own and operate over 2,000 apartment homes in eight states.</p><p>Acme Housing is based in Raleigh &amp; serves the Southeast.</p>';
const responses=()=>Object.fromEntries([
 ['https://dns.google/resolve?name=acmehousing.com&type=A',{body:JSON.stringify({Status:0,Answer:[{type:1,data:'93.184.216.34'}]})}],
 ['https://dns.google/resolve?name=acmehousing.com&type=AAAA',{body:JSON.stringify({Status:0,Answer:[]})}],
 ['https://acmehousing.com/robots.txt',{body:'User-agent: *\nAllow: /'}],
 [url,{body:html}]
]);
test('direct HTML preserves readable inline claims, excludes scripts/hidden/navigation claims, retains discovery links',async()=>{
 const {result}=await run({html,url});assert.match(result.data.content,/manages residential communities/);assert.doesNotMatch(result.data.content,/999|666/);assert.match(result.data.content,/\[Company page\]\(https:\/\/acmehousing.com\/company\)/);
 const p={...readerPage(result,'acmehousing.com','Acme Housing'),provider:'Direct company website'};
 const lead={company:'Acme Housing',website:'acmehousing.com',email:'a@acmehousing.com'},evidence=readerEvidence(lead,[p]).evidence,b=buildBrief({...lead,evidence},'acmehousing.com');
 assert.equal(evidence[0].provider,'Direct company website');assert.equal(b.portfolio.value,'over 2,000 apartment homes');assert.equal(b.footprint.value,'eight states');assert.ok(b.context.some(f=>f.text.includes('Raleigh & serves')));
});
test('direct retrieval checks robots and public DNS without sending credentials',async()=>{
 const out=await run({url,responses:responses()});assert.ok(out.result);assert.equal(out.calls.length,4);for(const c of out.calls){assert.equal(c.redirect,'manual');assert.equal(c.headers.Authorization,undefined);assert.equal(c.headers.Cookie,undefined)}
});
test('robots disallow, unsafe DNS, forbidden pages and off-domain redirects stop fallback',async()=>{
 for(const scenario of ['robots','dns','forbidden','redirect']){
  const r=responses();
  if(scenario==='robots')r['https://acmehousing.com/robots.txt'].body='User-agent: *\nDisallow: /';
  if(scenario==='dns')r['https://dns.google/resolve?name=acmehousing.com&type=A'].body=JSON.stringify({Status:0,Answer:[{type:1,data:'127.0.0.1'}]});
  if(scenario==='forbidden')r[url]={status:403,body:'Denied'};
  if(scenario==='redirect')r[url]={status:302,body:'',headers:{Location:'https://evil.com/'}};
  const out=await run({url,responses:r});assert.ok(out.error,scenario);assert.ok(!out.calls.some(c=>c.url.includes('evil.com')));if(['robots','dns'].includes(scenario))assert.ok(!out.calls.some(c=>c.url===url));
 }
});
test('public address and robots policies cover private ranges, specificity and allow ties',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.2','100.64.0.1','198.18.0.1','::1','fd00::1','fe80::1','2001:db8::1','2002:7f00:1::'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/public','/private/public/about'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?\n','/about?x=1'),false);
 assert.equal(robotsAllowed('User-agent: *\nAllow: /\nUser-agent: InboundDesk\nDisallow: /','/'),false);
});
test('oversized and challenge responses do not become evidence',async()=>{
 await assert.rejects(boundedText(new Response('x'.repeat(100)),50));
 const out=await run({html:'<title>Just a moment...</title><p>Acme Housing owns 1,000 apartment homes.</p>',url});assert.ok(out.error);
});
test('direct discovery retains anchor labels while excluding navigation from claim text',async()=>{
 const {result}=await run({html:'<title>Acme Housing</title><nav><a href="/bio/481">Jordan <strong>Lee</strong></a></nav><h1>Our company</h1>',url});
 assert.deepEqual(result.data.links,[{url:'https://acmehousing.com/bio/481',text:'Jordan Lee'}]);
 assert.doesNotMatch(result.data.content,/Jordan Lee/);
});
test('career navigation reads ph-href against a declared same-origin base without script execution',async()=>{
 const html='<title>Acme Careers</title><script>var phApp = phApp || {"baseUrl":"https://acmehousing.com/us/en/"}; throw Error("must not run")</script><nav><a ph-href="inclusion">Inclusion</a></nav><a>Empty</a>';
 const {result}=await run({html,url});assert.deepEqual(result.data.links,[{url:'https://acmehousing.com/us/en/inclusion',text:'Inclusion'}]);
 const bad=await run({html:html.replace('https://acmehousing.com/us/en/','https://evil.com/'),url});assert.deepEqual(bad.result.data.links,[]);
});
test('profile card boundaries prevent assigning the next card title to the preceding person',async()=>{
 const html='<title>Acme Housing Leadership</title><div class="person-card"><h5>Chief Operating Officer</h5><h3>Jordan Lee</h3></div><div class="person-card"><h5>Chief Financial Officer</h5><h3>Alex Smith</h3></div>';
 const {result}=await run({html,url});
 const {freePersonCandidates}=await import('../website/person-discovery.mjs');
 const people=freePersonCandidates({name:'Jordan Lee',company:'Acme Housing'},{url,title:result.data.title,text:result.data.profile_text}).people;
 assert.equal(people.length,0);assert.doesNotMatch(result.data.content,/␞/);
 const structured=freePersonCandidates({name:'Jordan Lee',company:'Acme Housing'},{url,title:result.data.title,text:result.data.profile_text,profile_blocks:result.data.profile_blocks}).people;
 assert.deepEqual(structured.map(p=>p.role),['Chief Operating Officer']);
});
test('a title before a name in one paragraph has structural evidence without phone details',async()=>{
 const html='<title>Acme Housing Tenant Resources</title><p><span>Regional Property Manager</span><br><span><a href="mailto:j@example.invalid">Jordan Lee</a> | 303.123.4567</span></p><p>Chief Financial Officer<br>Alex Smith | 303.555.5555</p>';
 const {result}=await run({html,url});
 const {freePersonCandidates}=await import('../website/person-discovery.mjs');
 const lead={name:'Jordan Lee',company:'Acme Housing'},page={url,title:result.data.title,text:result.data.profile_text,profile_blocks:result.data.profile_blocks};
 const found=freePersonCandidates(lead,page).people;
 assert.equal(found.length,1);assert.equal(found[0].role,'Regional Property Manager');assert.equal(found[0].quote,'Regional Property Manager\nJordan Lee');
});
test('SVG accessibility titles cannot pollute the company document title',async()=>{
 const {result}=await run({html:'<head><title>Acme Housing</title></head><svg><title>Decorative icon identifier</title></svg><p>Acme Housing owns residential communities.</p>',url});
 assert.equal(result.data.title,'Acme Housing');assert.doesNotMatch(result.data.content,/Decorative icon identifier/);
});
