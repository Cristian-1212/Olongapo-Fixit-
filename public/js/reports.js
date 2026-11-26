/* Report pages: dashboard, list, submit, detail, actions, notifications, map */
function attentionTable(R){
 const rows=R.filter(r=>['SUBMITTED','UNDER REVIEW'].includes(r.status)).sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0)).slice(0,5);
 if(!rows.length)return '<div class="citywide-empty"><b>No reports need attention</b><p>New reports awaiting review will appear here.</p></div>';
 return `<div class="citywide-attention-wrap"><table class="citywide-attention-table" aria-label="Reports needing attention"><thead><tr><th>Complaint ID</th><th>Category</th><th>Barangay</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Complaint ID"><strong>${esc(r.code)}</strong></td><td data-label="Category">${esc(r.cat)}</td><td data-label="Barangay">${esc(bname(r.brgy))}</td><td data-label="Date">${esc(fdate(r.created))}</td><td data-label="Status">${badge(r.status)}</td><td data-label="Action"><a class="btn citywide-view-button" href="#/r/${r.id}">View</a></td></tr>`).join('')}</tbody></table></div>`;
}
function dash(){if(!guard())return;if(ME.role==='brgy')return brgyDash();const R=visible(ME),c=counts(R);let h='';
 if(ME.role==='res'){
  h=`${resBanner()}<header class="dash-header"><div><p class="eyebrow">Resident dashboard</p><h2>Welcome, ${esc(ME.name)}</h2><p class="dash-description">Check your reports or start a new one.</p></div><nav class="dash-actions" aria-label="Quick actions"><a class="btn" href="#/new">Report a Problem</a><a class="btn o" href="#/reports">My Reports</a><a class="btn o" href="#/track">Track a Report</a></nav></header>
  <section class="dash-section" aria-labelledby="dash-overview-title"><div class="section-heading"><h3 id="dash-overview-title">Your report overview</h3></div><div class="grid dash-kpis">${[['Total reports',R.length],['Awaiting review',c.SUBMITTED+c['UNDER REVIEW']],['In progress',c['IN PROGRESS']+c.ASSIGNED+c.VERIFIED],['Resolved',c.RESOLVED]].map(x=>`<div class="card stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div></section>
  <section class="dash-section" aria-labelledby="dash-recent-title"><div class="section-heading"><div><h3 id="dash-recent-title">Recent reports</h3><p class="mu">Your five most recent submissions.</p></div><a class="text-link" href="#/reports">View all reports</a></div>${tbl(R.slice(-5).reverse())}</section>`;
 }else if(ME.role==='admin'){
  const pending=c.SUBMITTED+c['UNDER REVIEW'],inProgress=c.VERIFIED+c.ASSIGNED+c['IN PROGRESS'];
  const barangayCounts=Object.fromEntries(ALLOWED_BRGS.map(name=>[name,R.filter(r=>bname(r.brgy)===name).length]));
  const overview=[
   ['Total Reports',R.length,'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v6h5M10 13h6M10 17h6"/></svg>','total'],
   ['Pending Reports',pending,'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>','pending'],
   ['In Progress',inProgress,'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/></svg>','progress'],
   ['Resolved',c.RESOLVED,'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>','resolved']
  ];
  h=`<section class="citywide-dashboard" aria-labelledby="citywide-title">
   <header class="citywide-header"><div><p class="eyebrow">Super Admin</p><h2 id="citywide-title">Citywide Dashboard</h2><p>Monitor complaint reports, barangay activity, and system-wide performance.</p></div><a class="btn citywide-header-action" href="#/reports">Review reports</a></header>
   <section class="citywide-section" aria-labelledby="citywide-overview-title"><div class="citywide-section-heading"><div><h3 id="citywide-overview-title">Report Overview</h3><p>Current complaint totals across Olongapo City.</p></div></div><div class="citywide-kpis">${overview.map(([label,value,icon,key])=>`<article class="citywide-stat citywide-stat-${key}"><span class="citywide-stat-icon" aria-hidden="true">${icon}</span><div><span>${label}</span><strong>${value}</strong></div></article>`).join('')}</div></section>
   <section class="citywide-section" aria-labelledby="citywide-insights-title"><div class="citywide-section-heading"><div><h3 id="citywide-insights-title">Report Insights</h3><p>Compare complaint categories and current status.</p></div></div><div class="citywide-insights">
    <article class="card citywide-chart-card citywide-category-card"><div class="citywide-chart-heading"><h4>Reports by Category</h4><p>Report counts by complaint type</p></div>${R.length?compactCategoryChart(group(R,r=>r.cat),'Reports by category'):'<div class="citywide-empty"><b>No complaint category data</b><p>Category totals will appear after reports are submitted.</p></div>'}</article>
    <article class="card citywide-chart-card citywide-status-card"><div class="citywide-chart-heading"><h4>Reports by Status</h4><p>Current progress across all reports</p></div>${R.length?donutChart(group(R,r=>r.status),'Reports by status',statusColor):'<div class="citywide-empty"><b>No complaint status data</b><p>Status totals will appear after reports are submitted.</p></div>'}</article>
   </div></section>
   <section class="citywide-section" aria-labelledby="citywide-barangay-title"><div class="citywide-section-heading"><div><h3 id="citywide-barangay-title">Reports by Barangay</h3><p>Complaint volume for each supported barangay.</p></div></div><article class="card citywide-chart-card citywide-barangay-card">${dashboardBarangayChart(barangayCounts,'Reports by barangay')}</article></section>
   <section class="citywide-section" aria-labelledby="citywide-attention-title"><div class="citywide-section-heading"><div><h3 id="citywide-attention-title">Needs Attention</h3><p>Recent reports awaiting official review.</p></div></div><div class="card citywide-attention-card">${attentionTable(R)}</div></section>
  </section>`;
 }else{
  const t=ME.role==='admin'?'Citywide dashboard':'Barangay '+bname(ME.brgy),review=c.SUBMITTED+c['UNDER REVIEW'],progress=c.VERIFIED+c.ASSIGNED+c['IN PROGRESS'];
  h=`<header class="dash-header"><div><p class="eyebrow">${ROLE[ME.role]}</p><h2>${esc(t)}</h2><p class="dash-description">A clear view of reports that need attention and current progress.</p></div><nav class="dash-actions" aria-label="Dashboard actions"><a class="btn" href="#/reports">View reports</a></nav></header>
  <section class="dash-section" aria-labelledby="dash-overview-title"><div class="section-heading"><div><h3 id="dash-overview-title">Report overview</h3><p class="mu">Current totals for the reports you manage.</p></div>${ME.role==='admin'?`<p class="dash-context">Residents <b>${S.users.filter(u=>u.role==='res').length}</b><span aria-hidden="true"> · </span>Officials <b>${S.users.filter(u=>u.role==='brgy').length}</b></p>`:''}</div><div class="grid dash-kpis">${[['Total reports',R.length],['Awaiting review',review],['In progress',progress],['Resolved',c.RESOLVED]].map(x=>`<div class="card stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div></section>
  <section class="dash-section" aria-labelledby="dash-insights-title"><div class="section-heading"><div><h3 id="dash-insights-title">Report insights</h3><p class="mu">Compare reports by category and current status.</p></div></div><div class="dash-columns"><section class="dash-panel"><h4>By category</h4>${barChart(group(R,r=>r.cat),'Reports by category')}</section><section class="dash-panel"><h4>By status</h4>${donutChart(group(R,r=>r.status),'Reports by status',statusColor)}</section></div></section>
  ${ME.role==='admin'?`<section class="dash-section" aria-labelledby="dash-barangay-title"><div class="section-heading"><div><h3 id="dash-barangay-title">Reports by barangay</h3><p class="mu">Compare report volume across the city.</p></div></div><div class="dash-panel">${barChart(group(R,r=>bname(r.brgy)),'Reports by barangay')}</div></section>`:''}
  <section class="dash-section" aria-labelledby="dash-attention-title"><div class="section-heading"><div><h3 id="dash-attention-title">Needs attention</h3><p class="mu">Reports awaiting official review.</p></div></div>${tbl(R.filter(r=>['SUBMITTED','UNDER REVIEW'].includes(r.status)).slice(0,5))}</section>`;
 }
 $('app').innerHTML=h}
let F={q:'',s:'',c:'',b:'',ai:''};
function reports(){if(!guard())return;const R=visible(ME),stf=staff();
  const f=x=>R.filter(r=>(!F.s||r.status===F.s)&&(!F.c||r.cat===F.c)&&(!F.b||r.brgy==F.b)&&(!F.ai|| (F.ai==='NONE'?!r.ai:(r.ai&&r.ai.status===F.ai)) )&&(!F.q||(r.code+' '+r.desc).toLowerCase().includes(F.q.toLowerCase())));
  $('app').innerHTML=`<h2>${ME.role==='res'?'My Reports':'Reports'}</h2>
  <div class="card row"><input id="fq" placeholder="Search ID / text" value="${esc(F.q)}"><select id="fs"><option value="">All statuses</option>${STAT.map(s=>`<option ${F.s===s?'selected':''}>${s}</option>`).join('')}</select><select id="fc"><option value="">All categories</option>${CATS.map(s=>`<option ${F.c===s?'selected':''}>${s}</option>`).join('')}</select>${ME.role==='admin'?`<select id="fb"><option value="">All barangays</option>${S.barangays.map(b=>`<option value="${b.id}" ${F.b==b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select>`:''}<button class="btn" onclick="applyF()">Filter</button></div>${tbl(f(),stf)}`}
function applyF(){F.q=$('fq').value;F.s=$('fs').value;F.c=$('fc').value;F.b=$('fb')?$('fb').value:'';F.ai=$('fa')?$('fa').value:'';reports()}
function newRep(){if(!guard(['res']))return;PH='';LOCATION_PH='';submittingReport=false;if(ME.vstatus!=='approved'){$('app').innerHTML='<h2>Report a Problem</h2>'+resBanner();return}
 $('app').innerHTML=`<section class="card new-report" aria-labelledby="new-report-title"><h2 id="new-report-title">Report a Problem</h2>
 <section class="report-step" aria-labelledby="category-title"><h3 id="category-title">1. Choose a category</h3><input id="nc" type="hidden" value=""><div class="category-options" role="group" aria-labelledby="category-title">
 ${[['Broken Streetlight','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 18h6m-5 4h4m-6-7a7 7 0 1 1 8 0c-.8.6-1 1.2-1 2H9c0-.8-.2-1.4-1-2Z"/></svg>','Streetlight'],['Damaged Road','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3 5 21m11-18 3 18M12 5v3m0 4v3m0 4v2"/></svg>','Road'],['Garbage Problem','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16m-10-3h4m-8 3 1 14h10l1-14m-8 4v7m4-7v7"/></svg>','Garbage'],['Flooding','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6H7Zm-3 4c1.2-1 2.1-1 3.3 0s2.1 1 3.4 0 2.1-1 3.3 0 2.1 1 3.3 0 2.1-1 3.4 0"/></svg>','Flooding'],['Water Leak','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/></svg>','Water'],['Other','<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>','Other']].map(([value,icon,label])=>`<button type="button" class="category-chip" data-category="${esc(value)}" aria-pressed="false" onclick="selectReportCategory(this)"><span class="category-icon">${icon}</span><span class="category-label">${label}</span></button>`).join('')}
 </div><div id="other-category-wrap" hidden><label for="other-category">Please specify the concern <span class="reg-req">*</span></label><input id="other-category" type="text" maxlength="100" placeholder="Describe the issue"><p id="other-category-error" class="form-error" role="alert"></p></div><p id="category-error" class="form-error" role="alert" tabindex="-1"></p></section>
 <section class="report-step" aria-labelledby="location-title"><h3 id="location-title">2. Pin the location</h3><p class="map-hint">Tap the map or drag the pin to mark the problem.</p>
 <label class="sr-only" for="map-search">Search street or landmark</label><input id="map-search" class="map-search" type="search" placeholder="Search street or landmark" autocomplete="off" aria-controls="map-search-results">
 <div id="map-search-results" class="map-search-results" role="listbox" aria-label="Location search results" hidden></div>
 <div class="map-wrap"><div id="pick" class="location-picker" role="region" aria-label="Choose report location on map"></div><button type="button" id="use-location" class="map-location-button" onclick="useGeo()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg><span>Use current location</span></button></div>
 <p id="pick-msg" class="note" role="status" hidden>The map could not be loaded. Check your internet connection and try again.</p>
 <p id="pin-status" class="pin-status" role="status" aria-live="polite">Please pin the location on the map.</p>
 <p id="location-accuracy" class="map-hint" role="status" aria-live="polite"></p>
 <div class="location-details"><div><label for="nb">Barangay</label><select id="nb"><option value="">Auto-select from pin</option>${S.barangays.filter(b=>b.id===ME.brgy).map(b=>`<option value="${b.id}" selected>${esc(b.name)}</option>`).join('')}</select></div>
 <div><label for="nl">Location description</label><input id="nl" maxlength="200" placeholder="Street or nearby landmark (optional)"></div></div>
 <p id="geocode-status" class="map-hint" role="status" aria-live="polite"></p><input id="nla" type="hidden"><input id="nlo" type="hidden">
 </section>
<section class="report-step" aria-labelledby="photo-title"><h3 id="photo-title">3. Add two photos <span class="required-label">(required)</span></h3>
  <div class="report-image-grid">
   <div class="report-image-field"><label for="nf" class="report-image-label">Main Object Image <span class="reg-req">*</span></label><input id="nf" class="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onchange="prevMainObject(this)"><p class="field-help">JPG, PNG or WEBP · Max 5 MB</p><div id="npv" class="photo-preview" role="status" aria-live="polite"></div><button type="button" class="btn o" onclick="replaceMainObject()">Replace / Remove</button></div>
   <div class="report-image-field"><label for="nlf" class="report-image-label">Location Image <span class="reg-req">*</span></label><input id="nlf" class="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onchange="prevLocationImage(this)"><p class="field-help">JPG, PNG or WEBP · Max 5 MB</p><div id="nlpv" class="photo-preview" role="status" aria-live="polite"></div><button type="button" class="btn o" onclick="replaceLocationImage()">Replace / Remove</button></div>
  </div>
</section>
 <section class="report-step" aria-labelledby="description-title"><h3 id="description-title">4. Add a short description <span class="optional">(optional)</span></h3><label class="sr-only" for="nd">Description</label><textarea id="nd" rows="3" maxlength="2000" placeholder="What's wrong? (optional)"></textarea></section>
 <section class="report-submit"><p id="nm" class="form-error" role="alert"></p><p id="pin-required" class="field-help">Please pin the location on the map.</p><button id="submit-report" class="btn g submit-report-button" type="button" onclick="subRep()" disabled>Submit Report</button></section>
 </section>`;drawPick();setupReportLocationSearch();$('nl').addEventListener('input',()=>{locationTouched=true});$('nb').addEventListener('change',()=>{barangayTouched=true});updateReportSubmit()}
const TILE_URL='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
let pickMapInstance=null,pickMarker=null,reportMap=null,markersLayer=null,pickResizeObserver=null,pickLayoutObserver=null,reportDetailMap=null,reportDetailMapObserver=null,reportDetailMapVisibilityObserver=null,locationWatchId=null,locationWatchTimer=null,bestLocation=null,locationTouched=false,barangayTouched=false,submittingReport=false;
let allReports=[],selectedMapBarangay='All Barangays';
function addBaseLayer(map){return L.tileLayer(TILE_URL,{maxZoom:19,attribution:TILE_ATTRIBUTION}).addTo(map)}
const MAP_BARANGAYS=[
  {name:'Pag-asa',center:[14.8270,120.2867],zoom:15,
    polygon:[[120.29097609000007,14.827693981000042],[120.28745776700009,14.82999044000007],[120.28259373600007,14.82567847400003],[120.29097609000007,14.827693981000042]]
  },
  {name:'West Tapinac',center:[14.8322,120.2799],zoom:15,
    polygon:[[120.28202784100006,14.83783908900006],[120.2811730640001,14.83840144000004],[120.28025375800007,14.836960159000059],[120.27950490900002,14.832792377000033],[120.27827040100011,14.828979776000041],[120.27982060800002,14.828438108000057],[120.27990065300003,14.828897703000056],[120.28202784100006,14.83783908900006]]
  },
  {name:'New Kalalake',center:[14.8311,120.2888],zoom:15,
    polygon:[[120.29106808900009,14.834779484000025],[120.28812984900001,14.835132090000057],[120.28581638800006,14.831058998000062],[120.28745776700009,14.82999044000007],[120.29097609000007,14.827693981000042],[120.29106808900009,14.834779484000025]]
  }
];
const normalizeMapBarangay=name=>String(name||'').trim().toLowerCase();
function reportCoordinates(report,barangay){
 const latitude=Number(report.lat),longitude=Number(report.lng);
 if(Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180&&(latitude!==0||longitude!==0))return{latitude,longitude,isApprox:false};
 const center=MAP_BARANGAYS.find(x=>normalizeMapBarangay(x.name)===normalizeMapBarangay(barangay))?.center;
 const dbBarangay=S.barangays.find(x=>x.id===report.brgy);
 const fallback=center||[Number(dbBarangay?.lat),Number(dbBarangay?.lng)];
 return fallback&&fallback.every(Number.isFinite)?{latitude:fallback[0],longitude:fallback[1],isApprox:true}:{latitude:null,longitude:null,isApprox:true};
}
function invalidatePickMap(){if(pickMapInstance)requestAnimationFrame(()=>pickMapInstance&&pickMapInstance.invalidateSize({pan:false}))}
window.addEventListener('resize',invalidatePickMap,{passive:true});
function clearReportDetailMap(){
  if(reportDetailMapObserver){reportDetailMapObserver.disconnect();reportDetailMapObserver=null}
  if(reportDetailMapVisibilityObserver){reportDetailMapVisibilityObserver.disconnect();reportDetailMapVisibilityObserver=null}
  if(reportDetailMap){reportDetailMap.remove();reportDetailMap=null}
}
function invalidateReportDetailMap(){
  if(reportDetailMap)requestAnimationFrame(()=>{const el=reportDetailMap&&reportDetailMap.getContainer();if(el&&el.isConnected&&el.clientWidth&&el.clientHeight)reportDetailMap.invalidateSize({pan:false})})
}
window.addEventListener('hashchange',()=>{if(!/^#\/r\/\d+$/.test(location.hash))clearReportDetailMap()});
// All map interactions update one draggable marker and the hidden coordinates.
function drawPick(){
  const el=$('pick');if(pickMapInstance)pickMapInstance.remove();pickMapInstance=null;pickMarker=null;locationTouched=false;barangayTouched=false;
  if(pickResizeObserver)pickResizeObserver.disconnect();if(pickLayoutObserver)pickLayoutObserver.disconnect();
  if(reverseTimeout)clearTimeout(reverseTimeout);reverseRequest++;if(searchTimeout)clearTimeout(searchTimeout);searchRequest++;
  if(!window.L||!el)return;
  if(!el.clientWidth||!el.clientHeight)return;
  const bounds=L.latLngBounds([BB[0],BB[2]],[BB[1],BB[3]]);
  
  // Get resident's barangay polygon
  const residentBrgy=S.barangays.find(b=>b.id===ME.brgy);
  const brgyData=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(residentBrgy?.name));
  
  // Set initial view to resident's barangay center if available
  const initialView=brgyData?brgyData.center:[14.8300,120.2840];
  const initialZoom=brgyData?brgyData.zoom:14;
  
  // Keep mobile one-finger gestures available for page scrolling; taps still place pins.
  pickMapInstance=L.map(el,{scrollWheelZoom:false,dragging:!L.Browser.touch,touchZoom:true,minZoom:12,maxZoom:19,maxBounds:bounds,maxBoundsViscosity:.85}).setView(initialView,initialZoom);addBaseLayer(pickMapInstance).on('tileerror',()=>{const m=$('pick-msg');if(m)m.hidden=false});
  
  // Draw barangay boundary polygon
  if(brgyData && brgyData.polygon){
    const latLngs=brgyData.polygon.map(coord=>[coord[1],coord[0]]); // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    L.polygon(latLngs,{color:'#2563eb',weight:3,fillColor:'#2563eb',fillOpacity:0.1,dashArray:'8,8'}).addTo(pickMapInstance);
    // Fit to barangay bounds
    const polygonLayer=L.polygon(latLngs);
    pickMapInstance.fitBounds(polygonLayer.getBounds(),{padding:[30,30],maxZoom:brgyData.zoom});
  }
  
  pickMapInstance.on('click',e=>{pickMapInstance.scrollWheelZoom.enable();setPickPoint(e.latlng.lat,e.latlng.lng,true)});
  pickMapInstance.on('mouseout',()=>pickMapInstance&&pickMapInstance.scrollWheelZoom.disable());
  if(typeof ResizeObserver==='function'){pickResizeObserver=new ResizeObserver(invalidatePickMap);pickResizeObserver.observe(el.parentElement)}
  if(typeof MutationObserver==='function'){pickLayoutObserver=new MutationObserver(invalidatePickMap);pickLayoutObserver.observe(document.body,{attributes:true,attributeFilter:['class']})}
  requestAnimationFrame(invalidatePickMap);
}
function insideOlongapo(lat,lng){return lat>=BB[0]&&lat<=BB[1]&&lng>=BB[2]&&lng<=BB[3]}
function setPickPoint(lat,lng,pan){
  lat=Number(lat);lng=Number(lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
  if(!insideOlongapo(lat,lng)){$('nm').textContent='Please place the pin within Olongapo City.';return false}
  // Validate against resident's barangay boundary
  const residentBrgy=S.barangays.find(b=>b.id===ME.brgy);
  const brgyData=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(residentBrgy?.name));
  if(brgyData && brgyData.polygon && !pointInPolygon(lat,lng,brgyData.polygon)){
    $('nm').textContent=`The selected location is outside Barangay ${brgyData.name}. Please select a location within your barangay boundary.`;
    return false;
  }
  $('nla').value=lat.toFixed(6);$('nlo').value=lng.toFixed(6);$('geocode-status').textContent='Finding the street or area name…';$('nm').textContent='';if(!barangayTouched){const brgy=nearestBarangay(lat,lng);if(brgy)$('nb').value=String(brgy.id)}const selected=S.barangays.find(b=>b.id==Number($('nb').value));$('pin-status').textContent='Pin placed. Location pinned: '+(selected?selected.name:'Olongapo City')+'.';updateReportSubmit();
  if(pickMapInstance){if(pickMarker)pickMarker.setLatLng([lat,lng]);else{const icon=L.divIcon({className:'report-pin-icon',html:'<svg viewBox="0 0 42 50" aria-hidden="true" focusable="false"><path d="M21 2C13 13 5 21 5 30a16 16 0 0 0 32 0C37 21 29 13 21 2Z"/><circle cx="21" cy="29" r="5.5"/></svg>',iconSize:[42,50],iconAnchor:[21,48]});pickMarker=L.marker([lat,lng],{icon,draggable:true,autoPan:true}).addTo(pickMapInstance);pickMarker.on('dragend',()=>{const point=pickMarker.getLatLng();if(!insideOlongapo(point.lat,point.lng)){pickMarker.setLatLng([Number($('nla').value),Number($('nlo').value)]);$('nm').textContent='Please keep the pin within Olongapo City.';return}setPickPoint(point.lat,point.lng,false)})}if(pan)pickMapInstance.setView([lat,lng],17)}
  scheduleReverseGeocode(lat,lng);
  return true
}
function updateGeoButton(finding){const label=$('use-location')&&$('use-location').querySelector('span');if(label)label.textContent=finding?'Stop finding location':'Use current location'}
function stopGeo(applyBest,message){
  if(locationWatchTimer!==null){clearTimeout(locationWatchTimer);locationWatchTimer=null}
  if(locationWatchId!==null){navigator.geolocation.clearWatch(locationWatchId);locationWatchId=null}
  const best=bestLocation;bestLocation=null;updateGeoButton(false);
  const accuracy=$('location-accuracy');
  if(applyBest&&best){
    const placed=setPickPoint(best.latitude,best.longitude,true),meters=Math.round(best.accuracy);
    if(accuracy&&placed)accuracy.textContent=meters>100?`Location is not precise. Drag the pin to your exact spot. (Accuracy approximately ±${meters} m.)`:`Location found. Accuracy approximately ±${meters} m.`;
  }else if(accuracy&&!best&&applyBest)accuracy.textContent=message||'No location fix was received. You can still tap the map to place the pin.';
  if(message&&$('nm'))$('nm').textContent=message;
}
function useGeo(){
  if(locationWatchId!==null){stopGeo(true);return}
  const localHost=['localhost','127.0.0.1','::1'].includes(location.hostname);
  if(window.isSecureContext!==true&&!localHost){$('nm').textContent='Current location requires HTTPS or localhost. You can still tap the map to place the pin.';return}
  if(!navigator.geolocation){$('nm').textContent='Location sharing is not available in this browser. You can still tap the map to place the pin.';return}
  bestLocation=null;$('nm').textContent='';$('location-accuracy').textContent='Waiting for a location reading…';updateGeoButton(true);
  try{
    locationWatchId=navigator.geolocation.watchPosition(position=>{
      if(locationWatchId===null)return;
      const {latitude,longitude,accuracy}=position.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy<0||(bestLocation&&accuracy>=bestLocation.accuracy))return;
      bestLocation={latitude,longitude,accuracy};
      const placed=setPickPoint(latitude,longitude,true);
      if(placed)$('location-accuracy').textContent=`Improving accuracy... ±${Math.round(accuracy)} m`;
      if(accuracy<=30)stopGeo(true);
    },error=>{
      const message=error.code===1?'Location permission was denied. You can still tap the map to place the pin.':error.code===2?'Your location is unavailable. You can still tap the map to place the pin.':'Location request timed out. You can still tap the map to place the pin.';
      stopGeo(true,message);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    locationWatchTimer=setTimeout(()=>stopGeo(true,bestLocation?'':'Could not find your location within 20 seconds. You can still tap the map to place the pin.'),20000);
  }catch(e){stopGeo(false,'Could not start location tracking. You can still tap the map to place the pin.')}
}
window.addEventListener('hashchange',()=>{if(!/^#\/new(?:\/|$)/.test(location.hash))stopGeo(false)});
window.addEventListener('beforeunload',()=>stopGeo(false));
window.addEventListener('pagehide',()=>stopGeo(false));
let reverseTimeout=null,searchTimeout=null,reverseRequest=0,searchRequest=0;
// Debounce pin changes so reverse lookups only run after the marker settles.
function scheduleReverseGeocode(lat,lng){if(reverseTimeout)clearTimeout(reverseTimeout);const request=++reverseRequest;reverseTimeout=setTimeout(()=>reverseGeocode(lat,lng,request),500)}
// Use the backend proxy for Nominatim so the app is identified and requests are paced.
async function reverseGeocode(lat,lng,request){try{const result=await api(`geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);if(request!==reverseRequest||!$('nl'))return;const address=result.address||{},area=[address.suburb,address.neighbourhood,address.city_district,address.village,address.town].filter(Boolean).join(', '),street=[address.road||address.pedestrian||address.residential||address.footway,area].filter(Boolean).join(', ');if(street&&!locationTouched)$('nl').value=street;const brgy=barangayFromAddress(address)||nearestBarangay(lat,lng);if(brgy&&!barangayTouched)$('nb').value=String(brgy.id);const selected=S.barangays.find(b=>b.id==Number($('nb').value));$('pin-status').textContent='Pin placed. Location pinned: '+(street||selected&&selected.name||'Olongapo City')+'.';$('geocode-status').textContent=''}catch(e){if(request===reverseRequest&&$('geocode-status'))$('geocode-status').textContent=''}}
function normalizeBarangay(value){return String(value||'').toLocaleLowerCase().replace(/barangay|brgy\.?/g,'').replace(/[^a-z]/g,'')}
function barangayFromAddress(address){const values=[address.suburb,address.neighbourhood,address.city_district,address.quarter,address.village,address.town,address.locality].filter(Boolean).map(normalizeBarangay);return allowedBarangays().find(b=>{const name=normalizeBarangay(b.name);return values.some(value=>value===name||value.includes(name)||name.includes(value))||name==='newkalalake'&&values.some(value=>value==='kalalake')})||null}
function nearestBarangay(lat,lng){const list=allowedBarangays();if(!list.length)return null;return list.reduce((nearest,b)=>{const distance=(Number(b.lat)-lat)**2+(Number(b.lng)-lng)**2;return !nearest||distance<nearest.distance?{barangay:b,distance}:nearest},null).barangay}
function setupReportLocationSearch(){const input=$('map-search'),results=$('map-search-results');input.addEventListener('input',()=>{if(searchTimeout)clearTimeout(searchTimeout);const query=input.value.trim(),request=++searchRequest;results.hidden=true;results.replaceChildren();if(query.length<3)return;searchTimeout=setTimeout(()=>searchLocations(query,request),500)});input.addEventListener('keydown',e=>{if(e.key==='Escape'){results.hidden=true;results.replaceChildren()}})}
async function searchLocations(query,request){const results=$('map-search-results');try{const data=await api(`geocode/search?q=${encodeURIComponent(query)}`);if(request!==searchRequest||!$('map-search-results'))return;const matches=Array.isArray(data.results)?data.results:[];if(!matches.length){results.innerHTML='<p class="map-search-empty">No nearby places found. Try a street or landmark name.</p>';results.hidden=false;return}results.innerHTML=matches.map((item,index)=>`<button type="button" class="map-search-result" role="option" aria-selected="false" onclick="chooseSearchLocation(${index})">${esc(item.name)}</button>`).join('');window.reportSearchResults=matches;results.hidden=false}catch(e){if(request===searchRequest){results.innerHTML='<p class="map-search-empty">Location search is unavailable. You can still tap the map to place the pin.</p>';results.hidden=false}}}
function chooseSearchLocation(index){const result=window.reportSearchResults&&window.reportSearchResults[index];if(!result)return;const lat=Number(result.lat),lng=Number(result.lon);if(lat<BB[0]||lat>BB[1]||lng<BB[2]||lng>BB[3]){$('nm').textContent='That result is outside Olongapo City. Please choose another place.';return}$('map-search').value=result.name;$('map-search-results').hidden=true;setPickPoint(lat,lng,true)}
function updateReportSubmit(){const pin=!!($('nla')&&$('nla').value&&$('nlo')&&$('nlo').value),category=!!($('nc')&&$('nc').value),main=!!PH,location=!!LOCATION_PH,other=$('nc')&&$('nc').value==='Other'?!!($('other-category')&&$('other-category').value.trim()):true,button=$('submit-report');if(button)button.disabled=!pin||!category||!main||!location||!other||submittingReport;if($('pin-required'))$('pin-required').hidden=pin}
function selectReportCategory(button){
 document.querySelectorAll('.category-chip').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected))});
 $('nc').value=button.dataset.category;$('category-error').textContent='';
 const wrap=$('other-category-wrap'),show=button.dataset.category==='Other';if(wrap)wrap.hidden=!show;
 const input=$('other-category');if(input){input.required=show;if(!show){input.value='';$('other-category-error').textContent=''}}
 updateReportSubmit();
}
function onReportPhotoReady(data){AI_VERIFY=null;const wrap=$('ai-verify-wrap');if(!wrap)return;wrap.hidden=!data;renderAiVerify();if(data&&$('nc')&&$('nc').value){verifyReportImage(true)}}
function replaceReportPhoto(){const input=$('nf');if(input){input.value=''}PH='';AI_VERIFY=null;const pv=$('npv');if(pv)pv.innerHTML='';const wrap=$('ai-verify-wrap');if(wrap)wrap.hidden=true;renderAiVerify()}
async function prevMainObject(input){try{PH=await readImg(input.files[0],1200);$('npv').innerHTML=PH?`<img class="ph" src="${PH}" alt="Main object image preview">`:'';updateReportSubmit()}catch(e){PH='';input.value='';$('npv').innerHTML=`<span class="err">${esc(e.message)}</span>`;updateReportSubmit()}}
async function prevLocationImage(input){try{LOCATION_PH=await readImg(input.files[0],1200);$('nlpv').innerHTML=LOCATION_PH?`<img class="ph" src="${LOCATION_PH}" alt="Location image preview">`:'';updateReportSubmit()}catch(e){LOCATION_PH='';input.value='';$('nlpv').innerHTML=`<span class="err">${esc(e.message)}</span>`;updateReportSubmit()}}
function replaceMainObject(){const input=$('nf');if(input)input.value='';PH='';$('npv').innerHTML='';updateReportSubmit()}
function replaceLocationImage(){const input=$('nlf');if(input)input.value='';LOCATION_PH='';$('nlpv').innerHTML='';updateReportSubmit()}
function aiStatusLabel(s){return{MATCH:'MATCH – Image appears consistent',REVIEW_REQUIRED:'REVIEW_REQUIRED – Manual review recommended',REJECTED:'REJECTED – Image not relevant to complaint categories',AI_UNAVAILABLE:'AI_UNAVAILABLE – Verification unavailable'}[s]||s||'No result'}

function getScoreColor(percent){
  if(percent>=70)return'#17633a';
  if(percent>=40)return'#8a5a00';
  return'#a32121';
}

function updateCircularIndicator(percent){
  const ring=$('ai-ring-progress');
  const valueEl=$('ai-score-value');
  if(!ring||!valueEl)return;
  const circumference=2*Math.PI*54;
  const offset=circumference-(percent/100)*circumference;
  ring.style.strokeDashoffset=offset;
  ring.style.stroke=getScoreColor(percent);
  valueEl.textContent=percent+'%';
}

function updateProgressSteps(step){
  document.querySelectorAll('.ai-progress-step').forEach((el,i)=>{
    const stepNum=i+1;
    el.classList.toggle('active',stepNum===step);
    el.classList.toggle('completed',stepNum<step);
  });
}

function renderTopCandidates(candidates){
  const container=$('ai-top-candidates');
  const scroll=$('ai-candidates-scroll');
  if(!container||!scroll)return;
  if(!candidates||!candidates.length){
    container.hidden=true;
    return;
  }
  scroll.innerHTML=candidates.map(c=>`<div class="ai-candidate-card" role="listitem"><span class="ai-candidate-category">${esc(c.category)}</span><span class="ai-candidate-score">${c.score}%</span><span class="ai-candidate-prompt mu">${esc(c.prompt)}</span></div>`).join('');
  container.hidden=false;
}

function renderAiVerify(){
  const wrap=$('ai-verify-wrap');
  const idleEl=$('ai-verify-idle');
  const analyzingEl=$('ai-verify-analyzing');
  const resultEl=$('ai-verify-result');
  const card=$('ai-result-card');
  const icon=$('ai-result-icon');
  const title=$('ai-result-title');
  const msg=$('ai-result-message');
  const submitBtn=$('submit-report');
  
  if(!wrap)return;
  
  if(AI_VERIFYING){
    wrap.hidden=false;
    show('ai-verify-analyzing'); hide('ai-verify-idle', 'ai-verify-result');
    return;
  }
  
  if(!AI_VERIFY){
    wrap.hidden=false;
    show('ai-verify-idle'); hide('ai-verify-analyzing', 'ai-verify-result');
    return;
  }
  
  // Show result
  wrap.hidden=false;
  hide('ai-verify-idle', 'ai-verify-analyzing'); show('ai-verify-result');
  const r=AI_VERIFY;
  
  card.className='ai-result-card ' + r.status.toLowerCase().replace('_', '-');
  
  if(r.status==='MATCH'){
    icon.textContent='✅';
    title.textContent='Photo matches';
    msg.textContent='Your photo matches the selected category.';
    if(submitBtn)submitBtn.disabled=false;
  }else if(r.status==='REVIEW_REQUIRED'){
    icon.textContent='⚠️';
    title.textContent='Needs review';
    msg.textContent='Our system isn\'t sure. An official will review your photo.';
    if(submitBtn)submitBtn.disabled=false;
  }else if(r.status==='REJECTED'){
    icon.textContent='❌';
    title.textContent='Doesn\'t match';
    msg.textContent='The photo doesn\'t match the selected category. Please upload a relevant photo.';
    if(submitBtn)submitBtn.disabled=true;
  }else{
    // AI_UNAVAILABLE or other
    icon.textContent='ℹ️';
    title.textContent='Verification unavailable';
    msg.textContent='AI verification is temporarily unavailable. Your report can still be submitted for manual review.';
    if(submitBtn)submitBtn.disabled=false;
  }
}

function show(...ids){
  ids.forEach(id=>{const el=$(id);if(el)el.hidden=false;});
}
function hide(...ids){
  ids.forEach(id=>{const el=$(id);if(el)el.hidden=true;});
}

async function verifyReportImage(auto){
  if(!PH)return;
  const cat=$('nc')?$('nc').value:'';
  if(!cat){
    $('category-error').textContent='Choose a category before verifying the image.';
    if(!auto)$('category-error').focus();
    renderAiVerify();
    return
  }
  if(AI_VERIFYING)return;
  const req=++AI_VERIFY_REQ;
  AI_VERIFYING=true;
  renderAiVerify();
  try{
    const result=await api('report/verify-image',{cat,photo:PH});
    if(req!==AI_VERIFY_REQ)return;
    // Normalize result fields for UI
    const normalized={
      status:result.status,
      category:result.category,
      score:result.score,
      rank:result.rank,
      explanation:result.explanation,
      top3Candidates:result.top3Candidates,
      verificationMethod:result.verificationMethod,
      geminiConfidence:result.geminiConfidence,
      analyzedAt:new Date().toISOString()
    };
    AI_VERIFY=normalized;
  }catch(e){
    if(req!==AI_VERIFY_REQ)return;
    AI_VERIFY={status:'AI_UNAVAILABLE',category:cat,score:0,rank:0,explanation:(e&&e.message)?e.message:'AI image verification is temporarily unavailable. Your report can still be submitted for manual review.',top3Candidates:[],verificationMethod:'UNAVAILABLE',geminiConfidence:null,analyzedAt:new Date().toISOString()};
  }finally{
    if(req===AI_VERIFY_REQ){
      AI_VERIFYING=false;
      renderAiVerify()
    }
  }
}

function replaceReportPhoto(){
  const input=$('nf');
  if(input){input.value=''}
  PH='';
  AI_VERIFY=null;
  const pv=$('npv');
  if(pv)pv.innerHTML='';
  const wrap=$('ai-verify-wrap');
  if(wrap)wrap.hidden=true;
  renderAiVerify();
}

async function subRep(){
  const message=$('nm'),button=$('submit-report');
  message.textContent='';
  if(submittingReport)return;
  if(!$('nc').value){
    $('category-error').textContent='Please choose a category.';
    $('category-error').focus();
    return
  }
  if($('nc').value==='Other'&&!$('other-category').value.trim()){
    $('other-category-error').textContent='Please specify the concern.';
    $('other-category').focus();
    return
  }
  if(!PH){message.textContent='Please upload the Main Object Image.';message.className='form-error';return}
  if(!LOCATION_PH){message.textContent='Please upload the Location Image.';message.className='form-error';return}
  if(!$('nla').value||!$('nlo').value){
    $('pin-status').textContent='Please pin the location on the map.';
    return
  }
  const latF=Number($('nla').value),lngF=Number($('nlo').value);
  if(!Number.isFinite(latF)||!Number.isFinite(lngF)){
    message.textContent='Please place the pin on a valid location.';
    return
  }
  if(latF<BB[0]||latF>BB[1]||lngF<BB[2]||lngF>BB[3]){
    message.textContent='That pin is outside Olongapo City. Please choose a location within the city.';
    return
  }
  const b=Number($('nb').value)||(nearestBarangay(latF,lngF)||{}).id||null;
  submittingReport=true;
  button.disabled=true;
  button.setAttribute('aria-busy','true');
  button.textContent='Submitting...';
  try{
    const ai=AI_VERIFY?{
      status:AI_VERIFY.status,
      category:AI_VERIFY.category,
      predictedCategory:AI_VERIFY.top3Candidates&&AI_VERIFY.top3Candidates[0]?AI_VERIFY.top3Candidates[0].category:'',
      bestMatchDescription:AI_VERIFY.top3Candidates&&AI_VERIFY.top3Candidates[0]?AI_VERIFY.top3Candidates[0].prompt:'',
      score:AI_VERIFY.score,
      explanation:AI_VERIFY.explanation,
      verificationMethod:AI_VERIFY.verificationMethod,
      analyzedAt:AI_VERIFY.analyzedAt
    }:null;
    const r=await api('report',{cat:$('nc').value,customCategory:$('nc').value==='Other'?$('other-category').value.trim():'',brgy:b,desc:$('nd').value.trim(),photo:PH,locationPhoto:LOCATION_PH,loc:$('nl').value.trim(),lat:$('nla').value,lng:$('nlo').value,ai});
    stopGeo(false);
    PH='';LOCATION_PH='';
    $('app').innerHTML=`<div class="card report-success" role="status"><p class="eyebrow">Report received</p><h2 class="ok">Thank you for helping improve our community.</h2><p>Your reference number is <strong>${esc(r.code)}</strong>.</p><div class="report-success-actions"><a class="btn" href="#/track">Track your report</a><button type="button" class="btn o" onclick="go('#/new')">Report another</button></div></div>`
  }catch(e){
    message.textContent=e.message||'Your report could not be submitted. Please try again.';
    toast(message.textContent,'err')
  }finally{
    submittingReport=false;
    if(button.isConnected){
      button.removeAttribute('aria-busy');
      button.textContent='Submit Report';
      updateReportSubmit()
    }
  }
}

function aiDetailCard(r){
  if(!r||!r.ai)return '';
  const a=r.ai;
  const percent=a.similarityScorePercent!==undefined?a.similarityScorePercent:((a.similarityScore==null)?'—':Math.round(Number(a.similarityScore)*100));
  const labels={MATCH:'MATCH',REVIEW_REQUIRED:'REVIEW_REQUIRED',REJECTED:'REJECTED',AI_UNAVAILABLE:'AI_UNAVAILABLE'};
  const topCandidatesHtml=a.top3Candidates&&a.top3Candidates.length?
    `<div class="ai-top-candidates"><h5>Top Matches</h5><div class="ai-candidates-scroll">${a.top3Candidates.map(c=>`<div class="ai-candidate-card"><span class="ai-candidate-category">${esc(c.category)}</span><span class="ai-candidate-score">${c.score}%</span><span class="ai-candidate-prompt mu">${esc(c.prompt)}</span></div>`).join('')}</div></div>`:'';
  const method=a.verificationMethod||'xenova';
  const methodLabel=method==='combined'?'Xenova + Gemini':method==='gemini'?'Gemini':'Xenova CLIP';
  const geminiConfidence=a.geminiConfidence!==undefined?`<p><b>Gemini confidence:</b> ${a.geminiConfidence}%</p>`:'';
  return `<div class="card ai-detail"><h3>AI Image Verification</h3><p><span class="bd ai-${slug(a.status)}">${esc(labels[a.status]||a.status)}</span><span class="ai-method-badge">${esc(methodLabel)}</span></p><div class="ai-detail-grid"><p><b>Selected category:</b> ${esc(a.selectedCategory||r.cat||'—')}</p><p><b>Predicted category:</b> ${esc(a.predictedCategory||'—')}</p><p><b>Image-category similarity:</b> ${percent}%</p><p><b>Best matching description:</b> ${esc(a.bestMatchDescription||'—')}</p><p><b>Model:</b> ${esc(a.modelName||'—')}</p><p><b>Analysis date:</b> ${esc(a.analyzedAt?fd(a.analyzedAt):'—')}</p></div>${topCandidatesHtml}<p><b>Explanation:</b> ${esc(a.explanation||'—')}</p>${geminiConfidence}<p class="mu">AI assists review only. Officials make the final decision; AI does not automatically approve or reject complaints.</p></div>`;
}
function savedReportCoordinates(report){
 if(!report||report.lat===null||report.lat===undefined||report.lng===null||report.lng===undefined||String(report.lat).trim()===''||String(report.lng).trim()==='')return null;
 const latitude=Number(report.lat),longitude=Number(report.lng);
 if(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180||(latitude===0&&longitude===0))return null;
 return{latitude,longitude}
}
function detail(id){clearReportDetailMap();PH='';if(!guard())return;const r=S.reports.find(x=>x.id===id);
 if(!r||!can(r)){$('app').innerHTML='<div class="card err">Report not found or access denied.</div>';return}
 const coordinates=savedReportCoordinates(r),st=staff(),open=!['RESOLVED','REJECTED'].includes(r.status);
 const asg=S.users.filter(u=>u.active&&u.role==='brgy'&&u.brgy===r.brgy);
 const evidenceMissing=!r.photo&&!r.locationPhoto?'Both main object and location images are missing.':!r.photo?'The Main Object Image is missing.':!r.locationPhoto?'The Location Image is missing.':'';
 $('app').innerHTML=`<section class="report-detail-page">
 <header class="report-detail-header"><div><p class="eyebrow">COMPLAINT DETAILS</p><h2>${esc(r.code)}</h2><p>${esc(r.cat)}${r.customCategory?` — ${esc(r.customCategory)}`:''}</p></div>${badge(r.status)}</header>
 <div class="report-detail-grid">
  <article class="card report-detail-main"><h3>Complaint Information</h3><dl class="report-detail-list"><div><dt>Category</dt><dd>${esc(r.cat)}${r.customCategory?` — ${r.customCategory}`:''}</dd></div><div><dt>Barangay</dt><dd>${esc(bname(r.brgy))}</dd></div><div><dt>Reported</dt><dd>${esc(fd(r.created))}</dd></div><div><dt>Reporter</dt><dd>${esc(st?r.formerReporter||uname(r.uid):'You')}</dd></div><div><dt>Assigned official</dt><dd>${esc(r.assignee?uname(r.assignee):'Not assigned')}</dd></div></dl><div class="report-description"><h4>Description</h4><p>${esc(r.desc||'No description provided.')}</p></div></article>
  ${aiDetailCard(r)}
  <article class="card report-evidence-card"><h3>Uploaded Evidence</h3><div class="report-detail-images">
   <figure>${r.photo?`<button type="button" class="report-image-button" onclick="openImageModal('/api/img/r/${r.id}','Main Object Image')" aria-label="View main object image larger"><img class="ph" src="/api/img/r/${r.id}" alt="Main object image"></button>`:'<div class="report-image-placeholder"><span aria-hidden="true">PHOTO</span><p>No main object image</p></div>'}<figcaption>Main Object Image</figcaption></figure>
   <figure>${r.locationPhoto?`<button type="button" class="report-image-button" onclick="openImageModal('/api/img/r/${r.id}?kind=location','Location Image')" aria-label="View location image larger"><img class="ph" src="/api/img/r/${r.id}?kind=location" alt="Location image"></button>`:'<div class="report-image-placeholder"><span aria-hidden="true">LOCATION</span><p>No location image</p></div>'}<figcaption>Location Image</figcaption></figure>
  </div></article>
  <article class="card report-location-card"><h3>Complaint Location</h3><p>${esc(r.loc||'No location description provided.')}</p>${coordinates?`<div id="rpt-map" class="report-map" role="region" aria-label="Report location map"></div><p id="rpt-map-msg" class="note" role="status" hidden>Map tiles could not be loaded. Check your internet connection and try again.</p>`:'<p class="mu">No pin location saved.</p>'}</article>
 </div>
 ${st&&open?`<article class="card report-actions-card"><h3>Complaint Actions</h3>${evidenceMissing?`<p class="report-evidence-warning" role="status">${esc(evidenceMissing)} Verification cannot proceed until the evidence is available.</p>`:''}<div class="report-action-fields"><label for="rm">Action remarks / rejection reason</label><textarea id="rm" rows="3" placeholder="Add remarks or explain a rejection"></textarea></div><div class="report-action-buttons"><button class="btn g" ${evidenceMissing?'disabled':''} onclick="act(${r.id},'VERIFIED')">Verify</button><button class="btn r" onclick="act(${r.id},'REJECTED')">Reject</button><button class="btn o" ${['VERIFIED','ASSIGNED'].includes(r.status)?'':'disabled'} onclick="act(${r.id},'IN PROGRESS')">Mark In Progress</button></div>
 <div class="report-assignment"><label for="as">Assign complaint</label><div class="row"><select id="as"><option value="">Assign to…</option>${asg.map(u=>`<option value="u${u.id}">${esc(u.name)} (${esc(u.pos)})</option>`).join('')}</select><button class="btn" onclick="assign(${r.id})">Assign</button></div></div>
 <div class="report-resolve"><h4>Resolve complaint</h4><p class="field-help">Resolution remarks and photo evidence are required.</p><label for="rr">Resolution remarks</label><textarea id="rr" rows="3" placeholder="Describe the resolution"></textarea><label for="rf">Resolution photo</label><input id="rf" type="file" accept="image/jpeg,image/png,image/webp" onchange="prev('rf','rpv',1200)"><div id="rpv" class="photo-preview"></div><button class="btn g" onclick="resolve(${r.id})">Resolve</button></div><p id="am" class="err" role="alert"></p></article>`:''}
 ${r.ev.length?`<article class="card"><h3>Resolution Evidence</h3><div class="resolution-evidence-grid">${r.ev.map(e=>`<div><p>${esc(e.desc)}<br><small>${esc(uname(e.by))}, ${esc(fd(e.at))}</small></p>${e.img?`<button type="button" class="report-image-button" onclick="openImageModal('/api/img/e/${e.id}','Resolution Evidence')" aria-label="View resolution evidence larger"><img class="ph" src="/api/img/e/${e.id}" alt="Resolution evidence"></button>`:''}</div>`).join('')}</div></article>`:''}
 <article class="card report-timeline-card"><h3>Status Timeline</h3><ul class="tl">${r.hist.map(h=>`<li><span class="timeline-dot" aria-hidden="true"></span><div><b>${esc(h.s)}</b><small>${esc(fd(h.at))} — ${esc(uname(h.by))}</small>${h.rem?`<p>${esc(h.rem)}</p>`:''}</div></li>`).join('')}</ul></article>
 </section>`;
  const rmapEl=$('rpt-map');if(rmapEl&&window.L){
   reportDetailMap=L.map(rmapEl,{scrollWheelZoom:false,dragging:false}).setView([coordinates.latitude,coordinates.longitude],16);
   const tiles=addBaseLayer(reportDetailMap);tiles.on('tileerror',()=>{const message=$('rpt-map-msg');if(message)message.hidden=false});
   L.marker([coordinates.latitude,coordinates.longitude],{interactive:false,keyboard:false}).addTo(reportDetailMap);
   invalidateReportDetailMap();requestAnimationFrame(invalidateReportDetailMap);
   if(typeof ResizeObserver==='function'){reportDetailMapObserver=new ResizeObserver(invalidateReportDetailMap);reportDetailMapObserver.observe(rmapEl);reportDetailMapObserver.observe(rmapEl.parentElement)}
   if(typeof MutationObserver==='function'){reportDetailMapVisibilityObserver=new MutationObserver(invalidateReportDetailMap);reportDetailMapVisibilityObserver.observe($('app'),{attributes:true,attributeFilter:['class','style','hidden']});reportDetailMapVisibilityObserver.observe(rmapEl.parentElement,{attributes:true,attributeFilter:['class','style','hidden']})}
  }else if(rmapEl){const message=$('rpt-map-msg');if(message){message.textContent='The map could not be loaded.';message.hidden=false}}
}
async function openImageModal(src,title){
 const old=$('image-modal');if(old)old.remove();
 const modal=document.createElement('div');modal.id='image-modal';modal.className='image-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
 modal.innerHTML=`<div class="image-modal-dialog"><button type="button" class="image-modal-close" aria-label="Close image preview" onclick="closeImageModal()">×</button><h3>${esc(title)}</h3><img src="${esc(src)}" alt="${esc(title)}"></div>`;
 modal.onclick=e=>{if(e.target===modal)closeImageModal()};
 document.body.appendChild(modal);modal.querySelector('.image-modal-close').focus();
 document.addEventListener('keydown',closeImageModalOnEscape);
}
function closeImageModal(){const modal=$('image-modal');if(modal)modal.remove();document.removeEventListener('keydown',closeImageModalOnEscape)}
function closeImageModalOnEscape(e){if(e.key==='Escape')closeImageModal()}
async function act(id,s){
 await guarded(async()=>{
  const rem=$('rm')?$('rm').value.trim():'';
  if(s==='REJECTED'&&!rem)throw new Error('Please provide a reason for rejection.');
  await api('act',{id,s,rem});
  await refresh();detail(id)
 },'am','Report updated.');
}
async function assign(id){await guarded(async()=>{await api('assign',{id,to:$('as').value});await refresh();detail(id)},'am','Report assigned.')}
async function resolve(id){await guarded(async()=>{const remarks=$('rr')?$('rr').value.trim():'';if(!remarks)throw new Error('Please enter resolution remarks.');if(!PH)throw new Error('Please upload a resolution photo.');await api('resolve',{id,rem:remarks,img:PH});PH='';await refresh();detail(id)},'am','Report marked as resolved.')}
const NOTIFICATION_COPY={
 title:'Notifications',description:'Updates about your reports and account.',
 all:'All',unread:'Unread',markAll:'Mark all as read',today:'Today',yesterday:'Yesterday',earlier:'Earlier',
 emptyTitle:'You’re all caught up',emptyText:'New updates will appear here.',
 noReport:'FixIt update',openLabel:'Open notification',loading:'Loading notifications…',
 updated:'Notification marked as read.',allRead:'All notifications marked as read.'
};
let NOTIFICATION_FILTER='all';
function notificationSkeleton(){
 return `<section class="notification-page" aria-busy="true" aria-label="${esc(NOTIFICATION_COPY.loading)}"><header class="page-heading"><div><p class="eyebrow">FIXIT UPDATES</p><h2>${esc(NOTIFICATION_COPY.title)}</h2><p class="mu">${esc(NOTIFICATION_COPY.description)}</p></div></header><div class="notification-skeleton" aria-hidden="true">${[1,2,3].map(()=>'<div class="notification-skeleton-row"><i></i><span><b></b><em></em><small></small></span></div>').join('')}</div><span class="sr-only">${esc(NOTIFICATION_COPY.loading)}</span></section>`
}
function notificationDateGroup(value){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return NOTIFICATION_COPY.earlier;
 const key=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const today=key(new Date()),yesterday=key(new Date(Date.now()-86400000)),target=key(date);
 return target===today?NOTIFICATION_COPY.today:target===yesterday?NOTIFICATION_COPY.yesterday:NOTIFICATION_COPY.earlier;
}
function relativeNotificationTime(value){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return'';
 const seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000)),units=[['year',31536000],['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]];
 const relative=new Intl.RelativeTimeFormat('en',{numeric:'auto'});
 for(const [unit,size] of units)if(seconds>=size)return relative.format(-Math.floor(seconds/size),unit);
 return relative.format(-seconds,'second');
}
function notificationStyle(message){
 const value=String(message||'').toLowerCase();
 if(/\bresolved\b/.test(value))return{kind:'resolved',icon:'✓',label:'Resolved'};
 if(/\bin progress\b/.test(value))return{kind:'progress',icon:'↻',label:'In progress'};
 if(/\bverified\b/.test(value))return{kind:'verified',icon:'✓',label:'Verified'};
 return{kind:'general',icon:'•',label:'Update'};
}
function renderNotifications(){
 const all=S.notifs||[],unreadCount=all.filter(n=>!n.read).length,items=all.filter(n=>NOTIFICATION_FILTER!=='unread'||!n.read).slice().sort((a,b)=>new Date(b.at)-new Date(a.at));
 const groups=[NOTIFICATION_COPY.today,NOTIFICATION_COPY.yesterday,NOTIFICATION_COPY.earlier],rendered=groups.map(group=>{
  const rows=items.filter(n=>notificationDateGroup(n.at)===group);if(!rows.length)return'';
  return `<section class="notification-group" aria-labelledby="notification-group-${group.toLowerCase()}"><h3 id="notification-group-${group.toLowerCase()}">${esc(group)}</h3><div class="notification-list">${rows.map(n=>{
   const style=notificationStyle(n.msg),match=String(n.msg||'').match(/\bOF-\d{4}-\d{6}\b/),message=String(n.msg||'').replace(match?match[0]:'','').replace(/^\s*[:–—-]\s*/,'').trim()||String(n.msg||'');
   return `<button type="button" class="notification-row ${n.read?'':'is-unread'}" aria-label="${esc(NOTIFICATION_COPY.openLabel)}${n.read?'':', unread'}: ${esc(match?match[0]:NOTIFICATION_COPY.noReport)}. ${esc(message)}" onclick="openNotification(${Number(n.id)},${Number(n.rid)||0})"><span class="notification-status notification-${style.kind}" role="img" aria-label="${esc(style.label)}">${style.icon}</span><span class="notification-content"><span class="notification-topline"><strong>${esc(match?match[0]:NOTIFICATION_COPY.noReport)}</strong>${n.read?'':'<i class="notification-unread-dot" aria-label="Unread"></i>'}</span><span class="notification-message">${esc(message)}</span><time class="notification-time" datetime="${esc(n.at||'')}" title="${esc(fd(n.at))}">${esc(relativeNotificationTime(n.at))}</time></span><span class="notification-chevron" aria-hidden="true">›</span></button>`
  }).join('')}</div></section>`
 }).join('');
 const empty=items.length===0?`<div class="notification-empty"><span class="notification-empty-icon" aria-hidden="true">✓</span><h3>${esc(NOTIFICATION_COPY.emptyTitle)}</h3><p>${NOTIFICATION_FILTER==='unread'?'You have no unread notifications.':esc(NOTIFICATION_COPY.emptyText)}</p></div>`:'';
 $('app').innerHTML=`<section class="notification-page"><header class="page-heading"><div><p class="eyebrow">FIXIT UPDATES</p><h2>${esc(NOTIFICATION_COPY.title)}</h2><p class="mu">${esc(NOTIFICATION_COPY.description)}</p></div><button type="button" class="btn notification-mark-all" onclick="markAllNotificationsRead()" ${unreadCount?'':'disabled'}>${esc(NOTIFICATION_COPY.markAll)}</button></header><div class="notification-toolbar"><div class="tabs" role="group" aria-label="Filter notifications"><button type="button" class="btn ${NOTIFICATION_FILTER==='all'?'':'o'}" aria-pressed="${NOTIFICATION_FILTER==='all'}" onclick="setNotificationFilter('all')">${esc(NOTIFICATION_COPY.all)} (${all.length})</button><button type="button" class="btn ${NOTIFICATION_FILTER==='unread'?'':'o'}" aria-pressed="${NOTIFICATION_FILTER==='unread'}" onclick="setNotificationFilter('unread')">${esc(NOTIFICATION_COPY.unread)} (${unreadCount})</button></div><span class="notification-count" aria-live="polite">${unreadCount?`${unreadCount} unread`:''}</span></div>${rendered||empty}</section>`
}
function notifs(){if(!guard())return;renderNotifications()}
function setNotificationFilter(filter){NOTIFICATION_FILTER=filter==='unread'?'unread':'all';renderNotifications()}
async function openNotification(id,rid){
 const notification=(S.notifs||[]).find(n=>n.id===id);
 if(notification&&!notification.read){
  try{await api('notifs/read',{id});notification.read=true;nav()}
  catch(e){toast(e.message,'err');return}
 }
 if(rid)go('#/r/'+rid);else renderNotifications()
}
async function markAllNotificationsRead(){
 const button=document.querySelector('.notification-mark-all');if(button)button.disabled=true;
 try{await api('notifs/read',{});(S.notifs||[]).forEach(n=>{n.read=true});nav();renderNotifications();toast(NOTIFICATION_COPY.allRead,'ok')}
 catch(e){if(button)button.disabled=false;toast(e.message,'err')}
}
function mapV(){
  if(!guard(['admin','brgy']))return;
  if(reportMap){reportMap.remove();reportMap=null}
  markersLayer=null;
  
  // Determine available barangays based on role
  let availableBarangays=MAP_BARANGAYS;
  let isBrgyRestricted=false;
  
  if(ME.role==='brgy'){
    // Barangay officials only see their assigned barangay
    const officialBrgy=S.barangays.find(b=>b.id===ME.brgy);
    const brgyData=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(officialBrgy?.name));
    if(brgyData){
      availableBarangays=[brgyData];
      isBrgyRestricted=true;
    }
  }
  
  allReports=visible(ME).map(r=>{
   const barangayRecord=S.barangays.find(b=>b.id===r.brgy),storedName=barangayRecord?.name||bname(r.brgy);
   const barangay=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(storedName))?.name||storedName;
   return{id:r.id,title:r.cat,description:r.desc,status:r.status,barangay,...reportCoordinates(r,barangay),code:r.code,category:r.cat,location:r.loc,reportId:r.id,reported:r.created,photo:!!r.photo};
  });
  
  // Build barangay selector options and determine initial selection
  let barangayOptions='';
  let initialSelection;
  
  if(isBrgyRestricted){
    barangayOptions=`<option value="${esc(availableBarangays[0].name)}" selected>${esc(availableBarangays[0].name)}</option>`;
    initialSelection=availableBarangays[0].name;
  }else{
    barangayOptions=`<option>All Barangays</option>${MAP_BARANGAYS.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}`;
    initialSelection=selectedMapBarangay||'All Barangays';
  }
  
  $('app').innerHTML=`<section class="card map-page"><header class="map-heading"><div><p class="eyebrow">COMPLAINT LOCATIONS</p><h2>Olongapo FixIt Map</h2><p class="mu">Hover or select a marker to view complaint information.</p></div><a class="btn o" href="#/reports">View reports</a></header><div class="map-barangay-filter"><label for="map-barangay">Filter by barangay</label><select id="map-barangay" ${isBrgyRestricted?'disabled':''}>${barangayOptions}</select></div><p id="map-empty" class="map-empty" role="status" aria-live="polite" hidden></p><div id="report-map" class="report-map" role="region" aria-label="Interactive map of Olongapo reports"></div><ul class="map-legend" aria-label="Report status legend"><li><span class="legend-dot submitted" aria-hidden="true"></span>Submitted</li><li><span class="legend-dot under-review" aria-hidden="true"></span>Under Review</li><li><span class="legend-dot verified" aria-hidden="true"></span>Verified</li><li><span class="legend-dot assigned" aria-hidden="true"></span>Assigned</li><li><span class="legend-dot progress" aria-hidden="true"></span>In Progress</li><li><span class="legend-dot resolved" aria-hidden="true"></span>Resolved</li><li><span class="legend-dot rejected" aria-hidden="true"></span>Rejected</li></ul><p id="map-message" class="note" role="status" hidden>Map tiles could not be loaded. Check your internet connection and try again.</p></section>`;
  const selector=$('map-barangay');
  selector.value=initialSelection;
  if(!isBrgyRestricted){
    selector.addEventListener('change',()=>filterMapByBarangay(selector.value));
  }
  filterMapByBarangay(initialSelection);
  const el=$('report-map');if(!window.L||!el.clientWidth||!el.clientHeight)return;
  // For barangay officials, set initial view to their barangay
  const initialView=isBrgyRestricted?availableBarangays[0].center:[(BB[0]+BB[1])/2,(BB[2]+BB[3])/2];
  const initialZoom=isBrgyRestricted?availableBarangays[0].zoom:12;
  reportMap=L.map(el,{scrollWheelZoom:false}).setView(initialView,initialZoom);const tiles=addBaseLayer(reportMap);
  tiles.on('tileerror',()=>{$('map-message').hidden=false});
  markersLayer=L.layerGroup().addTo(reportMap);
  L.control.scale({imperial:false}).addTo(reportMap);
  // Apply the persisted selection after each map/data refresh
  filterMapByBarangay(initialSelection);
  requestAnimationFrame(()=>reportMap&&reportMap.invalidateSize());
}
function filterMapByBarangay(selectedBarangay){
  // Keep the selection across refreshes and compare names without casing or whitespace differences.
  const requested=String(selectedBarangay||'All Barangays').trim()||'All Barangays';
  const canonical=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(requested));
  selectedMapBarangay=normalizeMapBarangay(requested)===normalizeMapBarangay('All Barangays')?'All Barangays':canonical?canonical.name:requested;
  const selector=$('map-barangay');if(selector)selector.value=selectedMapBarangay;
  const showAll=normalizeMapBarangay(selectedMapBarangay)===normalizeMapBarangay('All Barangays');
  const reports=showAll?allReports:allReports.filter(r=>normalizeMapBarangay(r.barangay)===normalizeMapBarangay(selectedMapBarangay));
  const empty=$('map-empty');
  // Clear only report overlays, leaving the basemap and controls in place.
  if(markersLayer)markersLayer.clearLayers();
  if(empty){empty.hidden=reports.length>0;empty.textContent=reports.length?'' : showAll?'No reports are available to show on the map yet.':'No reports in this barangay yet.'}
  if(!reportMap||!markersLayer)return reports;
  const points=[];
  // Redraw markers from the complete dataset so switching filters never loses reports.
  reports.forEach(r=>{
   if(!Number.isFinite(r.latitude)||!Number.isFinite(r.longitude))return;
   const position=[r.latitude,r.longitude];points.push(position);
   const color=statusColor(r.status);
   const hover=`<div class="map-complaint-hover" role="tooltip"><strong class="map-complaint-hover-id">${esc(r.code)}</strong><b class="map-complaint-hover-title">${esc(r.category||r.title)}</b><div class="map-complaint-hover-status"><span>Status</span>${badge(r.status)}</div><dl><div><dt>Barangay</dt><dd>${esc(r.barangay)}</dd></div><div><dt>Reported</dt><dd>${esc(fdate(r.reported))}</dd></div></dl></div>`;
   const description=String(r.description||'').trim(),descriptionPreview=description.length>180?description.slice(0,177)+'…':description;
   const image=r.photo?`<img class="map-report-image" src="/api/img/r/${r.reportId}" alt="Complaint evidence thumbnail" loading="lazy">`:'';
   const popup=`<article class="map-report-popup">${image}<div class="map-report-popup-body"><strong>${esc(r.code)}</strong><h4>${esc(r.title)}</h4><p class="map-report-description">${esc(descriptionPreview||'No description provided.')}</p><p class="map-report-status">${badge(r.status)}</p><dl><div><dt>Category</dt><dd>${esc(r.category||'—')}</dd></div><div><dt>Barangay</dt><dd>${esc(r.barangay)}</dd></div><div><dt>Reported</dt><dd>${esc(fdate(r.reported))}</dd></div></dl><a class="btn" href="#/r/${r.reportId}">View Complaint Details</a></div></article>`;
   const marker=L.circleMarker(position,{radius:9,color:'#fff',weight:2,fillColor:color,fillOpacity:.95}).addTo(markersLayer);
   if(typeof marker.bindTooltip==='function')marker.bindTooltip(hover,{direction:'top',offset:[0,-8],opacity:.98,sticky:true,className:'map-complaint-tooltip'});
   if(typeof marker.bindPopup==='function')marker.bindPopup(popup,{maxWidth:300,minWidth:220,autoPanPadding:[16,16]});
   if(typeof marker.on==='function'){
    marker.on('mouseover',()=>{marker.setRadius(11);marker.setStyle({weight:3,fillOpacity:1})});
    marker.on('mouseout',()=>{marker.setRadius(9);marker.setStyle({weight:2,fillOpacity:.95})});
    marker.on('click',()=>{if(typeof marker.closeTooltip==='function')marker.closeTooltip()});
   }
  });
  // Draw barangay polygon boundary if a specific barangay is selected
  const barangayData=MAP_BARANGAYS.find(b=>normalizeMapBarangay(b.name)===normalizeMapBarangay(selectedMapBarangay));
  if(reportMap._barangayPolygon){
    reportMap.removeLayer(reportMap._barangayPolygon);
    reportMap._barangayPolygon=null;
  }
  if(!showAll&&barangayData&&barangayData.polygon){
    const latLngs=barangayData.polygon.map(coord=>[coord[1],coord[0]]); // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    reportMap._barangayPolygon=L.polygon(latLngs,{color:'#2563eb',weight:3,fillColor:'#2563eb',fillOpacity:0.1,dashArray:'8,8',interactive:false}).addTo(reportMap);
    reportMap.fitBounds(reportMap._barangayPolygon.getBounds(),{padding:[30,30],maxZoom:barangayData.zoom});
  }else if(points.length){
    reportMap.fitBounds(points,{padding:[30,30],maxZoom:14});
  }else{
    reportMap.fitBounds(MAP_BARANGAYS.map(b=>b.center),{padding:[30,30],maxZoom:13});
  }
  return reports;
}
