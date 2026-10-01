import {leadPriority} from '/company-fit.js';
import {setupSheets} from '/sheets-ui.js';
import {setupImport} from '/import-ui.js';
import {readResearchStream} from '/research-stream.js';
import {accountInitials} from '/account-visuals.js';
import {knownCompanyLogo} from '/company-brands.js';
import {researchMarkup,draftEvidenceMarkup,sourcePanelMarkup,fitHeaderMarkup} from '/research.js';
import {DISCOVERY_FIELDS,READINESS_FIELDS} from '/sales-context.js';
import {researchProgress,emailStatusLabel,sortContacts,matchesLead,needsResearch,autoResearchDue,autoResearchPlan,automaticCandidate,researchQueue,researchLabel as stateLabel} from '/workflow.js';
let state = {leads:[]}, selected=null, tab='research', busy=false, editingId=null, mobileDetail=false;
const draftBuffers={},qualificationBuffers={};
const logoResults=new Map(),logoJobs=new Map();let logoObserver,logoTimer;let logoActive=0,logoNext=0;const logoWaiting=[];
const aerialResults=new Map(),aerialJobs=new Map();let aerialObserver;
let sourceOpener=null,sourceLead=null,renderAfterSources=false;
const researchBusy=new Set(),autoAttempts=new Map();let autoTimer;
let csrfToken=null,publicAssessment=false,hasSheetConnection=false;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const date=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Not available';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),5000)}
async function api(path,body){const res=await fetch('/api/'+path,body===undefined?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},body:JSON.stringify(body)});const data=await res.json();if(!res.ok){const error=Error(data.error||'Request failed');Object.assign(error,{status:res.status,code:data.code,retry_after:data.retry_after});throw error}return data}
async function start(){
 try{const session=await api('session');csrfToken=session.csrf;publicAssessment=session.public_assessment;hasSheetConnection=!!session.has_sheet_connection}catch(e){if(e.status!==404)throw e}
 if(publicAssessment){
  $('.workspace-meta').textContent=hasSheetConnection?'Connected workspace':'Your session · expires in 24 hours';
  $('.dialogactions span').textContent='Saved in your session. Research uses name, company and website. Emails are not sent.';
  $('#assessment-info').hidden=false;
  $('#clear-session').onclick=async()=>{if(!confirm('Delete every lead and saved draft from your session? This cannot be undone.'))return;try{await api('session/delete',{});for(const id of Object.keys(draftBuffers))delete draftBuffers[id];location.reload()}catch(e){toast(e.message)}};
  $('#try-samples').onclick=async()=>{const button=$('#try-samples');button.disabled=true;try{const result=await api('samples',{});selected=result.ids?.[0]||result.existing_ids?.[0]||selected;tab='research';$('#search').value='';$('#filter').value='Researched examples';await load();toast('10 examples ready, including a software-vendor non-fit and unresolved research.')}catch(e){toast(e.message)}finally{button.disabled=false}};
 }
 await load();if(innerWidth>=900)autoResearch(selected);
}
async function load(){state=await api('state');sheetsUI.render(state.sheet_connection);if(state.sheet_connection)$('.workspace-meta').textContent='Connected workspace · expires '+date(state.expires_at*1000);state.leads=sortContacts(state.leads,'lead-priority');if(!state.leads.some(l=>l.id===selected))selected=state.leads[0]?.id??null;render()}
function filtered(){let q=$('#search').value.toLowerCase(),filter=$('#filter').value;return sortContacts(state.leads.filter(l=>(filter==='All leads'||filter==='Researched examples'&&l.sample_lead&&l.sample_set_version>=4||l.status===filter)&&matchesLead(l,q)),$('#sort').value)}
function pillClass(status){return status==='Draft reviewed'?'green':status==='Recheck draft'?'amber':status==='New'?'neutral':'purple'}
let professionalTimer=null, professionalBusy=null;
const professionalAttempts=new Map(),professionalRunning=new Set();
async function refreshProfessional(id){
 if(professionalBusy||researchJobs.has(id))return;
 professionalBusy=id;const attempt=professionalAttempts.get(id)||{count:0,at:0};professionalAttempts.set(id,{count:attempt.count+1,at:Date.now()+60000});renderResearchUpdate(id);
 try{const lead=await api('professional',{id});state.leads=state.leads.map(l=>l.id===id?lead:l);if(lead.professional_context?.status==='complete'&&!lead.professional_context?.stale)professionalAttempts.delete(id);renderResearchUpdate(id)}
 catch(error){toast(error.message)}
 finally{professionalBusy=null;renderResearchUpdate(id);scheduleProfessional()}
}
function scheduleProfessional(){
 clearTimeout(professionalTimer);if(document.hidden||professionalBusy)return;
 const jobs=state.leads.filter(l=>(professionalAttempts.get(l.id)?.count||0)<3&&!researchJobs.has(l.id)&&(l.professional_context?.status==='pending'||l.id===selected&&l.processed_at&&(!l.professional_context||l.professional_context.version<9)));
 const lead=jobs[0];if(!lead)return;
 const at=Math.max(Date.now()+1000,Date.parse(lead.professional_context?.retry_after)||0,professionalAttempts.get(lead.id)?.at||0);
 professionalTimer=setTimeout(()=>refreshProfessional(lead.id),at-Date.now());
}
function render(){
 scheduleProfessional();
 const all=state.leads, rows=filtered();$('#assessment-info').classList.toggle('has-leads',!!all.length);if(rows.length&&!rows.some(l=>l.id===selected))selected=rows[0].id;$('#reset-search').hidden=!$('#search').value&&$('#filter').value==='All leads';$('#workbench').classList.toggle('show-detail',mobileDetail);$('#workbench').classList.toggle('is-empty',!all.length);
 $('#visiblecount').textContent=rows.length+' '+(rows.length===1?'inquiry':'inquiries');
 $('#process').disabled=busy||!rows.some(l=>needsResearch(l)&&!['needs_website','needs_confirmation'].includes(l.research_state));
 $('#leadlist').innerHTML=rows.length?rows.map(l=>`<button class="lead ${l.id===selected?'selected':''}" data-id="${l.id}" aria-pressed="${l.id===selected}"><span class="lead-logo" data-company-logo="${esc(companyLogoKey(l))}" aria-hidden="true">${esc(accountInitials(l.company))}</span><span class="leadinfo"><span class="lead-name-row"><b>${esc(l.name||'Unnamed contact')}</b><span class="priority-badge priority-${esc(leadPriority(l).tier||'unknown')}" title="${esc(leadPriority(l).reason)}">${esc(leadPriority(l).label)}</span></span><span class="company-line">${esc(l.company||'Company unknown')}</span><span class="leadmeta">${l.reviewed?'<span class="review-mark" title="Draft reviewed">'+icon('check')+'</span>':''}${l.research_state==='blocked'?'<span class="pill amber">Research paused</span>':''}</span></span><span class="lead-location">${esc(l.city||l.property_context?.city||(l.company_locations?.[0]?.city?'Office · '+l.company_locations[0].city:'—'))}</span></button>`).join(''):
 `<div class="empty queue-empty"><span class="empty-emblem">${icon('plus')}</span><span class="empty-step">START HERE</span><h2>${all.length?'No matching leads':'Add your first lead'}</h2><p>${all.length?'Searches match leads already in your inbox. Try fewer words or clear the filters.':'A name, email, and company are enough to get started.'}</p></div>`;
 document.querySelectorAll('.lead').forEach(el=>el.onclick=()=>{selectLead(el.dataset.id)});
 detail();observeLeadLogos();scheduleAutomaticResearch();
}
function researchLabel(l){return researchBusy.has(l.id)?Date.parse(l.context_pending_until)>Date.now()?'Company ready · finishing context…':'Updating company research…':researchJobs.has(l.id)?'Research queued…':l.company_stale||['blocked','needs_website','needs_confirmation'].includes(l.research_state)?researchProgress(l).label:stateLabel(l)}
function draftLabel(l){return draftBuffers[l.id]?'Unsaved edits':l.draft_stale?'Review updated context':l.reviewed?'Reviewed':l.processed_at?'Ready to review':'Starter draft ready'}
function setView(view){tab=view;detail();$('#detail').scrollIntoView({block:'start'});$('#tab-'+view).focus({preventScroll:true})}
function nextAction(l){
 if(researchBusy.has(l.id)||researchJobs.has(l.id))return '';
 if(l.draft_stale)return '<div class="brief-update">Research or buyer context changed. Review your saved wording in Email draft.</div>';
 if(l.company_stale)return '';
 if(l.processed_at||l.reviewed)return '';
 const identity=['needs_website','needs_confirmation'].includes(l.research_state);
 return `<div class="brief-update"><span>${identity?'Add a company website to enable research.':'Company research is ready to run.'}</span><button id="next-action" class="textbutton" data-action="${identity?'edit':'research'}" ${busy?'disabled':''}>${identity?'Add website':'Research company'}</button></div>`;
}
function companyLogoKey(l){return JSON.stringify([l.company.trim().toLowerCase(),l.website.trim().toLowerCase()||l.email.split('@').at(-1).toLowerCase()])}
function showCompanyLogo(element,result){
 if(!element?.isConnected||! /^(?:data:image\/png;base64,[A-Za-z0-9+/=]+|\/company-marks\/(?:greystar|camden|amli|herzog|trimark|cpmanagement|aamci|redpeak|atlantic|bozzuto|yardi|appfolio|marcus)-v2\.png)$/.test(result?.image||''))return;
 const img=new Image();img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';
 img.onload=()=>{if(element.isConnected){element.replaceChildren(img);element.classList.add('has-logo');element.classList.toggle('logo-icon',result.kind==='icon');element.classList.toggle('logo-dark',result.theme==='dark');element.title=result.kind==='icon'?'Website icon from the company website':'Logo from the company website'}};
 img.src=result.image;
}
function paintCompanyLogo(key,result){
 document.querySelectorAll('[data-company-logo]').forEach(element=>{if(element.dataset.companyLogo===key)showCompanyLogo(element,result)});
}
function pumpLogos(){
 clearTimeout(logoTimer);if(logoActive||!logoWaiting.length||document.hidden)return;
 const current=state.leads.find(l=>l.id===selected),retry=autoResearchPlan(current,autoAttempts.get(selected));
 // Allow research to claim the shared homepage first, including after CSV import.
 const delay=researchJobs.size||retry!==null&&retry<Date.now()+10000?2000:Math.max(0,logoNext-Date.now());
 if(delay){logoTimer=setTimeout(pumpLogos,delay);return}
 logoActive++;logoNext=Date.now()+4000;logoWaiting.shift()();
}
function loadCompanyLogo(l){
 const key=companyLogoKey(l),known=knownCompanyLogo(l.company,l.website,l.email);
 if(known){paintCompanyLogo(key,known);return}
 const cached=logoResults.get(key);if(cached&&cached.expires>Date.now()){paintCompanyLogo(key,cached.result);return}
 if(!logoJobs.has(key)){
  // Cached and bundled marks paint immediately; background work yields to research.
  const job=new Promise(resolve=>{logoWaiting.push(resolve);logoTimer=setTimeout(pumpLogos,1500)}).then(()=>api('logo',{id:l.id})).catch(()=>({status:'missing'})).then(result=>{logoResults.set(key,{result,expires:result.status==='found'?Date.now()+3600000:Math.max(Date.now()+60000,Date.parse(result.retry_after)||Date.now()+600000)});paintCompanyLogo(key,result);return result});
  logoJobs.set(key,job);job.finally(()=>{logoJobs.delete(key);logoActive--;pumpLogos()});
 }
}
function observeLeadLogos(){
 logoObserver?.disconnect();
 logoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){logoObserver.unobserve(entry.target);const lead=state.leads.find(l=>companyLogoKey(l)===entry.target.dataset.companyLogo);if(lead)loadCompanyLogo(lead)}},{rootMargin:'80px'});
 document.querySelectorAll('#leadlist [data-company-logo]').forEach(element=>{
  const lead=state.leads.find(l=>companyLogoKey(l)===element.dataset.companyLogo);if(!lead)return;
  const known=knownCompanyLogo(lead.company,lead.website,lead.email),cached=logoResults.get(companyLogoKey(lead));
  if(known||cached&&cached.expires>Date.now())paintCompanyLogo(companyLogoKey(lead),known||cached.result);else logoObserver.observe(element);
 });
}

function detail(){
 aerialObserver?.disconnect();
 const l=filtered().find(x=>x.id===selected);
 if(!l){
  $('#detail').innerHTML=`<div class="empty-workspace"><span class="detail-kicker">YOUR LEAD WORKSPACE</span><h2>Research & email</h2><p>${state.leads.length?'Clear your filters to see the leads already in your inbox.':'Add a lead to open its research and draft.'}</p><div class="destination-preview"><span class="destination-icon">${icon('search')}</span><div><h3>Research</h3><p>Company details, property context, and original sources.</p></div></div><div class="destination-preview"><span class="destination-icon mail">${icon('mail')}</span><div><h3>Email draft</h3><p>An editable reply is ready as soon as you add a lead.</p></div></div></div>`;return
 }
 const edit={...l,...draftBuffers[l.id]};
 $('#detail').innerHTML=`<button class="back-to-queue textbutton" id="back-to-queue">Back to your leads</button><div class="detailhead"><div class="account-identity"><div class="account-monogram" data-company-logo="${esc(companyLogoKey(l))}" aria-hidden="true">${esc(accountInitials(l.company))}</div><div><h2>${esc(l.company||'Company unknown')}</h2><p class="header-contact-name">${esc(l.name)}</p><p class="header-contact-email">${esc(l.email)}</p></div></div><div class="lead-actions">${fitHeaderMarkup(l,{esc})}<div class="header-action-row"><button id="refresh-lead" class="quiet" ${researchJobs.has(l.id)||professionalBusy===l.id?'disabled':''} title="Refresh company, contact and property research using free sources and reusable cached results">${researchJobs.has(l.id)?'Refreshing…':professionalBusy===l.id?'Refreshing contact…':'Refresh lead'}</button><button id="edit-lead" class="textbutton" ${researchJobs.has(l.id)?'disabled':''}>Edit details</button></div></div></div><div class="workflow-nav" role="tablist" aria-label="Lead workspace"><button class="workflow-tab ${tab==='research'?'active':''}" id="tab-research" role="tab" aria-selected="${tab==='research'}" aria-controls="work-panel" tabindex="${tab==='research'?0:-1}" data-tab="research"><span class="destination-icon">${icon('search')}</span><span><b>Lead brief</b><small>${researchLabel(l)}</small></span><span class="destination-arrow">${icon('arrow')}</span></button><button class="workflow-tab ${tab==='draft'?'active':''}" id="tab-draft" role="tab" aria-selected="${tab==='draft'}" aria-controls="work-panel" tabindex="${tab==='draft'?0:-1}" data-tab="draft"><span class="destination-icon mail">${icon('mail')}</span><span><b>Email draft</b><small id="draft-stage">${draftLabel(l)}</small></span><span class="destination-arrow">${icon('arrow')}</span></button></div><div id="work-panel" role="tabpanel" aria-labelledby="tab-${tab}"><div id="tabcontent"></div></div>`;
 loadCompanyLogo(l);
 $('#back-to-queue').onclick=()=>{mobileDetail=false;render()};$('#edit-lead').onclick=()=>openLead(l);$('#refresh-lead').onclick=async()=>{const [result]=await run([l]);if(result)toast(researchProgress(result).label+'.');};
 document.querySelectorAll('.workflow-tab').forEach(el=>{
  el.onclick=()=>setView(el.dataset.tab);
  el.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const view=e.key==='Home'?'research':e.key==='End'?'draft':tab==='research'?'draft':'research';setView(view);$('#tab-'+view).focus()}}
 });
 let html='';
 if(tab==='research'){
  html=researchMarkup({...l,inquiry:qualificationBuffers[l.id]?.inquiry??l.inquiry,qualifications:qualificationBuffers[l.id]||l.qualifications},{esc,icon,date,busy:researchJobs.has(l.id),contactBusy:professionalRunning.has(l.id)||professionalBusy===l.id,retryAt:autoResearchPlan(l,autoAttempts.get(l.id)),nextAction,contextDirty:!!qualificationBuffers[l.id]});
 }else{
  html=`${qualificationBuffers[l.id]?'<div class="research-attention" role="status"><b>Buyer notes have unsaved changes</b><p>This draft uses the last saved context.</p><button class="textbutton" id="unsaved-context">Return to unsaved context</button></div>':''}<div class="composer-heading"><div><span class="action-eyebrow">${l.reviewed&&!draftBuffers[l.id]?'READY TO COPY':'DRAFT OUTREACH'}</span><h3>${l.reviewed&&!draftBuffers[l.id]?'Reviewed email':'Email draft'}</h3><p>${l.reviewed&&!draftBuffers[l.id]?'':l.draft_stale?'Your wording is preserved. Check it against the changed lead details.':l.processed_at?'':'This starter draft is ready to edit while company research runs.'}</p></div></div><div class="email-recipient"><span>To</span><b>${esc(l.name)}</b><span>${esc(l.email)}</span></div><label for="subject">Subject</label><input id="subject" value="${esc(edit.subject)}"><label for="draft">Email message</label><textarea id="draft">${esc(edit.draft)}</textarea><div class="composer-actions"><button class="${l.reviewed&&!draftBuffers[l.id]?'':'primary'}" id="save">${icon('check')}${draftBuffers[l.id]?'Save changes':l.reviewed?'Save reviewed draft':'Save & mark reviewed'}</button><button class="${l.reviewed&&!draftBuffers[l.id]?'primary':''}" id="copy">${icon('copy')}Copy email</button></div><p id="savestate" class="save-state" role="status">${draftBuffers[l.id]?'Unsaved changes':l.reviewed?'Saved and reviewed · Not sent':'Not reviewed · Not sent'}</p>${draftEvidenceMarkup(l,{esc,date})}<details class="review-notes"><summary>Notes & feedback</summary><label for="would-send">Would you send this draft?</label><select id="would-send"><option value="">Not assessed</option><option ${edit.would_send==='Would send'?'selected':''}>Would send</option><option ${edit.would_send==='Would not send'?'selected':''}>Would not send</option></select><label for="feedback-reason">Why?</label><textarea id="feedback-reason" maxlength="1500" class="notes">${esc(edit.feedback_reason||'')}</textarea><label for="notes">Your notes</label><textarea id="notes" class="notes" placeholder="What should we know before following up?">${esc(edit.notes)}</textarea></details><button class="textbutton return-research" id="return-research">${icon('search')}Buyer notes & sources</button>`;
 }
 $('#tabcontent').innerHTML=html;
 observeAerial(l);

 document.querySelectorAll('[data-edit-property]').forEach(button=>button.onclick=()=>{openLead(l);$('#field-property_address')?.focus()});
 if($('#add-company-source'))$('#add-company-source').onclick=()=>{openLead(l);$('#field-research_url').focus()};
 if($('#next-action'))$('#next-action').onclick=()=>$('#next-action').dataset.action==='edit'?openLead(l):$('#next-action').dataset.action==='research'?run([l]):setView('draft');
 if($('#return-research'))$('#return-research').onclick=()=>setView('research');
 if($('#unsaved-context'))$('#unsaved-context').onclick=()=>{setView('research');$('#record-context').click()};
 if($('#research'))$('#research').onclick=()=>run([l]);
 if($('#view-activity'))$('#view-activity').onclick=()=>showActivity(l.id);
 for(const id of ['edit-inquiry','edit-property'])if($('#'+id))$('#'+id).onclick=()=>{openLead(l);$('#field-'+(id==='edit-inquiry'?'inquiry':'property_address')).focus()};
 if($('#record-context'))$('#record-context').onclick=()=>{const editor=$('#context-editor');editor.hidden=false;$('#record-context').setAttribute('aria-expanded','true');$('#notes-tab-qualification')?.click();editor.scrollIntoView({block:'center'});$('#qualification-'+(l.inquiry?'scope':'inquiry')).focus({preventScroll:true})};
 if($('#cancel-context'))$('#cancel-context').onclick=()=>{delete qualificationBuffers[l.id];detail();$('#record-context').focus()};
 document.querySelectorAll('[data-decision-action]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.decisionAction;
  if(action==='draft')setView('draft');
  else if(action==='lead')openLead(l);
  else if(action==='research')run([l]);
  else if(action==='qualification')$('#record-context')?.click();
  else {$('#record-context')?.click();const code=l.decision?.action.code;const pane=code?.startsWith('route_')||['ownership','commitment','planned'].includes(code)?'handoff':code==='integration'?'opportunity':null;if(pane)$('#notes-tab-'+pane)?.click()}
 });
 if($('#qualification-form')){
  const tabs=[...document.querySelectorAll('[data-notes-tab]')];
  const selectNotesTab=button=>{for(const b of tabs){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1}document.querySelectorAll('[data-notes-pane]').forEach(pane=>pane.hidden=pane.dataset.notesPane!==button.dataset.notesTab);button.focus()};
  tabs.forEach((button,index)=>{button.onclick=()=>selectNotesTab(button);button.onkeydown=event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();selectNotesTab(tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length])}});
  const captureContext=()=>{qualificationBuffers[l.id]={...l.qualifications,...Object.fromEntries(new FormData($('#qualification-form')))};$('#qualification-save-state').textContent='Unsaved notes'};
  $('#qualification-form').oninput=captureContext;

  $('#qualification-form').onsubmit=async e=>{e.preventDefault();$('#save-qualification').disabled=true;try{await api('save',{id:l.id,inquiry:$('#qualification-inquiry').value,qualifications:Object.fromEntries(new FormData(e.target)),reconfirm:new FormData(e.target).get('reconfirm')==='yes'});delete qualificationBuffers[l.id];await load();toast('Notes saved. Your edited email wording is preserved.')}catch(e){toast(e.message);$('#save-qualification').disabled=false}};
 }
 for(const [id,restore] of [['refresh-draft',false],['restore-draft',true]])if($('#'+id))$('#'+id).onclick=async()=>{
  if((draftBuffers[l.id]||l.reviewed||l.draft_edited)&&!confirm('Replace the current editor with '+(restore?'the previous saved draft':'a draft from the current lead brief')+'? Your last saved draft will remain recoverable; unsaved editor text will be replaced.'))return;
  try{await api('draft',{id:l.id,restore});delete draftBuffers[l.id];await load();toast(restore?'Previous draft restored. Review before copying.':'Draft updated from the lead brief. Review before copying.')}catch(e){toast(e.message)}
 }
 document.querySelectorAll('[data-research-details]').forEach(button=>button.onclick=()=>{if(['needs_website','needs_confirmation'].includes(l.research_state)){openLead(l);return;}const details=$('.research-details');if(details){details.scrollIntoView({block:'nearest'});details.focus({preventScroll:true});}});
 document.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>openSources(l,button.dataset.source,button));
 if($('#draft'))['subject','draft','notes','would-send','feedback-reason'].forEach(id=>$('#'+id).oninput=()=>{draftBuffers[l.id]={subject:$('#subject').value,draft:$('#draft').value,notes:$('#notes').value,would_send:$('#would-send').value,feedback_reason:$('#feedback-reason').value};$('#savestate').textContent='Unsaved changes · kept while you switch leads';$('#draft-stage').textContent='Unsaved edits';$('#save').textContent='Save changes';$('#save').classList.add('primary');$('#copy').classList.remove('primary');$('.composer-heading .action-eyebrow').textContent='DRAFT OUTREACH';$('.composer-heading h3').textContent='Save your changes';$('.composer-heading p').textContent='Save the updated draft before you copy it.'});
 if($('#save'))$('#save').onclick=async()=>{const button=$('#save');button.disabled=true;try{await api('save',{id:l.id,subject:$('#subject').value,draft:$('#draft').value,notes:$('#notes').value,would_send:$('#would-send').value,feedback_reason:$('#feedback-reason').value,reviewed:true});delete draftBuffers[l.id];await load();toast('Email saved. Next, copy it into your email app.')}catch(e){toast(e.message);button.disabled=false}};
 if($('#copy'))$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText('Subject: '+$('#subject').value+'\n\n'+$('#draft').value);$('#copy').innerHTML=icon('check')+'Copied';toast('Copied. Paste the email into your email app to send it.')}catch{toast('Clipboard unavailable. Select and copy the message manually.')}};
}
function observeAerial(lead){
 const element=$('#property-aerial');if(!element)return;
 const key=JSON.stringify(lead.property_context?.coordinates);
 const display=result=>{
  if(!element.isConnected)return;
  const status=element.querySelector('.aerial-status');
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result?.image||'')){status.textContent='Aerial imagery unavailable. Open Google satellite below.';return}
  const img=new Image();img.alt='Aerial imagery around the approximate submitted address';img.decoding='async';
  img.onload=()=>{if(!element.isConnected)return;const frame=element.querySelector('.aerial-frame');frame.replaceChildren(img);const marker=document.createElement('span');marker.className='aerial-marker';marker.setAttribute('aria-hidden','true');frame.append(marker);};
  img.onerror=()=>{status.textContent='Image could not load. Open Google satellite below.'};img.src=result.image;
 };
 const load=()=>{
  const cached=aerialResults.get(key);if(cached&&cached.expires>Date.now()){display(cached.result);return}
  if(!aerialJobs.has(key)){const job=api('property-image',{id:lead.id}).catch(()=>({status:'unavailable'})).then(result=>{aerialResults.set(key,{result,expires:Date.now()+(result.image?3600000:600000)});return result});aerialJobs.set(key,job);job.finally(()=>aerialJobs.delete(key));}
  aerialJobs.get(key).then(display);
 };
 aerialObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){aerialObserver.disconnect();load()}},{rootMargin:'100px'});aerialObserver.observe(element);
}
function showSource(key){
 $('#source-panel').innerHTML=sourcePanelMarkup(sourceLead,{esc,icon,date},key);
 $('#close-sources').onclick=()=>$('#source-dialog').close();
 document.querySelectorAll('[data-panel-source]').forEach(button=>button.onclick=()=>{showSource(button.dataset.panelSource);document.querySelector(`[data-panel-source="${button.dataset.panelSource}"]`)?.focus()});
}
function openSources(lead,key,opener){
 sourceLead=lead;sourceOpener=opener;showSource(key);$('#source-dialog').showModal();$('#close-sources').focus();
}
$('#source-dialog').addEventListener('click',e=>{if(e.target===$('#source-dialog'))$('#source-dialog').close()});
$('#source-dialog').addEventListener('close',()=>{if(renderAfterSources){renderAfterSources=false;render()}if(sourceOpener?.isConnected)sourceOpener.focus();else $('#tab-'+tab)?.focus();sourceLead=null});
function renderResearchUpdate(id){
 // Status can change without rebuilding the editor or closing a source panel.
 const updated=state.leads.find(l=>l.id===id);
 if(updated){
  const priorityBadge=document.querySelector(`.lead[data-id="${CSS.escape(id)}"] .priority-badge`),priority=leadPriority(updated);
  if(priorityBadge){priorityBadge.textContent=priority.label;priorityBadge.className='priority-badge priority-'+(priority.tier||'unknown');priorityBadge.title=priority.reason}
  const header=id===selected?document.querySelector('.company-fit-header'):null;
  if(header)header.outerHTML=fitHeaderMarkup(updated,{esc});
 }
 if($('#source-dialog').open){renderAfterSources=true;return}
 const editing=$('#adddialog').open||$('#importdialog').open||document.activeElement?.matches('input,textarea,select');
 if(editing){const label=$('#tab-research small');const current=state.leads.find(l=>l.id===selected);if(label&&current)label.textContent=researchLabel(current);return}
 render();
}
const researchJobs=researchQueue(async id=>{
 const lead=state.leads.find(l=>l.id===id);if(!lead)return;
 const previous=autoAttempts.get(id);autoAttempts.set(id,{at:Date.now(),count:(previous?.count||0)+1});
 researchBusy.add(id);professionalRunning.add(id);busy=researchBusy.size>0;renderResearchUpdate(id);
 try{
  const response=await fetch('/api/process',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({id,stream:true})});
  const result=await readResearchStream(response,id,(partial,type)=>{if(type==='professional')professionalRunning.delete(id);state.leads=state.leads.map(l=>l.id===id?partial:l);renderResearchUpdate(id);});state.leads=state.leads.map(l=>l.id===id?result:l);if(!result.company_stale)autoAttempts.delete(id);
  const logoKey=companyLogoKey(result);if(logoResults.get(logoKey)?.result.status==='deferred')logoResults.delete(logoKey);
  return result;
 }catch(error){if(error.status===429||error.code==='lead_busy'||!error.status||error.status>=500){state.leads=state.leads.map(l=>l.id===id?{...l,company_stale:true,company_retry_code:error.code||'unavailable',company_error:error.message,research_note:error.message,company_fresh_until:null,company_retry_after:error.retry_after||new Date(Date.now()+60000).toISOString()}:l)}toast(error.message)}
 finally{researchBusy.delete(id);professionalRunning.delete(id);busy=researchBusy.size>0;}
},{concurrency:1,interval:1500});
async function run(items,{automatic=false}={}){
 if(!automatic)for(const lead of items)if(!researchJobs.has(lead.id)){autoAttempts.delete(lead.id);professionalAttempts.delete(lead.id);}
 return Promise.all(items.map(l=>researchJobs.add(l.id).finally(()=>{renderResearchUpdate(l.id);scheduleAutomaticResearch();scheduleProfessional();pumpLogos()})));
}
function autoResearch(id){
 const lead=state.leads.find(l=>l.id===id);
 if(!autoResearchDue(lead)||researchJobs.has(id)){scheduleAutomaticResearch();return}
 const at=autoResearchPlan(lead,autoAttempts.get(id));if(at===null||at>Date.now()){scheduleAutomaticResearch();return}
 void run([lead],{automatic:true});
}
function scheduleAutomaticResearch(){
 clearTimeout(autoTimer);if(document.hidden||$('#adddialog').open||$('#importdialog').open||researchJobs.size)return;
 const candidate=automaticCandidate(state.leads,innerWidth>=900||mobileDetail?selected:null,autoAttempts);
 if(!candidate)return;
 autoTimer=setTimeout(()=>{if(!document.hidden)autoResearch(candidate.lead.id)},Math.max(0,candidate.at-Date.now())+500+Math.random()*1000);
}
for(const selector of ['#adddialog','#importdialog'])$(selector).addEventListener('close',scheduleAutomaticResearch);
document.addEventListener('visibilitychange',()=>{scheduleAutomaticResearch();scheduleProfessional();pumpLogos()});
function selectLead(id){
 selected=id;tab='research';mobileDetail=true;render();
 $('#detail').scrollIntoView({block:'start'});$('#detail').focus({preventScroll:true});
 autoResearch(id);
}

function openLead(l=null){editingId=l?.id||null;$('#form-title').textContent=l?'Edit lead details':'Add lead manually';$('#submit-lead').textContent=l?'Save details':'Add & open lead';$('#addform').reset();for(const key of Object.keys(fields))$('#field-'+key).value=(key==='inquiry'?qualificationBuffers[l?.id]?.inquiry:undefined)??l?.[key]??(key==='country'?'US':'');$('#adddialog').showModal();$('#field-name').focus()}
const fields={name:'Full name',email:'Email',company:'Company',website:'Company website (optional)',research_url:'Official research page (optional)',inquiry:'Original inquiry / reason for reaching out (optional)',property_address:'Property address (full address is fine)',city:'City (optional)',state:'State (optional)',postal_code:'ZIP / postal code (optional)',country:'Country'};
$('#fields').innerHTML=Object.entries(fields).map(([key,label])=>`<div class="${['property_address','website','research_url','inquiry'].includes(key)?'wide':''}"><label for="field-${key}">${label}${['name','email','company'].includes(key)?' <span class="required">*</span>':''}</label>${key==='inquiry'?'<textarea id="field-inquiry" name="inquiry" maxlength="2000" placeholder="Paste the buyer’s message or record why they contacted you."></textarea><span class="field-help">Kept in this session. Not sent to research providers.</span>':`<input id="field-${key}" name="${key}" ${key==='email'?'type="email"':''} ${['name','email','company'].includes(key)?'required':''} ${key==='research_url'?'type="url" placeholder="https://company.com/about"':key==='website'?'placeholder="company.com"':key==='property_address'?'placeholder="Street, city, state and ZIP"':''}>`}</div>`).join('');
$('#addform').onsubmit=async e=>{e.preventDefault();$('#submit-lead').disabled=true;let duplicateOpened=false;try{const data=Object.fromEntries(new FormData(e.target));if(editingId){const old=state.leads.find(l=>l.id===editingId);await api('update',{...data,id:editingId});if(Object.keys(data).some(k=>old?.[k]!==data[k])){if(draftBuffers[editingId])toast('Unsaved email retained. Review it against the changed lead.');if(['email','company','website'].some(k=>old?.[k]!==data[k]))delete qualificationBuffers[editingId];else if(qualificationBuffers[editingId])qualificationBuffers[editingId].inquiry=data.inquiry;}selected=editingId}else{const result=await api('add',data);if(result.ids?.length)selected=result.ids[0];else if(result.existing_ids?.length)selected=result.existing_ids[0];if(result.duplicates)duplicateOpened=true}tab='research';mobileDetail=true;$('#search').value='';$('#filter').value='All leads';await load();$('#adddialog').close();if(innerWidth<900){$('#workbench').scrollIntoView({block:'start'});$('#detail').focus({preventScroll:true})}toast(editingId?'Lead details saved.':duplicateOpened?'Opened the existing lead.':'Lead added. Research queued automatically.');autoAttempts.delete(selected);autoResearch(selected)}catch(e){toast(e.message)}finally{$('#submit-lead').disabled=false}};
$('#add').onclick=()=>openLead();$('#close').onclick=()=>$('#adddialog').close();
$('#reset-search').onclick=()=>{$('#search').value='';$('#filter').value='All leads';render();$('#search').focus()};
$('#search').oninput=render;$('#filter').onchange=render;$('#sort').onchange=()=>{try{localStorage.setItem('inbound-sort',$('#sort').value)}catch{}render()};try{const saved=localStorage.getItem('inbound-sort');if([...$('#sort').options].some(o=>o.value===saved))$('#sort').value=saved}catch{};$('#process').onclick=()=>run(filtered().filter(l=>needsResearch(l)&&!['needs_website','needs_confirmation'].includes(l.research_state)));
$('#import').onclick=()=>$('#importdialog').showModal();$('#close-import').onclick=()=>$('#importdialog').close();$('#choose-csv').onclick=()=>$('#csvfile').click();
setupImport({api,esc,done:async result=>{if(result.ids?.length){selected=result.ids[0];tab='research';mobileDetail=true;$('#search').value='';$('#filter').value='All leads'}await load();toast(`${result.inserted} added · ${result.duplicates} duplicates skipped`);$('#importdialog').close();scheduleAutomaticResearch();if(innerWidth<900){$('#workbench').scrollIntoView({block:'start'});$('#detail').focus({preventScroll:true})}}});

window.addEventListener('beforeunload',e=>{if(Object.keys(draftBuffers).length||Object.keys(qualificationBuffers).length){e.preventDefault();e.returnValue=''}});
if(document.modelContext?.registerTool){Promise.resolve(document.modelContext.registerTool({name:'list_inbound_leads',description:'Read the visible real inbound leads. No changes or outbound actions.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||Object.keys(input).length)throw Error('No input fields accepted');return filtered().map(({id,name,company,status,fit})=>({id,name,company,status,fit}))}})).catch(()=>{})}
const sheetsUI=setupSheets({api,esc,load,toast});
start().catch(e=>toast(e.message));

async function showActivity(id){
 const box=$('#activity-content');box.textContent='Loading saved activity…';$('#activity-dialog').showModal();
 try{
  const [data,current]=await Promise.all([api('activity?id='+encodeURIComponent(id)),api('state')]),service=current.research_service,stamp=t=>t?new Date(t).toLocaleString():'Not recorded';
  const names={company:'Company websites · Reader / direct',contact:'Public company biographies',property:'U.S. Census geocoder',area:'Census Reporter',entity:'GLEIF',sheets:'Google Sheets',logo:'Company logo',imagery:'USGS imagery'};
  const sourceRows=Object.entries(names).map(([key,label])=>{const runs=data.runs.filter(r=>r.source===key),last=runs[0],ok=runs.find(r=>r.status==='succeeded');return `<tr><td>${esc(label)}</td><td>${esc(last?.status||'Not run')}${last?.code?'<br>'+esc(last.code):''}</td><td>${esc(stamp(last?.started_at))}</td><td>${esc(stamp(ok?.finished_at))}</td></tr>`}).join('');
  box.innerHTML=`${service?`<p class="research-service-status"><b>Free research</b> · ${esc(service.message)}${(service.additional_providers||[]).map(p=>`<br>${esc(p.message)}${Number.isFinite(p.app_credits_remaining)?' '+esc(p.app_credits_remaining)+' app credit reservations remain.':''}`).join('')}${Number.isFinite(service.app_tokens_remaining)?`<br>${esc(service.app_tokens_remaining.toLocaleString())} tokens remain in the app’s verified free allowance. Uncertain requests are reserved at their maximum; this is not a live provider balance.`:''}${service.app_request_limit!==null?`<br>${esc(service.app_requests_remaining)} of ${esc(service.app_request_limit)} app request reservations remain. This is the app’s safety allowance, not the provider’s token balance.`:''}</p>`:''}<p>Google Apps Script runs the connected sheet job about every five minutes, even with this tab closed. Browser-only queues pause when hidden. Missing completion after two minutes is marked interrupted.</p><div class="activity-table"><table><thead><tr><th>Source</th><th>Latest state</th><th>Last attempt</th><th>Last successful fetch</th></tr></thead><tbody>${sourceRows}</tbody></table></div><p>Cached results retain their original source dates. Google Street View loads in your browser; it is not a server research job.</p><details><summary>Recent runs (${data.runs.length})</summary>${data.runs.map(r=>`<p><b>${esc(names[r.source]||r.source)} · ${esc(r.status)}</b><br>${esc(stamp(r.started_at))}${r.finished_at?' · '+((r.finished_at-r.started_at)/1000).toFixed(1)+'s':''}<br>${esc(r.message)}</p>`).join('')||'<p>No runs recorded yet.</p>'}</details><h3>Saved assessments</h3><p>Inputs, evidence, rule version, company fit, priority and the exact draft at the time of each saved assessment.</p>${data.snapshots.map(r=>`<details><summary>${esc(stamp(r.at))} · ${esc(r.data.result.label)} · ${esc(r.reason)}</summary><pre>${esc(JSON.stringify({assessment_id:r.id,...r.data},null,2))}</pre></details>`).join('')||'<p>No snapshots yet. Refresh or save this lead to capture one.</p>'}<p class="claim-caption">${esc(data.retention)}</p>`;
 }catch(e){box.textContent=e.message}
}
$('#close-activity').onclick=()=>$('#activity-dialog').close();
