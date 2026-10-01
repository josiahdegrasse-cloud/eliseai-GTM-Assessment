import {cleanInquiry} from './domain.mjs';
// Clear only shipped sample messages, including older retained demo sets.
export function demoInquiryCleanup(lead,tier,templates){
 if(!lead.sample_lead||!['B','C'].includes(tier)||!lead.inquiry)return null;
 const original=templates.find(r=>r.sample_key===lead.sample_key&&r.email===lead.email&&r.company===lead.company);
 if(!original||![original.inquiry,...original.sample_previous_inquiries||[]].some(q=>q&&cleanInquiry(q)===cleanInquiry(lead.inquiry)))return null;
 const preserve=lead.draft_edited||lead.reviewed;
 return {...lead,inquiry:'',sample_focus:'No inbound email context',sample_response_type:'intro',
  ...(!preserve?{draft_version:0}:{draft_edited:true,reviewed:false,draft_stale:true})};
}
