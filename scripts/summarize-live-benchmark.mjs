import {readFile,writeFile} from 'node:fs/promises';
const results=JSON.parse(await readFile(new URL('../test-data/identity-live-check.json',import.meta.url),'utf8'));
const rows=results.map(r=>{
 const l=r.lead,b=l.research_brief||{};
 return {company:r.company,identity:l.company_identity?.status||'unresolved',current_company_evidence:!r.sample_snapshot&&!r.company_stale&&(b.sources||[]).some(s=>s.name_matched),saved_snapshot:!!r.sample_snapshot,sources:(b.sources||[]).length,company_facts:[b.summary,b.portfolio,b.footprint,(l.company_locations||[]).length>0].filter(Boolean).length,elapsed_ms:r.elapsed_ms,provider_requests:r.initial_provider_calls,repeat_requests:r.repeat_provider_calls,source_urls:(b.sources||[]).map(s=>s.url)};
});
const sorted=rows.map(r=>r.elapsed_ms).sort((a,b)=>a-b),median=sorted.length%2?sorted[Math.floor(sorted.length/2)]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
const summary={generated_at:new Date().toISOString(),mode:'live anonymous-provider smoke check',limitations:'Eight known-domain public companies, not a representative 50-lead benchmark. Domain discovery, contact enrichment and independently audited claim accuracy are not measured. No production credentials or paid provider used. Saved snapshots are not fresh live successes. Local runtime/network performance may differ from production. The run began before the copyright-footer compatibility fix; raw results retain the tested evidence.',tested:rows.length,current_company_evidence:rows.filter(r=>r.current_company_evidence).length,current_with_three_company_facts:rows.filter(r=>r.current_company_evidence&&r.company_facts>=3).length,median_elapsed_ms:median,total_provider_requests:rows.reduce((n,r)=>n+r.provider_requests,0),measured_cost:null,rows};
await writeFile(new URL('../test-data/identity-live-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
