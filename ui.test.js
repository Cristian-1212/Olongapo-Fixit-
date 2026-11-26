// UI smoke test (needs: npm i -D jsdom). Boots the server on a temp DB and drives the real pages.
const os=require('os'),path=require('path'),fs=require('fs');
process.env.PORT='0';process.env.DB_FILE=path.join(os.tmpdir(),`olongapo-fixit-ui-${process.pid}.db`);
process.env.IMAGE_VERIFY_DISABLED='1';
for(const suffix of ['','-wal','-shm'])try{fs.unlinkSync(process.env.DB_FILE+suffix)}catch(e){}
const srv=require('./server.js'),{JSDOM,VirtualConsole}=require('jsdom'),assert=require('assert');
let base;const errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function open(){const jar={};const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/not implemented/i.test(e.message))errors.push('jsdom: '+e.message)});vc.on('error',m=>errors.push('console: '+m));
 const cookieStr=()=>{const cs=[];if(jar.c)cs.push(jar.c);if(jar.xcsrf)cs.push('csrf_token='+jar.xcsrf);return cs.join('; ')};
 const dom=await JSDOM.fromURL(base,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.fetch=async(u,o={})=>{const r=await fetch(new URL(u,base),{...o,headers:{...(o.headers||{}),cookie:cookieStr()}});const scs=r.headers.getSetCookie?r.headers.getSetCookie():[];for(const sc of scs){const c=sc.split(';')[0];if(c.startsWith('sid='))jar.c=c;else if(c.startsWith('csrf_token='))jar.xcsrf=c.slice(11);}return{ok:r.ok,status:r.status,json:()=>r.json(),blob:()=>r.blob(),headers:r.headers}};
  Object.defineProperty(w,'isSecureContext',{configurable:true,value:true});w.scrollTo=()=>{};w.alert=m=>errors.push('alert: '+m);w.confirm=()=>true;w.prompt=()=>'Newpass1';
  w.addEventListener('error',e=>errors.push('window: '+e.message))}});
 const w=dom.window;await until(()=>w.document.getElementById('app').innerHTML.length>50);return w}
async function until(f,t=4000){const s=Date.now();while(Date.now()-s<t){try{if(f())return}catch(e){}await sleep(40)}throw new Error('timeout: '+f)}
async function visit(w,h,allowErr){const before=w.document.getElementById('app').innerHTML;if(w.location.hash===h)w.route();else w.location.hash=h;await sleep(30);await until(()=>!w.document.getElementById('app').classList.contains('busy'));await sleep(60);
 const html=w.document.getElementById('app').innerHTML;assert(html.length>30,'empty page '+h);assert(allowErr||!/class="card err"/.test(html),'error page '+h+': '+html.slice(0,200));return html}
const $=(w,id)=>w.document.getElementById(id);
function dobAtAge(age,today){
 const [year,month,day]=today.split('-').map(Number),date=new Date(Date.UTC(year-age,month-1,day));
 if(date.getUTCMonth()!==month-1)date.setUTCDate(0);
 return`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}
async function login(w,e,p){console.log('login',e,w.location.hash);await visit(w,'#/login');$(w,'le').value=e;$(w,'lp').value=p;try{await w.doLogin();console.log('doLogin completed, hash:',w.location.hash)}catch(err){console.log('doLogin error:',err.message)}try{await w.route();console.log('route completed, ME:',w.eval('ME'))}catch(err){console.log('route error:',err.message)}await until(()=>w.location.hash==='#/dash'&&w.eval('ME'));await sleep(200)}
(async()=>{
 if(!srv.listening)await new Promise((resolve,reject)=>{srv.once('listening',resolve);srv.once('error',reject)});
 base='http://127.0.0.1:'+srv.address().port+'/';
 const csp=(await fetch(base)).headers.get('content-security-policy');assert(/img-src[^;]*\bblob:/.test(csp)&&/frame-src[^;]*\bblob:/.test(csp),'CSP permits the authenticated document preview blob URLs');
 // public
 let w=await open();for(const h of ['#/','#/track','#/community','#/login','#/register'])await visit(w,h);
 assert(!/Try a demo account|class="demo"|onclick="fillDemo"/.test(await visit(w,'#/login')),'login page hides demo account buttons');
 $(w,'tc')||await visit(w,'#/track');$(w,'tc').value='bad';$(w,'tc').dispatchEvent(new w.Event('input'));assert.equal($(w,'track-id-error').hidden,false,'track ID format validation');$(w,'tc').value='of-2026-000001';$(w,'tc').dispatchEvent(new w.Event('input'));assert.equal($(w,'tc').value,'OF-2026-000001','track ID uppercased');await w.doTrack();await sleep(200);assert(/OF-2026-000001/.test($(w,'tr').innerHTML)&&$(w,'tr').querySelectorAll('.track-step').length===4,'track timeline');assert(w.eval("JSON.parse(localStorage.getItem('fixitTrackedIds')).includes('OF-2026-000001')"),'tracked ID remembered');
 await visit(w,'#/dash');assert.equal(w.location.hash,'#/login','guard redirect');
 $(w,'le').value='admin@fixit.ph';$(w,'lp').value='wrong';await w.doLogin();await sleep(300);assert(/Invalid/.test($(w,'lm').textContent),'bad login msg');
 // admin
 w=await open();await login(w,'admin@fixit.ph','admin123');
 assert.equal($(w,'assistant-toggle'),null,'AI chat removed');
  assert($(w,'chat-toggle')&&$(w,'chat-panel').hidden,'chat assistant is available in the global shell');assert.equal($(w,'chat-toggle').textContent.trim(),'Ask FixIt AI','chat toggle label');assert.equal($(w,'chat-panel').getAttribute('aria-label'),'Ask FixIt AI','chat panel label');w.toggleChat(true);assert.equal($(w,'chat-panel').hidden,false,'chat panel opens');assert(/residents in Pag-asa/i.test($(w,'chat-suggestions').textContent)&&/Find barangay officials/i.test($(w,'chat-suggestions').textContent),'chat quick questions');w.toggleChat(false);
 assert(!/AI Queue|AI Performance/.test($(w,'side').textContent),'AI navigation removed');
 assert(!/People Map/.test($(w,'side').textContent),'People Map navigation removed');
 const removedPeoplePage=await visit(w,'#/people-map');assert(!/Residents &amp; Barangay Officials Map|people-map-controls|people-search/.test(removedPeoplePage),'legacy People Map route no longer renders its page');
 const citywide=await visit(w,'#/dash'),citywideText=$(w,'app').textContent;
 assert(/Citywide Dashboard/.test(citywideText)&&/Monitor complaint reports, barangay activity, and system-wide performance\./.test(citywideText),'Super Admin dashboard header');
 assert($(w,'app').classList.contains('citywide-dashboard-page'),'citywide dashboard uses its expanded page layout');
 const citywideExpected=w.eval("(()=>{const R=visible(ME),c=counts(R);return [['Total Reports',R.length],['Pending Reports',c.SUBMITTED+c['UNDER REVIEW']],['In Progress',c.VERIFIED+c.ASSIGNED+c['IN PROGRESS']],['Resolved',c.RESOLVED]]})()");
 const citywideCards=[...$(w,'app').querySelectorAll('.citywide-stat')].map(card=>[card.textContent.replace(/\s+/g,' ').trim(),Number(card.querySelector('strong').textContent)]);
 assert(citywideExpected.every(([label,value],i)=>citywideCards[i][0].includes(label)&&citywideCards[i][1]===value),'overview cards use actual report status counts');
 const categoryRows=[...$(w,'app').querySelectorAll('.citywide-category-card .category-bar-row')].map(row=>[row.querySelector('.category-bar-label').textContent,Number(row.querySelector('.category-bar-value').textContent)]);
 assert.deepEqual(categoryRows,Object.entries(w.eval('group(visible(ME),r=>r.cat)')),'category chart shows real category totals');
 const statusChart=$(w,'app').querySelector('.citywide-status-card .chart.donut');
 assert(statusChart&&statusChart.querySelector('svg .ct').textContent===String(w.eval('visible(ME).length'))&&statusChart.querySelectorAll('.legend li').length>0,'status donut centers the actual total and shows its legend');
 const barangayBars=[...$(w,'app').querySelectorAll('.citywide-bar-column')].map(column=>[column.querySelector('.citywide-bar-label').textContent,Number(column.querySelector('.citywide-bar-value').textContent)]);
 assert.deepEqual(barangayBars,['Pag-asa','New Kalalake','West Tapinac'].map(name=>[name,w.eval(`visible(ME).filter(r=>bname(r.brgy)===${JSON.stringify(name)}).length`)]),'barangay chart uses real counts for all supported barangays');
 const attention=$(w,'app').querySelector('.citywide-attention-table');
 assert(attention&&[...attention.querySelectorAll('thead th')].map(th=>th.textContent.trim()).join('|')==='Complaint ID|Category|Barangay|Date|Status|Action','needs-attention table has the requested columns');
 const attentionLink=attention.querySelector('tbody a[href^="#/r/"]');
 assert(attentionLink&&attention.querySelector('tbody .bd'),'needs-attention rows include status and the matching complaint link');
 const attentionHref=attentionLink.getAttribute('href');await visit(w,attentionHref);assert(/Complaint Information/.test($(w,'app').textContent),'dashboard View action opens the linked complaint details');
 for(const h of ['#/dash','#/reports','#/map','#/analytics','#/barangays','#/b/1','#/users','#/chat-insights','#/logs','#/notifs','#/r/1','#/r/3','#/residents'])await visit(w,h);
 await visit(w,'#/residents');assert(/All/.test($(w,'app').querySelector('.resident-tab[aria-pressed="true"]').textContent),'resident list selects All when no pending requests');assert(/Ana Resident/.test($(w,'app').textContent),'resident list shows approved records');w.setRF('pending');assert(/No pending residents\. New registrations will appear here\./.test($(w,'app').textContent),'resident pending empty state');w.setRF('all');
 const proofResidentId=w.eval('S.residents[0].id'),proofResidentSnapshot=w.eval('JSON.stringify(S.residents[0])'),proofFetch=w.fetch,proofCreateUrl=w.URL.createObjectURL,proofRevokeUrl=w.URL.revokeObjectURL;let proofUrl=0;
 w.URL.createObjectURL=()=>`blob:resident-proof-${++proofUrl}`;w.URL.revokeObjectURL=()=>{};
 w.eval("S.residents[0]={...S.residents[0],hasproof:true,upload_mode:'back',document_type:'UMID',ocr_name:null,ocr_dob:null,ocr_barangay:null,ocr_document_number:null}");
 w.fetch=async(url,options)=>String(url).startsWith('/api/img/p/')?{ok:true,status:200,blob:async()=>new w.Blob(['image']),headers:{get:()=> 'image/jpeg'}}:proofFetch(url,options);
 await w.openResidentProof(proofResidentId);assert.equal($(w,'resident-proof-viewer').querySelectorAll('.resident-proof-image').length,2,'front-and-back mode loads both document images');assert(/Front and Back/.test($(w,'resident-proof-details').textContent),'resident details show the configured upload mode');assert(/Not extracted/.test($(w,'resident-proof-details').textContent),'empty OCR fields are identified as not extracted');
 $(w,'resident-proof-viewer').querySelectorAll('.resident-proof-image').forEach(image=>Object.defineProperty(image,'naturalWidth',{value:1,configurable:true}));w.zoomResidentProof(.2);assert.equal($(w,'resident-proof-viewer').querySelector('.resident-proof-image').style.transform,'scale(1.2)','zoom controls scale the loaded document images');
 w.residentProofImageError($(w,'resident-proof-viewer').querySelector('.resident-proof-image'));assert(/Document not available/.test($(w,'resident-proof-viewer').textContent)&&$(w,'resident-proof-viewer').querySelector('a[target="_blank"]'),'failed image shows a retry/open fallback');
 w.closeResidentProof();w.fetch=async(url,options)=>String(url).startsWith('/api/img/p/')?{ok:false,status:404}:proofFetch(url,options);w.eval("S.residents[0]={...S.residents[0],upload_mode:'front'}");await w.openResidentProof(proofResidentId);assert(/Document not available/.test($(w,'resident-proof-viewer').textContent),'unavailable document falls back without a broken image');
 w.closeResidentProof();w.eval("S.residents[0]={...S.residents[0],hasproof:false}");await w.openResidentProof(proofResidentId);assert(/No proof was uploaded/.test($(w,'resident-proof-viewer').textContent),'old record without an image opens safely');w.closeResidentProof();w.eval(`S.residents[0]=${proofResidentSnapshot}`);w.fetch=proofFetch;w.URL.createObjectURL=proofCreateUrl;w.URL.revokeObjectURL=proofRevokeUrl;
 await visit(w,'#/map');assert(/All Barangays/.test($(w,'map-barangay').textContent)&&/Pag-asa/.test($(w,'map-barangay').textContent)&&/West Tapinac/.test($(w,'map-barangay').textContent)&&/New Kalalake/.test($(w,'map-barangay').textContent),'report map barangay selector');
 const mapReports=w.eval('allReports'),allMapResults=w.filterMapByBarangay('All Barangays');
 for(const name of ['Pag-asa','West Tapinac','New Kalalake'])assert(w.filterMapByBarangay('  '+name.toLowerCase()+'  ').every(r=>r.barangay.trim().toLowerCase()===name.toLowerCase()),'report map filters '+name);
 assert.equal(w.filterMapByBarangay('All Barangays').length,allMapResults.length,'report map restores all reports');
 w.eval('allReports=[]');w.filterMapByBarangay('New Kalalake');assert.equal($(w,'map-empty').textContent,'No reports in this barangay yet.','report map empty state');w.allReports=mapReports;w.eval('allReports=window.allReports');
const circleMarker=w.L.circleMarker,polygon=w.L.polygon,filterLayer={markers:[],clearLayers(){this.markers=[]}};
w.__filterLayer=filterLayer;w.__filterMap={fitBounds(){},remove(){},removeLayer(){}};
w.eval('markersLayer=window.__filterLayer;reportMap=window.__filterMap');
w.L.circleMarker=(point,options)=>({point,options,events:{},addTo(layer){layer.markers.push(this);return this},bindTooltip(tooltip,tooltipOptions){this.tooltip=tooltip;this.tooltipOptions=tooltipOptions;return this},bindPopup(popup){this.popup=popup;return this},on(event,handler){this.events[event]=handler;return this},setRadius(radius){this.radius=radius;return this},setStyle(style){this.style=style;return this},closeTooltip(){this.tooltipClosed=true;return this}});
w.L.polygon=(latLngs,options)=>{w.__polygonOptions=options;return{addTo(){return this},getBounds(){return [[0,0],[0,0]]},remove(){}}};
 const westReports=w.filterMapByBarangay('West Tapinac');assert.equal(filterLayer.markers.length,westReports.length,'report map draws only filtered markers');
 assert(filterLayer.markers.every(marker=>/West Tapinac/.test(marker.popup)),'report map markers belong to selected barangay');
 const previewMarker=filterLayer.markers.find(marker=>marker.popup.includes(`href="#/r/${westReports[0].reportId}"`));
 assert(previewMarker&&/View Complaint Details/.test(previewMarker.popup)&&/Category/.test(previewMarker.popup)&&/Reported/.test(previewMarker.popup),'click popup shows real complaint preview and detail route');
 assert(!/Reporter:|Resident:|Official|Address:/.test(previewMarker.popup),'complaint popup excludes people-map information');
 assert(previewMarker.tooltip.includes(westReports[0].code)&&previewMarker.tooltip.includes(westReports[0].category)&&/Status/.test(previewMarker.tooltip)&&/West Tapinac/.test(previewMarker.tooltip)&&/Reported/.test(previewMarker.tooltip),'hover tooltip identifies the complaint and its actual details');
 assert(/class="bd s-/.test(previewMarker.tooltip)&&previewMarker.tooltipOptions.className==='map-complaint-tooltip'&&previewMarker.tooltipOptions.sticky,'hover tooltip has a status badge and marker-attached styling');
 if(westReports[0].photo)assert(/\/api\/img\/r\/\d+/.test(previewMarker.popup),'complaint preview includes actual image thumbnail');
 for(const name of ['Pag-asa','New Kalalake','West Tapinac']){const visibleReports=w.filterMapByBarangay(name);assert.equal(filterLayer.markers.length,visibleReports.length,'filtered markers for '+name);assert(filterLayer.markers.every(marker=>marker.tooltip.includes(name)),'hover tooltips match '+name)}
 assert.equal(w.__polygonOptions.interactive,false,'barangay boundaries do not block complaint marker interactions');
 previewMarker.events.mouseover();assert.equal(previewMarker.radius,11,'marker enlarges on hover');assert.equal(previewMarker.style.weight,3,'hover adds a marker highlight');previewMarker.events.mouseout();assert.equal(previewMarker.radius,9,'marker returns to normal after hover');assert.equal(previewMarker.style.weight,2,'marker outline returns to normal');
 previewMarker.events.click();assert.equal(previewMarker.tooltipClosed,true,'clicking a marker closes the hover tooltip');
 w.filterMapByBarangay('All Barangays');assert.equal(filterLayer.markers.length,allMapResults.length,'report map redraws all markers');
 w.L.circleMarker=circleMarker;w.L.polygon=polygon;w.eval('markersLayer=null;reportMap=null');delete w.__filterLayer;delete w.__filterMap;delete w.__polygonOptions;
 $(w,'map-barangay').value='West Tapinac';$(w,'map-barangay').dispatchEvent(new w.Event('change'));await visit(w,'#/map');assert.equal($(w,'map-barangay').value,'West Tapinac','report map keeps selection after refresh');
  await visit(w,'#/chat-insights');assert(/Ask FixIt AI insights/.test($(w,'app').textContent)&&/Verified service information/.test($(w,'app').textContent),'admin chat insights and service editor');$(w,'chat-service-name').value='UI Verified Service';$(w,'chat-service-requirements').value='Bring the form.';$(w,'chat-service-fee').value='No fee';$(w,'chat-service-hours').value='Weekdays';await w.saveChatService();await sleep(300);assert(/UI Verified Service/.test($(w,'app').textContent),'verified service saved');
 assert(/Complaint Information/.test(await visit(w,'#/r/1')),'redesigned complaint detail page');
 let detailMapOptions=null;const leafletMap=w.L.map;w.L.map=function(el,options){if(el.id==='rpt-map')detailMapOptions=options;return leafletMap.call(this,el,options)};
 const seededDetail=await visit(w,'#/r/7');
 assert($(w,'rpt-map')&&detailMapOptions&&detailMapOptions.dragging===false,'complaint detail has a read-only map');
 assert(/No main object image/.test(seededDetail)&&/No location image/.test(seededDetail),'missing evidence uses clear placeholders');
 const savedDetailCoords=w.eval("(()=>{const r=S.reports.find(r=>r.id===7);return{lat:r.lat,lng:r.lng}})()");
 w.eval("S.reports.find(r=>r.id===7).lat=null;S.reports.find(r=>r.id===7).lng=null;detail(7)");
 assert(/No pin location saved/.test($(w,'app').textContent)&&!$(w,'rpt-map'),'complaint without coordinates shows a safe no-pin message');
 w.eval(`S.reports.find(r=>r.id===7).lat=${JSON.stringify(savedDetailCoords.lat)};S.reports.find(r=>r.id===7).lng=${JSON.stringify(savedDetailCoords.lng)}`);
 w.L.map=leafletMap;
 const analyticsHtml=await visit(w,'#/analytics');
 assert(!$(w,'app').classList.contains('citywide-dashboard-page'),'expanded layout is scoped to the Super Admin dashboard');
 assert($(w,'app').classList.contains('analytics-dashboard-page'),'analytics page uses its expanded responsive layout');
 assert(/Analytics Dashboard/.test(analyticsHtml)&&/Total Complaints Received/.test($(w,'app').textContent),'analytics dashboard redesign');
 assert(/<svg/.test($(w,'app').innerHTML),'analytics graphs');
 assert(/analytics-category-card/.test($(w,'app').innerHTML)&&/Number of reports by category/.test($(w,'app').textContent),'category chart card heading');
 assert($(w,'app').querySelectorAll('.category-bar-row').length>0&&$(w,'app').querySelectorAll('.category-bar-value').length>0,'category bars show labels and counts');
 assert(/No complaint category data available/.test(w.compactCategoryChart({},'Reports by category')),'category chart empty state');
 const analyticsReports=w.eval('S.reports');
 const expectedStatusTotal=w.eval('visible(ME).length');
 assert.equal($(w,'app').querySelector('.analytics-status-card .chart.donut .ct').textContent,String(expectedStatusTotal),'analytics status donut uses actual database total');
 assert(/analytics-monthly/.test($(w,'app').innerHTML)&&/viewBox="0 0 100 100"/.test($(w,'app').innerHTML)&&$(w,'app').querySelectorAll('.analytics-line-labels span').length>0,'monthly chart has responsive plot and readable month labels');
 const monthlySvg=$(w,'app').querySelector('.analytics-monthly .analytics-line-graph svg'),monthlyArea=monthlySvg&&monthlySvg.querySelector('polygon'),areaPoints=monthlyArea&&monthlyArea.getAttribute('points').trim().split(/\s+/);
 assert(monthlySvg&&monthlySvg.getAttribute('overflow')==='hidden'&&monthlySvg.querySelector('clipPath rect')&&monthlySvg.querySelector('g[clip-path="url(#analytics-line-plot-clip)"]'),'monthly chart clips all plot geometry to its SVG bounds');
 const areaStart=areaPoints&&areaPoints[0].split(','),areaEnd=areaPoints&&areaPoints[areaPoints.length-1].split(',');
 assert(areaStart&&Number(areaStart[0])===4&&Number(areaStart[1])===95&&areaEnd&&Number(areaEnd[0])===96&&Number(areaEnd[1])===95,'monthly area closes at the chart baseline');
 assert(/No recurring problems detected/.test($(w,'app').textContent)||$(w,'app').querySelectorAll('.recurring-item').length>0,'recurring problems display data or the specified empty state');
 const analyticsBarangay=$(w,'analytics-barangay');
 assert(analyticsBarangay&&analyticsBarangay.value==='all','analytics defaults to All Barangays');
 const pagasaId=w.eval("S.barangays.find(b=>b.name==='Pag-asa').id");
 await w.setAnalyticsBarangay(String(pagasaId));
 const pagasaCount=analyticsReports.filter(report=>report.brgy===pagasaId).length;
 assert.equal(Number($(w,'app').querySelector('.analytics-stat.stat-total b').textContent),pagasaCount,'barangay filter updates statistics from actual complaints');
 assert.equal($(w,'analytics-barangay').value,String(pagasaId),'analytics filter retains the selected barangay');
 assert.equal(Number($(w,'app').querySelector('.analytics-status-card .chart.donut .ct').textContent),pagasaCount,'barangay filter updates chart totals');
 await w.setAnalyticsBarangay('all');
 assert.equal(Number($(w,'app').querySelector('.analytics-stat.stat-total b').textContent),analyticsReports.length,'All Barangays restores citywide totals');
 const recurringGroup=w.eval("Object.entries(group(S.reports,r=>r.cat+'|'+r.brgy)).find(([,count])=>count>=3)");
 if(recurringGroup){
  const [key,count]=recurringGroup,parts=key.split('|');
  assert($(w,'app').querySelectorAll('.recurring-item').length>0&&$(w,'app').querySelector('.recurring-item').textContent.includes(`${count} reports`),'recurring problems preserve the three-report threshold');
  assert($(w,'app').querySelector('.recurring-ids a[href^="#/r/"]'),'recurring problem shows links to real complaints');
  assert($(w,'app').querySelector('.recurring-item').textContent.includes(w.eval(`bname(${Number(parts[1])})`)),'recurring problem identifies its barangay');
 }
 const recurringSeed=analyticsReports[0],recurringCategory=recurringSeed.cat,recurringBarangay=recurringSeed.brgy;
 w.eval("S.reports.push(...[90001,90002].map(id=>({...S.reports[0],id,code:'OF-2026-'+String(id).padStart(6,'0')})))");
 await w.analytics();
 const recurringItem=[...$(w,'app').querySelectorAll('.recurring-item')].find(item=>item.querySelector('h4').textContent===recurringCategory&&item.querySelector('.recurring-barangay').textContent===w.eval(`bname(${recurringBarangay})`));
 assert(recurringItem&&recurringItem.querySelectorAll('.recurring-ids a').length===3,'recurring groups list associated complaint IDs once the threshold is met');
 w.viewRecurringReports(recurringCategory,recurringBarangay);
 assert.equal(w.eval('F.c'),recurringCategory,'recurring complaint action filters reports by category');
 assert.equal(w.eval('F.b'),String(recurringBarangay),'recurring complaint action filters reports by barangay');
 w.eval("F={q:'',s:'',c:'',b:'',ai:''}");
 await visit(w,'#/reports');await visit(w,'#/analytics');
 assert(w.document.body.classList.contains('auth'),'sidebar layout');
 await visit(w,'#/barangays');$(w,'bn').value='UI Test Brgy';$(w,'bla').value='14.83';$(w,'blo').value='120.28';await w.addB();await sleep(400);assert(/UI Test Brgy/.test($(w,'app').innerHTML),'barangay added');
 await visit(w,'#/users');$(w,'on').value='UI Official';$(w,'oe').value='ui@x.ph';$(w,'opw').value='Secret12';$(w,'ob').value='3';await w.addO();await sleep(400);assert(/ui@x.ph/.test($(w,'app').innerHTML),'official added');
 await visit(w,'#/reports');$(w,'fs').value='VERIFIED';w.applyF('');await sleep(100);assert(/OF-2026-000002/.test($(w,'app').innerHTML),'filter');
 await visit(w,'#/logout');await until(()=>!w.eval('ME'));
 // barangay official: full report lifecycle
 for(const official of [
  ['pagasa@fixit.ph','Pag-asa','Juan Dela Cruz'],
  ['newkalalake@fixit.ph','New Kalalake','Maria Santos'],
  ['westtapinac@fixit.ph','West Tapinac','Lito Ramos']
 ]){
  w=await open();await login(w,official[0],'demo123');
  assert(/Barangay Official/.test($(w,'side').textContent)&&new RegExp(official[1]).test($(w,'side').textContent)&&!$(w,'side').textContent.includes(official[2]),'barangay official sidebar hides the personal name for '+official[1]);
  await visit(w,'#/logout');await until(()=>!w.eval('ME'));
 }
 w=await open();await login(w,'pagasa@fixit.ph','demo123');
 assert(!/People Map/.test($(w,'side').textContent),'people map option removed for barangay officials');
 for(const h of ['#/dash','#/reports','#/map','#/analytics','#/notifs','#/r/3'])await visit(w,h);
 assert(!/OF-2026-000005/.test(await visit(w,'#/reports')),'other barangay report visible');
 await visit(w,'#/map');assert($(w,'map-barangay').disabled&&$(w,'map-barangay').options.length===1,'barangay official map is restricted to the assigned barangay');
 const brgyCircleMarker=w.L.circleMarker,brgyLayer={markers:[],clearLayers(){this.markers=[]}},brgyMap={fitBounds(){},removeLayer(){}};
 w.__brgyLayer=brgyLayer;w.__brgyMap=brgyMap;w.eval('markersLayer=window.__brgyLayer;reportMap=window.__brgyMap');
 w.L.circleMarker=(point,options)=>({point,options,events:{},addTo(layer){layer.markers.push(this);return this},bindTooltip(tooltip,tooltipOptions){this.tooltip=tooltip;this.tooltipOptions=tooltipOptions;return this},bindPopup(popup){this.popup=popup;return this},on(event,handler){this.events[event]=handler;return this},setRadius(radius){this.radius=radius;return this},setStyle(style){this.style=style;return this},closeTooltip(){this.tooltipClosed=true;return this}});
 const brgyReports=w.filterMapByBarangay('All Barangays');
 assert(brgyReports.length>0&&brgyReports.every(report=>report.barangay==='Pag-asa'),'barangay official map data stays within the assigned barangay');
 assert.equal(brgyLayer.markers.length,brgyReports.length,'barangay official map draws its permitted complaint markers');
 assert(brgyLayer.markers.every(marker=>marker.tooltip.includes('Pag-asa')&&marker.tooltip.includes('Status')&&marker.tooltipOptions.className==='map-complaint-tooltip'),'barangay official markers show the same dynamic hover details');
 w.L.circleMarker=brgyCircleMarker;w.eval('markersLayer=null;reportMap=null');delete w.__brgyLayer;delete w.__brgyMap;
 {const d=await visit(w,'#/dash');assert(/Barangay Pag-asa Dashboard/.test(d),'brgy dashboard');assert(!/West Tapinac|New Kalalake/.test(d),'brgy dashboard shows other barangays');assert(/<svg/.test(d),'dashboard graph');const a=await visit(w,'#/analytics');assert(/<svg/.test(a),'analytics graph');assert.equal(Number($(w,'app').querySelector('.analytics-status-card .chart.donut .ct').textContent),w.eval('visible(ME).length'),'barangay analytics totals stay within the assigned scope');assert(!/West Tapinac|New Kalalake/.test($(w,'app').textContent),'barangay analytics does not show other barangays');await visit(w,'#/residents');await visit(w,'#/resident/5');assert(/Ana Resident/.test($(w,'app').innerHTML),'resident detail');await visit(w,'#/resident/6',true);assert(/not found|access denied/i.test($(w,'app').innerHTML),'other barangay resident blocked')}
 await visit(w,'#/r/5',true);assert(/access denied|not found/i.test($(w,'app').innerHTML),'cross-barangay detail blocked');
 await visit(w,'#/r/3');$(w,'rm').value='Confirmed on site';await w.act(3,'VERIFIED');await sleep(500);assert(/VERIFIED/.test($(w,'app').innerHTML),'verified');
 $(w,'as').value='u2';await w.assign(3);await sleep(500);assert(/Juan Dela Cruz/.test($(w,'app').innerHTML),'assigned to a barangay official');
 await w.act(3,'IN PROGRESS');await sleep(500);
 $(w,'rr').value='Fixed';await w.resolve(3);await sleep(300);assert(/photo/i.test($(w,'am').textContent),'resolve needs photo');
 await visit(w,'#/logout');await until(()=>!w.eval('ME'));
 // resident: submit + track
 w=await open();await login(w,'resident@fixit.ph','demo123');
 for(const h of ['#/dash','#/reports','#/new','#/notifs','#/track','#/r/1'])await visit(w,h);
 assert(!/AI Verification/.test(await visit(w,'#/r/1')),'resident report details omit AI assessment');
 await visit(w,'#/new');assert.equal($(w,'app').querySelectorAll('.category-chip').length,6,'six category buttons');assert.equal($(w,'nla').type,'hidden','latitude is hidden');assert.equal($(w,'nlo').type,'hidden','longitude is hidden');assert($(w,'submit-report').disabled,'submit disabled before pin');assert(/Tap the map or drag the pin/.test($(w,'app').textContent),'pin instructions');const geocodeApi=w.api;w.api=async(p,b)=>String(p).startsWith('geocode/')?{address:{}}:geocodeApi(p,b);
 let geoSuccess,geoError,geoOptions,clearedWatches=[],watchNumber=0;
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{watchPosition(success,error,options){geoSuccess=success;geoError=error;geoOptions=options;return++watchNumber},clearWatch(id){clearedWatches.push(id)}}});
 $(w,'app').querySelector('[data-category="Damaged Road"]').click();w.useGeo();
 assert.equal($(w,'use-location').textContent.trim(),'Stop finding location','location button toggles to stop mode');
 assert.deepEqual(JSON.parse(JSON.stringify(geoOptions)),{enableHighAccuracy:true,timeout:15000,maximumAge:0},'location watch requests fresh high-accuracy readings');
 geoSuccess({coords:{latitude:14.827,longitude:120.2867,accuracy:151}});
 assert(/Improving accuracy\.\.\. ±151 m/.test($(w,'location-accuracy').textContent),'coarse first fix is shown as still improving');
 geoSuccess({coords:{latitude:14.8271,longitude:120.2866,accuracy:45}});
 assert.equal($(w,'nla').value,'14.827100','improved fix saves latitude in the correct field');assert.equal($(w,'nlo').value,'120.286600','improved fix saves longitude in the correct field');
 geoSuccess({coords:{latitude:14.8272,longitude:120.2865,accuracy:25}});
 assert(clearedWatches.includes(1)&&$(w,'use-location').textContent.trim()==='Use current location','location watch stops at 30 m and restores the button');
 assert(/Location found\. Accuracy approximately ±25 m/.test($(w,'location-accuracy').textContent),'final improved accuracy is shown');
 w.useGeo();geoSuccess({coords:{latitude:14.8272,longitude:120.2865,accuracy:151}});w.useGeo();
 assert(clearedWatches.includes(2)&&/Location is not precise\. Drag the pin to your exact spot\./.test($(w,'location-accuracy').textContent),'stopping with a coarse fix shows the precise-location warning');
 w.setPickPoint(14.827,120.286,true);assert.equal($(w,'nla').value,'14.827000','pin saves latitude');assert.equal($(w,'nlo').value,'120.286000','pin saves longitude');assert(/Pin placed/.test($(w,'pin-status').textContent),'pin confirmation is visible');w.eval("PH='data:image/jpeg;base64,/9j/4AAQSkZJRg';LOCATION_PH='data:image/jpeg;base64,/9j/4AAQSkZJRg';updateReportSubmit()");assert(!$(w,'submit-report').disabled,'pin and both images enable submission');await w.subRep();
 const ok=$(w,'app').innerHTML;assert(/Report received/.test(ok)&&/OF-2026-/.test(ok),'successful submission includes tracking number: '+ok.slice(0,150));
 const submittedCode=$(w,'app').querySelector('.report-success strong').textContent;
 await visit(w,'#/reports');const submittedReport=w.eval(`S.reports.find(r=>r.code===${JSON.stringify(submittedCode)})`);
 assert(submittedReport&&submittedReport.photo&&submittedReport.locationPhoto,'submitted main and location images are persisted and loaded in report state');
 await visit(w,'#/r/'+submittedReport.id);assert.equal($(w,'app').querySelectorAll('.report-detail-images img').length,2,'detail page loads both submitted image endpoints');
 await visit(w,'#/new');assert.equal($(w,'app').querySelectorAll('.category-chip svg').length,6,'category chips use SVG icons');assert($(w,'use-location').querySelector('svg'),'location button uses an SVG icon');$(w,'app').querySelector('[data-category="Other"]').click();await w.subRep();assert(/Please pin the location/.test($(w,'pin-status').textContent),'pin is required before submission');
 w.useGeo();geoError({code:1});assert(clearedWatches.includes(3)&&/permission was denied/i.test($(w,'nm').textContent),'permission denial clears the watch and shows a manual-placement message');
 w.setPickPoint(14.8273,120.2864,true);assert.equal($(w,'nla').value,'14.827300','manual pin remains available after permission denial');
 w.useGeo();const leavingWatch=watchNumber;await visit(w,'#/notifs');assert(clearedWatches.includes(leavingWatch),'leaving the form clears the active location watch');await sleep(100);assert(/Filter notifications/.test($(w,'app').innerHTML),'notifications filters');const unreadNotification=w.eval('S.notifs.find(n=>!n.read&&n.rid)');assert(unreadNotification,'resident has unread report notifications');await w.openNotification(unreadNotification.id,unreadNotification.rid);await until(()=>w.location.hash==='#/r/'+unreadNotification.rid);assert(w.eval('S.notifs.find(n=>n.id==='+unreadNotification.id+').read'),'opening a notification marks only it read');await visit(w,'#/notifs');await w.markAllNotificationsRead();assert(w.eval('S.notifs.every(n=>n.read)'),'mark all notifications read');
 // City Official removal + register
 w=await open();await visit(w,'#/login');assert(!/City Official|engineer@fixit\.ph/.test($(w,'app').textContent),'City Official demo login removed');
 await login(w,'admin@fixit.ph','admin123');await visit(w,'#/users');assert(!/City Official|Department|Dept/.test($(w,'app').textContent)&&!$(w,'or'),'user management only creates Barangay Officials');
 const PX='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//aAAgBAQAAPwA=';
 w=await open();await visit(w,'#/register');assert(/Proof of Residency/.test($(w,'app').innerHTML)&&/Upload a valid ID to help verify your identity and residency\./.test($(w,'app').innerHTML)&&/Pag-asa/.test($(w,'rb').innerHTML)&&!/Barretto/.test($(w,'rb').innerHTML),'register form');
 assert($(w,'rbd')&&$(w,'rbd').required&&$(w,'rbd').type==='date','registration requires a date of birth');
 const ageToday=w.RegistrationAge.todayDate(),age14Dob=dobAtAge(14,ageToday),age15Dob=dobAtAge(15,ageToday);
 await w.doReg();assert.equal($(w,'er-rbd').textContent,w.RegistrationAge.messages.invalid,'missing DOB is rejected');
 $(w,'rbd').value=age14Dob;$(w,'rbd').dispatchEvent(new w.Event('input'));await w.doReg();assert.equal($(w,'er-rbd').textContent,w.RegistrationAge.messages.underage,'age 14 is denied');
 $(w,'rbd').value='';w.applyOcrResult({dob:age14Dob});assert.equal($(w,'rbd').value,'','OCR DOB does not replace the user-entered source of truth');assert.equal($(w,'er-rbd').textContent,'','OCR DOB does not create an age error');assert.equal($(w,'regAgeStatus').textContent,'','empty entered DOB has no eligibility status');
 w.applyOcrResult({dob:age15Dob});assert.equal($(w,'rbd').value,'','OCR DOB is only an optional hint');
 $(w,'rbd').value='2004-12-12';$(w,'rbd').dispatchEvent(new w.Event('input'));w.applyOcrResult({dob:'not-a-date'});assert.equal($(w,'regAgeStatus').textContent,w.RegistrationAge.messages.eligible,'unparseable OCR DOB leaves entered DOB eligible');assert.equal($(w,'er-rbd').textContent,'','unparseable OCR DOB does not set an age error');
 w.regClearOcr();assert.equal($(w,'rbd').value,'2004-12-12','uploading a new file does not clear a user-entered DOB');assert.equal($(w,'regAgeStatus').textContent,w.RegistrationAge.messages.eligible,'new OCR run keeps current DOB validation');
 $(w,'rbd').value='2004-12-12';$(w,'rbd').dispatchEvent(new w.Event('input'));w.eval("OCR_RESULT={status:'readable',dob:'2005-12-12',fieldConfidence:{dateOfBirth:0.9}}");w.applyOcrResult({dob:'2005-12-12',fieldConfidence:{dateOfBirth:0.9}});
 assert.equal($(w,'rbd').value,'2004-12-12','OCR mismatch does not overwrite the entered DOB');assert.equal($(w,'regAgeStatus').textContent,w.RegistrationAge.messages.eligible,'valid entered DOB stays eligible when OCR disagrees');assert.equal($(w,'regDobOcrHint').textContent,w.RegistrationAge.messages.ocrReview,'OCR mismatch asks the user to verify DOB');
 $(w,'rbd').value='';w.eval("OCR_RESULT={status:'readable',dob:'2004-12-12',fieldConfidence:{dateOfBirth:0.2}}");w.applyOcrResult({dob:'2004-12-12',fieldConfidence:{dateOfBirth:0.2}});
 assert.equal($(w,'rbd').value,'','low-confidence OCR DOB is not autofilled');assert.equal($(w,'er-rbd').textContent,'','low-confidence OCR does not mark age invalid');assert.equal($(w,'regDobOcrHint').textContent,'','missing or low-confidence OCR DOB does not create a hint');
 $(w,'rbd').value=age15Dob;$(w,'rbd').dispatchEvent(new w.Event('input'));w.eval(`OCR_RESULT={status:'readable',dob:${JSON.stringify(age15Dob)},fieldConfidence:{dateOfBirth:0.9}}`);w.applyOcrResult({dob:age15Dob,fieldConfidence:{dateOfBirth:0.9}});
 assert.equal($(w,'regAgeStatus').textContent,w.RegistrationAge.messages.eligible,'registration field accepts exactly 15 after OCR review');assert.equal($(w,'regDobOcrHint').textContent,'','matching OCR DOB clears the review hint');
 assert.equal($(w,'rbd').max,ageToday,'future DOBs are blocked by the date input');
 assert($(w,'governmentFrontField').hidden&&$(w,'governmentBackField').hidden,'ID image uploads remain hidden until an ID type is selected');
 assert.equal($(w,'ridType').options[0].textContent,'Select your ID type','ID selector has a clear placeholder');
 for(const [type,requirement] of Object.entries(w.ID_REQUIREMENTS)){w.onDocumentTypeChange(type);assert(!$(w,'governmentFrontField').hidden,'front image shown for '+type);assert.equal($(w,'governmentBackField').hidden,requirement.uploadMode==='front','configured image sides shown for '+type)}
 $(w,'rp').value='Password123';$(w,'rc').value='Confirm123';const pwToggle=$(w,'rp').parentElement.querySelector('.reg-pass-toggle'),confirmToggle=$(w,'rc').parentElement.querySelector('.reg-pass-toggle');
 assert.equal(pwToggle.type,'button','password visibility control does not submit form');assert(pwToggle.querySelector('.reg-eye-show')&&pwToggle.querySelector('.reg-eye-hide'),'password control uses inline eye icons');pwToggle.click();
 assert.equal($(w,'rp').type,'text','password button reveals password');assert.equal($(w,'rp').value,'Password123','revealing password preserves its value');assert.equal($(w,'rc').type,'password','password visibility is independent');assert.equal(pwToggle.getAttribute('aria-label'),'Hide password','visible password has hide label');
 pwToggle.click();assert.equal($(w,'rp').type,'password','password button hides password again');assert.equal($(w,'rp').value,'Password123','hiding password preserves its value');
 confirmToggle.click();assert.equal($(w,'rc').type,'text','confirm password button reveals independently');assert.equal($(w,'rp').type,'password','confirm toggle does not reveal password field');confirmToggle.click();assert.equal($(w,'rc').type,'password','confirm password button hides independently');
 $(w,'rn').value='Reg User';$(w,'re').value='reg@x.ph';$(w,'rph').value='09170000000';$(w,'rad').value='5 Rizal Ave., Pag-asa';$(w,'rp').value='Abc12345';$(w,'rc').value='Abc12345';await w.doReg();await sleep(200);assert(/select your barangay/i.test($(w,'er-rb').textContent),'barangay required on register');
 $(w,'rb').value='1';$(w,'ridType').value='PhilHealth ID';w.eval("onDocumentTypeChange('PhilHealth ID')");assert(!$(w,'governmentFrontField').hidden&&$(w,'governmentBackField').hidden,'front-only ID shows just its front upload');
 await w.doReg();await sleep(200);assert(/front of your ID/i.test($(w,'er-rf').textContent),'front image required on register');
 assert($(w,'governmentBackField').hidden,'PhilHealth displays front-only requirement');
 assert(/Front only/.test($(w,'uploadRequirementTitle').textContent),'PhilHealth is labeled front only');
 $(w,'ridType').value='Philippine National ID (PhilID/ePhilID)';w.eval("onDocumentTypeChange('Philippine National ID (PhilID/ePhilID)')");assert(!$(w,'governmentBackField').hidden&&$(w,'regUploadGrid').classList.contains('has-back'),'front-and-back ID shows both upload cards');
 assert(/Front and back required/.test($(w,'uploadRequirementTitle').textContent),'front-and-back requirement is explained');
 await w.doReg();assert(/front of your ID/i.test($(w,'er-rf').textContent),'front image is required for two-sided ID');
 w.eval("PH_FRONT='"+PX+"';PH='"+PX+"'");await w.doReg();assert(/back of your ID/i.test($(w,'er-rbk').textContent),'back image is required for two-sided ID');
 $(w,'ridType').value='PhilHealth ID';w.eval("onDocumentTypeChange('PhilHealth ID')");assert($(w,'governmentBackField').hidden&&!$(w,'regUploadGrid').classList.contains('has-back'),'switching back to front-only removes the back card');
 assert.equal(w.eval('PH_BACK'),'','switching ID type clears the previous back image');
 const originalApi=w.api,originalWindowTimeout=w.setTimeout;let registrationPayload=null;
 w.api=async(route,payload)=>{if(route==='register'){registrationPayload=payload;return{verification:{status:'manual_review'}}}return originalApi(route,payload)};
 w.setTimeout=()=>0;
 $(w,'rp').value='Abc12345';$(w,'rc').value='Abc12345';w.eval("PH_FRONT='"+PX+"';PH='"+PX+"';PH_BACK='unused-back-image'");
 await w.doReg();assert(registrationPayload&&registrationPayload.back===undefined,'front-only registration omits a back image');assert.equal(registrationPayload.dob,age15Dob,'registration submits the validated DOB');
 w.api=originalApi;w.setTimeout=originalWindowTimeout;
 $(w,'ridType').value='Barangay Residency Document';w.eval("onDocumentTypeChange('Barangay Residency Document')");assert(!$(w,'governmentFrontField').hidden,'residency document uses front upload');assert($(w,'governmentBackField').hidden,'residency document hides back upload');assert(!$(w,'rResidence')&&!$(w,'residencyDocumentField'),'separate residency certificate upload removed');
 w.eval("PH_FRONT='"+PX+"';PH='"+PX+"'");await w.doReg();await sleep(500);assert(/unclear|could not|too small|readable|valid JPG|document|ID|upload/i.test($(w,'app').textContent+$(w,'er-rf').textContent),'unreadable ID is rejected');
 console.log(errors.length?'ERRORS:\n'+errors.join('\n'):'no runtime errors');
 assert.equal(errors.length,0);console.log('UI TESTS PASSED');srv.close();process.exit(0)
})().catch(e=>{console.error('UI FAIL:',e.stack);console.error(errors.join('\n'));process.exit(1)});
