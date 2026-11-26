'use strict';
const {all,get,run,tx,now,histAdd,notify}=require('./db');
const {bad}=require('./security');
const {MSG}=require('./config');
function createReport(d){return tx(()=>{
  const ai=d.ai||{};
  const id=Number(run(`INSERT INTO reports(uid,cat,brgy,descr,photo,location_photo,loc,lat,lng,status,created,custom_category,ai_status,ai_selected_cat,ai_predicted_cat,ai_best_match,ai_score,ai_explanation,ai_model,ai_analyzed_at) VALUES(?,?,?,?,?,?,?,?,?,'UNDER REVIEW',?,?,?,?,?,?,?,?,?,?)`,d.uid,d.cat,d.brgy,d.desc,d.photo||null,d.locationPhoto||null,d.loc||'',d.lat,d.lng,now(),d.customCategory||null,ai.status||null,ai.selectedCategory||null,ai.predictedCategory||null,ai.bestMatchDescription||null,ai.similarityScore==null?null:Number(ai.similarityScore),ai.explanation||null,ai.modelName||null,ai.analyzedAt||null).lastInsertRowid);
  const code='OF-'+new Date().getFullYear()+'-'+String(id).padStart(6,'0');run('UPDATE reports SET code=? WHERE id=?',code,id);
  histAdd(id,'UNDER REVIEW','Report submitted and awaiting official review',d.uid);
  return {id,code}})}
function setStatus(r,s,rem,who){run('UPDATE reports SET status=?,resolved=CASE WHEN ?=\'RESOLVED\' THEN ? ELSE resolved END WHERE id=?',s,s,now(),r.id);histAdd(r.id,s,rem,who);notify(r.uid,r.id,`${r.code}: ${MSG[s]||s}`)}
const scope=u=>u.role==='admin'?['1=1',[]]:u.role==='brgy'?['brgy=?',[u.brgy]]:['uid=?',[u.id]];
const RC='id,code,uid,cat,brgy,descr,loc,lat,lng,status,assignee,created,resolved,(photo IS NOT NULL AND photo<>\'\') AS ph,(location_photo IS NOT NULL AND location_photo<>\'\') AS location_ph,custom_category,ai_status,ai_selected_cat,ai_predicted_cat,ai_best_match,ai_score,ai_explanation,ai_model,ai_analyzed_at';
function getReport(u,id){const [w,p]=scope(u);const r=get(`SELECT * FROM reports WHERE id=? AND ${w}`,Number(id),...p);if(!r)bad('Report not found or access denied.',404);return r}
function shape(rows, opts){if(!rows.length)return[];const includeAi=!opts||opts.includeAi!==false;const ids=rows.map(r=>r.id),ph=ids.map(()=>'?').join(',');
  const grp=(sql)=>{const m={};all(sql,...ids).forEach(x=>(m[x.rid]=m[x.rid]||[]).push(x));return m};
  const H=grp(`SELECT rid,s,rem,who,at FROM hist WHERE rid IN(${ph}) AND s<>'AI ANALYZING' ORDER BY id`),E=grp(`SELECT id,rid,descr,who,at,(img IS NOT NULL AND img<>'') AS has FROM ev WHERE rid IN(${ph}) ORDER BY id`),F=all(`SELECT report_id,name FROM former_reporters WHERE report_id IN(${ph})`);
  const formerReporter=Object.fromEntries(F.map(x=>[x.report_id,x.name]));
  return rows.map(r=>{const o={id:r.id,code:r.code,uid:r.uid,cat:r.cat,brgy:r.brgy,desc:r.descr,photo:!!r.ph,locationPhoto:!!r.location_ph,customCategory:r.custom_category||'',loc:r.loc,lat:r.lat,lng:r.lng,status:r.status,assignee:r.assignee,created:r.created,resolved:r.resolved,formerReporter:formerReporter[r.id]||null,
   hist:(H[r.id]||[]).map(h=>({s:h.s,rem:h.rem,by:h.who,at:h.at})),ev:(E[r.id]||[]).map(e=>({id:e.id,desc:e.descr,by:e.who,at:e.at,img:!!e.has}))};
   if(includeAi)o.ai=r.ai_status?{status:r.ai_status,selectedCategory:r.ai_selected_cat||r.cat,predictedCategory:r.ai_predicted_cat||'',bestMatchDescription:r.ai_best_match||'',similarityScore:r.ai_score==null?null:Number(r.ai_score),explanation:r.ai_explanation||'',modelName:r.ai_model||'',analyzedAt:r.ai_analyzed_at||''}:null;
   return o})}
const pub=x=>({id:x.id,name:x.name,role:x.role,pos:x.pos,brgy:x.brgy,active:!!x.active,vstatus:x.role==='res'?x.vstatus:undefined});
const RESQ="SELECT id,name,email,phone,age,address,brgy,vstatus,vrem,vat,created,document_type,upload_mode,id_front,id_back,residency_document,ocr_name,ocr_dob,ocr_address,ocr_barangay,ocr_text,ocr_status,ocr_confidence,document_uploaded_at,ocr_document_number,ocr_expiration_date,ocr_issue_date,ocr_field_confidence,((proof IS NOT NULL AND proof<>'') OR (id_front IS NOT NULL AND id_front<>'') OR (id_back IS NOT NULL AND id_back<>'') OR (residency_document IS NOT NULL AND residency_document<>'')) AS hasproof FROM users WHERE role='res'";
function state(u){const S={barangays:all('SELECT * FROM barangays ORDER BY id').map(b=>({...b,active:!!b.active})),users:[],residents:[],reports:[],notifs:[],logs:[],formerOfficials:{}};
  if(!u)return{me:null,S};
  const [w,p]=scope(u);S.reports=shape(all(`SELECT ${RC} FROM reports WHERE ${w} ORDER BY id`,...p),{includeAi:u.role!=='res'});
  const m=new Map();all("SELECT * FROM users WHERE role='brgy'").forEach(x=>m.set(x.id,pub(x)));
  if(u.role==='admin')all('SELECT * FROM users ORDER BY id').forEach(x=>m.set(x.id,{...pub(x),email:x.email,phone:x.phone,created:x.created,lastActivity:x.last_activity,protected:!!x.protected}));
  else{if(u.role!=='res')S.reports.forEach(r=>{if(!m.has(r.uid)){const x=get('SELECT * FROM users WHERE id=?',r.uid);if(x)m.set(x.id,pub(x))}});m.set(u.id,{...pub(u),email:u.email,phone:u.phone,created:u.created,age:u.age,address:u.address,vrem:u.vrem})}
  S.users=[...m.values()];
  S.notifs=all('SELECT id,uid,rid,msg,read,at FROM notifs WHERE uid=? ORDER BY id DESC LIMIT 100',u.id).map(n=>({...n,read:!!n.read}));
  if(u.role==='admin'||u.role==='brgy'){S.residents=(u.role==='admin'?all(RESQ+' ORDER BY id DESC'):all(RESQ+' AND brgy=? ORDER BY id DESC',u.brgy)).map(x=>({...x,hasproof:!!x.hasproof}))}
  if(u.role==='admin')S.logs=all('SELECT u,a,e,eid AS id,dsc,at FROM logs ORDER BY id DESC LIMIT 200');
  const formerIds=new Set(S.reports.reduce((ids,r)=>ids.concat(r.hist.map(h=>h.by),r.ev.map(e=>e.by)),[]).filter(id=>id<0));
  if(u.role==='admin')S.logs.forEach(x=>{if(x.u<0)formerIds.add(x.u)});
  if(formerIds.size)S.formerOfficials=all(`SELECT id,name FROM former_officials WHERE id IN(${[...formerIds].map(()=>'?').join(',')})`,...[...formerIds]).reduce((out,x)=>(out[x.id]={name:x.name},out),{});
  return{me:u.id,S}}
module.exports={createReport,setStatus,scope,RC,getReport,shape,pub,state};
