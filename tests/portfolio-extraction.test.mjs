import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildBrief} from '../website/brief.mjs';
import {readerPage,readerEvidence,researchHasContext} from '../website/free-research.mjs';
const claim='Bozzuto currently manages 130,000 apartments and 4 million square feet of retail space across the U.S.';
const source=(text,extra={})=>({url:'https://www.bozzuto.com/about-us/',title:'About Bozzuto',text,verified:true,...extra});
const brief=(evidence)=>buildBrief({company:'Bozzuto',website:'bozzuto.com',evidence},'bozzuto.com');
test('ordinary apartments and U.S. wording yields separate residential and retail facts',()=>{
 const b=brief([source(claim)]);assert.equal(b.portfolio.value,'130,000 apartments');assert.equal(b.footprint.value,'United States');assert.equal(b.retail_area.value,'4 million square feet of retail space');assert.equal(b.portfolio.unit,'homes');assert.equal(b.portfolio.quote,claim);
});
test('reader retains short statistic blocks without merging neighboring counters',()=>{
 const page=readerPage({code:200,data:{url:'https://www.bozzuto.com/about-us/',title:'About Bozzuto',content:'Bozzuto manages apartment communities across the United States.\n\n4,000+\n\n## Employees\n\n140,000+\n\n## Residences managed\n\n62,000\n\n## Homes and Apartments Developed, Acquired and Built'}},'bozzuto.com','Bozzuto');
 const evidence=readerEvidence({company:'Bozzuto',website:'bozzuto.com',email:'a@bozzuto.com'},[page]).evidence;const b=brief(evidence);assert.equal(b.portfolio.value,'140,000+ Residences');assert.equal(b.portfolio.alternatives.length,0);assert.equal(b.development_total.value,'62,000 Homes and Apartments Developed, Acquired and Built');assert.ok(page.highlights.join(' ').includes('140,000+ Residences managed'));
});
test('historical, customer and title-only figures cannot replace an operating portfolio',()=>{
 const b=brief([source('Bozzuto manages apartment communities.\n\nOur customers manage 900,000 apartments.\n\nBozzuto has developed 62,000 apartments.\n\nBozzuto manages approximately 130,000 residences.')]);assert.equal(b.portfolio.value,'approximately 130,000 residences');assert.equal(b.portfolio.alternatives.length,0);
});
test('older published totals retain provenance but do not outrank an undated overview',()=>{
 const b=brief([source('Bozzuto manages 140,000+ residences.'),source('Bozzuto manages 130,000 apartments.',{url:'https://www.bozzuto.com/news/2020-expansion',published_date:'2020-01-01'})]);assert.equal(b.portfolio.value,'140,000+ residences');assert.equal(b.portfolio.alternatives[0].value,'130,000 apartments');assert.equal(b.portfolio.conflict,true);
});
test('housing fit alone does not end portfolio research',()=>{
 const lead={company:'Bozzuto',website:'bozzuto.com',email:'a@bozzuto.com'};const page={url:'https://www.bozzuto.com/about-us/',title:'About Bozzuto',highlights:['Bozzuto manages apartment communities throughout the United States.']};assert.equal(researchHasContext(lead,[page]),false);
});

import {portfolioStatStatements} from '../website/portfolio-statements.mjs';
test('adjacent counters do not assign a development number to the preceding managed label',()=>{
 assert.deepEqual(portfolioStatStatements('140,000+\nResidences managed\n62,000\nHomes and Apartments Developed, Acquired and Built'),['140,000+ Residences managed','62,000 Homes and Apartments Developed, Acquired and Built']);
 assert.deepEqual(portfolioStatStatements('Residences managed\n140,000+'),['Residences managed 140,000+']);
});

import {presentLead} from '../website/domain.mjs';
test('old retained complete evidence is re-extracted; missing portfolio requests bounded refresh',()=>{
 const base={id:'portfolio-upgrade',company:'Bozzuto',website:'bozzuto.com',email:'a@bozzuto.com',processed_at:new Date().toISOString(),company_engine:'reader-v2',company_brief_version:3,company_location_version:1};
 const complete=presentLead({...base,evidence:[source(claim)]});assert.equal(complete.research_brief.portfolio.value,'130,000 apartments');assert.equal(complete.needs_brief_refresh,false);
 const incomplete=presentLead({...base,evidence:[source('Bozzuto manages apartment communities.')]});assert.equal(incomplete.needs_brief_refresh,true);
 const upgraded=presentLead({...base,company_brief_version:4,evidence:[source('Bozzuto manages apartment communities.')]});assert.equal(upgraded.needs_brief_refresh,false);
});
