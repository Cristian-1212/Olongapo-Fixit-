'use strict';
const crypto=require('crypto');
const {all,get,run,tx,now,log,notify,count,paginate}=require('./db');
const {bad,hashPw,checkPw,jpegOk,imageOk,fileOk,str,num,cookie,startSession,regenerateSession,need,isLocked,recordFailure,resetFailures,generateCSRFToken,validateCSRFToken,validatePassword,sanitizeHtml,okResp,errResp}=require('./security');
const {createReport,setStatus,getReport,state}=require('./reports');
const {CATS,OPEN,WORKABLE}=require('./config');
const chat=require('./chat');
const imageVerification=require('./imageVerification');
const {verifyIdAddress,ocrId,getCachedOcr,consumeCachedOcr,cacheOcr,compareAddress,compareResidencyDocument}=require('./addressVerification');
const {parsePhilIdQr,qrShape}=require('./idQr');
const {mergeId}=require('./idMerge');
const {ID_REQUIREMENTS}=require('./idRequirements');
const RegistrationAge=require('../public/js/registrationAge');
const tries={};
const chatTries=new Map();
const imageVerifyTries=new Map();
const ocrTries=new Map();
// Serialize calls and enforce Nominatim's one-request-per-second usage policy.
let nominatimQueue=Promise.resolve(),lastNominatimRequest=0;
const OLONGAPO_BOUNDS={south:14.75,north:14.9,west:120.2,east:120.4};
function nominatimRequest(url,referer){
 const task=nominatimQueue.then(async()=>{
  const wait=Math.max(0,1000-(Date.now()-lastNominatimRequest));
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastNominatimRequest=Date.now();
  let response;
  try{response=await fetch(url,{headers:{'User-Agent':'OlongapoFixIt/1.2.0 (community reporting web application)','Referer':referer,'Accept-Language':'en'},signal:AbortSignal.timeout(8000)})}
  catch(e){bad('Location lookup is temporarily unavailable. Please try again.',503)}
  if(!response.ok)bad('Location lookup is temporarily unavailable. Please try again.',503);
  try{return await response.json()}catch(e){bad('Location lookup returned an invalid response. Please try again.',503)}
 });
 nominatimQueue=task.then(()=>{},()=>{});
 return task;
}
const CSRF_EXEMPT=['POST /api/login','POST /api/register','POST /api/logout','POST /api/ocr','GET /api/track','GET /api/public','GET /api/state','GET /api/csrf/token','GET /api/health'];
const ALLOW_BRGS=['Pag-asa','New Kalalake','West Tapinac'];
const DOCUMENT_TYPES=['Philippine National ID (PhilID/ePhilID)','PhilHealth ID','UMID','Philippine Driver\'s License','Philippine Passport','Postal ID',"Voter's ID",'Barangay Residency Document'];
const BACK_REQUIRED=new Set(Object.entries(ID_REQUIREMENTS).filter(([,config])=>config.uploadMode==='back').map(([type])=>type));
const R={};
const pInt=(v,d)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:d};
const oInt=(v,d)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:d};
const maint=()=>{try{return require('fs').existsSync(require('path').join(__dirname,'..','.maintenance'))}catch(e){return false}};

// Point-in-polygon validation using ray-casting algorithm
// polygon: array of [lng, lat] coordinates (GeoJSON order)
function pointInPolygon(lat, lng, polygon) {
  if (!polygon || !polygon.length) return true; // No boundary defined = allow
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

R['GET /api/health']=(c)=>{return okResp({status:'ok',uptime:process.uptime(),memory:process.memoryUsage()})};
R['POST /api/ocr']=async(c,req)=>{
 checkOcrRate(req);
 if(!c.b||typeof c.b!=='object'||Array.isArray(c.b))bad('Invalid request.');
 const documentType=String(c.b.documentType||c.b.idType||'');
 if(documentType&&!DOCUMENT_TYPES.includes(documentType))bad('Unsupported document type.');
 const proof=String(c.b.proof||c.b.front||'');
 if(!/^data:image\/(jpeg|png);base64,/i.test(proof))bad('Invalid document. Upload a clear JPG or PNG image under 5 MB.');
 const uploadMode=documentType&&ID_REQUIREMENTS[documentType]
  ?ID_REQUIREMENTS[documentType].uploadMode
  :(c.b.uploadMode==='back'?'back':'front');
 const back=uploadMode==='back'?String(c.b.back||''):'';
 if(uploadMode==='back'&&!back)bad('Please upload the back of the ID.');
 if(back&&!/^data:image\/(jpeg|png);base64,/i.test(back))bad('Invalid back image. Upload a clear JPG or PNG image under 5 MB.');
 // 1) QR code (decoded in the browser; read-only, signature NOT verified here)
 const qrRaw=typeof c.b.qr==='string'?c.b.qr:'';
 const qr=parsePhilIdQr(qrRaw);
 console.log('[QR] sent by browser:',!!qrRaw,'| recognized as PhilSys:',!!qr,'| shape:',qrShape(qrRaw));
 // 2) Tesseract OCR (always runs; works offline)
 const unreadable={status:'unreadable',confidence:0,address:'',text:'',reason:'The uploaded ID is unclear or could not be processed.'};
 let ocr;
 try{ocr=await ocrId(proof,documentType)}catch(e){console.error('[OCR] front failed:',e&&e.message);ocr={...unreadable}}
 let backOcr=null;
 if(back){try{backOcr=await ocrId(back,documentType)}catch(e){console.error('[OCR] back failed:',e&&e.message)}}
 const isDLDoc=documentType==="Philippine Driver's License";
 // The back of a driver's license lists an EMERGENCY CONTACT (another person), never the holder's details.
 if(isDLDoc&&backOcr)backOcr={...backOcr,name:null,dob:null,address:'',barangay:null,sex:''};
 let combined={...ocr};
 if(ocr.status!=='readable'&&backOcr&&backOcr.status==='readable')combined={...backOcr};
 else if(back&&backOcr&&backOcr.status==='readable'){
  combined={
   ...ocr,
   text:[ocr.text,backOcr.text].filter(Boolean).join('\n'),
   address:ocr.address||backOcr.address||'',
   name:ocr.name||backOcr.name||null,
   dob:ocr.dob||backOcr.dob||null,
   barangay:ocr.barangay||backOcr.barangay||null,
   sex:ocr.sex||backOcr.sex||'',
   civilStatus:ocr.civilStatus||backOcr.civilStatus||'',
   documentNumber:ocr.documentNumber||backOcr.documentNumber||'',
   expirationDate:ocr.expirationDate||backOcr.expirationDate||'',
   issueDate:ocr.issueDate||backOcr.issueDate||'',
   fieldConfidence:ocr.fieldConfidence||backOcr.fieldConfidence||{},
   confidence:Math.max(ocr.confidence||0,backOcr.confidence||0)
  };
 }
 // 3) Optional AI vision (only when ID_AI_VISION=1 and a Gemini key is set)
 const aiResults=[]; // the AI read already happened inside ocrId()
 if(combined.status!=='readable'&&!qr&&!aiResults.length)return okResp({status:'unreadable',reason:ocr.reason||unreadable.reason,address:ocr.address||'',text:ocr.text||'',confidence:ocr.confidence||0});
 const merged=mergeId({qr,ai:aiResults,ocr:combined.status==='readable'?combined:null});
 const ocrKey=crypto.randomBytes(16).toString('hex');
 const cache={status:'readable',address:merged.address,text:combined.text||'',confidence:combined.status==='readable'?(combined.confidence||0):(qr?0.99:aiResults.length?0.9:0),name:merged.name||null,dob:merged.dob||null,barangay:merged.barangay||null,sex:merged.sex,civilStatus:merged.civilStatus,documentNumber:merged.documentNumber,expirationDate:merged.expirationDate,issueDate:merged.issueDate,fieldConfidence:merged.fieldConfidence,documentType,uploadMode,sources:merged.sources,qr:{provided:!!qrRaw,found:!!qr,signatureVerified:false},ai:combined.status==='readable',crossCheck:merged.crossCheck};
 cacheOcr(ocrKey,cache);
 return okResp({status:'readable',ocrId:ocrKey,...cache});
};
function checkChatRate(user){const key=String(user.id),nowMs=Date.now();let entry=chatTries.get(key);if(!entry||nowMs-entry.since>=60000)entry={count:0,since:nowMs};if(entry.count>=20)bad('Chat message limit reached. Please wait a minute and try again.',429);entry.count++;chatTries.set(key,entry);if(chatTries.size>5000)for(const [id,x] of chatTries)if(nowMs-x.since>=60000)chatTries.delete(id)}

function checkImageVerifyRate(user){
  const key=String(user.id);
  const nowMs=Date.now();
  let entry=imageVerifyTries.get(key);
  if(!entry||nowMs-entry.since>=60000)entry={count:0,since:nowMs};
  const limit = user.role === 'admin' ? 60 : user.role === 'brgy' ? 30 : 10;
  if(entry.count>=limit)bad('Image verification limit reached. Please wait a minute and try again.',429);
  entry.count++;
  imageVerifyTries.set(key,entry);
  if(imageVerifyTries.size>5000)for(const [id,x] of imageVerifyTries)if(nowMs-x.since>=60000)imageVerifyTries.delete(id);
}
function checkOcrRate(req){
  const key=req.socket.remoteAddress||'unknown';
  const nowMs=Date.now();
  let entry=ocrTries.get(key);
  if(!entry||nowMs-entry.since>=60000)entry={count:0,since:nowMs};
  if(entry.count>=15)bad('OCR request limit reached. Please wait a minute and try again.',429);
  entry.count++;
  ocrTries.set(key,entry);
  if(ocrTries.size>5000)for(const [id,x] of ocrTries)if(nowMs-x.since>=60000)ocrTries.delete(id);
}
function chatHasMedia(value,depth){
  if(depth>6||value===null||value===undefined)return false;
  if(typeof value==='string'){
    if(/^data:image\//i.test(value)||/^data:application\//i.test(value))return true;
    if(/^\/9j\//.test(value)||/^iVBORw0KGgo/.test(value)||/^UklGR/.test(value))return true;
    return false;
  }
  if(Array.isArray(value))return value.some(v=>chatHasMedia(v,depth+1));
  if(typeof value!=='object')return false;
  for(const [k,v] of Object.entries(value)){
    if(/^(image|images|attachments?|files?|inlineData|inline_data|fileData|file_data|blob|binary)$/i.test(k)&&v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length))return true;
    if(k==='content'&&typeof v!=='string'&&v&&typeof v==='object')return true;
    if(k==='parts'&&Array.isArray(v)&&v.some(p=>p&&typeof p==='object'&&('inlineData'in p||'inline_data'in p||'fileData'in p||'file_data'in p)))return true;
    if(chatHasMedia(v,depth+1))return true;
  }
  return false;
}
R['POST /api/chat']=async(c)=>{
  console.log('[chat] POST /api/chat request:', {hasBody: !!c.b, bodyKeys: c.b ? Object.keys(c.b) : [], userRole: c.u?.role});
  const u=c.u || {id:0,role:'guest',name:'Guest',brgy:null};
  if(!c.b||typeof c.b!=='object'||Array.isArray(c.b))bad('Ask FixIt currently supports text questions only and cannot read images or files. Please describe your question in text.',400);
  if(chatHasMedia(c.b,0)){console.log('[chat] Image detected in body');bad('Ask FixIt currently supports text questions only and cannot read images or files. Please describe your question in text.',400)}
  if(!('message'in c.b)||typeof c.b.message!=='string')bad('Ask FixIt currently supports text questions only and cannot read images or files. Please describe your question in text.',400);
  const message=c.b.message.trim();
  if(!message||message.length>1000)bad('Message must be 1-1000 characters.');
  const history=c.b.history===undefined?[]:c.b.history;
  if(!Array.isArray(history)||history.length>10)bad('Send no more than 10 recent chat messages.');
  let total=message.length;
  const recent=history.map(m=>{
   if(!m||typeof m!=='object'||Array.isArray(m)||!['user','assistant'].includes(m.role)||typeof m.content!=='string')bad('Invalid chat history.');
   if(chatHasMedia(m,0)){console.log('[chat] Image detected in history');bad('Ask FixIt currently supports text questions only and cannot read images or files. Please describe your question in text.',400)}
   const content=m.content.trim();
   if(!content||content.length>1000)bad('Each history message must be 1-1000 characters.');
   total+=content.length;
   return{role:m.role,content};
  });
  if(total>6000)bad('Chat history is too long. Start a new conversation.');
  // Rate limiting: stricter for guests (5/min) vs authenticated (20/min)
  if(u.role==='guest'){
    const ip=c.req?.socket?.remoteAddress||'unknown';
    const key='guest:'+ip;
    const nowMs=Date.now();
    let entry=chatTries.get(key);
    if(!entry||nowMs-entry.since>=60000)entry={count:0,since:nowMs};
    if(entry.count>=5)bad('Guest message limit reached. Please wait a minute and try again, or sign in for higher limits.',429);
    entry.count++;chatTries.set(key,entry);
  }else{
    checkChatRate(u);
  }
  try{
   const reply=await chat.reply(message,recent,u),topic=chat.topicFor(message);
   chat.recordTopic(topic);
   return okResp({reply,topic});
  }catch(e){
   if(e instanceof chat.ChatError)bad(e.message,e.status);
   throw e;
  }
};
R['POST /api/chat/feedback']=(c)=>{const u=c.u;if(!u)bad('Please sign in to send feedback.',401);checkChatRate(u);if(!chat.recordFeedback(String(c.b.topic||''),String(c.b.vote||'')))bad('Invalid chat feedback.');return okResp({ok:true})};
R['GET /api/chat/insights']=(c)=>{need(c.u,['admin']);return okResp(chat.insights())};
R['GET /api/chat/services']=(c)=>{need(c.u,['admin']);return okResp({services:all('SELECT id,name,requirements,fee,office_hours AS officeHours,active,updated FROM chat_services ORDER BY name')})};
R['POST /api/chat/service/save']=(c)=>{const u=need(c.u,['admin']),name=str(c.b.name,2,100,'Service name'),requirements=str(c.b.requirements,2,2000,'Requirements'),fee=str(c.b.fee,1,200,'Fee'),officeHours=str(c.b.officeHours,2,200,'Office hours');run('INSERT INTO chat_services(name,requirements,fee,office_hours,active,updated) VALUES(?,?,?,?,1,?) ON CONFLICT(name) DO UPDATE SET requirements=excluded.requirements,fee=excluded.fee,office_hours=excluded.office_hours,active=1,updated=excluded.updated',name,requirements,fee,officeHours,now());log(u.id,'UPDATE','chat_service',0,'Updated verified service information');return okResp({ok:true})};
R['POST /api/chat/service/delete']=(c)=>{const u=need(c.u,['admin']),id=Number(c.b.id);if(!Number.isInteger(id)||id<1)bad('Invalid service.');if(!get('SELECT id FROM chat_services WHERE id=?',id))bad('Service not found.',404);run('DELETE FROM chat_services WHERE id=?',id);log(u.id,'DELETE','chat_service',id,'Removed service information');return okResp({ok:true})};
R['GET /api/state']=(c,req,res)=>{const u=c.u;if(maint()&&u&&u.role!=='admin')return errResp(503,'System is under maintenance.');const st=state(u);const S=st.S;const lim=pInt(c.q.get('limit'),50),off=oInt(c.q.get('offset'),0);const rep=S.reports.slice(off,off+lim);return okResp({me:u?u.id:null,S:{...S,reports:rep,reportsTotal:S.reports.length,reportsLimit:lim,reportsOffset:off}})}
R['GET /api/csrf/token']=(c,req,res)=>{const tok=generateCSRFToken();const sec=(process.env.NODE_ENV==='production'||req.headers['x-forwarded-proto']==='https')?'; Secure':'';res.setHeader('Set-Cookie',`csrf_token=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${sec}`);return okResp({csrfToken:tok})};
R['GET /api/public']=()=>{const t=get('SELECT COUNT(*) n,SUM(status=\'RESOLVED\') r,SUM(status NOT IN(\'RESOLVED\',\'REJECTED\')) a FROM reports');return okResp({stats:{total:t.n,resolved:t.r||0,active:t.a||0,barangays:get('SELECT COUNT(*) n FROM barangays WHERE active=1').n},list:all('SELECT r.cat,b.name AS brgy,r.status,r.created FROM reports r JOIN barangays b ON b.id=r.brgy ORDER BY r.id DESC LIMIT 100').map(x=>({cat:x.cat,brgy:x.brgy,status:x.status,date:x.created}))})};
R['GET /api/track']=(c)=>{const code=String(c.q.get('code')||'').trim().toUpperCase();if(!/^OF-\d{4}-\d{6}$/.test(code))return okResp({found:false});const r=get('SELECT r.id,r.code,r.cat,r.status,r.created,b.name AS brgy FROM reports r JOIN barangays b ON b.id=r.brgy WHERE r.code=?',code);if(!r)return okResp({found:false});const ev=get('SELECT descr FROM ev WHERE rid=? ORDER BY id DESC LIMIT 1',r.id);return okResp({found:true,code:r.code,cat:r.cat,brgy:r.brgy,created:r.created,status:r.status,hist:all('SELECT s,at FROM hist WHERE rid=? ORDER BY id',r.id),resolution:r.status==='RESOLVED'&&ev?ev.descr:null})};
R['GET /api/geocode/reverse']=(c,req)=>{const u=need(c.u,['res']);if(u.vstatus!=='approved')bad('Your residency must be verified to look up a location.',403);const lat=num(c.q.get('lat'),OLONGAPO_BOUNDS.south,OLONGAPO_BOUNDS.north,'Latitude'),lon=num(c.q.get('lon'),OLONGAPO_BOUNDS.west,OLONGAPO_BOUNDS.east,'Longitude'),url=new URL('https://nominatim.openstreetmap.org/reverse');url.search=new URLSearchParams({format:'jsonv2',lat:String(lat),lon:String(lon),zoom:'18',addressdetails:'1'}).toString();const referer=req.headers.referer||process.env.PUBLIC_URL||'http://localhost/';return nominatimRequest(url,referer).then(result=>({address:result.address||{},display_name:result.display_name||''}))};
R['GET /api/geocode/search']=(c,req)=>{const u=need(c.u,['res']);if(u.vstatus!=='approved')bad('Your residency must be verified to look up a location.',403);const query=String(c.q.get('q')||'').trim();if(query.length<3||query.length>100)bad('Search must be 3-100 characters.');const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({format:'jsonv2',q:`${query}, Olongapo City, Zambales, Philippines`,viewbox:'120.2000,14.9000,120.4000,14.7500',bounded:'1',addressdetails:'1',limit:'5'}).toString();const referer=req.headers.referer||process.env.PUBLIC_URL||'http://localhost/';return nominatimRequest(url,referer).then(results=>({results:results.filter(result=>Number(result.lat)>=OLONGAPO_BOUNDS.south&&Number(result.lat)<=OLONGAPO_BOUNDS.north&&Number(result.lon)>=OLONGAPO_BOUNDS.west&&Number(result.lon)<=OLONGAPO_BOUNDS.east).map(result=>({name:result.name||result.display_name,lat:result.lat,lon:result.lon}))}))};
R['POST /api/login']=(c,req,res)=>{const email=String(c.b.email||'').trim().toLowerCase().slice(0,254),k=req.socket.remoteAddress+'|'+email,t=tries[k]||(tries[k]={n:0,t:Date.now()});if(Date.now()-t.t>9e5){t.n=0;t.t=Date.now()}if(t.n>=10)bad('Too many attempts. Try again in 15 minutes.',429);const u=get('SELECT * FROM users WHERE email=?',email);if(!u){t.n++;bad('Invalid email or password.',401)}if(isLocked(u))bad('Account is temporarily locked due to multiple failed attempts. Try again later.',423);if(!checkPw(String(c.b.password||''),u.pw)){recordFailure(u);t.n++;bad('Invalid email or password.',401)}if(!u.active)bad('Account is deactivated.',403);resetFailures(u);t.n=0;run('UPDATE users SET last_activity=? WHERE id=?',now(),u.id);regenerateSession(res,req,u.id);log(u.id,'LOGIN','user',u.id,u.name+' logged in');return okResp({ok:true})};
R['POST /api/register']=async(c,req,res)=>{
 const name=str(c.b.name,1,100,'Full name'),email=str(c.b.email,3,254,'Email').toLowerCase(),phone=str(c.b.phone||'',0,30,'Phone'),pw=String(c.b.password||'');
 validatePassword(pw);if(!/^\S+@\S+\.\S+$/.test(email))bad('Enter a valid email.');
 const dob=RegistrationAge.normalizeDob(String(c.b.dob||'').trim()),submittedAge=RegistrationAge.calculateAge(dob);
 if(submittedAge.status==='invalid')bad(RegistrationAge.messages.invalid);
 if(submittedAge.status==='underage')bad(RegistrationAge.messages.underage);
 const address=sanitizeHtml(str(c.b.address,5,200,'Complete address')),brgy=get('SELECT * FROM barangays WHERE id=? AND active=1',Number(c.b.brgy));
 if(!brgy||!ALLOW_BRGS.includes(brgy.name))bad('Please select a supported barangay.');
 const documentType=String(c.b.documentType||c.b.idType||'');
 if(!DOCUMENT_TYPES.includes(documentType))bad('Please select a supported ID or document type.');
 const uploadMode=ID_REQUIREMENTS[documentType]?.uploadMode||'front';
 const front=String(c.b.front||c.b.proof||''),back=uploadMode==='back'?String(c.b.back||''):'',residence=documentType==='Barangay Residency Document'?front:'';
 if(documentType==='Barangay Residency Document'){
  if(!residence||!/^data:image\/(jpeg|png);base64,/i.test(residence)||!fileOk(residence))bad('Upload a clear JPG or PNG Barangay Residency Document under 5 MB.');
 }else{
  if(!front||!/^data:image\/(jpeg|png);base64,/i.test(front)||!fileOk(front))bad('Upload a clear JPG or PNG front image under 5 MB.');
  if(uploadMode==='back'&&(!back||!/^data:image\/(jpeg|png);base64,/i.test(back)||!fileOk(back)))bad('Upload a clear JPG or PNG back image for the Front and Back mode.');
 }
 if(get('SELECT id FROM users WHERE email=?',email))bad('Email already registered.',409);
 const gender=String(c.b.gender||''),sex=String(c.b.sex||c.b.gender||''),civilStatus=String(c.b.civilStatus||''),customGender=gender==='Other'?String(c.b.customGender||'').trim().slice(0,100):null;
 if(gender==='Other'&&!customGender)bad('Please specify your gender.');
 let verification;
 const ocrKey=String(c.b.ocrId||'');
 if(documentType==='Barangay Residency Document'){
  let cached=ocrKey?consumeCachedOcr(ocrKey):null;
  if(!cached){const ocr=await ocrId(residence,documentType);cached=ocr.status==='readable'?ocr:null}
  if(!cached||cached.status==='unreadable')bad('The residency document is unclear or unreadable. Please upload another document.',422);
  const match=compareResidencyDocument(cached.text||`${cached.address||''} ${cached.barangay||''}`,name,brgy.name);
  verification={status:match.status,confidence:match.confidence,address:cached.address||cached.text||'',text:cached.text||'',name:match.name||cached.name||null,dob:cached.dob||null,barangay:match.barangay||cached.barangay||null};
 }else{
  const cached=ocrKey?consumeCachedOcr(ocrKey):null;
  verification=cached?compareAddress(cached.address,address,brgy.name):await verifyIdAddress(front,address,brgy.name);
  if(cached){verification.text=cached.text;verification.name=cached.name||null;verification.dob=cached.dob||null;verification.barangay=cached.barangay||null;verification.sex=cached.sex||null;verification.documentNumber=cached.documentNumber||null;verification.expirationDate=cached.expirationDate||null;verification.issueDate=cached.issueDate||null;verification.fieldConfidence=cached.fieldConfidence||{};verification.crossCheck=cached.crossCheck||'n/a';verification.qrFound=!!(cached.qr&&cached.qr.found);verification.aiUsed=!!cached.ai;verification.confidence=cached.confidence;
   if(documentType==='PhilHealth ID'&&verification.status==='unreadable'){verification.status='manual_review';verification.reason='OCR did not extract enough detail. Manual review required.'}
  }
 }
 if(verification.status==='unreadable'&&documentType!=='Barangay Residency Document'&&(verification.name||verification.dob||verification.documentNumber)){verification.status='manual_review';verification.confidence=Math.min(verification.confidence||0,.4);verification.reason='No readable address on the uploaded ID. Manual review required.'}
 if(verification.status==='unreadable')bad(verification.reason||'The uploaded document is unclear or does not contain a readable address.',422);
 const ocrDob=RegistrationAge.normalizeDob(verification.dob);
 const dobMismatch=!!ocrDob&&ocrDob!==dob;
 const vstatus='pending';
 const idNote=(verification.qrFound?' ID QR code was read (signature not verified by this system; confirm at verify.philsys.gov.ph).':'')+(verification.aiUsed?' AI-assisted reading was used.':'')+(verification.crossCheck==='mismatch'?' WARNING: QR data does not match the printed details.':'')+(dobMismatch?' OCR date of birth differs from the entered date; manual review required.':'');
 const vrem=documentType==='Barangay Residency Document'?`Residency document OCR result requires manual verification. ${verification.reason||''}`:(verification.status==='rejected'?'Address or barangay could not be verified from the uploaded ID. Manual review required.':'OCR result requires manual review.')+idNote;
 const proof=documentType==='Barangay Residency Document'?residence:(front);
 const uploaded=now();
 const id=Number(run("INSERT INTO users(name,email,pw,role,pos,brgy,phone,age,address,proof,dob,gender,custom_gender,document_type,upload_mode,id_front,id_back,residency_document,ocr_name,ocr_dob,ocr_address,ocr_barangay,ocr_text,ocr_status,ocr_confidence,vstatus,vrem,vat,document_uploaded_at,created,sex,civil_status,ocr_document_number,ocr_expiration_date,ocr_issue_date,ocr_field_confidence)  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  name,email,hashPw(pw),'res','Resident',brgy.id,phone,submittedAge.age,address,proof,dob,gender,customGender,documentType,uploadMode,
  documentType==='Barangay Residency Document'?null:front,documentType==='Barangay Residency Document'?null:(back||null),
  documentType==='Barangay Residency Document'?residence:null,verification.name||null,verification.dob||null,address,
  verification.barangay||null,verification.text||null,verification.status,verification.confidence||null,
  vstatus,vrem,null,uploaded,uploaded,sex,civilStatus||null,verification.documentNumber||null,verification.expirationDate||null,verification.issueDate||null,JSON.stringify(verification.fieldConfidence||{})).lastInsertRowid);
 all("SELECT id FROM users WHERE role='brgy' AND brgy=? AND active=1",brgy.id).forEach(o=>notify(o.id,null,`New resident verification request: ${name}. ${documentType} OCR needs review.`));
 startSession(res,req,id);log(id,'REGISTER','user',id,name+' registered for Brgy. '+brgy.name+' (pending human verification)');
 return okResp({ok:true,verification:{status:'manual_review',address:verification.address,reason:vrem}});
};
R['POST /api/resident/proof']=async(c)=>{const u=need(c.u,['res']);if(u.vstatus==='approved')bad('Your residency is already verified.');const address=sanitizeHtml(str(c.b.address,5,200,'Complete address'));const documentType=String(c.b.documentType||c.b.idType||u.document_type||'');const uploadMode=ID_REQUIREMENTS[documentType]?.uploadMode||'front';if(!DOCUMENT_TYPES.includes(documentType))bad('Please select a supported document type.');
 let proof,front=null,back=null,residence=null;
 if(documentType==='Barangay Residency Document'){proof=String(c.b.front||c.b.proof||'');residence=proof;if(!proof||!imageOk(proof)||!/^data:image\/(jpeg|png);base64,/i.test(proof))bad('Upload a clear JPG/PNG Barangay Residency Document under 5 MB.')}
 else{proof=String(c.b.front||c.b.proof||'');front=proof;if(!proof||!imageOk(proof)||!/^data:image\/(jpeg|png);base64,/i.test(proof))bad('Upload a clear JPG/PNG front image under 5 MB.');back=uploadMode==='back'?String(c.b.back||u.id_back||''):'';if(uploadMode==='back'&&(!back||!imageOk(back)||!/^data:image\/(jpeg|png);base64,/i.test(back)))bad('Upload a clear JPG/PNG back image for the Front and Back mode.')}
 const ocr=await ocrId(proof,documentType);if(ocr.status==='unreadable')bad(ocr.reason||'The document is unclear or unreadable.',422);
 const match=documentType==='Barangay Residency Document'?compareResidencyDocument(ocr.text||ocr.address||'',u.name,u.brgy?get('SELECT name FROM barangays WHERE id=?',u.brgy)?.name:''):null;
 run("UPDATE users SET proof=?,address=?,document_type=?,id_front=?,id_back=?,residency_document=?,ocr_name=?,ocr_dob=?,ocr_address=?,ocr_barangay=?,ocr_text=?,ocr_status=?,ocr_confidence=?,vstatus='pending',vrem=?,vat=NULL,document_uploaded_at=? WHERE id=?",proof,address,documentType,front,back,residence,ocr.name||null,ocr.dob||null,address,ocr.barangay||null,ocr.text||null,match?.status||'manual_review',ocr.confidence||null,match?.reason||'OCR result requires manual review.',now(),u.id);
 all("SELECT id FROM users WHERE role='brgy' AND brgy=? AND active=1",u.brgy).forEach(o=>notify(o.id,null,`${u.name} resubmitted a ${documentType} for verification.`));log(u.id,'RESUBMIT','user',u.id,u.name+' resubmitted residency document');return okResp({ok:true})};
R['POST /api/resident/review']=(c)=>{const u=need(c.u,['admin','brgy']),t=get("SELECT * FROM users WHERE id=? AND role='res'",Number(c.b.id));if(!t||(u.role==='brgy'&&t.brgy!==u.brgy))bad('Resident not found or access denied.',404);const d=c.b.d,rem=sanitizeHtml(str(c.b.rem||'',0,300,'Remarks'));if(!['approved','rejected'].includes(d))bad('Invalid decision.');if(d==='rejected'&&!rem)bad('Please provide a reason for rejection.');if(t.vstatus!=='pending')bad('This request was already reviewed.',409);run('UPDATE users SET vstatus=?,vrem=?,vat=? WHERE id=?',d,rem||null,now(),t.id);notify(t.id,null,d==='approved'?'Your residency has been verified. You can now submit reports.':'Your proof of residency was not accepted'+(rem?': '+rem:'.')+' Please upload a new proof.');log(u.id,d==='approved'?'APPROVE':'REJECT','resident',t.id,`${u.name} ${d} residency of ${t.name}`);return okResp({ok:true})};
R['POST /api/logout']=(c,req,res)=>{const t=cookie(req,'sid');if(t)run('DELETE FROM sessions WHERE tok=?',t);res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.setHeader('Set-Cookie','csrf_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return okResp({ok:true})};
R['POST /api/report/verify-image']=async(c)=>{
 const u=need(c.u,['res']);
 checkImageVerifyRate(u);
 if(!CATS.includes(c.b.cat))bad('Select a valid category.');
 if(!c.b.photo||!imageOk(c.b.photo))bad('Upload a clear JPG, PNG or WEBP main object image under 5 MB.');
 return okResp(await imageVerification.verifyForReport(c.b.cat,c.b.photo));
};
R['POST /api/report']=(c)=>{const u=need(c.u,['res']);if(u.vstatus!=='approved')bad(u.vstatus==='rejected'?'Your proof of residency was not accepted. Please upload a new proof first.':'Your residency is still waiting for verification by your barangay.',403);if(!CATS.includes(c.b.cat))bad('Select a valid category.');const lat=num(c.b.lat,-90,90,'Latitude'),lng=num(c.b.lng,-180,180,'Longitude');let brgy;if(c.b.brgy!==undefined&&c.b.brgy!==null&&c.b.brgy!==''){brgy=get('SELECT * FROM barangays WHERE id=? AND active=1',Number(c.b.brgy));if(!brgy)bad('Please select a valid barangay.')}else{const candidates=all('SELECT * FROM barangays WHERE active=1 AND name IN(?,?,?)',...ALLOW_BRGS);if(!candidates.length)bad('A barangay could not be determined for this location.');brgy=candidates.reduce((nearest,b)=>{const distance=(Number(b.lat)-lat)**2+(Number(b.lng)-lng)**2;return !nearest||distance<nearest.distance?{barangay:b,distance}:nearest},null).barangay}
// Validate that the location is within the resident's barangay boundary
const residentBrgy=get('SELECT * FROM barangays WHERE id=?',u.brgy);
if(residentBrgy && residentBrgy.polygon){
  const polygon=JSON.parse(residentBrgy.polygon);
  if(!pointInPolygon(lat,lng,polygon)){
    bad(`Report rejected. The selected location is outside Barangay ${residentBrgy.name}. Please select a location within your barangay boundary.`,400);
  }
}
const desc=sanitizeHtml(str(c.b.desc||'',0,2000,'Description')),loc=sanitizeHtml(str(c.b.loc||'',0,200,'Location description'));if(!c.b.photo||!imageOk(c.b.photo))bad('A Main Object Image is required. Upload a JPG, PNG or WEBP image under 5 MB.');if(!c.b.locationPhoto||!imageOk(c.b.locationPhoto))bad('A Location Image is required. Upload a JPG, PNG or WEBP image under 5 MB.');const customCategory=c.b.cat==='Other'?sanitizeHtml(str(c.b.customCategory||'',1,100,'Other category')):null;const ai=c.b.ai&&typeof c.b.ai==='object'?{status:String(c.b.ai.status||''),selectedCategory:String(c.b.ai.category||c.b.cat||''),predictedCategory:c.b.ai.predictedCategory?String(c.b.ai.predictedCategory):'',bestMatchDescription:c.b.ai.bestMatchDescription?String(c.b.ai.bestMatchDescription):'',similarityScore:Number.isFinite(Number(c.b.ai.score))?Number(c.b.ai.score):null,explanation:sanitizeHtml(str(c.b.ai.explanation||'',0,1000,'AI explanation')),modelName:String(c.b.ai.verificationMethod||'xenova'),analyzedAt:String(c.b.ai.analyzedAt||now())}:null;const r=createReport({uid:u.id,cat:c.b.cat,brgy:brgy.id,desc,photo:c.b.photo,locationPhoto:c.b.locationPhoto,loc,lat,lng,customCategory,ai});log(u.id,'CREATE','report',r.id,u.name+' submitted '+r.code);return okResp({id:r.id,code:r.code})};
R['POST /api/act']=(c)=>{const u=need(c.u,['admin','brgy']),r=getReport(u,c.b.id),s=c.b.s,rem=sanitizeHtml(str(c.b.rem||'',0,500,'Remarks'));const from={VERIFIED:['SUBMITTED','UNDER REVIEW'],REJECTED:OPEN,'IN PROGRESS':['VERIFIED','ASSIGNED']};if(!from[s])bad('Invalid action.');if(!from[s].includes(r.status))bad(s==='IN PROGRESS'?'Verify the report before marking it in progress.':`Cannot change status from ${r.status} to ${s}.`);if(s==='VERIFIED'){if(!r.photo)bad('A Main Object Image is required for verification. Upload a clear image before verifying this complaint.');if(!r.location_photo)bad('A Location Image is required for verification. Upload a clear image before verifying this complaint.')}if(s==='REJECTED'&&!rem)bad('Please provide a reason for rejection.');tx(()=>{setStatus(r,s,rem,u.id);log(u.id,'STATUS','report',r.id,`${u.name} changed ${r.code} from ${r.status} to ${s}`)});return okResp({ok:true})};
R['POST /api/assign']=(c)=>{const u=need(c.u,['admin','brgy']),r=getReport(u,c.b.id),to=String(c.b.to||'');if(!WORKABLE.includes(r.status))bad('Verify the report before assigning it.');const match=to.match(/^u(\d+)$/);if(!match)bad('Choose a barangay official.');const t=get('SELECT * FROM users WHERE id=? AND active=1 AND role=? AND brgy=?',Number(match[1]),'brgy',r.brgy);if(!t)bad('Choose an active official assigned to this barangay.');tx(()=>{run('UPDATE reports SET assignee=? WHERE id=?',t.id,r.id);notify(t.id,r.id,`Report ${r.code} assigned to you.`);setStatus(r,'ASSIGNED','Assigned to '+t.name,u.id);log(u.id,'ASSIGN','report',r.id,`${u.name} assigned ${r.code} to ${t.name}`)});return okResp({ok:true})};
R['POST /api/resolve']=(c)=>{const u=need(c.u,['admin','brgy']),r=getReport(u,c.b.id),rem=sanitizeHtml(str(c.b.rem,1,500,'Resolution remarks'));if(!WORKABLE.includes(r.status))bad('Only verified or in-progress reports can be resolved.');if(!c.b.img||!imageOk(c.b.img))bad('A valid resolution photo is required.');tx(()=>{run('INSERT INTO ev(rid,img,descr,who,at) VALUES(?,?,?,?,?)',r.id,c.b.img,rem,u.id,now());setStatus(r,'RESOLVED',rem,u.id);log(u.id,'STATUS','report',r.id,`${u.name} resolved ${r.code}`)});return okResp({ok:true})};
R['POST /api/notifs/read']=(c)=>{const u=need(c.u);if(c.b.id!==undefined){const id=Number(c.b.id);if(!Number.isSafeInteger(id)||id<1)bad('Invalid notification.');run('UPDATE notifs SET read=1 WHERE uid=? AND id=?',u.id,id)}else run('UPDATE notifs SET read=1 WHERE uid=?',u.id);return okResp({ok:true})};
R['POST /api/barangay/add']=(c)=>{const u=need(c.u,['admin']),n=str(c.b.name,1,80,'Name');if(get('SELECT id FROM barangays WHERE lower(name)=lower(?)',n))bad('Barangay already exists.',409);const id=Number(run('INSERT INTO barangays(name,address,contact,lat,lng) VALUES(?,?,?,?,?)',n,str(c.b.address||'',0,200,'Address'),str(c.b.contact||'',0,50,'Contact'),num(c.b.lat,-90,90,'Latitude'),num(c.b.lng,-180,180,'Longitude')).lastInsertRowid);log(u.id,'CREATE','barangay',id,'Added '+n);return okResp({ok:true,id})};
R['POST /api/barangay/toggle']=(c)=>{const u=need(c.u,['admin']),b=get('SELECT * FROM barangays WHERE id=?',Number(c.b.id));if(!b)bad('Not found.',404);run('UPDATE barangays SET active=? WHERE id=?',b.active?0:1,b.id);log(u.id,'UPDATE','barangay',b.id,u.name+(b.active?' deactivated ':' activated ')+b.name);return okResp({ok:true})};
R['POST /api/user/add']=(c)=>{const u=need(c.u,['admin']),b=c.b,name=str(b.name,1,100,'Full name'),email=str(b.email,3,254,'Email').toLowerCase(),pw=String(b.password||'');validatePassword(pw);if(!/^\S+@\S+\.\S+$/.test(email))bad('Valid email required.');if(get('SELECT id FROM users WHERE email=?',email))bad('Email exists.',409);if(b.role!=='brgy')bad('Invalid role.');const brgy=Number(b.brgy);if(!get('SELECT id FROM barangays WHERE id=?',brgy))bad('Select a barangay.');const id=Number(run('INSERT INTO users(name,email,pw,role,pos,brgy,phone,created) VALUES(?,?,?,?,?,?,?,?)',name,email,hashPw(pw),'brgy',str(b.pos||'Official',1,60,'Position'),brgy,str(b.phone||'',0,30,'Phone'),now()).lastInsertRowid);log(u.id,'CREATE','user',id,'Created barangay official '+name);return okResp({ok:true,id})};
R['POST /api/user/toggle']=(c)=>{const u=need(c.u,['admin']),t=get('SELECT * FROM users WHERE id=?',Number(c.b.id));if(!t)bad('Not found.',404);if(t.id===u.id)bad('You cannot deactivate your own account.');if(t.role==='admin'||t.protected)bad('Protected account cannot be changed.',403);const newActive=t.active?0:1;run('UPDATE users SET active=? WHERE id=?',newActive,t.id);if(t.active)run('DELETE FROM sessions WHERE uid=?',t.id);if(!t.active)run('UPDATE users SET last_activity=? WHERE id=?',now(),t.id);log(u.id,'UPDATE','user',t.id,(t.active?'Deactivated ':'Activated ')+t.name);return okResp({ok:true})};
R['POST /api/user/delete']=(c)=>{const u=need(c.u,['admin']),t=get('SELECT * FROM users WHERE id=?',Number(c.b.id));if(!t)bad('Not found.',404);if(t.id===u.id)bad('You cannot delete your own account.');if(t.role==='admin'||t.protected)bad('Protected account cannot be deleted.',403);const admin=get("SELECT id FROM users WHERE role='admin' AND id<>? LIMIT 1",t.id);const aid=admin?admin.id:u.id;tx(()=>{run('UPDATE reports SET uid=? WHERE uid=?',aid,t.id);run('UPDATE hist SET who=? WHERE who=?',aid,t.id);run('UPDATE ev SET who=? WHERE who=?',aid,t.id);run('DELETE FROM sessions WHERE uid=?',t.id);run('DELETE FROM notifs WHERE uid=?',t.id);run('DELETE FROM users WHERE id=?',t.id);log(u.id,'DELETE','user',t.id,'Deleted account '+t.name)});return okResp({ok:true})};
R['POST /api/user/unassign']=(c)=>{const u=need(c.u,['admin']),t=get('SELECT * FROM users WHERE id=? AND role=?',Number(c.b.id),'brgy');if(!t)bad('Not found.',404);run('UPDATE users SET brgy=NULL,active=0 WHERE id=?',t.id);run('DELETE FROM sessions WHERE uid=?',t.id);log(u.id,'UPDATE','user',t.id,'Removed '+t.name+' from barangay');return okResp({ok:true})};
R['GET /api/export/reports']=(c,req,res)=>{const u=need(c.u,['admin','brgy']);const {scope}=require('./reports');const [w,p]=scope(u);const rows=all(`SELECT id,code,cat,brgy,status,descr,loc,lat,lng,created,resolved,assignee,uid FROM reports WHERE ${w} ORDER BY id`,...p);const esc=v=>String(v===''||v===null?'':v).replace(/"/g,'""');const lines=['"id","code","category","barangay","status","description","location","lat","lng","created","resolved","assignee","resident_id"'];rows.forEach(r=>{lines.push([r.id,r.code,r.cat,r.brgy,r.status,r.descr,r.loc,r.lat,r.lng,r.created,r.resolved,r.assignee,r.uid].map(esc).join(','))});const csv=lines.join('\n');res.writeHead(200,{'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=reports.csv','Cache-Control':'no-store'});res.end(csv);return null};
R['GET /api/export/residents']=(c,req,res)=>{const u=need(c.u,['admin','brgy']);const {scope}=require('./reports');const [w,p]=scope(u);const extra=u.role==='admin'?'':` AND brgy=${u.brgy}`;const rows=all(`SELECT id,name,email,phone,age,address,brgy,vstatus,vrem,vat,created FROM users WHERE role='res'${extra} ORDER BY id`,...p);const esc=v=>String(v===''||v===null?'':v).replace(/"/g,'""');const lines=['"id","name","email","phone","age","address","barangay","vstatus","vrem","vat","created"'];rows.forEach(r=>{lines.push([r.id,r.name,r.email,r.phone,r.age,r.address,r.brgy,r.vstatus,r.vrem,r.vat,r.created].map(esc).join(','))});const csv=lines.join('\n');res.writeHead(200,{'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=residents.csv','Cache-Control':'no-store'});res.end(csv);return null};
R['POST /api/maintenance/toggle']=(c)=>{const u=need(c.u,['admin']);const f=require('path').join(__dirname,'..','.maintenance');const fs=require('fs');if(maint()){try{fs.unlinkSync(f)}catch(e){}log(u.id,'MAINTENANCE','system',0,'Maintenance mode disabled')}else{fs.writeFileSync(f,'');log(u.id,'MAINTENANCE','system',0,'Maintenance mode enabled')}return okResp({ok:true,maintenance:!maint()})};
module.exports={R};