/* Public pages: home, track, community, login, register */
const TRACK_COPY={
 title:'Track a Report',intro:'Enter the reference number you received after sending a report.',
 idLabel:'Report ID',placeholder:'OF-2026-000001',format:'Use this format: OF-YYYY-NNNNNN. Example: OF-2026-000001.',
 invalid:'Check the format. Enter an ID like OF-2026-000001.',
 submit:'Track report',loading:'Searching…',searching:'Looking for your report…',
 recent:'Recently tracked',emptyRecent:'Your recent report IDs will appear here.',
 lost:'Lost your report ID? Check your notifications.',
 notFoundTitle:'Report not found',notFoundText:'Check the ID for typing mistakes, then try again. If you still need help, check your notifications or contact your barangay.',
 timeline:['Submitted','Verified','In Progress','Resolved'],
 descriptions:['Your report was received.','An official checked your report.','Work is underway.','The issue has been resolved.'],
 waiting:'Waiting for this step',rejected:'This report was rejected. Check your notifications or contact your barangay for more information.',
 systemError:'We could not look up this report. Please try again.'
};
const TRACK_CODE_PATTERN=/^OF-\d{4}-\d{6}$/;
let TRACK_REQUEST=0,TRACK_IDS=[];
let OCR_ID='',OCR_REQ=0,OCR_RESULT=null,OCR_STATUS='idle',OCR_FILLED=new Set();
let PH_FRONT='',PH_BACK='',QR_FRONT='',QR_BACK='',DOCUMENT_TYPE='',UPLOAD_MODE='front';
const DOCUMENT_TYPES=Object.keys(window.ID_REQUIREMENTS);
function loadTrackedIds(){
 try{const values=JSON.parse(localStorage.getItem('fixitTrackedIds')||'[]');return Array.isArray(values)?values.filter(id=>typeof id==='string'&&TRACK_CODE_PATTERN.test(id)).slice(0,3):[]}
 catch(e){console.warn('Could not read recent report IDs from local storage.',e);return[]}
}
function saveTrackedId(id){
 TRACK_IDS=[id,...TRACK_IDS.filter(value=>value!==id)].slice(0,3);
 try{localStorage.setItem('fixitTrackedIds',JSON.stringify(TRACK_IDS))}
 catch(e){console.warn('Could not save recent report IDs to local storage.',e)}
 renderTrackedIds();
}
function renderTrackedIds(){
 const target=$('track-recent');if(!target)return;
 target.innerHTML=`<div class="track-recent-heading"><h3>${esc(TRACK_COPY.recent)}</h3><p>${TRACK_IDS.length?'Select an ID to look it up again.':esc(TRACK_COPY.emptyRecent)}</p></div>${TRACK_IDS.length?`<div class="track-recent-chips">${TRACK_IDS.map(id=>`<button type="button" class="track-chip" onclick="useTrackedReport('${id}')">${esc(id)}</button>`).join('')}</div>`:''}`;
}
function useTrackedReport(id){const input=$('tc');if(!input)return;input.value=id;trackInputChanged();doTrack()}
function trackInputChanged(){
 const input=$('tc');if(!input)return;
 const value=input.value.toUpperCase();if(input.value!==value)input.value=value;
 const error=$('track-id-error'),invalid=!!value&&!TRACK_CODE_PATTERN.test(value);
 error.hidden=!invalid;error.textContent=invalid?TRACK_COPY.invalid:'';
 input.setAttribute('aria-invalid',String(invalid));
 if($('tr'))$('tr').innerHTML='';
}
function home(){const st=P.stats||{};
 const reports=[['Total reports',st.total],['Resolved',st.resolved],['Open now',st.active],['Barangays reached',st.barangays]];
 $('app').innerHTML=`<div class="civic-home">
 <section class="signal-hero" aria-labelledby="home-title">
   <div class="signal-copy reveal"><p class="kicker">Olongapo City · Community desk</p><h1 id="home-title">Small reports.<br><em>Visible change.</em></h1><p class="hero-lede">Spot a problem on your street? Put it on your barangay’s radar and follow every handoff through to resolution.</p>
   <div class="hero-actions"><a class="signal-cta" href="#/new">Report an issue <span aria-hidden="true">→</span></a><a class="signal-link" href="#/track">Track a report <span aria-hidden="true">↗</span></a></div>
   <p class="quiet-promise">No call queue. No guessing. Your report gets a reference number instantly.</p></div>
   <aside class="signal-board reveal" aria-label="Community report activity"><div class="board-top"><span class="live-dot"></span> LIVE CITY SIGNAL</div><div class="board-number">${st.active??0}</div><p>issues currently moving through review and repair</p><div class="signal-lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div><a href="#/community">See community reports <span aria-hidden="true">→</span></a></aside>
   <div class="hero-grid" aria-hidden="true"></div>
 </section>
 <section class="report-pulse" aria-labelledby="pulse-title"><div class="pulse-heading"><p class="kicker">The city, in motion</p><h2 id="pulse-title">Every report leaves a trail.</h2></div><div class="pulse-stats">${reports.map((x,i)=>`<div class="pulse-stat reveal" style="--i:${i}"><b>${x[1]??0}</b><span>${x[0]}</span></div>`).join('')}</div></section>
 <section class="route-section" aria-labelledby="route-title"><div class="route-intro"><p class="kicker">From sidewalk to solution</p><h2 id="route-title">One clear route.<br>Six accountable steps.</h2><p>FixIt sends each report to the people who can move it forward — while you stay in the loop.</p>${ME?'<a class="text-action" href="#/dash">Open my dashboard <span aria-hidden="true">→</span></a>':'<a class="text-action" href="#/register">Create a resident account <span aria-hidden="true">→</span></a>'}</div><ol class="report-route">${[['01','You flag it','Add a photo, location, and a quick description.'],['02','We check it','Initial verification keeps reports useful and focused.'],['03','It reaches the right desk','Barangay officials can review and assign it.'],['04','You see the outcome','Follow status updates until the work is complete.']].map((x,i)=>`<li class="reveal" style="--i:${i}"><span>${x[0]}</span><div><h3>${x[1]}</h3><p>${x[2]}</p></div></li>`).join('')}</ol></section>
 <section class="category-section" aria-labelledby="category-title"><div><p class="kicker">Make your neighborhood legible</p><h2 id="category-title">What needs attention?</h2></div><div class="category-cloud">${CATS.map((c,i)=>`<a class="category-tag tag-${i%4}" href="#/new" aria-label="Report ${esc(c)}">${esc(c)} <span aria-hidden="true">↗</span></a>`).join('')}</div></section>
 <section class="home-close"><p>Olongapo works better when the street-level details have somewhere to go.</p><a class="signal-cta light" href="#/new">Start a report <span aria-hidden="true">→</span></a></section>
 </div>`}
function track(){
 TRACK_IDS=loadTrackedIds();
 $('app').innerHTML=`<section class="track-page"><header class="track-header"><p class="eyebrow">REPORT LOOKUP</p><h2>${esc(TRACK_COPY.title)}</h2><p>${esc(TRACK_COPY.intro)}</p></header><form class="track-form" onsubmit="doTrack(event)" novalidate><label for="tc">${esc(TRACK_COPY.idLabel)}</label><div class="track-form-row"><input id="tc" name="code" type="text" maxlength="14" placeholder="${esc(TRACK_COPY.placeholder)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="track-id-hint track-id-error"><button id="track-submit" class="btn track-submit" type="submit"><span>${esc(TRACK_COPY.submit)}</span></button></div><p id="track-id-hint" class="track-help">${esc(TRACK_COPY.format)}</p><p id="track-id-error" class="track-inline-error" role="alert" aria-live="polite" hidden></p></form><p class="track-notification-note">${esc(TRACK_COPY.lost)} <a href="#/notifs">View notifications</a></p><div id="track-recent"></div><div id="tr" class="track-result" aria-live="polite" aria-busy="false"></div></section>`;
 $('tc').addEventListener('input',trackInputChanged);renderTrackedIds();
}
function trackTimeline(report){
 const history=report.hist||[],status=String(report.status||'').toUpperCase();
 const entryFor=accepted=>history.filter(item=>accepted.includes(String(item.s||'').toUpperCase())).slice(-1)[0]||null;
 const stageEntries=[
  entryFor(['SUBMITTED','UNDER REVIEW'])||{at:report.created},
  entryFor(['VERIFIED','ASSIGNED']),
  entryFor(['IN PROGRESS']),
  entryFor(['RESOLVED'])
 ];
 const current={SUBMITTED:0,'UNDER REVIEW':0,VERIFIED:1,ASSIGNED:1,'IN PROGRESS':2,RESOLVED:3,REJECTED:Math.max(0,history.reduce((max,item)=>{const index={'SUBMITTED':0,'UNDER REVIEW':0,VERIFIED:1,ASSIGNED:1,'IN PROGRESS':2,RESOLVED:3}[String(item.s||'').toUpperCase()];return index===undefined?max:Math.max(max,index)},0))}[status]??0;
 return `<ol class="track-timeline" aria-label="Report status timeline">${TRACK_COPY.timeline.map((label,index)=>{
  const entry=stageEntries[index],completed=!!entry&&index<current,active=index===current;
  const description=index===3&&report.resolution?report.resolution:TRACK_COPY.descriptions[index];
  return `<li class="track-step ${completed?'is-complete':''} ${active?'is-current':''}"${active?' aria-current="step"':''}><span class="track-step-marker" aria-hidden="true">${completed?'✓':index+1}</span><div class="track-step-content"><div class="track-step-heading"><strong>${esc(label)}</strong><time${entry&&entry.at?` datetime="${esc(entry.at)}" title="${esc(fd(entry.at))}"`:''}>${entry&&entry.at?esc(fd(entry.at)):esc(TRACK_COPY.waiting)}</time></div><p>${esc(description)}</p></div></li>`
 }).join('')}</ol>`
}
function trackedReportMarkup(report){
 const rejected=String(report.status||'').toUpperCase()==='REJECTED';
 return `<article class="track-report-card"><header class="track-report-heading"><div><p class="eyebrow">REPORT FOUND</p><h3>${esc(report.code)}</h3><p>${esc(report.cat)} · ${esc(report.brgy)} · Submitted ${esc(fdate(report.created))}</p></div>${badge(report.status)}</header>${rejected?`<p class="track-rejected" role="status">${esc(TRACK_COPY.rejected)}</p>`:''}${trackTimeline(report)}${report.resolution?`<p class="track-resolution"><b>Resolution:</b> ${esc(report.resolution)}</p>`:''}</article>`
}
async function doTrack(event){
 if(event)event.preventDefault();
 const input=$('tc'),button=$('track-submit'),result=$('tr');if(!input||!button||!result)return;
 input.value=input.value.trim().toUpperCase();
 if(!TRACK_CODE_PATTERN.test(input.value)){const error=$('track-id-error');error.textContent=TRACK_COPY.invalid;error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return}
 $('track-id-error').hidden=true;input.setAttribute('aria-invalid','false');
 const code=input.value,request=++TRACK_REQUEST;saveTrackedId(code);
 button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML=`<span class="track-spinner" aria-hidden="true"></span>${esc(TRACK_COPY.loading)}`;
 result.setAttribute('aria-busy','true');result.innerHTML=`<p class="track-searching" role="status">${esc(TRACK_COPY.searching)}</p>`;
 try{
  const report=await api('track?code='+encodeURIComponent(code));if(request!==TRACK_REQUEST)return;
  result.innerHTML=report.found?trackedReportMarkup(report):`<div class="track-not-found" role="alert"><span class="track-not-found-icon" aria-hidden="true">?</span><div><h3>${esc(TRACK_COPY.notFoundTitle)}</h3><p>${esc(TRACK_COPY.notFoundText)}</p><a href="#/notifs">Check notifications</a></div></div>`;
 }catch(error){if(request===TRACK_REQUEST)result.innerHTML=`<p class="track-request-error" role="alert">${esc(error.message||TRACK_COPY.systemError)}</p>`}
 finally{if(request===TRACK_REQUEST&&button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=`<span>${esc(TRACK_COPY.submit)}</span>`;result.setAttribute('aria-busy','false')}}
}
function community(){$('app').innerHTML=`<div class="card"><h2>Community Reports</h2><div class="tw"><table><tr><th>Category</th><th>Barangay</th><th>General location</th><th>Status</th><th>Date</th></tr>${P.list.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.brgy)}</td><td>Brgy. ${esc(r.brgy)}</td><td>${badge(r.status)}</td><td>${esc(fdate(r.date))}</td></tr>`).join('')}</table></div></div>`}
function login(){$('app').innerHTML=`<div class="authbox card" data-enter="doLogin"><h2>Welcome back</h2><p class="mu">Log in to report problems or manage reports.</p>
 <label for="le">Email</label><input id="le" type="email" autocomplete="username"><label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password">
 <button class="btn block" onclick="doLogin()">Log in</button><p id="lm" class="err" role="alert"></p><p class="mu">New here? <a href="#/register">Create an account</a></p></div>`;$('le').focus()}
async function doLogin(){$('lm').textContent='';await guarded(async()=>{await api('login',{email:$('le').value,password:$('lp').value});toast('Welcome back!','ok');goto('#/dash')},'lm')}
function register(){PH='';PH_FRONT='';PH_BACK='';OCR_ID='';OCR_RESULT=null;OCR_STATUS='idle';OCR_FILLED=new Set();DOCUMENT_TYPE='';UPLOAD_MODE='front';const B=allowedBarangays();
 $('app').innerHTML=`<div class="reg-page">
  <div class="reg-card" data-enter="doReg">
   <header class="reg-header">
    <div class="reg-brand">Olongapo <b>FixIt</b></div>
    <p class="eyebrow">Resident registration</p>
    <h1 class="reg-title">Personal Information and Resident Verification</h1>
    <p class="reg-subtitle">Create one account to report and track community problems. A barangay official will verify your residency before you can submit reports.</p>
   </header>
   <form id="regForm" novalidate>
    <section class="reg-section">
     <div class="reg-section-head">
      <h2 class="reg-section-title"><span class="reg-sec-icon">👤</span>Account Information</h2>
      <p class="reg-section-desc">Use your full name and an email address you can access.</p>
     </div>
     <div class="reg-cols">
      <div class="reg-field">
       <label class="reg-label"><span class="reg-icon">👤</span>Complete Name<span class="reg-req" aria-hidden="true">*</span></label>
       <input id="rn" type="text" placeholder="Juan Dela Cruz" autocomplete="name" maxlength="100" required>
       <p class="reg-err" id="er-rn"></p>
      </div>
      <div class="reg-field">
       <label class="reg-label"><span class="reg-icon">✉️</span>Email Address<span class="reg-req" aria-hidden="true">*</span></label>
       <input id="re" type="email" placeholder="juan@example.com" autocomplete="email" maxlength="254" required>
       <p class="reg-err" id="er-re"></p>
      </div>
      <div class="reg-field">
       <label class="reg-label"><span class="reg-icon">📞</span>Contact Number<span class="reg-req" aria-hidden="true">*</span></label>
       <input id="rph" type="tel" placeholder="0917 000 0000" autocomplete="tel" maxlength="30" required>
       <p class="reg-err" id="er-rph"></p>
      </div>
      <div class="reg-field">
       <label class="reg-label" for="rbd"><span class="reg-icon" aria-hidden="true">📅</span>Date of Birth<span class="reg-req" aria-hidden="true">*</span></label>
       <input id="rbd" type="date" autocomplete="bday" required>
       <p class="reg-age-status" id="regAgeStatus" role="status" aria-live="polite"></p>
       <p class="reg-age-review" id="regDobOcrHint" role="status" aria-live="polite"></p>
       <p class="reg-err" id="er-rbd" role="alert"></p>
      </div>
     </div>
    </section>
    <section class="reg-section">
     <div class="reg-section-head">
      <h2 class="reg-section-title"><span class="reg-sec-icon">🏠</span>Residential Information</h2>
      <p class="reg-section-desc">Where do you live? This helps us assign your reports to the right barangay.</p>
     </div>
     <div class="reg-cols">
      <div class="reg-field full">
       <label class="reg-label"><span class="reg-icon">🏠</span>Complete Residential Address<span class="reg-req" aria-hidden="true">*</span></label>
       <input id="rad" type="text" placeholder="House no., street, purok / zone, barangay" autocomplete="street-address" required>
       <p class="reg-err" id="er-rad"></p>
      </div>
      <div class="reg-field full">
       <label class="reg-label"><span class="reg-icon">📍</span>Barangay<span class="reg-req" aria-hidden="true">*</span></label>
       <select id="rb" required>
        <option value="">Select your barangay…</option>${B.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}
       </select>
       <p class="reg-hint">Your barangay officials will verify your residency.</p>
       <p class="reg-err" id="er-rb"></p>
      </div>
     </div>
    </section>
    <section class="reg-section reg-proof-section">
     <div class="reg-section-head">
      <div class="reg-proof-heading">
       <span class="reg-proof-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg></span>
       <div><h2 class="reg-section-title">Proof of Residency</h2><p class="reg-section-desc">Upload a valid ID to help verify your identity and residency.</p></div>
      </div>
     </div>
     <div class="reg-cols">
       <div class="reg-field full">
        <label class="reg-label" for="ridType">ID / Document Type<span class="reg-req" aria-hidden="true">*</span></label>
        <select id="ridType" required onchange="onDocumentTypeChange(this.value)">
         <option value="">Select your ID type</option>${DOCUMENT_TYPES.map(type=>`<option value="${esc(type)}">${esc(type)}</option>`).join('')}
        </select>
        <p class="reg-err" id="er-ridType"></p>
       </div>
       <div class="reg-requirement" id="uploadModeHint" hidden>
        <strong id="uploadRequirementTitle">Upload requirement</strong>
        <span id="uploadRequirementText"></span>
       </div>
       <div class="reg-upload-grid" id="regUploadGrid">
        <div class="reg-field reg-id-upload" id="governmentFrontField" hidden>
         <label class="reg-label" for="rf">Front Image<span class="reg-req" aria-hidden="true">*</span></label>
         <div class="reg-upload" id="regUpload">
          <input class="reg-file-input" id="rf" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onchange="regFile(this)">
          <label class="sr-only" for="rf">Choose a front image of your ID</label>
          <div class="reg-dropzone" id="regFrontDropzone">
           <svg class="reg-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></svg>
           <strong>Upload front of your ID</strong>
           <span>Drag and drop your image here or click to browse.</span>
           <small>JPG or PNG · Maximum 5 MB</small>
           <button class="reg-browse-link" id="regFrontBrowse" type="button" onclick="regBrowse('rf')">Browse files</button>
          </div>
          <div class="reg-file-preview" id="regFilePreview" hidden>
           <img id="regFileImage" class="reg-id-preview" alt="Front of ID preview">
           <div class="reg-file-item" id="regFileItem">
            <span class="reg-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>
            <span class="reg-file-name" id="regFileName">Selected image</span>
            <div class="reg-file-actions"><button type="button" class="reg-file-remove" id="regFrontReplace" onclick="regBrowse('rf')">Replace</button><button type="button" class="reg-file-remove" onclick="regRemove()">Remove</button></div>
           </div>
          </div>
         </div>
         <p class="reg-err" id="er-rf"></p>
        </div>
        <div class="reg-field reg-id-upload" id="governmentBackField" hidden>
         <label class="reg-label" for="rbk">Back of ID<span class="reg-req" aria-hidden="true">*</span></label>
         <div class="reg-upload" id="regBackUpload">
          <input class="reg-file-input" id="rbk" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onchange="regBackFile(this)">
          <label class="sr-only" for="rbk">Choose a back image of your ID</label>
          <div class="reg-dropzone" id="regBackDropzone">
           <svg class="reg-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></svg>
           <strong>Upload back of your ID</strong>
           <span>Upload the back of your ID if required for verification.</span>
           <small>JPG or PNG · Maximum 5 MB</small>
           <button class="reg-browse-link" id="regBackBrowse" type="button" onclick="regBrowse('rbk')">Browse files</button>
          </div>
          <div id="rbkPreview" class="reg-file-preview" hidden></div>
         </div>
         <p class="reg-err" id="er-rbk"></p>
        </div>
       </div>
       <div class="reg-ocr-panel">
        <div class="reg-ocr-status" id="regOcrStatus" role="status" aria-live="polite"></div>
        <div class="reg-ocr-extracted" id="regOcrExtracted" role="status" aria-live="polite"></div>
        <button type="button" class="reg-ocr-retry" id="regOcrRetry" style="display:none" onclick="regOcrRetry()">Try reading the ID again</button>
       </div>
     </div>
    </section>
    <section class="reg-section">
     <div class="reg-section-head">
      <h2 class="reg-section-title"><span class="reg-sec-icon">🔐</span>Account Security</h2>
      <p class="reg-section-desc">Create a secure password to protect your account.</p>
     </div>
     <div class="reg-cols">
      <div class="reg-field full">
       <label class="reg-label"><span class="reg-icon">🔒</span>Password<span class="reg-req" aria-hidden="true">*</span></label>
       <div class="reg-pass-wrap">
        <input id="rp" type="password" autocomplete="new-password" placeholder="Create a strong password" required>
        <button type="button" class="reg-pass-toggle" onclick="regToggle('rp')" aria-label="Show password" aria-pressed="false">
         <svg class="reg-eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
         <svg class="reg-eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.8"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 3-.4"/></svg>
        </button>
       </div>
       <p class="reg-hint" id="regPassReq">8-128 characters; include uppercase, lowercase, and a number</p>
       <p class="reg-strength" id="regStrength"></p>
       <p class="reg-err" id="er-rp"></p>
      </div>
      <div class="reg-field full">
       <label class="reg-label"><span class="reg-icon">🔁</span>Confirm Password<span class="reg-req" aria-hidden="true">*</span></label>
       <div class="reg-pass-wrap">
        <input id="rc" type="password" autocomplete="new-password" placeholder="Enter your password again" required>
        <button type="button" class="reg-pass-toggle" onclick="regToggle('rc')" aria-label="Show password" aria-pressed="false">
         <svg class="reg-eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
         <svg class="reg-eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.8"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 3-.4"/></svg>
        </button>
       </div>
       <p class="reg-err" id="er-rc"></p>
      </div>
     </div>
    </section>
    <div class="reg-actions">
     <button type="button" class="reg-btn" id="regBtn" onclick="doReg()">Create Account</button>
     <p class="reg-link">Already registered? <a href="#/login">Log in</a></p>
    </div>
   </form>
  </div>
 </div>`;$('rn').focus();
 const up=$('regUpload');
 up.onclick=e=>{if(e.target!==$('rf')&&!e.target.closest('button'))regBrowse('rf')};
 up.ondragover=e=>{e.preventDefault();up.classList.add('reg-drag')};
 up.ondragleave=e=>{e.preventDefault();up.classList.remove('reg-drag')};
 up.ondrop=e=>{e.preventDefault();up.classList.remove('reg-drag');const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)regSetFile(f,$('rf'))};
 const back=$('rbk');
 if(back){
  const zone=back.closest('.reg-upload');
  zone.onclick=e=>{if(e.target!==back&&!e.target.closest('button'))regBrowse('rbk')};
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('reg-drag')};
  zone.ondragleave=e=>{e.preventDefault();zone.classList.remove('reg-drag')};
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('reg-drag');const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)regBackFile(back,f)};
 }
 const dob=$('rbd');
 if(dob){
  dob.max=RegistrationAge.todayDate();
  dob.addEventListener('input',validateRegistrationDob);
  dob.addEventListener('change',validateRegistrationDob);
 }
}
  const passwordInput=$('rp'),strength=$('regStrength');
  if(passwordInput&&strength){
   passwordInput.addEventListener('input',()=>{
    const value=passwordInput.value;
    let score=0;
    if(value.length>=8)score++;
    if(/[A-Z]/.test(value)&&/[a-z]/.test(value))score++;
    if(/[0-9]/.test(value))score++;
    if(/[^A-Za-z0-9]/.test(value))score++;
    const labels=['Add a stronger password','Weak','Fair','Good','Strong'];
    strength.textContent=value?labels[Math.max(1,score)]:labels[0];
    strength.style.color=score>=4?'var(--ok)':score>=2?'var(--warn)':'var(--er)';
    strength.dataset.score=String(score);
   });
  }
 async function regSetFile(file,input){
  const item=$('regFileItem'),name=$('regFileName'),image=$('regFileImage'),preview=$('regFilePreview'),dropzone=$('regFrontDropzone');
  const clear=()=>{PH='';PH_FRONT='';QR_FRONT='';PH_BACK='';QR_BACK='';if(input)input.value='';if(preview)preview.hidden=true;if(image)image.removeAttribute('src');if(dropzone)dropzone.hidden=false;if($('rbk'))$('rbk').value='';if($('rbkPreview')){$('rbkPreview').innerHTML='';$('rbkPreview').hidden=true}if($('regBackDropzone'))$('regBackDropzone').hidden=false;regClearOcr()};
  if(!file){clear();if($('er-rf'))$('er-rf').textContent='';if(input)input.removeAttribute('aria-invalid');return}
  if(!/^image\/(jpeg|png)$/.test(file.type)){clear();regErr('rf','Only JPG or PNG images are accepted.');return}
  if(file.size>5e6){clear();regErr('rf','Choose an image smaller than 5 MB.');return}
  if(PH_FRONT&&PH_BACK){
   PH_BACK='';QR_BACK='';
   if($('rbk'))$('rbk').value='';
   if($('rbkPreview')){$('rbkPreview').innerHTML='';$('rbkPreview').hidden=true}
   if($('regBackDropzone'))$('regBackDropzone').hidden=false;
   if($('er-rbk'))$('er-rbk').textContent='';
  }
  try{
   PH=await readDataURL(file);PH_FRONT=PH;
   if(item)item.style.display='flex';
   if(name)name.textContent=file.name+' · '+(file.size/1024).toFixed(0)+' KB';
   if(image){image.src=PH;image.hidden=false}
   if(preview)preview.hidden=false;
   if(dropzone)dropzone.hidden=true;
  }catch(e){clear();regErr('rf',e.message);return}
  if($('er-rf'))$('er-rf').textContent='';
  if(input)input.removeAttribute('aria-invalid');
  regClearOcr();
  QR_FRONT=await decodeQrFromFile(file);
  if(UPLOAD_MODE==='back'&&!PH_BACK){regAwaitingBackImage();return}
  startOcr(PH);
 }
 function regFile(inp){regSetFile(inp.files&&inp.files[0],inp);}
 function regBrowse(id){const input=$(id);if(input){input.value='';input.click()}}
 function regRemove(){regSetFile(null,$('rf'))}
function onDocumentTypeChange(type){
 DOCUMENT_TYPE=DOCUMENT_TYPES.includes(type)?type:'';
 const isResidence=DOCUMENT_TYPE==='Barangay Residency Document';
 const requirement=DOCUMENT_TYPE&&window.ID_REQUIREMENTS[DOCUMENT_TYPE];
 UPLOAD_MODE=requirement?requirement.uploadMode:'front';
 PH_BACK='';
 if($('rbk'))$('rbk').value='';
 if($('rbkPreview'))$('rbkPreview').innerHTML='';
 const govFront=$('governmentFrontField'),govBack=$('governmentBackField');
 if(govFront)govFront.hidden=!DOCUMENT_TYPE;
 if(govBack)govBack.hidden=UPLOAD_MODE==='front'||!DOCUMENT_TYPE;
 const uploadGrid=$('regUploadGrid');
 if(uploadGrid)uploadGrid.classList.toggle('has-back',UPLOAD_MODE==='back'&&!!DOCUMENT_TYPE);
 const requirementPanel=$('uploadModeHint');
 if(requirementPanel){
  requirementPanel.hidden=!requirement;
  if(requirement){
   $('uploadRequirementTitle').textContent=UPLOAD_MODE==='back'?'Front and back required':'Front only';
   $('uploadRequirementText').textContent=requirement.reason;
  }
 }
 const frontLabel=govFront&&govFront.querySelector('label');
 const hint=govFront&&govFront.querySelector('.reg-hint');
 if(frontLabel)frontLabel.innerHTML=isResidence?'Residency Document Image<span class="reg-req" aria-hidden="true">*</span>':'Front Image<span class="reg-req" aria-hidden="true">*</span>';
 if(hint)hint.textContent=isResidence?'Upload a clear Barangay Certificate of Residency or officially accepted residency document. Only this front image is required.':'Upload a clear front image of the selected document.';
 regClearOcr();clearDocumentFiles(isResidence);
}
function clearDocumentFiles(isResidence){
 PH='';PH_FRONT='';QR_FRONT='';QR_BACK='';if($('rf'))$('rf').value='';
 if($('regFilePreview'))$('regFilePreview').hidden=true;
 if($('regFileImage'))$('regFileImage').removeAttribute('src');
 if($('regFrontDropzone'))$('regFrontDropzone').hidden=false;
 PH_BACK='';if($('rbk'))$('rbk').value='';
 if($('rbkPreview')){$('rbkPreview').innerHTML='';$('rbkPreview').hidden=true}
 if($('regBackDropzone'))$('regBackDropzone').hidden=false;
 if($('er-rf'))$('er-rf').textContent='';
 if($('er-rbk'))$('er-rbk').textContent='';
 if($('rf'))$('rf').removeAttribute('aria-invalid');
 if($('rbk'))$('rbk').removeAttribute('aria-invalid');
}
async function regBackFile(inp,fileOverride){
 const file=fileOverride||(inp.files&&inp.files[0]);
 if(!file)return;
 const preview=$('rbkPreview'),dropzone=$('regBackDropzone');
 const clear=()=>{PH_BACK='';QR_BACK='';if(inp)inp.value='';if(preview){preview.hidden=true;preview.innerHTML=''}if(dropzone)dropzone.hidden=false};
 try{
  if(!/^image\/(jpeg|png)$/.test(file.type))throw new Error('Only JPG or PNG images are accepted.');
  if(file.size>5e6)throw new Error('Choose an image smaller than 5 MB.');
  PH_BACK=await readImg(file,1800,.85);
  QR_BACK=await decodeQrFromFile(file);
  preview.innerHTML=`<img class="reg-id-preview" src="${PH_BACK}" alt="Back of ID preview"><div class="reg-file-item"><span class="reg-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span><span class="reg-file-name">${esc(file.name)} · ${(file.size/1024).toFixed(0)} KB</span><div class="reg-file-actions"><button type="button" class="reg-file-remove" onclick="regBrowse('rbk')">Replace</button><button type="button" class="reg-file-remove" onclick="regBackRemove()">Remove</button></div></div><p class="reg-side-status">Image ready for ID processing.</p>`;
  preview.hidden=false;
  if(dropzone)dropzone.hidden=true;
  if($('er-rbk'))$('er-rbk').textContent='';
  if(inp)inp.removeAttribute('aria-invalid');
  if(PH_FRONT)startOcr(PH_FRONT);
 }catch(e){
  clear();
  regErr('rbk',e.message);
  regClearOcr();
  if(PH_FRONT&&UPLOAD_MODE==='back')regAwaitingBackImage();
  else if(PH_FRONT)startOcr(PH_FRONT);
 }
}
function regBackRemove(){
 PH_BACK='';QR_BACK='';
 if($('rbk'))$('rbk').value='';
 if($('rbkPreview')){$('rbkPreview').innerHTML='';$('rbkPreview').hidden=true}
 if($('regBackDropzone'))$('regBackDropzone').hidden=false;
 if($('er-rbk'))$('er-rbk').textContent='';
 if($('rbk'))$('rbk').removeAttribute('aria-invalid');
 regClearOcr();
 if(PH_FRONT&&UPLOAD_MODE==='back')regAwaitingBackImage();
 else if(PH_FRONT)startOcr(PH_FRONT);
}
function regAwaitingBackImage(){
 const st=$('regOcrStatus');
 if(st){st.textContent='Front image ready. Upload the back of your ID to start ID processing.';st.className='reg-ocr-status reg-ocr-ready';st.setAttribute('aria-busy','false')}
}
function regClearOcr(){OCR_REQ++;OCR_ID='';OCR_RESULT=null;OCR_STATUS='idle';const dob=$('rbd');OCR_FILLED=new Set();const st=$('regOcrStatus'),ex=$('regOcrExtracted'),retry=$('regOcrRetry'),dobHint=$('regDobOcrHint'),ageStatus=$('regAgeStatus'),dobError=$('er-rbd');if(st){st.textContent='';st.className='reg-ocr-status';st.setAttribute('aria-busy','false')}if(ex)ex.textContent='';if(retry)retry.style.display='none';if(dobHint)dobHint.textContent='';if(ageStatus)ageStatus.textContent='';if(dobError)dobError.textContent='';if(dob&&dob.value)validateRegistrationDob()}


/* The AI reads the ID, so no image enhancement is needed. Only shrink very large photos to keep uploads fast.
   The image the resident uploads as proof is not changed. */
async function prepOcrImage(dataUrl){
 try{
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/'))return dataUrl;
  const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=dataUrl});
  const longest=Math.max(img.naturalWidth,img.naturalHeight);
  if(!longest||longest<=1800)return dataUrl;
  const k=1800/longest,w=Math.round(img.naturalWidth*k),h=Math.round(img.naturalHeight*k);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const ctx=cv.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
  const out=cv.toDataURL('image/jpeg',.88);
  return out.length<dataUrl.length?out:dataUrl;
 }catch(_){return dataUrl}
}
async function decodeQrFromFile(file){
 try{
  if(typeof jsQR!=='function'||!file||typeof createImageBitmap!=='function')return '';
  const stEl=$('regOcrStatus');if(stEl){stEl.textContent='Scanning for a QR code...';stEl.className='reg-ocr-status reg-ocr-busy'}
  const bmp=await createImageBitmap(file);
  try{
   for(const max of [1400,900]){
    const scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,w,h);
    const img=ctx.getImageData(0,0,w,h);
    const code=jsQR(img.data,w,h,{inversionAttempts:'dontInvert'});
    if(code&&code.data){console.log('[QR] code found in image ('+String(code.data).length+' characters)');return String(code.data).slice(0,6000)}
   }
  }finally{if(bmp.close)bmp.close()}
 }catch(_){}
 return '';
}
function ocrStatusText(r){
 const conf=r.fieldConfidence||{};
 const available=Object.values(conf).filter(v=>Number(v)>0).length;
 let t=available<2?'Some information could not be detected. Please review the extracted fields.':'Information extracted successfully. Please review the fields.';
 if(r.qr&&r.qr.found)t+=' Details were read from the ID\'s QR code (not yet verified with PhilSys Check).';
 else{
  if(r.qr&&r.qr.provided)t+=' A QR code was detected but it is not in a recognized PhilSys format, so it was not used.';
  else if(/PhilID/i.test(r.documentType||'')&&typeof UPLOAD_MODE!=='undefined'&&UPLOAD_MODE==='back')t+=' No QR code could be detected in the back image. Use a sharp, straight, well-lit photo of the QR code.';
  if(r.ai)t+=' Read with AI assistance.';
 }
 if(r.crossCheck==='mismatch')t+=' Warning: the QR data does not match the printed details. Please check carefully.';
 return t;
}
async function startOcr(dataUrl){
 const req=++OCR_REQ;
 const st=$('regOcrStatus');
 const ex=$('regOcrExtracted'),retry=$('regOcrRetry');
 if(st){st.textContent='Uploading ID images and processing them…';st.className='reg-ocr-status reg-ocr-busy';st.setAttribute('aria-busy','true')}
 if(ex)ex.textContent='';if(retry)retry.style.display='none';
 try{
  const ocrFront=await prepOcrImage(dataUrl),ocrBack=UPLOAD_MODE==='back'&&PH_BACK?await prepOcrImage(PH_BACK):undefined;
  const result=await api('ocr',{proof:ocrFront,documentType:DOCUMENT_TYPE,uploadMode:UPLOAD_MODE,qr:(QR_BACK||QR_FRONT||undefined),front:ocrFront,back:ocrBack});
  if(req!==OCR_REQ)return;
  OCR_RESULT=result;OCR_STATUS=result.status;
  if(result.status==='readable'){OCR_ID=result.ocrId;applyOcrResult(result);if(st){st.textContent=ocrStatusText(result);st.className='reg-ocr-status reg-ocr-success';st.setAttribute('aria-busy','false')}}
  else{updateDobOcrHint();if(st){st.textContent='This image could not be read. Please upload a clearer image.';st.className='reg-ocr-status reg-ocr-error';st.setAttribute('aria-busy','false')}if(retry)retry.style.display='inline-block'}
 }catch(e){if(req!==OCR_REQ)return;const dobHint=$('regDobOcrHint');if(dobHint)dobHint.textContent=RegistrationAge.messages.ocrReview;if(st){st.textContent='The ID could not be processed. Please try a clearer image or try again.';st.className='reg-ocr-status reg-ocr-error';st.setAttribute('aria-busy','false')}if(retry)retry.style.display='inline-block'}
}
function applyOcrResult(result){
 const name=$('rn'),dob=$('rbd'),rad=$('rad'),rb=$('rb'),sex=$('rgn');
 const address=(result.address&&result.address.length<=200)?result.address:'',barangay=result.barangay||'';
 if(name&&(!name.value.trim()||OCR_FILLED.has('rn'))&&result.name){name.value=result.name;name.dispatchEvent(new Event('input',{bubbles:true}));name.dispatchEvent(new Event('change',{bubbles:true}));OCR_FILLED.add('rn')}
 if(rad&&(!rad.value.trim()||OCR_FILLED.has('rad'))&&address){rad.value=address;rad.dispatchEvent(new Event('input',{bubbles:true}));rad.dispatchEvent(new Event('change',{bubbles:true}));OCR_FILLED.add('rad')}
 if(sex&&(!sex.value||OCR_FILLED.has('rgn'))&&result.sex&&['Male','Female'].includes(result.sex)){sex.value=result.sex;sex.dispatchEvent(new Event('change',{bubbles:true}));OCR_FILLED.add('rgn')}
 const civil=$('rcivil');
 if(civil&&(!civil.value||OCR_FILLED.has('rcivil'))&&result.civilStatus){const opt=[...civil.options].find(o=>o.text===result.civilStatus);if(opt){civil.value=opt.value;civil.dispatchEvent(new Event('change',{bubbles:true}));OCR_FILLED.add('rcivil')}}
 if(rb&&(!rb.value||OCR_FILLED.has('rb'))){
  const key=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const hay=key(address+' '+barangay);
  const opt=[...rb.options].find(o=>o.value&&key(o.text).length>=3&&hay.includes(key(o.text).replace(/^(barangay|brgy)/,'')));
  if(opt){rb.value=opt.value;rb.dispatchEvent(new Event('change',{bubbles:true}));OCR_FILLED.add('rb')}
 }
 const ex=$('regOcrExtracted');
 if(ex){
  const brgySel=rb&&rb.value?rb.options[rb.selectedIndex]?.text||'':'';
  const normalizeKey=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const normalizedAddress=normalizeKey(address+' '+barangay),normalizedBarangay=normalizeKey(brgySel);
  const addrStatus=!brgySel?'Please select a barangay':normalizedBarangay&&normalizedAddress.includes(normalizedBarangay)?'Address appears to match selected barangay':'Address requires manual review';
  ex.innerHTML=`<strong>${esc(addrStatus)}</strong>${address?' · '+esc(address):''}`;
 }
 if(dob){
  updateDobOcrHint();
  if(dob.value)validateRegistrationDob();
  else{const error=$('er-rbd'),status=$('regAgeStatus');if(error)error.textContent='';if(status)status.textContent='';dob.removeAttribute('aria-invalid')}
 }
}
function registrationOcrDob(result){
 const dob=RegistrationAge.normalizeDob(result&&result.dob);
 if(!dob)return'';
 const confidence=result&&result.fieldConfidence&&result.fieldConfidence.dateOfBirth;
 return confidence===undefined||confidence===null||Number(confidence)>=0.6?dob:'';
}
function updateDobOcrHint(){
 const hint=$('regDobOcrHint'),input=$('rbd');
 if(!hint||!input)return;
 if(!OCR_RESULT){hint.textContent='';return}
 const extractedDob=registrationOcrDob(OCR_RESULT),enteredDob=RegistrationAge.normalizeDob(input.value);
 hint.textContent=extractedDob&&enteredDob&&extractedDob!==enteredDob?RegistrationAge.messages.ocrReview:'';
}
async function regOcrRetry(){
 const req=++OCR_REQ;
 const st=$('regOcrStatus'),retry=$('regOcrRetry');
 const image=PH_FRONT||PH;
 if(!image)return;
 if(st){st.textContent='Uploading ID images and processing them…';st.className='reg-ocr-status reg-ocr-busy';st.setAttribute('aria-busy','true')}
 if(retry)retry.style.display='none';
 try{
  const ocrFront=await prepOcrImage(PH_FRONT||image),ocrBack=UPLOAD_MODE==='back'&&PH_BACK?await prepOcrImage(PH_BACK):undefined;
  const result=await api('ocr',{proof:ocrFront,documentType:DOCUMENT_TYPE,uploadMode:UPLOAD_MODE,qr:(QR_BACK||QR_FRONT||undefined),front:ocrFront,back:ocrBack});
  if(req!==OCR_REQ)return;
  OCR_RESULT=result;OCR_STATUS=result.status;
  if(result.status==='readable'){OCR_ID=result.ocrId;applyOcrResult(result);if(st){st.textContent=ocrStatusText(result);st.className='reg-ocr-status reg-ocr-success';st.setAttribute('aria-busy','false')}}
  else{updateDobOcrHint();if(st){st.textContent='This image could not be read. Please upload a clearer image.';st.className='reg-ocr-status reg-ocr-error';st.setAttribute('aria-busy','false')}if(retry)retry.style.display='inline-block'}
 }catch(e){if(req!==OCR_REQ)return;const dobHint=$('regDobOcrHint');if(dobHint)dobHint.textContent=RegistrationAge.messages.ocrReview;if(st){st.textContent='The ID could not be processed. Please try a clearer image or try again.';st.className='reg-ocr-status reg-ocr-error';st.setAttribute('aria-busy','false')}if(retry)retry.style.display='inline-block'}
}
function regToggle(id){
 const input=$(id),wrap=input&&input.closest('.reg-pass-wrap'),button=wrap&&wrap.querySelector('.reg-pass-toggle');
 if(!input||!button)return;
 const visible=input.type==='password';
 input.type=visible?'text':'password';
 button.setAttribute('aria-pressed',String(visible));
 button.setAttribute('aria-label',visible?'Hide password':'Show password');
}
function regClear(){['rn','re','rph','ra','rbd','rgn','rcivil','rgnOther','rad','rb','ridType','rf','rbk','rp','rc'].forEach(id=>{const e=$('er-'+id),input=$(id);if(e)e.textContent='';if(input)input.removeAttribute('aria-invalid')});const ageStatus=$('regAgeStatus'),dobHint=$('regDobOcrHint');if(ageStatus)ageStatus.textContent='';if(dobHint)dobHint.textContent=''}
function regErr(field,msg){const e=$('er-'+field),input=$(field);if(e)e.textContent=msg;if(input)input.setAttribute('aria-invalid','true')}
function validateRegistrationDob(){
 const input=$('rbd'),error=$('er-rbd'),status=$('regAgeStatus');
 if(!input)return false;
 updateDobOcrHint();
 const result=RegistrationAge.calculateAge(input.value);
 if(result.status==='invalid'){
  if(error)error.textContent=RegistrationAge.messages.invalid;
  if(status)status.textContent='';
  input.setAttribute('aria-invalid','true');
  return false;
 }
 if(result.status==='underage'){
  if(error)error.textContent=RegistrationAge.messages.underage;
  if(status)status.textContent='';
  input.setAttribute('aria-invalid','true');
  return false;
 }
 if(error)error.textContent='';
 if(status)status.textContent=RegistrationAge.messages.eligible;
 input.removeAttribute('aria-invalid');
 return true;
}
async function doReg(){
 const btn=$('regBtn');regClear();
 updateDobOcrHint();
 if(!validateRegistrationDob()){$('rbd').focus();return}
 if(!$('rn').value.trim()){regErr('rn','Please enter your complete name.');$('rn').focus();return}
 if(!$('re').value.trim()){regErr('re','Please enter your email address.');$('re').focus();return}
 if(!/^\S+@\S+\.\S+$/.test($('re').value.trim())){regErr('re','Please enter a valid email address.');$('re').focus();return}
 if(!$('rph').value.trim()){regErr('rph','Please enter your contact number.');$('rph').focus();return}
 const phoneDigits=$('rph').value.replace(/\D/g,'');
 if(!/^09\d{9}$/.test(phoneDigits)&&!/^639\d{9}$/.test(phoneDigits)){regErr('rph','Enter a valid Philippine mobile number (for example, 0917 123 4567).');$('rph').focus();return}
 if(!$('rad').value.trim()){regErr('rad','Please enter your complete residential address.');$('rad').focus();return}
 if(!$('rb').value){regErr('rb','Please select your barangay.');$('rb').focus();return}
 if(!DOCUMENT_TYPE){regErr('ridType','Please select your ID type first.');$('ridType').focus();return}
 if(DOCUMENT_TYPE==='Barangay Residency Document'){
  if(!PH_FRONT){regErr('rf','Please upload the front of your ID.');$('regFrontBrowse').focus();return}
 }else{
  if(!PH_FRONT){regErr('rf','Please upload the front of your ID.');$('regFrontBrowse').focus();return}
  if(UPLOAD_MODE==='back'&&!PH_BACK){regErr('rbk','Please upload the back of your ID.');$('regBackBrowse').focus();return}
 }
 const password=$('rp').value;if(password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)){regErr('rp','Use 8-128 characters with uppercase, lowercase, and a number.');$('rp').focus();return}
 if(password!==$('rc').value){regErr('rc','Passwords do not match.');$('rc').focus();return}
 btn.disabled=true;btn.innerHTML='<span class="reg-loader"></span> Creating account…';
 try{
  const result=await api('register',{name:$('rn').value.trim(),email:$('re').value.trim().toLowerCase(),phone:$('rph').value.trim(),dob:$('rbd').value,address:$('rad').value.trim(),brgy:+$('rb').value,documentType:DOCUMENT_TYPE,uploadMode:UPLOAD_MODE,proof:PH_FRONT||PH,front:PH_FRONT||undefined,back:UPLOAD_MODE==='back'?(PH_BACK||undefined):undefined,password,ocrId:OCR_ID||undefined});
  PH='';btn.innerHTML='<span class="reg-ok">✓</span> Account created!';
  toast(result.verification&&result.verification.status==='verified'?'Account created and address verified.': 'Account created. Your address is pending barangay review.','ok');
  setTimeout(()=>{goto('#/dash');btn.disabled=false;btn.innerHTML='Create Account';},1200)
 }catch(e){
  btn.disabled=false;btn.innerHTML='Create Account';
  const msg=e.message||'Registration failed. Please try again.';
  if(msg===RegistrationAge.messages.invalid||msg===RegistrationAge.messages.underage){regErr('rbd',msg);$('regAgeStatus').textContent='';$('rbd').focus()}
  else if(/email already/i.test(msg)){regErr('re',msg);$('re').focus()}
  else if(/document type|ID Type/i.test(msg)){regErr('ridType',msg);$('ridType').focus()}
  else if(/back image|back of the ID/i.test(msg)){regErr('rbk',msg);$('regBackBrowse').focus()}
  else if(/proof|ID|address|OCR|barcode|front image|front of your ID/i.test(msg)){regErr('rf',msg);$('regFrontBrowse').focus()}
  else if(/barangay/i.test(msg)){regErr('rb',msg);$('rb').focus()}
  else toast(msg,'err')
 }
}
