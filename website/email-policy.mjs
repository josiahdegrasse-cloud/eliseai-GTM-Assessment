// GEPA may select only these reviewed, non-factual wording alternatives.
// Production keeps this default until a reviewed code change promotes another.
export const DEFAULT_EMAIL_POLICY=Object.freeze({ask_style:'walkthrough',subject_style:'original'});
export const EMAIL_POLICY_OPTIONS=Object.freeze({ask_style:['walkthrough','overview','conversation'],subject_style:['original','topic']});
export function validateEmailPolicy(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='ask_style,subject_style')throw Error('Email policy must contain only ask_style and subject_style.');
 for(const key of Object.keys(EMAIL_POLICY_OPTIONS))if(!EMAIL_POLICY_OPTIONS[key].includes(value[key]))throw Error('Unsupported email policy '+key);
 return {ask_style:value.ask_style,subject_style:value.subject_style};
}
export function applyEmailPolicy(copy,policy=DEFAULT_EMAIL_POLICY){
 const selected=validateEmailPolicy(policy),match=copy.question.match(/^Would a quick walkthrough of ([^?]+) be useful\?$/);
 let question=copy.question;
 if(match&&selected.ask_style==='overview')question=`Would a short overview of ${match[1]} help?`;
 if(match&&selected.ask_style==='conversation')question=`Open to a brief conversation about ${match[1]}?`;
 // Preserve contact-specific asks, negative-need responses and coordination.
 const subject=selected.subject_style==='topic'&&match?`A question about ${match[1]}`:copy.subject;
 return {...copy,subject,question,draft:question===copy.question?copy.draft:copy.draft.replace(copy.question,question),draft_policy:selected};
}
