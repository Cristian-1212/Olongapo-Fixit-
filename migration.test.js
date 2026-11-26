'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');

const file=path.join(os.tmpdir(),`olongapo-fixit-migration-${process.pid}.db`);
process.env.DB_FILE=file;
let db;
try{
  db=new (require('node:sqlite').DatabaseSync)(file);
  db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE barangays(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,address TEXT,contact TEXT,lat REAL NOT NULL,lng REAL NOT NULL,active INTEGER DEFAULT 1,polygon TEXT);
  CREATE TABLE depts(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1);
  CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,pw TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('admin','brgy','city','res')),pos TEXT,brgy INTEGER REFERENCES barangays(id),dept INTEGER REFERENCES depts(id),phone TEXT,active INTEGER DEFAULT 1,created TEXT);
  CREATE TABLE reports(id INTEGER PRIMARY KEY,code TEXT UNIQUE,uid INTEGER NOT NULL REFERENCES users(id),cat TEXT NOT NULL,brgy INTEGER NOT NULL REFERENCES barangays(id),descr TEXT NOT NULL,photo TEXT,location_photo TEXT,loc TEXT,lat REAL,lng REAL,status TEXT NOT NULL,assignee INTEGER REFERENCES users(id),dept INTEGER REFERENCES depts(id),created TEXT,resolved TEXT,custom_category TEXT);
  CREATE TABLE hist(id INTEGER PRIMARY KEY,rid INTEGER NOT NULL REFERENCES reports(id),s TEXT,rem TEXT,who INTEGER,at TEXT);
  CREATE TABLE ev(id INTEGER PRIMARY KEY,rid INTEGER NOT NULL REFERENCES reports(id),img TEXT,descr TEXT,who INTEGER,at TEXT);
  CREATE TABLE notifs(id INTEGER PRIMARY KEY,uid INTEGER NOT NULL,rid INTEGER,msg TEXT,read INTEGER DEFAULT 0,at TEXT);
  CREATE TABLE logs(id INTEGER PRIMARY KEY,u INTEGER,a TEXT,e TEXT,eid TEXT,dsc TEXT,at TEXT);
  CREATE TABLE sessions(tok TEXT PRIMARY KEY,uid INTEGER NOT NULL,exp INTEGER NOT NULL);
  INSERT INTO barangays VALUES(1,'Pag-asa','address','contact',14.8,120.2,1,NULL);
  INSERT INTO depts VALUES(1,'City Engineering Office',1);
  INSERT INTO users(id,name,email,pw,role,pos,brgy,dept,phone,active,created) VALUES
   (1,'Admin','admin@example.test','hash','admin','System Admin',NULL,NULL,'',1,'2026-01-01'),
   (2,'Barangay Official','brgy@example.test','hash','brgy','Captain',1,NULL,'',1,'2026-01-01'),
   (3,'Resident','resident@example.test','hash','res','Resident',1,NULL,'',1,'2026-01-01'),
   (4,'Former City Official','city@example.test','hash','city','Engineer',NULL,1,'',1,'2026-01-01');
  INSERT INTO reports(id,code,uid,cat,brgy,descr,status,assignee,dept,created) VALUES
   (1,'OF-2026-000001',3,'Pothole',1,'Assigned report','ASSIGNED',4,1,'2026-01-01'),
   (2,'OF-2026-000002',4,'Drainage',1,'City-authored report','UNDER REVIEW',NULL,NULL,'2026-01-01');
  INSERT INTO hist(rid,s,rem,who,at) VALUES(1,'ASSIGNED','Assigned to city official',4,'2026-01-01');
  INSERT INTO sessions(tok,uid,exp) VALUES('retired-session',4,9999999999999);
  INSERT INTO notifs(uid,rid,msg,at) VALUES(4,1,'Assignment notice','2026-01-01');`);
  db.close();db=null;

  const migrated=require('./src/db');
  db=migrated.db;
  assert.equal(migrated.get("SELECT id FROM users WHERE role='city'"),undefined,'legacy City Official accounts are removed');
  assert.equal(migrated.get("SELECT id FROM users WHERE role='admin'").id,1,'Super Admin is preserved');
  assert.equal(migrated.get("SELECT id FROM users WHERE role='brgy'").id,2,'Barangay Official is preserved');
  assert.equal(migrated.get("SELECT id FROM users WHERE role='res'").id,3,'Resident is preserved');
  assert.equal(migrated.get('SELECT COUNT(*) AS n FROM sessions').n,0,'retired account sessions are revoked');
  assert.equal(migrated.get('SELECT COUNT(*) AS n FROM notifs WHERE uid=4').n,0,'retired account notifications are removed');
  assert.equal(migrated.get('SELECT COUNT(*) AS n FROM notifs WHERE uid=3').n,1,'complaint owner is notified when assignment returns to the barangay queue');
  assert.equal(migrated.get("SELECT name FROM sqlite_master WHERE type='table' AND name='depts'"),undefined,'legacy department table is removed');
  assert(!migrated.db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='dept'),'department relationship is removed from users');
  assert(!migrated.db.prepare('PRAGMA table_info(reports)').all().some(c=>c.name==='dept'),'department relationship is removed from complaints');
  assert.equal(migrated.all('PRAGMA foreign_key_check').length,0,'foreign-key relationships remain valid');
  const assigned=migrated.get('SELECT status,assignee FROM reports WHERE id=1');
  assert.deepEqual(assigned,{status:'VERIFIED',assignee:null},'department-assigned report returns to the barangay queue');
  assert.equal(migrated.get('SELECT uid FROM reports WHERE id=2').uid,1,'city-authored complaint is preserved under the Super Admin');
  assert.equal(migrated.get('SELECT who FROM hist WHERE rid=1 ORDER BY id DESC LIMIT 1').who,0,'reassignment is recorded as a system event');
  assert.equal(migrated.get('SELECT name FROM former_officials WHERE id=-4').name,'Former City Official','historical actor identity is retained under a non-reusable ID');
  assert.equal(migrated.get('SELECT who FROM hist WHERE rid=1 ORDER BY id LIMIT 1').who,-4,'existing history retains the former official identity');
  assert.equal(migrated.get('SELECT name FROM former_reporters WHERE report_id=2').name,'Former City Official','complaint reporter attribution is retained');
  assert.throws(()=>migrated.run("INSERT INTO users(name,email,pw,role) VALUES('No','no@example.test','hash','city')"),/City Official accounts are no longer supported/,'new City Official accounts are blocked');
  assert.throws(()=>migrated.run("UPDATE users SET role='city' WHERE id=2"),/City Official accounts are no longer supported/,'role reassignment to City Official is blocked');
  console.log('Legacy City Official migration passed.');
}finally{
  if(db)db.close();
  for(const suffix of ['','-wal','-shm'])try{fs.unlinkSync(file+suffix)}catch(e){}
}
