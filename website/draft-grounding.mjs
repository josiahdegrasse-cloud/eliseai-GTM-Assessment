import {companyObservation} from './sales-insights.mjs';
import {professionalObservation} from './professional-personalization.mjs';
// Facts come from retained inputs/evidence, never from a proposed hook itself.
export function draftFacts(lead,brief){
 const facts=(brief?.sources||[]).filter(s=>s.name_matched).map(s=>({id:'company:'+s.id,type:'company',url:s.url,text:s.excerpt}));
 for(const [i,p] of (lead.professional_context?.people||[]).entries())if(p.quote&&p.url)facts.push({id:'contact:'+i,type:'contact',url:p.url,text:p.quote});
 if(lead.inquiry)facts.push({id:'inquiry',type:'submitted',text:lead.inquiry});
 if(lead.qualifications?.workflow_note)facts.push({id:'buyer:workflow',type:'buyer-reported',text:lead.qualifications.workflow_note});
 if(lead.qualifications?.impact_note)facts.push({id:'buyer:impact',type:'buyer-reported',text:lead.qualifications.impact_note});
 return facts;
}
export function validHook(hook,facts){
 return !!hook.text&&!!hook.quote&&Array.isArray(hook.fact_ids)&&hook.fact_ids.length>0&&hook.fact_ids.every(id=>facts.some(f=>f.id===id&&f.text.includes(hook.quote)&&(!hook.url||f.url===hook.url)));
}
export function groundDraft(lead,brief,copy){
 const facts=draftFacts(lead,brief),hooks=[],rejected=[];
 const company=companyObservation(lead,brief),person=professionalObservation(lead);
 for(const b of copy.context_basis||[]){
  const text=b.usage==='professional_role'&&copy.question===person?.cta?person.cta:b.sentence;
  if(!text||!copy.draft.includes(text))continue;
  const fact=facts.find(f=>f.text.includes(b.quote||'')&&(b.source?.url?f.url===b.source.url:f.id==='buyer:impact'));
  const hook={kind:b.usage,text,quote:b.quote,url:b.source?.url||null,fact_ids:fact?[fact.id]:[]};
  const approved=b.usage==='company_observation'?text===company?.sentence:b.usage==='professional_role'?text===person?.cta:b.usage==='buyer_baseline';
  if(approved&&validHook(hook,facts))hooks.push(hook);else rejected.push(hook);
 }
 // Acknowledgments refer to the submitted message or current recorded workflow.
 const acknowledgment=copy.draft.match(/Thanks for reaching out about [^.]+\./)?.[0];
 if(acknowledgment){const fact=facts.find(f=>f.id==='inquiry')||facts.find(f=>f.id==='buyer:workflow');const h={kind:'inquiry_acknowledgment',text:acknowledgment,quote:fact?.text||'',fact_ids:fact?[fact.id]:[]};if(validHook(h,facts))hooks.push(h);else rejected.push(h)}
 let draft=copy.draft,question=copy.question;
 for(const h of rejected){const fallback=h.text===question?'Would a brief introduction be useful?':'Thanks for getting in touch with EliseAI.';draft=draft.replaceAll(h.text,fallback);if(h.text===question)question=fallback}
 return {...copy,draft,question,draft_personalization:hooks.some(h=>h.kind==='company_observation')?'Company-personalized':hooks.some(h=>['professional_role','buyer_baseline'].includes(h.kind))?'Contact-personalized':'Basic response',context_basis:(copy.context_basis||[]).filter(b=>!rejected.some(h=>h.quote===b.quote)),draft_facts:facts,draft_hooks:hooks,draft_guard:{version:1,status:rejected.length?'fallback':'passed',removed_hooks:rejected.length}};
}
