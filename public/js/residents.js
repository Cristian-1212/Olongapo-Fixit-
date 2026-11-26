/* Resident verification + dedicated barangay official dashboard */
const VL={pending:'Pending',approved:'Approved',rejected:'Rejected'};
const vbadge=s=>`<span class="bd s-${slug(s)}">${esc(VL[s]||s)}</span>`;
const pendingN=()=>ME&&['admin','brgy'].includes(ME.role)?(S.residents||[]).filter(r=>r.vstatus==='pending').length:0;
function resBanner(){
 if(!ME||ME.role!=='res'||ME.vstatus==='approved')return'';
 if(ME.vstatus==='rejected')return `<div class="banner bad" role="alert"><h3>Proof of residency not accepted</h3><p>${esc(ME.vrem||'Please upload a clearer proof of residency.')}</p>
  <label for="rsa">Complete address</label><input id="rsa" value="${esc(ME.address||'')}"><label for="rsf">New proof of residency (JPG/PNG/WEBP, max 5 MB)</label><input id="rsf" type="file" accept="image/*" onchange="prev('rsf','rspv',1000)"><div id="rspv"></div>
  <button class="btn" onclick="resubmit()">Submit again</button><p id="rsm" class="err" role="alert"></p></div>`;
 return `<div class="banner" role="status"><h3>Waiting for verification</h3><p>Officials of Barangay ${esc(bname(ME.brgy))} are checking your proof of residency. You can submit reports once you are approved.</p></div>`}
async function resubmit(){await guarded(async()=>{if(!PH)throw new Error('Upload your new proof of residency.');await api('resident/proof',{address:$('rsa').value,proof:PH});PH='';await refresh();dash()},'rsm','Proof submitted. Please wait for verification.')}

function pendingTable(L){return L.length?`<div class="card tw"><table><tr><th>Name</th><th>Age</th><th>Address</th><th>Submitted</th><th></th></tr>${L.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.age)}</td><td>${esc(r.address)}</td><td>${esc(fdate(r.created))}</td><td><a class="btn" href="#/resident/${r.id}">Review</a></td></tr>`).join('')}</table></div>`:'<div class="card"><p class="mu">No residents are waiting for verification.</p></div>'}
function brgyDash(){
 const R=visible(ME),c=counts(R),bn=bname(ME.brgy),review=c.SUBMITTED+c['UNDER REVIEW'],progress=c.VERIFIED+c.ASSIGNED+c['IN PROGRESS'],pend=(S.residents||[]).filter(x=>x.vstatus==='pending'),todo=R.filter(r=>['SUBMITTED','UNDER REVIEW'].includes(r.status)).slice(-5).reverse();
 $('app').innerHTML=`<header class="dash-header"><div><p class="eyebrow">Barangay ${esc(bn)} Official</p><h2>Barangay ${esc(bn)} Dashboard</h2><p class="dash-description">Only reports and residents of Barangay ${esc(bn)} are shown here.</p></div>
 <nav class="dash-actions" aria-label="Dashboard actions">
  <a class="dash-action dash-action-primary" href="#/reports" aria-label="View reports"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-4 2-4-2-3 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span>View reports</span></a>
  <a class="dash-action dash-action-secondary" href="#/residents" aria-label="Verify residents${pend.length?' — '+pend.length+' pending':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3"/><path d="M4 19v-1a6 6 0 0 1 12 0v1M17 8h4M19 6v4"/></svg><span>Verify residents${pend.length?`<b class="action-count">${pend.length}</b>`:''}</span></a>
  <a class="dash-action dash-action-secondary" href="#/map" aria-label="Open report map"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"/><path d="M8 4v13M16 7v13"/></svg><span>Map</span></a>
 </nav></header>
 <section class="dash-section"><div class="section-heading"><div><h3>Report overview</h3><p class="mu">Reports submitted in Barangay ${esc(bn)}.</p></div></div><div class="grid dash-kpis">${[['Total reports',R.length],['Awaiting review',review],['In progress',progress],['Resolved',c.RESOLVED]].map(x=>`<div class="card stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div></section>
 <section class="dash-section"><div class="section-heading"><div><h3>Resident verification</h3><p class="mu">Check the proof of residency before residents can report.</p></div><a class="text-link" href="#/residents">View all residents</a></div>${pendingTable(pend.slice(0,5))}</section>
 <section class="dash-section"><div class="section-heading"><div><h3>Reports needing action</h3><p class="mu">Newest reports still waiting for your review.</p></div><a class="text-link" href="#/reports">View all reports</a></div>${todo.length?tbl(todo):'<div class="card"><p class="mu">Nothing is waiting for review.</p></div>'}</section>
 <section class="dash-section"><div class="section-heading"><div><h3>Report insights</h3><p class="mu">Graphs for Barangay ${esc(bn)} only.</p></div><a class="text-link" href="#/analytics">Full analytics</a></div>
 <div class="charts"><div class="card"><h4>By status</h4>${donutChart(group(R,r=>r.status),'Reports by status',statusColor)}</div><div class="card"><h4>By category</h4>${barChart(group(R,r=>r.cat),'Reports by category')}</div></div></section>`}

const RESIDENT_COPY={
 title:'Residents',description:'Search registrations, check proof of residency, and review requests.',
 search:'Search by resident name',sort:'Sort by registration date',newest:'Newest first',oldest:'Oldest first',
 tabs:{pending:'Pending',approved:'Approved',rejected:'Rejected',all:'All'},
 empty:{pending:'No pending residents. New registrations will appear here.',approved:'No approved residents yet.',rejected:'No rejected registrations.',all:'No residents found.'},
 noSearch:'No residents match your search.',address:'Address / Purok',registered:'Date registered',
 proof:'View proof',noProof:'No proof uploaded',proofTitle:'Proof of residency',loadingProof:'Loading proof…',
 proofError:'We could not load this file. Please try again.',zoomIn:'Zoom in',zoomOut:'Zoom out',resetZoom:'Reset zoom',
 close:'Close proof preview',approve:'Approve',reject:'Reject',confirmApprove:'Approve this resident?',
 confirmReject:'Reject this registration?',rejectReason:'Reason for rejection',rejectReasonHint:'Choose a reason',
 rejectNote:'Optional note',chooseReason:'Choose a reason before rejecting.',
 reasons:[['unreadable','Document is unclear or unreadable'],['address','Address does not match'],['document','Document is not accepted'],['other','Other']],
 approveSuccess:'Resident approved.',rejectSuccess:'Resident rejected.',emptyProof:'No proof was uploaded for this registration.',
 details:'Resident details',age:'Age',email:'Email',phone:'Phone',barangay:'Barangay',
 pendingCount:'pending',allCount:'residents',decision:'Review decision',proofAlt:'Proof of residency submitted by'
};
let RF='pending',residentQuery='',residentSort='newest',residentProofURLs=[],residentProofRequest=0,residentModalTrigger=null;
function setRF(filter){RF=['pending','approved','rejected','all'].includes(filter)?filter:'all';residents(false)}
function residentEmptyMessage(filter,searched){
 const message=searched?RESIDENT_COPY.noSearch:RESIDENT_COPY.empty[filter]||RESIDENT_COPY.empty.all;
 return `<div class="resident-empty"><span aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="13" cy="13" r="7"></circle><path d="m18 18 7 7M7 25h18"></path></svg></span><h3>${esc(message)}</h3></div>`
}
function residentProofButton(r){
 return r.hasproof?`<button type="button" class="btn o resident-proof-button" onclick="openResidentProof(${r.id},this)">${esc(RESIDENT_COPY.proof)}</button>`:`<button type="button" class="btn o resident-proof-button" disabled title="${esc(RESIDENT_COPY.emptyProof)}">${esc(RESIDENT_COPY.noProof)}</button>`
}
function residentDateValue(value){const time=Date.parse(value||'');return Number.isFinite(time)?time:0}
function residentReasonFields(prefix){
 return `<div class="resident-reject-fields"><label for="${prefix}-reason">${esc(RESIDENT_COPY.rejectReason)}</label><select id="${prefix}-reason"><option value="">${esc(RESIDENT_COPY.rejectReasonHint)}</option>${RESIDENT_COPY.reasons.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select><label for="${prefix}-note">${esc(RESIDENT_COPY.rejectNote)}</label><textarea id="${prefix}-note" rows="2" maxlength="220"></textarea><p id="${prefix}-reason-error" class="resident-inline-error" role="alert"></p></div>`
}
function residents(resetFilter=true){
 if(!guard(['admin','brgy']))return;
 closeResidentProof();
 const all=S.residents||[],admin=ME.role==='admin',pending=all.filter(r=>r.vstatus==='pending').length;
 if(resetFilter){RF=pending?'pending':'all';residentQuery='';residentSort='newest'}
 const count=filter=>filter==='all'?all.length:all.filter(r=>r.vstatus===filter).length;
 const query=residentQuery.trim().toLocaleLowerCase();
 const filtered=all.filter(r=>(RF==='all'||r.vstatus===RF)&&(!query||String(r.name||'').toLocaleLowerCase().includes(query)));
 filtered.sort((a,b)=>(residentSort==='newest'?-1:1)*(residentDateValue(a.created)-residentDateValue(b.created)));
 const title=admin?RESIDENT_COPY.title:`${RESIDENT_COPY.title} of Barangay ${bname(ME.brgy)}`;
 const tabs=['pending','approved','rejected','all'].map(filter=>`<button type="button" class="btn resident-tab ${RF===filter?'':'o'}" aria-pressed="${RF===filter}" onclick="setRF('${filter}')">${esc(RESIDENT_COPY.tabs[filter])}<span>${count(filter)}</span></button>`).join('');
 const rows=filtered.map(r=>`<tr><td><strong>${esc(r.name)}</strong>${admin?`<small>${esc(bname(r.brgy))}</small>`:''}</td><td>${esc(r.address||'—')}</td><td><time datetime="${esc(r.created||'')}">${esc(fdate(r.created))}</time></td><td>${vbadge(r.vstatus)}</td><td>${residentProofButton(r)}</td></tr>`).join('');
 const cards=filtered.map(r=>`<article class="resident-mobile-card"><header><div><h3>${esc(r.name)}</h3>${admin?`<p>${esc(bname(r.brgy))}</p>`:''}</div>${vbadge(r.vstatus)}</header><dl><div><dt>${esc(RESIDENT_COPY.address)}</dt><dd>${esc(r.address||'—')}</dd></div><div><dt>${esc(RESIDENT_COPY.registered)}</dt><dd><time datetime="${esc(r.created||'')}">${esc(fdate(r.created))}</time></dd></div></dl>${residentProofButton(r)}</article>`).join('');
 const empty=residentEmptyMessage(RF,!!query);
 $('app').innerHTML=`<section class="resident-page"><header class="resident-page-heading"><div><p class="eyebrow">BARANGAY SERVICES</p><h2 id="resident-page-title" tabindex="-1">${esc(title)}</h2><p class="mu">${esc(RESIDENT_COPY.description)}</p></div><div class="resident-total"><strong>${all.length}</strong><span>${esc(RESIDENT_COPY.allCount)}</span></div></header><nav class="tabs resident-tabs" role="group" aria-label="Filter residents">${tabs}</nav><div class="resident-toolbar"><div class="resident-search"><label for="resident-search">${esc(RESIDENT_COPY.search)}</label><input id="resident-search" type="search" value="${esc(residentQuery)}" placeholder="${esc(RESIDENT_COPY.search)}" autocomplete="off"></div><div class="resident-sort"><label for="resident-sort">${esc(RESIDENT_COPY.sort)}</label><select id="resident-sort"><option value="newest" ${residentSort==='newest'?'selected':''}>${esc(RESIDENT_COPY.newest)}</option><option value="oldest" ${residentSort==='oldest'?'selected':''}>${esc(RESIDENT_COPY.oldest)}</option></select></div></div><p class="resident-filter-summary" aria-live="polite">${filtered.length} ${filtered.length===1?'resident':'residents'} shown · ${count('pending')} ${esc(RESIDENT_COPY.pendingCount)}</p>${filtered.length?`<div class="resident-table-wrap"><table class="resident-table"><thead><tr><th>Name</th><th>${esc(RESIDENT_COPY.address)}</th><th>${esc(RESIDENT_COPY.registered)}</th><th>Status</th><th>Proof</th></tr></thead><tbody>${rows}</tbody></table></div><div class="resident-mobile-list">${cards}</div>`:empty}
 <div id="resident-proof-modal" class="modal resident-proof-modal" role="dialog" aria-modal="true" aria-labelledby="resident-proof-title" aria-describedby="resident-proof-description" hidden onclick="if(event.target===this)closeResidentProof()"><section class="resident-dialog"><header class="resident-dialog-header"><div><p class="eyebrow">${esc(RESIDENT_COPY.details)}</p><h2 id="resident-proof-title">${esc(RESIDENT_COPY.proofTitle)}</h2></div><button id="resident-modal-close" type="button" class="btn o resident-modal-close" aria-label="${esc(RESIDENT_COPY.close)}" onclick="closeResidentProof()">×</button></header><div class="resident-dialog-body"><section class="resident-proof-panel"><p id="resident-proof-description" class="resident-proof-caption"></p><div id="resident-proof-viewer" class="resident-proof-viewer" role="status">${esc(RESIDENT_COPY.loadingProof)}</div><div id="resident-proof-zoom" class="resident-proof-zoom" hidden><button type="button" class="btn o" onclick="zoomResidentProof(-0.2)">${esc(RESIDENT_COPY.zoomOut)}</button><button type="button" class="btn o" onclick="zoomResidentProof(0.2)">${esc(RESIDENT_COPY.zoomIn)}</button><button type="button" class="btn o" onclick="zoomResidentProof(0,true)">${esc(RESIDENT_COPY.resetZoom)}</button></div></section><aside id="resident-proof-details" class="resident-details"></aside></div><p id="resident-review-error" class="resident-inline-error" role="alert"></p><div id="resident-review-actions" class="resident-review-actions"></div></section></div></section>`
 $('resident-search').addEventListener('input',event=>{residentQuery=event.target.value;residents(false);const input=$('resident-search');input.focus();input.setSelectionRange(residentQuery.length,residentQuery.length)});
 $('resident-sort').addEventListener('change',event=>{residentSort=event.target.value;residents(false)});
}
function residentModalKey(event){
 const modal=$('resident-proof-modal');if(!modal||modal.hidden||document.getElementById('cfm')||event.defaultPrevented)return;
 if(event.key==='Escape'){event.preventDefault();closeResidentProof();return}
 if(event.key!=='Tab')return;
 const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];
 if(!focusable.length)return;
 const first=focusable[0],last=focusable[focusable.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function closeResidentProof(){
 residentProofRequest++;
 residentProofURLs.forEach(url=>URL.revokeObjectURL(url));residentProofURLs=[];
 const modal=$('resident-proof-modal');if(modal)modal.hidden=true;
 document.body.classList.remove('resident-proof-open');document.removeEventListener('keydown',residentModalKey,true);
 const trigger=residentModalTrigger;residentModalTrigger=null;if(trigger&&trigger.isConnected)trigger.focus();
}
async function openResidentProof(id,trigger){
 const resident=(S.residents||[]).find(item=>item.id===id),modal=$('resident-proof-modal');if(!resident||!modal)return;
 residentProofURLs.forEach(url=>URL.revokeObjectURL(url));residentProofURLs=[];
 residentProofRequest++;const request=residentProofRequest;residentModalTrigger=trigger||document.activeElement;
 const viewer=$('resident-proof-viewer'),zoom=$('resident-proof-zoom'),status=resident.vstatus;
 residentProofScale=1;
 const requirement=window.ID_REQUIREMENTS&&window.ID_REQUIREMENTS[resident.document_type];
 const backMode=String(resident.upload_mode||requirement&&requirement.uploadMode||'front').toLowerCase()==='back';
 const extracted=value=>esc(value==null||String(value).trim()===''?'Not extracted':value);
 $('resident-proof-title').textContent=RESIDENT_COPY.proofTitle;
 $('resident-proof-description').textContent=`${resident.name} · ${bname(resident.brgy)}`;
 $('resident-proof-details').innerHTML=`<h3>${esc(resident.name)}</h3><dl><div><dt>Document type</dt><dd>${esc(resident.document_type||'Not recorded')}</dd></div><div><dt>Upload mode</dt><dd>${backMode?'Front and Back':'Front Only'}</dd></div><div><dt>Document number</dt><dd>${extracted(resident.ocr_document_number)}</dd></div><div><dt>${esc(RESIDENT_COPY.address)}</dt><dd>${esc(resident.address||'—')}</dd></div><div><dt>OCR name</dt><dd>${extracted(resident.ocr_name)}</dd></div><div><dt>OCR date of birth</dt><dd>${extracted(resident.ocr_dob)}</dd></div><div><dt>OCR address</dt><dd>${extracted(resident.ocr_address)}</dd></div><div><dt>OCR barangay</dt><dd>${extracted(resident.ocr_barangay)}</dd></div><div><dt>OCR status</dt><dd>${extracted(resident.ocr_status)}</dd></div><div><dt>${esc(RESIDENT_COPY.age)}</dt><dd>${esc(resident.age??'—')}</dd></div><div><dt>${esc(RESIDENT_COPY.email)}</dt><dd>${esc(resident.email||'—')}</dd></div><div><dt>${esc(RESIDENT_COPY.phone)}</dt><dd>${esc(resident.phone||'—')}</dd></div><div><dt>${esc(RESIDENT_COPY.barangay)}</dt><dd>${esc(bname(resident.brgy))}</dd></div><div><dt>${esc(RESIDENT_COPY.registered)}</dt><dd>${esc(fd(resident.created))}</dd></div><div><dt>Status</dt><dd>${vbadge(status)}</dd></div></dl>`;
 $('resident-review-error').textContent='';zoom.hidden=true;
 $('resident-review-actions').innerHTML=status==='pending'?`${residentReasonFields('resident')}<div class="resident-decision-buttons"><button type="button" class="btn g" data-resident-action onclick="confirmResidentReview(${resident.id},'approved')">${esc(RESIDENT_COPY.approve)}</button><button type="button" class="btn r" data-resident-action onclick="confirmResidentReview(${resident.id},'rejected')">${esc(RESIDENT_COPY.reject)}</button></div>`:`<p class="resident-decision-note">${esc(VL[status]||status)}${resident.vat?' · '+esc(fd(resident.vat)):''}${resident.vrem?' · '+esc(resident.vrem):''}</p>`;
 modal.hidden=false;document.body.classList.add('resident-proof-open');document.addEventListener('keydown',residentModalKey,true);$('resident-modal-close').focus();
 if(!resident.hasproof){viewer.innerHTML=`<div class="resident-proof-empty"><span aria-hidden="true">▧</span><p>${esc(RESIDENT_COPY.emptyProof)}</p></div>`;return}
 const sides=[['front','Front image']];if(backMode)sides.push(['back','Back image']);
 viewer.innerHTML=sides.map(([kind,label])=>`<section class="resident-proof-side" id="resident-proof-${kind}"><strong>${label}</strong><p>${esc(RESIDENT_COPY.loadingProof)}</p></section>`).join('');
 zoom.hidden=false;
 await Promise.all(sides.map(([kind,label])=>loadResidentProofImage(resident,kind,label,request)));
}
async function loadResidentProofImage(resident,kind,label,request){
 const slot=$('resident-proof-'+kind);if(!slot)return;
 const url='/api/img/p/'+encodeURIComponent(resident.id)+(kind==='back'?'?kind=back':'');
 slot.innerHTML=`<strong>${label}</strong><p>${esc(RESIDENT_COPY.loadingProof)}</p>`;
 try{
  const response=await fetch(url,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error(RESIDENT_COPY.proofError);
  const blob=await response.blob(),type=(response.headers.get('Content-Type')||blob.type||'').toLowerCase();
  if(request!==residentProofRequest||$('resident-proof-modal').hidden)return;
  if(type==='application/pdf'){
   const objectUrl=URL.createObjectURL(blob);residentProofURLs.push(objectUrl);
   slot.innerHTML=`<strong>${label}</strong><iframe class="resident-proof-pdf" src="${esc(objectUrl)}" title="${esc(label)}"></iframe>`;
  }else if(type.startsWith('image/')){
   const objectUrl=URL.createObjectURL(blob);residentProofURLs.push(objectUrl);
   slot.innerHTML=`<strong>${label}</strong><div class="resident-proof-image-wrap"><img class="resident-proof-image" src="${esc(objectUrl)}" alt="${esc(RESIDENT_COPY.proofAlt+' '+resident.name+' ('+label.toLowerCase()+')')}" onerror="residentProofImageError(this)" data-url="${esc(url)}" data-resident="${resident.id}" data-kind="${kind}" data-name="${esc(resident.name)}"></div>`;
  }else throw new Error('This proof file type cannot be previewed.');
 }catch(error){
  if(request!==residentProofRequest||$('resident-proof-modal').hidden)return;
  slot.innerHTML=`<strong>${label}</strong>${residentProofFallback(url,resident,kind,label)}`;
 }
}
function residentProofFallback(url,resident,kind,label){
 return `<div class="resident-proof-empty"><p>Document not available.</p><button type="button" class="btn o" onclick="retryResidentProofImage(this)" data-url="${esc(url)}" data-resident="${resident.id}" data-kind="${kind}" data-name="${esc(resident.name)}" data-label="${esc(label)}">Retry</button><a href="${esc(url)}" target="_blank" rel="noopener">Open in new tab</a></div>`;
}
function residentProofImageError(image){
 const wrap=image&&image.closest('.resident-proof-image-wrap');if(!wrap)return;
 const resident={id:Number(image.dataset.resident),name:image.dataset.name||''};
 wrap.innerHTML=residentProofFallback(image.dataset.url||'',resident,image.dataset.kind||'front',image.dataset.kind==='back'?'Back image':'Front image');
}
function retryResidentProofImage(button){
 const id=Number(button.dataset.resident),resident=(S.residents||[]).find(item=>item.id===id);
 if(resident)loadResidentProofImage(resident,button.dataset.kind||'front',button.dataset.label||'Front image',residentProofRequest);
}
let residentProofScale=1;
function zoomResidentProof(delta,reset){const images=[...document.querySelectorAll('#resident-proof-viewer .resident-proof-image')].filter(image=>image.naturalWidth>0);if(!images.length)return;residentProofScale=reset?1:Math.max(.7,Math.min(3,residentProofScale+delta));images.forEach(image=>image.style.transform=`scale(${residentProofScale})`)}
function confirmResidentReview(id,decision){
 let reason='';
 if(decision==='rejected'){
  const prefix=$('resident-proof-modal')&&!$('resident-proof-modal').hidden?'resident':'rvr',choice=$(prefix+'-reason'),note=$(prefix+'-note'),error=$(prefix+'-reason-error');
  if(!choice||!choice.value){if(error)error.textContent=RESIDENT_COPY.chooseReason;if(choice)choice.focus();return}
  const label=(RESIDENT_COPY.reasons.find(item=>item[0]===choice.value)||[])[1]||choice.value;
  reason=(label+(note&&note.value.trim()?': '+note.value.trim():'')).slice(0,300);
 }
 openConfirm({title:decision==='approved'?RESIDENT_COPY.confirmApprove:RESIDENT_COPY.confirmReject,msg:decision==='approved'?'The resident will be able to submit reports after approval.':'The resident will be notified that the registration was rejected.',yes:decision==='approved'?RESIDENT_COPY.approve:RESIDENT_COPY.reject,no:'Cancel',onYes:()=>reviewRes(id,decision,reason)});
}
function residentDetail(id){
 if(!guard(['admin','brgy']))return;const r=(S.residents||[]).find(x=>x.id===id);
 if(!r){$('app').innerHTML='<div class="card err">Resident not found or access denied.</div>';return}
 $('app').innerHTML=`<p><a href="#/residents">← Back to residents</a></p><div class="card"><h2>${esc(r.name)} ${vbadge(r.vstatus)}</h2>
 <p><b>Barangay:</b> ${esc(bname(r.brgy))}<br><b>Age:</b> ${esc(r.age??'—')}<br><b>Address:</b> ${esc(r.address||'—')}<br><b>Email:</b> ${esc(r.email)}<br><b>Phone:</b> ${esc(r.phone||'—')}<br><b>Registered:</b> ${esc(fd(r.created))}</p>
 <h3>Proof of residency</h3><p><b>Document type:</b> ${esc(r.document_type||'—')}<br><b>OCR name:</b> ${esc(r.ocr_name||'—')}<br><b>OCR address:</b> ${esc(r.ocr_address||'—')}<br><b>OCR barangay:</b> ${esc(r.ocr_barangay||'—')}<br><b>OCR status:</b> ${esc(r.ocr_status||'—')}</p>${r.hasproof?`<a class="btn o" href="/api/img/p/${r.id}" target="_blank" rel="noopener">Open document</a>${r.id_back?` <a class="btn o" href="/api/img/p/${r.id}?kind=back" target="_blank" rel="noopener">Open back image</a>`:''}${r.residency_document?` <a class="btn o" href="/api/img/p/${r.id}?kind=residence" target="_blank" rel="noopener">Open residency document</a>`:''}`:`<p class="mu">${esc(RESIDENT_COPY.emptyProof)}</p>`}
 ${r.vstatus==='pending'?`<h3>${esc(RESIDENT_COPY.decision)}</h3>${residentReasonFields('rvr')}<button class="btn g" onclick="confirmResidentReview(${r.id},'approved')">${esc(RESIDENT_COPY.approve)}</button><button class="btn r" onclick="confirmResidentReview(${r.id},'rejected')">${esc(RESIDENT_COPY.reject)}</button><p id="rvm" class="err" role="alert"></p>`:`<p class="mu">Decision: <b>${esc(VL[r.vstatus])}</b>${r.vat?' on '+esc(fd(r.vat)):''}${r.vrem?' – '+esc(r.vrem):''}</p>`}</div>`}
async function reviewRes(id,decision,reason=''){
 const detailView=location.hash.startsWith('#/resident/'),busyButtons=[...document.querySelectorAll('[data-resident-action]')];
 busyButtons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true')});
 try{
  await api('resident/review',{id,d:decision,rem:reason});await refresh();nav();
  if(detailView)residentDetail(id);else{closeResidentProof();residents(false);$('resident-page-title').focus()}
  toast(decision==='approved'?RESIDENT_COPY.approveSuccess:RESIDENT_COPY.rejectSuccess,'ok');
 }catch(error){
  const message=error.message||'The resident could not be updated.';
  const target=$('resident-review-error')||$('rvm');if(target)target.textContent=message;
  toast(message,'err');busyButtons.forEach(button=>{button.disabled=false;button.removeAttribute('aria-busy')});
 }
}
