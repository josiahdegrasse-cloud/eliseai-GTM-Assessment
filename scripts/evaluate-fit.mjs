import fs from 'node:fs';
import {buildBrief} from '../website/brief.mjs';
import {companyFit,verifiedScoringRole} from '../static/company-fit.js';
const companies=JSON.parse(fs.readFileSync(new URL('../test-data/free-company-expanded.json',import.meta.url)));
const contacts=JSON.parse(fs.readFileSync(new URL('../test-data/free-people-v8.json',import.meta.url))).results;
const results=companies.map(r=>{const l=r.lead,brief=buildBrief(l,l.website.replace(/^https?:\/\//,'').split('/')[0]),time=Date.parse(l.processed_at)||Date.now(),fit=companyFit(l,brief,time);return {company:r.company,operating_model:brief.classification.kind,fit:fit.label,portfolio_context_available:!!brief.portfolio,detailed_workflow:brief.context.some(c=>c.key==='workflow')};});
const report={model:'housing-fit-v3',method:'Replay of saved convenience samples at capture/check time; no live requests, no outcome labels or predictive-accuracy claim.',companies:results,contacts:{count:contacts.length,legacy_research_format:contacts.filter(r=>(r.professional_context?.version||0)<9).length,upstream_matched:contacts.filter(r=>r.professional_context?.match==='name_company_match').length,strict_verified_role:contacts.filter(r=>verifiedScoringRole(r,Date.parse(r.professional_context?.checked_at)||0)).length}};
console.log(JSON.stringify(report,null,2));
