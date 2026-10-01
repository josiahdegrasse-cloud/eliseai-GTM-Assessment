import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildBrief,cleanText,organizeSources,sourceURL} from '../website/brief.mjs';
import {intake,companyEvidence,presentLead} from '../website/domain.mjs';
test('removing the submitted address hides old coordinates and area evidence',()=>{
 const lead=presentLead({...intake({name:'Person',email:'person@acmehousing.com',company:'Acme Housing'}),processed_at:'2026-09-30',research_state:'complete',property_address:'',property_context:{status:'matched',address:'OLD ADDRESS',coordinates:{x:-78,y:35}},area_context:{status:'available',tract:'12345678901'}});
 assert.deepEqual(lead.property_context,{});assert.deepEqual(lead.area_context,{});
});
import {researchMarkup,sourcePanelMarkup} from '../static/research.js';

// Representative source excerpts are fixtures, not hardcoded product facts.
const sample=(company='AMLI',website='amli.com')=>intake({name:'TEST Contact',email:'test@example.invalid',company,website,property_address:'12 Test St',city:'Seattle',state:'WA',country:'US'});
const source=(text,url='https://www.amli.com/about-us',extras={})=>({text,url,title:'AMLI Residential',verified:true,date:'2026-09-29T01:00:00Z',...extras});
const amli='AMLI Residential focuses on the development, construction and management of luxury apartment communities. We currently own and manage over 25,000 apartment homes in eight U.S. markets.';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=l=>researchMarkup(l,{esc,icon:()=>'',date:v=>v||'Not available',busy:false,nextAction:()=>''});

test('brief preserves portfolio qualifier, original units, footprint and citation',()=>{
 const b=buildBrief({...sample(),evidence:[source(amli)]},'amli.com');
 assert.equal(b.portfolio.value,'over 25,000 apartment homes');assert.equal(b.portfolio.as_of,null);
 assert.equal(b.footprint.value,'eight U.S. markets');assert.equal(b.profile.text,amli.split('. ')[0]+'.');
 assert.equal(b.portfolio.source_id,b.sources[0].id);assert.ok(b.sources[0].excerpt.includes(b.portfolio.quote));
});
test('global mixed unit counts retain the student-bed qualifier',()=>{
 const text='With more than 1.1 million multifamily units and student beds under management globally, Greystar provides a wealth of experience in managing all product types.';
 const b=buildBrief({...sample('Greystar','greystar.com'),evidence:[source(text,'https://greystar.com/business/services')]},'greystar.com');
 assert.equal(b.portfolio.value,'more than 1.1 million multifamily units and student beds');assert.equal(b.portfolio.scope,'Global company portfolio');assert.equal(b.footprint.value,'Global operations');
});
test('dated corporate totals outrank undated totals and expose the difference',()=>{
 const b=buildBrief({...sample('Camden Property Trust','camdenliving.com'),evidence:[
  source('Camden Property Trust currently owns and operates 58,000 apartment homes.','https://camdenliving.com/about'),
  source('As of July 31, 2026, Camden Property Trust owned and operated 167 properties containing 56,695 apartment homes across the United States.','https://investors.camdenliving.com/home/default.aspx')
 ]},'camdenliving.com');
 assert.equal(b.portfolio.value,'56,695 apartment homes');assert.equal(b.portfolio.as_of,'July 31, 2026');assert.equal(b.portfolio.alternatives[0].value,'58,000 apartment homes');
 assert.equal(b.footprint.value,'United States');assert.equal(b.footprint.as_of,'July 31, 2026');
});
test('development, recruitment and unrelated hosts are rejected',()=>{
 for(const url of ['https://www.dev.amli.com/about','https://staging.amli.com','https://amli.com/careers','https://amli.com/jobs/operations','https://amli.com.attacker.com','http://amli.com/about','https://user:pass@amli.com','https://amli.com:8443'])assert.equal(sourceURL(url,'amli.com'),'');
 assert.equal(sourceURL('https://www.amli.com/about?utm_source=email&y_source=123#team','amli.com'),'https://www.amli.com/about');
});
test('duplicate URLs collapse into one source; structured markup is removed',()=>{
 const sources=organizeSources([source(amli),source(amli,'https://amli.com/about-us/?utm_source=email')],'amli.com',true);
 assert.equal(sources.length,1);assert.equal(sources[0].cached,true);
 assert.equal(cleanText('Company description.\n```json\n{"@context":"https://schema.org"}\n```'),'Company description.');
});
test('acquisition, planned counts and explicitly negated ownership are not a portfolio',()=>{
 for(const text of ['AMLI acquired 120 apartment homes in Seattle.','AMLI manages a pipeline of 900 homes under construction.','AMLI does not own or manage 300 apartment homes.','AMLI owns 350 apartment homes at Downtown Crossing.'])assert.equal(buildBrief({...sample(),evidence:[source(text)]},'amli.com').portfolio,null);
});
test('explicitly negated operations do not become a positive fit signal',()=>{
 const b=buildBrief({...sample(),evidence:[source('AMLI does not manage multifamily communities or offer leasing services.')]},'amli.com');assert.ok(b.signals.every(s=>!s.supported));
});
test('unmatched identity and absent sources leave company facts unknown',()=>{
 const b=buildBrief({...sample(),evidence:[source(amli,undefined,{verified:false})]},'amli.com');
 assert.equal(b.portfolio,null);assert.equal(b.profile,null);assert.equal(b.footprint,null);assert.ok(b.signals.every(s=>!s.supported));
 assert.equal(buildBrief(sample(),'amli.com').sources.length,0);
});
test('provider-selected sentences require both grounding and a verbatim excerpt match',()=>{
 const result={results:[{title:'AMLI Residential',url:'https://amli.com/about',highlights:[amli]}],output:{content:{observations:[{kind:'profile',quote:amli,url:'https://amli.com/about'},{kind:'portfolio',quote:'AMLI currently manages over 99,000 apartment homes.',url:'https://amli.com/about'}]},grounding:[{citations:[{url:'https://amli.com/about'}]}]}};
 assert.deepEqual(companyEvidence(sample(),result).evidence[0].focus_quotes,[amli]);
 result.output.grounding=[];assert.equal(companyEvidence(sample(),result).evidence[0].focus_quotes,undefined);
 result.output.content='invalid';assert.equal(companyEvidence(sample(),result).evidence.length,1);
});
test('old cached records receive briefs and filtered fit without overwriting reviewed drafts',()=>{
 const l=presentLead({...sample(),processed_at:'2026-09-29',research_state:'complete',reviewed:true,draft:'My reviewed email',cached:true,evidence:[source(amli,'https://dev.amli.com/about')]});
 assert.equal(l.research_brief.version,3);assert.equal(l.research_brief.sources.length,0);assert.equal(l.score,null);assert.equal(l.draft,'My reviewed email');assert.equal(l.reviewed,true);
});
test('render distinguishes facts, interpretation and unknown property relationship with navigable citations',()=>{
 const l=presentLead({...sample(),processed_at:'2026-09-29',research_state:'complete',evidence:[source(amli)],property_context:{status:'matched',county:'King County',message:'Address-range match.'}}),html=render(l);
 for(const phrase of ['Reported portfolio','Submitted property','<h3 class="detail-kicker">Sources</h3>'])assert.ok(html.includes(phrase),phrase);
 assert.match(html,/data-source="S1"/);assert.match(html,/id="source-S1"/);assert.doesNotMatch(html,/NEXT ACTION|ASK NEXT|CONVERSATION STARTER|BUYING READINESS|USE IN DISCOVERY|What matters for the conversation/);assert.ok(!html.includes('Company relationship</dt><dd>Verified'));
});
test('source text and lead address are escaped before HTML rendering',()=>{
 const l=presentLead({...sample(),property_address:'<img src=x onerror=alert(1)>',processed_at:'2026-09-29',research_state:'complete',evidence:[source(amli)]});
 l.research_brief.sources[0].excerpt='<script>alert(1)</script>';l.research_brief.profile.text='<img src=x onerror=alert(2)>';
 const html=render(l)+sourcePanelMarkup(l,{esc,icon:()=>'',date:v=>v||''},'S1');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.match(html,/&lt;script&gt;/);
});

test('a concise account summary removes marketing language while retaining the full cited profile',()=>{
 const text='AMLI is a leading, fully integrated real estate platform offering expertise in investment management, development, and management of rental housing properties globally.';
 const brief=buildBrief({...sample(),evidence:[source(text+' We own and manage residential apartment communities.')]},'amli.com');assert.match(brief.summary.text,/investment management, development, and management of rental housing/);assert.doesNotMatch(brief.summary.text,/leading/);assert.equal(brief.profile.text,text);assert.deepEqual(brief.summary.source_ids,[brief.profile.source_id]);
});


test('generated email greets the lead by first name, including Unicode and sample names',()=>{
 for(const [name,first] of [['  Jordan Lee  ','Jordan'],['Élodie Martin','Élodie'],["Anne-Marie O’Neill",'Anne-Marie'],['Avery Morgan (TEST)','Avery'],['TEST Camden Contact','there'],['','there']]){
  assert.ok(intake({...sample(),name}).draft.startsWith(`Hi ${first},\n`));
 }
});
test('old generated greetings update while edited and reviewed wording stays intact',()=>{
 const old={...sample(),name:'Jordan Lee',draft:'Hi [First name],\n\nExisting source-backed message.',draft_version:3};
 assert.ok(presentLead(old).draft.startsWith('Hi Jordan,\n'));assert.equal(presentLead(old).draft_version,20);
 for(const flags of [{draft_edited:true},{reviewed:true}])assert.equal(presentLead({...old,...flags}).draft,old.draft);
});

test('cited background remains visible without inventing housing fit or buyer readiness',()=>{
 const lead=sample('Acme','acmehousing.com'),text='Acme is based in Raleigh and operates in eight states. Acme is a real estate investment trust (REIT).';
 const l=presentLead({...lead,processed_at:'2026-09-29',research_state:'complete',evidence:[source(text,'https://acmehousing.com/about',{title:'Acme'})]});
 assert.equal(l.research_brief.context.length,2);assert.ok(l.research_brief.signals.every(s=>!s.supported));assert.equal(l.priority.readiness,0);
 assert.doesNotMatch(render(l),/Acme is based in Raleigh/);assert.match(render(l),/data-source="S1"/);
 const unverified=buildBrief({...lead,evidence:[source(text,'https://acmehousing.com/about',{verified:false})]},'acmehousing.com');assert.equal(unverified.context.length,0);
});

test('account context retains distinct sourced operating facts and rejects generic values',()=>{
 const text='AMLI Residential focuses on development, construction and management of luxury apartment communities across multiple regional operating teams. We currently own and manage 25,000 apartment homes in eight U.S. markets. AMLI is owned by Example Property Fund. Our workforce totals approximately 600 employees. Managing our own communities keeps operations in house. AMLI believes that sustainability enhances value. Our mission is to be the best.';
 const b=buildBrief({...sample(),evidence:[source(text)]},'amli.com');
 assert.ok(b.summary.text.length>135);assert.ok(text.includes(b.summary.text));
 assert.deepEqual(b.context.map(c=>c.key),['ownership','team','operations']);
 for(const fact of b.context){assert.ok(text.includes(fact.quote||fact.text));assert.equal(fact.source_id,'S1')}
 assert.doesNotMatch(JSON.stringify(b.context),/sustainability|mission/);
});
test('account portfolio keeps home and community totals distinct and dated',()=>{
 const text='As of August 31, 2026, AMLI owned and operated 80 properties containing 25,000 apartment homes across the United States.';
 const b=buildBrief({...sample(),evidence:[source(text)]},'amli.com');
 assert.equal(b.portfolio.value,'25,000 apartment homes');assert.equal(b.property_count.value,'80 properties');assert.equal(b.property_count.as_of,'August 31, 2026');
});
test('unmatched sources and customer descriptions do not populate account context',()=>{
 const b=buildBrief({...sample(),evidence:[source('AMLI says our customers are headquartered in Boston and our clients manage student housing.') ]},'amli.com');
 assert.equal(b.context.length,0);
 const other=buildBrief({...sample(),evidence:[source('Different Company is owned by Example Fund and has 600 employees.','https://amli.com/about',{verified:false,title:'Different Company'})]},'amli.com');
 assert.equal(other.context.length,0);
});

 test('matched company pages retain possessive brand workforce details without matching other companies',()=>{
 const text="Camden Property Trust owns and manages multifamily apartment communities. Camden’s workforce totals approximately 1,600 employees and the Company is headquartered in Houston. Another’s workforce totals 500 employees.";
 const b=buildBrief({...sample('Camden Property Trust','camdenliving.com'),evidence:[source(text,'https://camdenliving.com/about',{title:'Camden Property Trust'})]},'camdenliving.com');
 assert.equal(b.context.find(x=>x.key==='team').text,'Camden’s workforce totals approximately 1,600 employees and the Company is headquartered in Houston.');
 assert.doesNotMatch(JSON.stringify(b.context),/Another/);
});


test('operating context exposes sourced software use and dated initiatives without invention',()=>{
 const text='AMLI manages residential apartment communities. AMLI uses Yardi for property management. AMLI announced a centralized leasing team serving its communities.';
 const b=buildBrief({...sample(),evidence:[source(text,undefined,{published_date:'2026-09-01'})]},'amli.com');
 assert.equal(b.context.find(f=>f.key==='technology').text,'AMLI uses Yardi for property management.');
 // One statement appears once, even when it fits multiple categories.
 assert.equal(b.context.filter(f=>f.text.includes('centralized leasing team')).length,1);
 assert.ok(b.context.every(f=>f.source_id==='S1'&&text.includes(f.text)));
 const expansion=buildBrief({...sample(),evidence:[source('AMLI manages apartments. AMLI expanded its residential operations into Denver.',undefined,{published_date:'2026-09-01'})]},'amli.com');
 assert.equal(expansion.context.find(f=>f.key==='initiative').published_at,'2026-09-01');
});
test('software mentions, future plans, customer claims and undated news are not installed technology or dated initiatives',()=>{
 for(const quote of ['AMLI integrates with Yardi.','AMLI plans to use Yardi.','AMLI does not use Yardi.',"AMLI doesn't use Yardi.",'AMLI customers use Yardi.','AMLI is considering using Yardi.','Our clients have implemented Yardi.','Other Company uses Yardi and works with AMLI.','AMLI requires experience using Yardi.']){
  const b=buildBrief({...sample(),evidence:[source('AMLI manages residential apartments. '+quote)]},'amli.com');
  assert.equal(b.context.find(f=>f.key==='technology'),undefined,quote);
 }
 const b=buildBrief({...sample(),evidence:[source('AMLI manages residential apartments. AMLI expanded its residential operations into Denver.')]},'amli.com');
 assert.equal(b.context.find(f=>f.key==='initiative'),undefined);
});
test('main brief deduplicates claims and keeps the sample contact brief separate from scoring',()=>{
 const l=presentLead({...sample(),processed_at:'2026-09-29',research_state:'complete',evidence:[source(amli)]});
 l.research_brief.context=[{label:'Operations',text:l.research_brief.summary.text,source_id:'S1'}];
 const html=render(l),main=html.split('<section class="research-details"')[0];
 assert.equal(main.split(l.research_brief.summary.text).length-1,1);
 assert.doesNotMatch(main,/assessment-grid|priority-card|source-card|property-aerial|Unconfirmed|Reporting date not stated|<h3>Contact background|<h3>Lead-provided context/);
 assert.match(main,/id="record-context"/);assert.doesNotMatch(main,/aria-label="Contact brief"|Fictional sample contact/);assert.doesNotMatch(main,/class="fit-summary"/);
 assert.match(html,/id="source-S1"/);
});

test('account summary rejects concatenated page headings and keeps factual sentences',()=>{
 const noise='Bell Partners Grid $12.1 VALUE OF REALIZED RESIDENTIAL TRANSACTIONS SINCE 2002 $10.5B Gross Asset Value Under Management Bell Partners Headline Analytics Data-Driven Results';
 const b=buildBrief({...sample('Bell Partners','bellpartnersinc.com'),evidence:[source(noise,'https://bellpartnersinc.com/overview/'),source('Bell Partners manages multifamily apartment communities.','https://bellpartnersinc.com/about/')]},'bellpartnersinc.com');
 assert.doesNotMatch(b.summary?.text||'',/Grid|Headline|VALUE OF REALIZED/);
 assert.match(b.summary.text,/manages multifamily apartment communities/);
});
