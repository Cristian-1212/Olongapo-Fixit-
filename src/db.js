'use strict';
const path=require('path');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.env.DB_FILE||path.join(__dirname,'..','fixit.db'));
db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS barangays(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,address TEXT,contact TEXT,lat REAL NOT NULL,lng REAL NOT NULL,active INTEGER DEFAULT 1,polygon TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pw TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('admin','brgy','res')),pos TEXT,brgy INTEGER REFERENCES barangays(id),phone TEXT,active INTEGER DEFAULT 1,created TEXT,age INTEGER,address TEXT,proof TEXT,vstatus TEXT DEFAULT 'approved',vrem TEXT,vat TEXT,ocr_text TEXT,ocr_address TEXT,ocr_status TEXT,ocr_confidence REAL,custom_gender TEXT,document_type TEXT,upload_mode TEXT,id_front TEXT,id_back TEXT,residency_document TEXT,ocr_name TEXT,ocr_dob TEXT,ocr_barangay TEXT,document_uploaded_at TEXT,ocr_document_number TEXT,ocr_expiration_date TEXT,ocr_issue_date TEXT,ocr_field_confidence TEXT,sex TEXT,civil_status TEXT);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,code TEXT UNIQUE,uid INTEGER NOT NULL REFERENCES users(id),cat TEXT NOT NULL,brgy INTEGER NOT NULL REFERENCES barangays(id),descr TEXT NOT NULL,photo TEXT,location_photo TEXT,loc TEXT,lat REAL,lng REAL,status TEXT NOT NULL,assignee INTEGER REFERENCES users(id),created TEXT,resolved TEXT,custom_category TEXT);
CREATE TABLE IF NOT EXISTS hist(id INTEGER PRIMARY KEY,rid INTEGER NOT NULL REFERENCES reports(id),s TEXT,rem TEXT,who INTEGER,at TEXT);
CREATE TABLE IF NOT EXISTS ev(id INTEGER PRIMARY KEY,rid INTEGER NOT NULL REFERENCES reports(id),img TEXT,descr TEXT,who INTEGER,at TEXT);
CREATE TABLE IF NOT EXISTS notifs(id INTEGER PRIMARY KEY,uid INTEGER NOT NULL,rid INTEGER,msg TEXT,read INTEGER DEFAULT 0,at TEXT);
CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY,u INTEGER,a TEXT,e TEXT,eid TEXT,dsc TEXT,at TEXT);
CREATE TABLE IF NOT EXISTS sessions(tok TEXT PRIMARY KEY,uid INTEGER NOT NULL,exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS former_officials(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS former_reporters(report_id INTEGER PRIMARY KEY REFERENCES reports(id),name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_services(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,requirements TEXT NOT NULL,fee TEXT NOT NULL,office_hours TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_topic_stats(topic TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS chat_feedback_stats(topic TEXT NOT NULL,vote TEXT NOT NULL CHECK(vote IN('up','down')),count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(topic,vote));
CREATE INDEX IF NOT EXISTS ix_r_b ON reports(brgy);CREATE INDEX IF NOT EXISTS ix_r_u ON reports(uid);CREATE INDEX IF NOT EXISTS ix_sessions_exp ON sessions(exp);CREATE INDEX IF NOT EXISTS ix_reports_created ON reports(created);CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status);CREATE INDEX IF NOT EXISTS ix_notifs_uid ON notifs(uid);CREATE INDEX IF NOT EXISTS ix_hist_rid ON hist(rid);CREATE INDEX IF NOT EXISTS ix_logs_at ON logs(at);CREATE INDEX IF NOT EXISTS ix_reports_cat ON reports(cat);CREATE INDEX IF NOT EXISTS ix_reports_uid_status ON reports(uid,status);CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);CREATE INDEX IF NOT EXISTS ix_users_role_brgy ON users(role,brgy);CREATE INDEX IF NOT EXISTS ix_ev_rid ON ev(rid);CREATE INDEX IF NOT EXISTS ix_notifs_uid_read ON notifs(uid,read);DROP INDEX IF EXISTS ix_users_role_dept;`);
db.exec("UPDATE reports SET status='UNDER REVIEW' WHERE status='AI ANALYZING'");
{const have=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
  [['age','INTEGER'],['address','TEXT'],['proof','TEXT'],['dob','TEXT'],['gender','TEXT'],['sex','TEXT'],['civil_status','TEXT'],['failed_attempts','INTEGER DEFAULT 0'],['locked_until','INTEGER'],['vstatus',"TEXT DEFAULT 'approved'"],['vrem','TEXT'],['vat','TEXT'],['ocr_text','TEXT'],['ocr_address','TEXT'],['ocr_status','TEXT'],['ocr_confidence','REAL'],['custom_gender','TEXT'],['document_type','TEXT'],['upload_mode','TEXT'],['id_front','TEXT'],['id_back','TEXT'],['residency_document','TEXT'],['ocr_name','TEXT'],['ocr_dob','TEXT'],['ocr_barangay','TEXT'],['document_uploaded_at','TEXT'],['ocr_document_number','TEXT'],['ocr_expiration_date','TEXT'],['ocr_issue_date','TEXT'],['ocr_field_confidence','TEXT'],['last_activity','TEXT'],['protected','INTEGER DEFAULT 0']].forEach(([n,t])=>{if(!have.includes(n))db.exec(`ALTER TABLE users ADD COLUMN ${n} ${t}`)})}
db.exec("UPDATE users SET last_activity=COALESCE(last_activity, created, '" + new Date().toISOString() + "') WHERE last_activity IS NULL");
{const have=db.prepare('PRAGMA table_info(reports)').all().map(c=>c.name);
  [['ai_status','TEXT'],['ai_selected_cat','TEXT'],['ai_predicted_cat','TEXT'],['ai_best_match','TEXT'],['ai_score','REAL'],['ai_explanation','TEXT'],['ai_model','TEXT'],['ai_analyzed_at','TEXT'],['location_photo','TEXT'],['custom_category','TEXT']].forEach(([n,t])=>{if(!have.includes(n))db.exec(`ALTER TABLE reports ADD COLUMN ${n} ${t}`)})}
{const have=db.prepare('PRAGMA table_info(barangays)').all().map(c=>c.name);
  if(!have.includes('polygon'))db.exec('ALTER TABLE barangays ADD COLUMN polygon TEXT');}
const nn=v=>v===undefined?null:v;
const all=(s,...p)=>db.prepare(s).all(...p.map(nn)),get=(s,...p)=>db.prepare(s).get(...p.map(nn)),run=(s,...p)=>db.prepare(s).run(...p.map(nn));
const count=(s,...p)=>{const r=db.prepare(s).get(...p.map(nn));return r?Number(Object.values(r)[0]):0};
const paginate=(s,countSql,limit,offset,...p)=>{const rows=all(s,...p.map(nn),limit,offset);const total=count(countSql,...p.map(nn));return{rows,total,limit,offset}};
let depth=0;const tx=f=>{if(depth){return f()}depth=1;db.exec('BEGIN');try{const r=f();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}finally{depth=0}};
const now=()=>new Date().toISOString();
function log(u,a,e,eid,dsc){run('INSERT INTO logs(u,a,e,eid,dsc,at) VALUES(?,?,?,?,?,?)',u,a,e,String(eid),dsc,now())}
function notify(uid,rid,msg){if(uid)run('INSERT INTO notifs(uid,rid,msg,at) VALUES(?,?,?,?)',uid,rid,msg,now())}
function histAdd(rid,s,rem,who){run('INSERT INTO hist(rid,s,rem,who,at) VALUES(?,?,?,?,?)',rid,s,rem,who,now())}
{
  const userColumns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
  const reportColumns=db.prepare('PRAGMA table_info(reports)').all().map(c=>c.name);
  const userHasDept=userColumns.includes('dept'),reportHasDept=reportColumns.includes('dept');
  const deptTable=!!get("SELECT name FROM sqlite_master WHERE type='table' AND name='depts'");
  const former=all("SELECT id,name FROM users WHERE role='city'");
  const ids=former.map(x=>x.id),placeholders=ids.map(()=>'?').join(',');
  const ownership=ids.length?all(`SELECT id FROM reports WHERE uid IN(${placeholders})`,...ids):[];
  const authorRecords=ids.length?all(`SELECT r.id,u.name FROM reports r JOIN users u ON u.id=r.uid WHERE r.uid IN(${placeholders})`,...ids):[];
  const admin=get("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  if(ownership.length&&!admin)throw new Error('Cannot retire city-official accounts while their complaint records have no Super Admin to preserve them under.');
  const assignmentFilters=[];
  if(reportHasDept)assignmentFilters.push('dept IS NOT NULL');
  if(ids.length)assignmentFilters.push(`assignee IN(${placeholders})`);
  const assigned=assignmentFilters.length?all(`SELECT id,uid,code,status FROM reports WHERE ${assignmentFilters.join(' OR ')}`,...ids):[];
  const legacySchema=userHasDept||reportHasDept||deptTable;
  if(legacySchema)db.exec('PRAGMA foreign_keys=OFF');
  try{
    tx(()=>{
      former.forEach(x=>{
        const historicalId=-Math.abs(x.id);
        run('INSERT INTO former_officials(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',historicalId,x.name);
        run('UPDATE hist SET who=? WHERE who=?',historicalId,x.id);
        run('UPDATE ev SET who=? WHERE who=?',historicalId,x.id);
        run('UPDATE logs SET u=? WHERE u=?',historicalId,x.id);
      });
      authorRecords.forEach(x=>run('INSERT INTO former_reporters(report_id,name) VALUES(?,?) ON CONFLICT(report_id) DO UPDATE SET name=excluded.name',x.id,x.name));
      if(ids.length){
        run(`DELETE FROM sessions WHERE uid IN(${placeholders})`,...ids);
        run(`DELETE FROM notifs WHERE uid IN(${placeholders})`,...ids);
        if(ownership.length)run(`UPDATE reports SET uid=? WHERE uid IN(${placeholders})`,admin.id,...ids);
      }
      if(assigned.length){
        const clear=['assignee=NULL'];if(reportHasDept)clear.push('dept=NULL');
        run(`UPDATE reports SET ${clear.join(',')} WHERE ${assignmentFilters.join(' OR ')}`,...ids);
        assigned.filter(r=>r.status==='ASSIGNED').forEach(r=>{
          run("UPDATE reports SET status='VERIFIED' WHERE id=?",r.id);
          histAdd(r.id,'VERIFIED','Returned to the barangay queue after department assignment was removed.',0);
          const owner=get('SELECT uid FROM reports WHERE id=?',r.id);
          notify(owner.uid,r.id,`${r.code}: Returned to the barangay queue for review.`);
        });
      }
      if(ids.length)run("DELETE FROM users WHERE role='city'");
      if(userHasDept){
        db.exec(`CREATE TABLE users_new(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pw TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('admin','brgy','res')),pos TEXT,brgy INTEGER REFERENCES barangays(id),phone TEXT,active INTEGER DEFAULT 1,created TEXT,age INTEGER,address TEXT,proof TEXT,vstatus TEXT DEFAULT 'approved',vrem TEXT,vat TEXT,ocr_text TEXT,ocr_address TEXT,ocr_status TEXT,ocr_confidence REAL,custom_gender TEXT,document_type TEXT,upload_mode TEXT,id_front TEXT,id_back TEXT,residency_document TEXT,ocr_name TEXT,ocr_dob TEXT,ocr_barangay TEXT,document_uploaded_at TEXT,ocr_document_number TEXT,ocr_expiration_date TEXT,ocr_issue_date TEXT,ocr_field_confidence TEXT,sex TEXT,civil_status TEXT,dob TEXT,gender TEXT,failed_attempts INTEGER DEFAULT 0,locked_until INTEGER,last_activity TEXT,protected INTEGER DEFAULT 0);
        INSERT INTO users_new(id,name,email,pw,role,pos,brgy,phone,active,created,age,address,proof,vstatus,vrem,vat,ocr_text,ocr_address,ocr_status,ocr_confidence,custom_gender,document_type,upload_mode,id_front,id_back,residency_document,ocr_name,ocr_dob,ocr_barangay,document_uploaded_at,ocr_document_number,ocr_expiration_date,ocr_issue_date,ocr_field_confidence,sex,civil_status,dob,gender,failed_attempts,locked_until,last_activity,protected)
        SELECT id,name,email,pw,role,pos,brgy,phone,active,created,age,address,proof,vstatus,vrem,vat,ocr_text,ocr_address,ocr_status,ocr_confidence,custom_gender,document_type,upload_mode,id_front,id_back,residency_document,ocr_name,ocr_dob,ocr_barangay,document_uploaded_at,ocr_document_number,ocr_expiration_date,ocr_issue_date,ocr_field_confidence,sex,civil_status,dob,gender,failed_attempts,locked_until,last_activity,protected FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;`);
      }
      if(reportHasDept){
        db.exec(`CREATE TABLE reports_new(id INTEGER PRIMARY KEY,code TEXT UNIQUE,uid INTEGER NOT NULL REFERENCES users(id),cat TEXT NOT NULL,brgy INTEGER NOT NULL REFERENCES barangays(id),descr TEXT NOT NULL,photo TEXT,location_photo TEXT,loc TEXT,lat REAL,lng REAL,status TEXT NOT NULL,assignee INTEGER REFERENCES users(id),created TEXT,resolved TEXT,custom_category TEXT,ai_status TEXT,ai_selected_cat TEXT,ai_predicted_cat TEXT,ai_best_match TEXT,ai_score REAL,ai_explanation TEXT,ai_model TEXT,ai_analyzed_at TEXT);
        INSERT INTO reports_new(id,code,uid,cat,brgy,descr,photo,location_photo,loc,lat,lng,status,assignee,created,resolved,custom_category,ai_status,ai_selected_cat,ai_predicted_cat,ai_best_match,ai_score,ai_explanation,ai_model,ai_analyzed_at)
        SELECT id,code,uid,cat,brgy,descr,photo,location_photo,loc,lat,lng,status,assignee,created,resolved,custom_category,ai_status,ai_selected_cat,ai_predicted_cat,ai_best_match,ai_score,ai_explanation,ai_model,ai_analyzed_at FROM reports;
        DROP TABLE reports;
        ALTER TABLE reports_new RENAME TO reports;`);
      }
      if(deptTable)db.exec('DROP TABLE depts');
    });
  }finally{if(legacySchema)db.exec('PRAGMA foreign_keys=ON')}
}
db.exec(`CREATE INDEX IF NOT EXISTS ix_r_b ON reports(brgy);CREATE INDEX IF NOT EXISTS ix_r_u ON reports(uid);CREATE INDEX IF NOT EXISTS ix_sessions_exp ON sessions(exp);CREATE INDEX IF NOT EXISTS ix_reports_created ON reports(created);CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status);CREATE INDEX IF NOT EXISTS ix_notifs_uid ON notifs(uid);CREATE INDEX IF NOT EXISTS ix_hist_rid ON hist(rid);CREATE INDEX IF NOT EXISTS ix_logs_at ON logs(at);CREATE INDEX IF NOT EXISTS ix_reports_cat ON reports(cat);CREATE INDEX IF NOT EXISTS ix_reports_uid_status ON reports(uid,status);CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);CREATE INDEX IF NOT EXISTS ix_users_role_brgy ON users(role,brgy);CREATE INDEX IF NOT EXISTS ix_ev_rid ON ev(rid);CREATE INDEX IF NOT EXISTS ix_notifs_uid_read ON notifs(uid,read);DROP INDEX IF EXISTS ix_users_role_dept;`);
const fkViolations=all('PRAGMA foreign_key_check');
if(fkViolations.length)throw new Error('Database migration produced invalid foreign-key references.');
db.exec(`CREATE TRIGGER IF NOT EXISTS users_no_city_role_insert BEFORE INSERT ON users WHEN NEW.role='city' BEGIN SELECT RAISE(ABORT,'City Official accounts are no longer supported'); END;
CREATE TRIGGER IF NOT EXISTS users_no_city_role_update BEFORE UPDATE OF role ON users WHEN NEW.role='city' BEGIN SELECT RAISE(ABORT,'City Official accounts are no longer supported'); END;`);
module.exports={db,nn,all,get,run,tx,now,count,paginate,log,notify,histAdd};
