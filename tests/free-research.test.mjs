import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readerRequest,readerPage,readerEvidence,registryRequest,registryEvidence} from '../website/free-research.mjs';
import {intake,presentLead} from '../website/domain.mjs';
import {buildBrief} from '../website/brief.mjs';
const lead={name:'TEST Contact',company:'Acme Housing',website:'acmehousing.com',email:'test@example.invalid',city:'Raleigh',state:'NC',property_address:'12 Test Street'};
const page=(content,extra={})=>({code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',httpStatus:200,content,...extra}});
const record=(name='ACME HOUSING',lei='549300TESTEXAMPLE001')=>({attributes:{lei,entity:{legalName:{name},status:'ACTIVE',headquartersAddress:{city:'Raleigh',country:'US'}},registration:{status:'LAPSED',lastUpdateDate:'2026-09-01T00:00:00Z'}}});
test('Reader follows an observed corporate link and rejects unrelated, credentialed or query links',()=>{
 const p=readerPage(page('[Bad](https://attacker.com/about)\n[Bad](https://user:pass@acmehousing.com/about)\n[About](https://acmehousing.com/about?token=secret)\n[About us](/about-us)\n[Services](/services)'),'acmehousing.com');
 assert.equal(p.next,'https://acmehousing.com/about-us');
 for(const url of ['https://attacker.com/','http://acmehousing.com/','https://acmehousing.com:8080/','https://127.0.0.1/'])assert.throws(()=>readerRequest(url,'acmehousing.com'));
});
test('office directory links stay discoverable even when many corporate links outrank them',()=>{
 const content=Array.from({length:9},(_,i)=>`[About business ${i}](/about-${i})`).join('\n')+'\n[Contact](/contact "Contact us")\n[Regional offices](/contact/regional-offices "Our offices")';
 const p=readerPage(page(content),'acmehousing.com');assert.equal(p.links.length,6);assert.equal(p.location_links[0],'https://acmehousing.com/contact/regional-offices');
});
test('Reader rejects unrelated final URLs, access challenges and upstream errors',()=>{
 for(const data of [{url:'https://othercompany.com/'},{title:'Just a moment...'},{httpStatus:403}])assert.throws(()=>readerPage(page('Public text',data),'acmehousing.com'));
 assert.throws(()=>readerPage({code:200,data:null},'acmehousing.com'));
});
test('Reader strips image captions and navigation while preserving complete numerical claims',()=>{
 const p=readerPage(page('# About us\n\n[Home](/) [Resident login](/login)\n\n![We own 999 apartment homes](https://images.test/x.png)\n\n**Acme Housing** manages residential apartment communities. We own and manage over 25,000 apartment homes in eight U.S. markets.\n\nAll rights reserved. Read the privacy policy.'),'acmehousing.com');
 const out=readerEvidence(lead,[p]),brief=buildBrief({evidence:out.evidence},'acmehousing.com');
 assert.equal(out.matched,true);assert.equal(out.evidence[0].provider,'Jina Reader');assert.equal(brief.portfolio.value,'over 25,000 apartment homes');assert.equal(brief.footprint.value,'eight U.S. markets');assert.doesNotMatch(out.evidence[0].text,/999|privacy|Resident login/);
});
test('Reader does not infer a match when the company name is absent',()=>{
 const out=readerEvidence(lead,[readerPage(page('Different Housing manages residential communities.',{title:'Different Housing'}),'acmehousing.com')]);assert.equal(out.matched,false);
});
test('a page without operating statements contributes no invented claims',()=>{
 const out=readerEvidence(lead,[readerPage(page('Welcome to our website.\n\n[About](/about)'),'acmehousing.com')]);assert.equal(out.evidence.length,0);
});
test('a resident-facing home page can lead to its observed business site',()=>{
 const p=readerPage(page('[Business](https://www.acmehousing.com/business)\n\n[Residents](/login)'),'acmehousing.com');assert.equal(p.next,'https://www.acmehousing.com/business');
});
test('a legal name in the footer corroborates identity but creates no operating claim',()=>{
 const p=readerPage(page('Acme manages residential multifamily communities.\n\n© 2026 All Rights Reserved - Acme Housing',{title:'About Acme'}),'acmehousing.com','Acme Housing');
 const out=readerEvidence(lead,[p]);assert.equal(out.matched,true);assert.match(out.evidence[0].text,/All Rights Reserved - Acme Housing/);
 const brief=buildBrief({evidence:out.evidence},'acmehousing.com');assert.ok(brief.signals[0].supported);assert.doesNotMatch(brief.summary.text,/Rights Reserved/);
 const footer=readerEvidence(lead,[readerPage(page('© 2026 All Rights Reserved - Acme Housing'),'acmehousing.com','Acme Housing')]);assert.equal(buildBrief({evidence:footer.evidence},'acmehousing.com').signals[0].supported,false);
});
test('an old provider cooldown is cleared without erasing existing source dates or draft text',()=>{
 const l={...intake(lead),processed_at:'2026-09-01T00:00:00Z',research_state:'partial',company_retry_after:'2099-01-01T00:00:00Z',company_fresh_until:'2099-01-01T00:00:00Z',draft:'Keep my edit',draft_edited:true,evidence:[{text:'Acme Housing manages residential communities.',url:'https://acmehousing.com/',date:'2026-09-01T00:00:00Z',verified:true}]};
 const out=presentLead(l);assert.equal(out.company_retry_after,null);assert.equal(out.company_fresh_until,null);assert.equal(out.evidence[0].date,l.evidence[0].date);assert.equal(out.draft,'Keep my edit');
 assert.equal(presentLead({...l,company_engine:'reader-v2'}).company_retry_after,l.company_retry_after);
});
test('GLEIF exact names are encoded into a fixed endpoint with a five-record bound',()=>{
 const u=new URL(registryRequest('Acme & Sons'));assert.equal(u.origin,'https://api.gleif.org');assert.equal(u.searchParams.get('filter[entity.legalName]'),'Acme & Sons');assert.equal(u.searchParams.get('page[size]'),'5');
});
test('GLEIF accepts only a unique exact name, not subsidiaries, fuzzy names or crowded results',()=>{
 for(const data of [[],[record('Acme Housing Partners')],[record(),record()]])assert.equal(registryEvidence('Acme Housing',{data}).status,'unmatched');
 assert.equal(registryEvidence('Acme Housing',{data:[record()],meta:{pagination:{total:10}}}).status,'unmatched');
});
test('GLEIF keeps legal entity and LEI registration status distinct; never changes fit or draft',()=>{
 const registry=registryEvidence('Acme Housing',{data:[record()]});assert.equal(registry.entity_status,'ACTIVE');assert.equal(registry.registration_status,'LAPSED');assert.match(registry.message,/Exact legal-name match only/);
 const before=presentLead(intake(lead)),after=presentLead({...before,registry_context:registry});assert.deepEqual(after.fit,before.fit);assert.equal(after.draft,before.draft);
});
test('GLEIF rejects malformed provider payloads and unsafe record identifiers',()=>{
 assert.throws(()=>registryEvidence('Acme Housing',{}));assert.throws(()=>registryEvidence('Acme Housing',{data:[record('ACME HOUSING','<script>')]}));
});

test('a company describing itself as managers of multifamily communities provides residential context',()=>{
 const p=readerPage(page('We are managers of multifamily communities. Acme Housing operates in the United States.'),'acmehousing.com');
 const out=readerEvidence(lead,[p]);assert.equal(buildBrief({evidence:out.evidence},'acmehousing.com').signals[0].supported,true);
});
test('corporate investor links outrank product links and exclude image/CDN navigation',()=>{
 const p=readerPage(page('[Investors](https://investors.acmehousing.com/)\n[Investor Management Services](/investment-management/services)\n[About the bloggers](/blog/authors)\n[Corporate image](https://media.acmehousing.com/image/upload/logo.svg)\n[About us](/about-us)'),'acmehousing.com');
 assert.equal(p.next,'https://investors.acmehousing.com/');assert.ok(p.links.includes('https://acmehousing.com/about-us'));assert.ok(!p.links.some(l=>/blog|media\./.test(l)));
 assert.equal(readerRequest('https://acmehousing.com/','acmehousing.com').options.headers['X-Respond-With'],'markdown');
});
test('vendor product navigation does not create operator fit or portfolio claims',()=>{
 const pages=[readerPage(page('Acme Housing provides property management software for the rental industry.',{title:'Acme Housing | Property Management Software'}),'acmehousing.com'),readerPage(page('Manage residential communities and your portfolio of 5,000 apartment homes. Leasing teams can schedule tours.',{title:'Investor Management Services',url:'https://acmehousing.com/services'}),'acmehousing.com')];
 const brief=buildBrief({evidence:readerEvidence(lead,pages).evidence},'acmehousing.com');assert.equal(brief.company_kind,'software_vendor');assert.ok(brief.signals.every(s=>!s.supported));assert.equal(brief.portfolio,null);
});

test('thin company pages continue to safe overview fallbacks instead of ending research',async()=>{
 const {nextCompanyPage}=await import('../website/free-research.mjs');
 const input={domain:'acmehousing.com',pages:[{links:[],locations:[]}],visited:new Set(['https://acmehousing.com']),alternatives:['https://evil.test/about','https://acmehousing.com/about'],enough:false};
 assert.equal(nextCompanyPage(input),'https://acmehousing.com/about');
 assert.equal(nextCompanyPage({...input,visited:new Set([...input.visited,'https://acmehousing.com/about'])}),null);
 assert.equal(nextCompanyPage({...input,pages:[{links:['https://acmehousing.com/company'],locations:[]}]}),'https://acmehousing.com/company');
 assert.equal(nextCompanyPage({...input,enough:true,pages:[{locations:[{city:'Raleigh'}]}]}),null);
 assert.equal(nextCompanyPage({...input,enough:true,pages:[{location_links:['https://acmehousing.com/contact']}]}),'https://acmehousing.com/contact');
});

test('short unpunctuated claims and useful sentences in long paragraphs survive extraction',()=>{
 const claim='Acme Housing owns and manages 800 apartment homes';
 const content=claim+'\n\n'+('An ordinary introductory sentence without company facts. '.repeat(50))+'Acme Housing operates residential communities across six states.';
 const p=readerPage(page(content),'acmehousing.com','Acme Housing');
 assert.ok(p.highlights.join(' ').includes(claim));assert.match(p.highlights.join(' '),/across six states/);
});

test('direct-page navigation labels aid discovery without becoming evidence',()=>{
 const raw=page('Acme Housing welcomes you to our website.',{links:[{text:'Investors',url:'https://investors.acmehousing.com/'},{text:'We own 999999 apartment homes',url:'https://acmehousing.com/about'}]});
 const p=readerPage(raw,'acmehousing.com','Acme Housing');
 assert.equal(p.next,'https://investors.acmehousing.com/');assert.doesNotMatch(p.highlights.join(' '),/999999/);
});


test('published company initiatives retain an actual publication date through extraction',()=>{
 const content='Acme Housing manages residential apartment communities. Acme Housing expanded its property management operations into Denver.';
 const parsed=readerPage(page(content,{publishedDate:'2026-09-12'}),'acmehousing.com');
 const brief=buildBrief({...lead,evidence:readerEvidence(lead,[parsed]).evidence},'acmehousing.com');
 assert.equal(brief.context.find(f=>f.key==='initiative').published_at,'2026-09-12');
 assert.equal(readerPage(page(content,{publishedDate:'invalid'}),'acmehousing.com').publishedDate,null);
});

test('official business-line and company-story links outrank awards and general about pages',()=>{
 const page=readerPage({code:200,data:{title:'Acme Housing',url:'https://acmehousing.com/',content:'Acme Housing welcomes you to our website.',links:[{text:'Awards',url:'https://acmehousing.com/about/awards'},{text:'About',url:'https://acmehousing.com/about'},{text:'Apartment Living',url:'https://acmehousing.com/apartment-living'},{text:'Our Story',url:'https://acmehousing.com/our-story'}]}},'acmehousing.com','Acme Housing');
 assert.equal(page.links[0],'https://acmehousing.com/apartment-living');assert.ok(page.links.includes('https://acmehousing.com/our-story'));assert.ok(!page.links.some(url=>url.includes('awards')));
});
