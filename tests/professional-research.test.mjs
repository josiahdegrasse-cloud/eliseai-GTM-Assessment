import {test} from 'node:test';
import assert from 'node:assert/strict';
import {professionalEvidence,professionalKey,freePersonCandidates} from '../website/professional-research.mjs';
import {intake,presentLead} from '../website/domain.mjs';
import {professionalMarkup} from '../static/research.js';
import {externalCompanyFacts} from '../website/external-company.mjs';
const lead={name:'Jordan Lee',company:'Acme Housing',website:'acmehousing.com',email:'private@example.invalid',inquiry:'Private buyer note',property_address:'Private address'};
const url='https://acmehousing.com/team/jordan-lee',quote='Jordan Lee is Chief Operating Officer of Acme Housing.';
const fixture=(overrides={})=>{
 const item={name:lead.name,company:lead.company,role:'Chief Operating Officer',quote,url,historical:false,...overrides};
 return {run:{status:'completed',output:{structured:{people:[item],company_facts:[]},grounding:[{field:'people',citations:[{url:item.url}]}]},costDollars:{total:.025}},pages:[{url:item.url,title:'Jordan Lee · Acme Housing',text:item.quote}]};
};
const get=(f,l=lead)=>professionalEvidence(l,f.run,f.pages,Date.parse('2026-09-30'));
test('explicit company-authored role-before-name attribution is supported',()=>{
 const f=fixture({role:'President & CEO',quote:'From our President & CEO, Jordan Lee'});
 const candidates=freePersonCandidates(lead,f.pages[0]);assert.equal(candidates.people[0].role,'President & CEO');
 assert.equal(get(f).people.length,1);
 f.pages[0].text=f.run.output.structured.people[0].quote='From their President & CEO, Jordan Lee';assert.equal(get(f).people.length,0);
});
test('dated promotions and co-founder transitions retain explicit current roles',()=>{
 for(const [role,quote] of [['Chief Executive Officer','Jordan Lee has been promoted to Chief Executive Officer and joined the Board of Trust Managers.'],['Executive Chairman of the Board of Trust Managers','Jordan Lee, Co-Founder of the Company, will now serve as Executive Chairman of the Board of Trust Managers.']]){
  const f=fixture({role,quote,url:'https://acmehousing.com/news/2026/leadership'});f.pages[0].publishedDate='2026-03-27';
  assert.equal(freePersonCandidates(lead,f.pages[0]).people[0].role,role);assert.equal(get(f).people[0].historical,false);
  delete f.pages[0].publishedDate;assert.equal(get(f).people[0].historical,true);
  f.pages[0].publishedDate='2022-03-27';assert.equal(get(f).people[0].historical,true);
 }
});
test('reverse directory rows need a real single-person HTML block',()=>{
 const f=fixture({quote:'Chief Operating Officer\nJordan Lee'});
 assert.equal(get(f).people.length,0);
 f.pages[0].profile_blocks=['Chief Operating Officer\nJordan Lee | 303.555.5555'];
 assert.equal(get(f).people.length,1);
 for(const block of ['Chief Operating Officer\nAlex Smith\nJordan Lee','Chief Operating Officer\nJordan Lee and Alex Smith','Chief Operating Officer\nJordan B. Lee']){
  f.pages[0].profile_blocks=[block];assert.equal(get(f,{...lead,name:'Jordan A. Lee'}).people.length,0);
 }
});
test('official sourced role is displayed without awarding authority or readiness',()=>{
 const ctx=get(fixture());assert.equal(ctx.match,'name_company_match');assert.equal(ctx.people[0].role,'Chief Operating Officer');
 const base=presentLead({...intake(lead),processed_at:'2026-09-30',research_state:'complete'}),after=presentLead({...base,professional_context:ctx});assert.deepEqual(after.priority,base.priority);assert.equal(after.draft,base.draft);
});
for(const [label,mutate] of [
 ['wrong name',f=>f.run.output.structured.people[0].name='Morgan Lee'],
 ['wrong employer',f=>{f.run.output.structured.people[0].company='Other Housing';f.run.output.structured.people[0].quote='Jordan Lee is Chief Operating Officer of Other Housing.';f.pages[0].text=f.run.output.structured.people[0].quote}],
 ['role is absent from quote',f=>f.run.output.structured.people[0].role='Chief Executive Officer'],
 ['ungrounded URL',f=>f.run.output.grounding=[]],
 ['fabricated excerpt',f=>f.pages[0].text='Acme Housing has a large team.'],
 ['unsafe URL',f=>{f.run.output.structured.people[0].url='javascript:alert(1)'}],
 ['another person holds the role',f=>{f.run.output.structured.people[0].quote='Jordan Lee works alongside Alex Smith, Chief Operating Officer of Acme Housing.';f.pages[0].text=f.run.output.structured.people[0].quote}],
 ['nonterminal output',f=>f.run.status='running']
])test('rejects '+label,()=>{const f=fixture();mutate(f);assert.equal(get(f).people.length,0)});
test('historical and dated roles never become current listed roles',()=>{
 let f=fixture({historical:true});assert.equal(get(f).match,'historical');f=fixture({url:'https://acmehousing.com/news/2022/appointment'});f.pages[0].publishedDate='2022-01-01';assert.equal(get(f).match,'historical');
 f=fixture({quote:'Jordan Lee was Chief Operating Officer of Acme Housing until 2024.'});assert.equal(get(f).match,'historical');
 f=fixture({quote:'Jordan Lee was Chief Operating Officer of Acme Housing.'});assert.equal(get(f).match,'historical');
});
test('external person sources need employer in the same excerpt',()=>{
 const f=fixture({url:'https://industrypublication.com/jordan',quote:'Jordan Lee is Chief Operating Officer of an investment company.'});assert.equal(get(f).people.length,0);
});
test('conflicting sourced roles stay in review',()=>{
 const f=fixture(),g=fixture({role:'Chief Executive Officer',quote:'Jordan Lee is Chief Executive Officer of Acme Housing.',url:'https://industrypublication.com/jordan'});
 f.run.output.structured.people.push(...g.run.output.structured.people);f.run.output.grounding.push(...g.run.output.grounding);f.pages.push(...g.pages);assert.equal(get(f).match,'review');
});
test('independent company facts need name, domain identity, source grounding and fetched excerpt',()=>{
 const f=fixture(),fact={company:lead.company,url:'https://industrypublication.com/acme',quote:'Acme Housing manages apartment communities in eight states.'};f.run.output.structured.company_facts=[fact];f.run.output.grounding.push({citations:[{url:fact.url}]});f.pages.push({url:fact.url,text:fact.quote+' Company website: https://acmehousing.com/'});
 assert.equal(get(f).company_facts.length,1);f.pages.at(-1).text=fact.quote;assert.equal(get(f).company_facts.length,0);
});
test('person edits invalidate old research and compact contact details are escaped',()=>{
 const ctx=get(fixture());assert.equal(presentLead({...intake(lead),name:'Alex Smith',professional_context:ctx}).professional_context,null);
 const esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');ctx.insights=[{kind:'responsibility',quote:'<script>alert(1)</script>',url:ctx.people[0].url}];
 const html=professionalMarkup({...lead,name:'Jordan <script>',professional_context:ctx},{esc,date:s=>s});assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Chief Operating Officer/);assert.doesNotMatch(html,/<details|Supporting excerpt|alert\(1\)|contact-remit|contact-function/);
 assert.notEqual(professionalKey(lead),professionalKey({...lead,name:'Alex Smith'}));
});

test('external-company retrieval keeps actual quotes and separates third-party context from announcements',()=>{
 const body='Acme Housing manages apartment communities in eight states.\n\nWebsite: https://acmehousing.com/';
 const pages=[{url:'https://industrypublication.com/company/acme',title:'Acme Housing profile',text:body},{url:'https://www.businesswire.com/news/acme',text:body}];
 const facts=externalCompanyFacts('Acme Housing','acmehousing.com',pages);assert.equal(facts.length,2);assert.equal(facts[0].basis,'External published source');assert.match(facts[1].basis,/Company announcement/);
 for(const page of [{...pages[0],text:'Other Housing manages apartment communities. acmehousing.com'},{...pages[0],url:'https://acmehousing.com/about'},{...pages[0],text:body.replace('acmehousing.com','othercompany.com')}])assert.equal(externalCompanyFacts('Acme Housing','acmehousing.com',[page]).length,0);
});

test('equivalent title forms and directly sourced employer names survive provider normalization',()=>{
 const f=fixture({company:'Acme',role:'President and CEO',quote:'Jordan Lee is President & Chief Executive Officer of Acme Housing.'});assert.equal(get(f).people.length,1);
 const p=fixture({quote:'Jordan Lee has been promoted to Chief Operating Officer of Acme Housing.'});assert.equal(get(p).people.length,1);
});

test('external company context excludes profile-preview boilerplate',()=>{
 const facts=externalCompanyFacts('Greystar','greystar.com',[{url:'https://pitchbook.com/profiles/company/example',text:'Search Request a free trial Log in Greystar Real Estate Partners This is a profile preview from the PitchBook Platform. Website: greystar.com'}]);assert.equal(facts.length,0);
});

test('team-card headings are recovered from the retrieved page, not a generated quote',()=>{
 const f=fixture({quote:'Jordan Lee is the COO of Acme Housing.'});f.pages[0].text='# Acme Housing team\n\n## Jordan Lee\nChief Operating Officer\n\n## Alex Smith\nChief Executive Officer';
 const p=get(f);assert.equal(p.people.length,1);assert.equal(p.people[0].quote,'Jordan Lee\nChief Operating Officer');assert.equal(p.people[0].recovered,true);
});
test('card extraction never bridges another person or assigns the preceding title',()=>{
 const f=fixture();f.pages[0].text='Acme Housing\nJordan Lee\nAlex Smith\nChief Operating Officer';assert.equal(get(f).people.length,0);
 f.run.output.structured.people[0].quote='Chief Operating Officer Jordan Lee';f.pages[0].text='Acme Housing\nAlex Smith\nChief Operating Officer\nJordan Lee\nChief Executive Officer';assert.equal(get(f).people.length,0);
});
test('middle initials and their omission work with employer corroboration; conflicting initials do not',()=>{
 const l={...lead,name:'Jordan A. Lee'},f=fixture({name:'Jordan Lee'});assert.equal(get(f,l).people.length,1);
 const g=fixture({name:'Jordan A. Lee',quote:'Jordan A. Lee is Chief Operating Officer of Acme Housing.'});assert.equal(get(g,lead).people.length,1);
 const h=fixture({name:'Jordan B. Lee',quote:'Jordan B. Lee is Chief Operating Officer of Acme Housing.'});assert.equal(get(h,l).people.length,0);
});
test('diagnostics identify missing pages, failed quote validation and name-role association separately',()=>{
 const f=fixture();f.pages=[];assert.equal(get(f).research_diagnostics.rejections[0].reason,'page_unavailable');
 const g=fixture();g.pages[0].text='Acme Housing team.';assert.equal(get(g).research_diagnostics.rejections[0].reason,'excerpt_not_on_page');
 const h=fixture({quote:'Jordan Lee works with Alex Smith, Chief Operating Officer at Acme Housing.'});assert.equal(get(h).research_diagnostics.rejections[0].reason,'name_role_not_associated');
});
test('sourced responsibilities and role-based question are shown without granting buying authority',()=>{
 const f=fixture(),q='Jordan Lee oversees resident operations at Acme Housing.';f.run.output.structured.insights=[{name:'Jordan Lee',company:'Acme Housing',kind:'responsibility',quote:q,url}];f.pages[0].text+=' '+q;
 const p=get(f);assert.equal(p.insights.length,1);assert.match(p.conversation_starter.text,/Chief Operating Officer/);
 f.pages[0].text=quote;assert.equal(get(f).insights.length,0);
});
test('dated activity needs a current publication date and is hidden for unresolved people',()=>{
 const f=fixture(),q='Jordan Lee spoke about resident operations at Acme Housing.';f.run.output.structured.insights=[{name:'Jordan Lee',company:'Acme Housing',kind:'activity',quote:q,url}];f.pages[0].text+=' '+q;
 assert.equal(get(f).insights.length,0);f.pages[0].publishedDate='2026-09-01';assert.equal(get(f).insights.length,1);
 f.run.output.structured.people=[];assert.equal(get(f).insights.length,0);
});
test('old creation dates on current official directories do not turn present listings into past roles',()=>{
 const f=fixture();f.pages[0].publishedDate='2020-01-01';assert.equal(get(f).people[0].historical,false);
 f.run.output.structured.people[0].url='https://acmehousing.com/news/2020/appointment';f.pages[0].url=f.run.output.structured.people[0].url;f.run.output.grounding=[{citations:[{url:f.pages[0].url}]}];assert.equal(get(f).people[0].historical,true);
});

test('flattened long biographies recover a bounded verbatim name-led sentence',()=>{
 const f=fixture({quote:'Chief Operating Officer Jordan Lee'});const sentence='Jordan Lee is the Chief Operating Officer at Acme Housing.';f.pages[0].text='Acme Housing navigation '.repeat(40)+sentence+' '+('Other public background. '.repeat(50));
 const p=get(f);assert.equal(p.people.length,1);assert.equal(p.people[0].quote,sentence);
});

test('official directory corroboration supports a shortened brand but never another employer',()=>{
 const f=fixture({company:'Acme',quote:'Jordan Lee Chief Operating Officer'});f.pages[0].title='Acme Housing team';assert.equal(get(f).people.length,1);
 f.run.output.structured.people[0].company='Other Housing';assert.equal(get(f).people.length,0);
 f.run.output.structured.people[0].company='Acme';f.pages[0].title='Other Housing team';assert.equal(get(f).people.length,0);
});

test('free extraction finds adjacent name/title headings and a name-led biography',()=>{
 const p={url,title:'Acme Housing',text:'Acme Housing team\nJordan Lee\nChief Operating Officer\nAlex Smith\nChief Executive Officer'};
 const c=freePersonCandidates(lead,p);assert.equal(c.people[0].role,'Chief Operating Officer');assert.equal(c.people.some(x=>/Alex/.test(x.role)),false);
 const b=freePersonCandidates(lead,{...p,text:'Jordan Lee is the Chief Operating Officer of Acme Housing.'});assert.equal(b.people[0].role,'Chief Operating Officer');
});

test('free extraction retains full Director of titles without a duplicate shortened role',()=>{
 const page={url,title:'Acme Housing team',text:'Jordan Lee\nDirector of Business Operations\n\nJordan Lee is Director of Business Operations at Acme Housing.'};
 const c=freePersonCandidates(lead,page);assert.deepEqual(c.people.map(p=>p.role),['Director of Business Operations']);
});
test('free extraction supports middle initials, hyphenated names and title separators',()=>{
 for(const [name,line,title] of [['Jordan A. Lee','Jordan A. Lee — Chief Operating Officer','Chief Operating Officer'],['Jordan Lee','Jordan A. Lee\nSenior Vice President','Senior Vice President'],['Anne-Marie Smith','Anne-Marie Smith | Regional Property Manager','Regional Property Manager']]){
  const l={...lead,name},p={url,title:'Acme Housing team',text:line};const c=freePersonCandidates(l,p);
  assert.equal(c.people[0]?.role,title,line);
  assert.equal(professionalEvidence(l,{status:'completed',output:{structured:c,grounding:[{citations:[{url}]}]}},[p]).people[0]?.role,title,line);
 }
});
test('free extraction does not bridge an unrelated person into a role',()=>{
 for(const text of ['Jordan Lee\nAlex Smith\nChief Operating Officer','Jordan Lee works alongside Alex Smith, Chief Operating Officer of Acme Housing.','Jordan Lee\nContact us\nChief Operating Officer'])assert.equal(freePersonCandidates(lead,{url,text}).people.length,0,text);
});
for(const [label,path,title,quote] of [
 ['customer spotlight','/customer-stories/other','Acme Housing','Jordan Lee is Chief Executive Officer at Other Housing.'],
 ['client case study','/case-studies/other','Acme Housing','Jordan Lee\nChief Executive Officer'],
 ['testimonial title','/news/guest','Acme Housing customer success story','Jordan Lee\nChief Operating Officer'],
 ['partner spotlight','/partner-spotlight/other','Acme Housing','Jordan Lee\nPresident'],
 ['explicit other employer on homepage','/','Acme Housing','Jordan Lee is Chief Executive Officer of Other Housing.'],
 ['explicit other employer on biography','/team/jordan-lee','Acme Housing','Jordan Lee is Chief Operating Officer at Other Housing.']
])test('free extraction rejects '+label,()=>{
 const page={url:'https://acmehousing.com'+path,title,text:quote},c=freePersonCandidates(lead,page);
 const result=professionalEvidence(lead,{status:'completed',output:{structured:c,grounding:[{citations:[{url:page.url}]}]}},[page]);assert.equal(result.people.length,0);
});
test('an explicit other employer is rejected even when the candidate title omits it',()=>{
 const f=fixture({quote:'Jordan Lee is Chief Operating Officer at Other Housing.'});f.pages[0].title='Acme Housing';assert.equal(get(f).people.length,0);
});
test('department titles remain valid after employer-conflict checks',()=>{
 const f=fixture({role:'President of Operations',quote:'Jordan Lee is President of Operations at Acme Housing.'});assert.equal(get(f).people.length,1);
});
test('an explicit of-employer cannot be hidden by a shorter candidate role',()=>{
 const f=fixture({quote:'Jordan Lee is Chief Operating Officer of Other Housing.'});f.pages[0].title='Acme Housing';assert.equal(get(f).people.length,0);
});

test('contact brief distinguishes submitted details, research in progress, historical roles and conflicting evidence',()=>{
 const ui={esc:s=>String(s).replaceAll('<','&lt;'),date:String};
 const fresh=professionalMarkup(lead,ui);assert.equal(fresh,'');
 const pending=professionalMarkup(lead,{...ui,contactBusy:true});assert.match(pending,/role="status"/);assert.doesNotMatch(pending,/<details|id="research-person"/);
 const p=get(fixture({historical:true}));p.match='review';
 const researched=professionalMarkup({...lead,professional_context:p},ui);assert.match(researched,/Previously reported role/);assert.match(researched,/Current position is unresolved/);
 const sample=professionalMarkup({...lead,name:'Jordan TEST'},ui);assert.equal(sample,'');assert.doesNotMatch(sample,/id="research-person"/);
});

test('generic and department-specific titles on the same official page are compatible, distinct departments are not',()=>{
 const make=roles=>{
  const f=fixture();f.run.output.structured.people=roles.map(role=>({...f.run.output.structured.people[0],role,quote:'Jordan Lee\n'+role}));f.pages[0].text=f.run.output.structured.people.map(p=>p.quote).join('\n\n');return get(f);
 };
 const found=make(['Senior Vice President','Senior Vice President, Apartment Living']);
 assert.equal(found.match,'name_company_match');assert.equal(found.people[0].role,'Senior Vice President, Apartment Living');
 assert.equal(make(['Senior Vice President, Finance','Senior Vice President, Apartment Living']).match,'review');
 assert.equal(make(['President','Vice President']).match,'review');
});


test('current official directory and biography can share a generic title without a false conflict',()=>{
 const f=fixture();const roles=['Senior Vice President','Senior Vice President, Apartment Living'];
 f.run.output.structured.people=roles.map((role,i)=>({...f.run.output.structured.people[0],role,quote:'Jordan Lee\n'+role,url:i?url:url.replace('jordan-lee','directory')}));
 f.pages=f.run.output.structured.people.map(p=>({url:p.url,title:'Acme Housing team',text:p.quote}));f.run.output.grounding=f.pages.map(p=>({citations:[{url:p.url}]}));
 const found=get(f);assert.equal(found.match,'name_company_match');assert.equal(found.people[0].role,'Senior Vice President, Apartment Living');
});
