import {professionalKey,compatibleName,norm} from './professional-evidence.mjs';
// Use only a recent, unambiguous company-authored role. A title informs a
// question; it does not prove remit, budget, authority or purchasing intent.
export function professionalObservation(lead,time=Date.now()){
 const p=lead.professional_context,age=time-Date.parse(p?.checked_at);
 if(!p||p.version<9||p.status!=='complete'||p.stale||p.match!=='name_company_match'||p.input_key!==professionalKey(lead)||!Number.isFinite(age)||age<0||age>30*86400000||/\bTEST\b/i.test(lead.name))return null;
 const role=p.people?.find(s=>!s.historical&&s.official&&compatibleName(s.name,lead.name)&&norm(s.company)===norm(lead.company)&&s.role&&s.role.length<=160&&s.quote&&/^https:\/\//.test(s.url));
 if(!role)return null;
 const sentence=`Your company’s website lists you as ${role.role}.`;
 let question=null;
 if(/marketing|leasing/i.test(role.role))question='Is the handoff from inbound inquiries to your leasing teams part of your remit?';
 else if(/regional|property manager|portfolio (?:director|manager)/i.test(role.role))question='Do the property teams handle leasing follow-up locally, or does a central team support them?';
 else if(/operations|operating/i.test(role.role))question='Is leasing follow-up coordinated centrally, or separately by each property team?';
 else if(/chief executive|\bCEO\b|president|founder/i.test(role.role))question='Who oversees leasing operations and would be useful to include in the conversation?';
 const cta=/regional|property manager|portfolio (?:director|manager)/i.test(role.role)?'Would a quick look at leasing follow-up for your property teams be useful?':/operations|operating/i.test(role.role)?'Would a quick look at coordinating leasing follow-up across properties be useful?':/chief executive|\bCEO\b|president|founder/i.test(role.role)?'Would a short overview be useful for the team handling leasing?':/marketing|leasing/i.test(role.role)?'Would a quick look at leasing inquiry follow-up be useful?':null;
 return {usage:'professional_role',sentence,question,cta,quote:role.quote,source:{url:role.url,title:role.title||'Company biography',provider:'Company website',type:'Professional role',retrieved_at:role.retrieved_at,published_at:role.published_at,excerpt:role.quote}};
}
export const professionalDraftSignature=lead=>JSON.stringify(professionalObservation(lead));
