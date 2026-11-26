'use strict';
/* Parses the data decoded from a PhilID / ePhilID QR code.
   NOTE: this only READS the QR payload. It does NOT verify the PSA digital signature
   (signatureVerified is always false). Officials should confirm authenticity with the
   official PhilSys Check website (verify.philsys.gov.ph). */
const {parseDateLoose}=require('./addressVerification');

function pick(obj,names){
  if(!obj||typeof obj!=='object')return '';
  const map={};
  for(const k of Object.keys(obj))map[k.toLowerCase().replace(/[^a-z]/g,'')]=obj[k];
  for(const n of names){
    const v=map[n];
    if(v!==undefined&&v!==null&&typeof v!=='object')return String(v).trim();
  }
  return '';
}
const clean=v=>String(v||'').replace(/[<>`]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
const titleCase=v=>clean(v).toLowerCase().replace(/(^|[\s\-'])([a-zñ])/g,(_,a,b)=>a+b.toUpperCase());

const b64=t=>{try{return Buffer.from(String(t).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch(_){return ''}};
const NAME_KEYS=['lname','lastname','surname','familyname','fname','firstname','givenname','givennames','pcn','philsysnumber','psn'];
const hasNameKey=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).some(k=>NAME_KEYS.includes(k.toLowerCase().replace(/[^a-z]/g,'')));

/* Try several encodings: plain JSON, JSON inside text, base64/base64url JSON, JWT-style (header.payload.signature). */
function decodeToObject(raw){
  const t=String(raw||'').trim();
  const candidates=[t];
  const parts=t.split('.');
  if(parts.length===3)candidates.push(b64(parts[1]));
  candidates.push(b64(t));
  for(const c of candidates){
    if(!c)continue;
    try{const o=JSON.parse(c);if(o&&typeof o==='object')return o}catch(_){}
    const m=c.match(/\{[\s\S]*\}/);
    if(m){try{const o=JSON.parse(m[0]);if(o&&typeof o==='object')return o}catch(_){}}
  }
  return null;
}

function findSubject(o,depth){
  if(!o||typeof o!=='object'||depth>4)return null;
  if(hasNameKey(o))return o;
  for(const v of (Array.isArray(o)?o:Object.values(o))){
    const r=findSubject(v,depth+1);
    if(r)return r;
  }
  return null;
}

/* Safe description for server logs: field NAMES only, never values. */
function qrShape(raw){
  if(typeof raw!=='string'||!raw)return 'none';
  const o=decodeToObject(raw);
  if(!o)return `not JSON/base64-JSON (${raw.length} chars, looks like ${/^https?:\/\//i.test(raw)?'a web link':/^[A-Za-z0-9+/=_.-]+$/.test(raw)?'encoded text':'plain text'})`;
  const top=Object.keys(o);
  const sub=findSubject(o,0);
  return `JSON keys=[${top.join(',')}]${sub&&sub!==o?` subject keys=[${Object.keys(sub).join(',')}]`:''}`;
}

function parsePhilIdQr(raw){
  if(typeof raw!=='string'||!raw.trim()||raw.length>6000)return null;
  const data=decodeToObject(raw);
  if(!data||Array.isArray(data))return null;
  const subject=findSubject(data,0);
  if(!subject)return null; // not a PhilSys-style QR
  const surname=titleCase(pick(subject,['lname','lastname','surname','familyname']));
  const firstName=titleCase(pick(subject,['fname','firstname','givenname','givennames']));
  const middleName=titleCase(pick(subject,['mname','middlename']));
  const suffix=titleCase(pick(subject,['suffix']));
  const digits=pick(subject,['pcn','philsysnumber','psn']).replace(/\D/g,'');
  if(!surname&&!firstName&&!digits)return null;
  const dobRaw=pick(subject,['dob','dateofbirth','birthdate']);
  const sexRaw=pick(subject,['sex','gender']);
  return{
    fullName:[firstName,middleName,surname,suffix].filter(Boolean).join(' '),
    surname,firstName,middleName,suffix,
    dob:dobRaw?parseDateLoose(dobRaw):null,
    sex:/^\s*m/i.test(sexRaw)?'Male':/^\s*f/i.test(sexRaw)?'Female':'',
    documentNumber:digits.length===16?digits.match(/.{4}/g).join('-'):digits,
    placeOfBirth:clean(pick(subject,['pob','placeofbirth'])),
    issued:clean(pick(data,['dateissued','issued'])),
    issuer:clean(pick(data,['issuer'])),
    signaturePresent:!!(data.signature||data.sig||data.proof),
    signatureVerified:false
  };
}
module.exports={parsePhilIdQr,qrShape};
