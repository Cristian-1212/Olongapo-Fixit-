'use strict';
const crypto=require('crypto');
const path=require('path');
const fs=require('fs');
const RegistrationAge=require('../public/js/registrationAge');
let sharp=null;
try{sharp=require('sharp')}catch(_){sharp=null}

function normalizeText(text){
  return String(text||'').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim();
}

const DOCUMENT_PROFILES={
 'Philippine National ID (PhilID/ePhilID)':{nameLabels:['last name','surname','first name','given name','middle name','suffix','full name'],addressLabels:['address','permanent address','residence'],dateLabels:['date of birth','birth date','dob'],numberLabels:['pcn','philsys card number'],optional:['expirationDate','issueDate']},
 'PhilHealth ID':{nameLabels:['member name','full name','name','member'],addressLabels:['address','residence'],dateLabels:['date of birth','birth date','dob'],numberLabels:['philhealth identification number','philhealth number','pin'],optional:['address','dateOfBirth','expirationDate','issueDate']},
 'UMID':{nameLabels:['surname','given name','middle name','full name','name'],addressLabels:['address','residence','permanent address'],dateLabels:['date of birth','birth date','dob'],numberLabels:['crn','common reference number','sss','gsis'],optional:['address','expirationDate','issueDate']},
 "Philippine Driver's License":{nameLabels:['last name','surname','first name','given name','middle name','full name','name'],addressLabels:['address','residence'],dateLabels:['date of birth','birth date','dob'],numberLabels:['license no','license number'],expirationLabels:['valid until','expiry date','expiration date'],optional:['issueDate']},
 'Philippine Passport':{nameLabels:['surname','given names','given name','full name','name'],addressLabels:['place of birth'],dateLabels:['date of birth','birth date','dob'],numberLabels:['passport no','passport number'],issueLabels:['date of issue'],expirationLabels:['date of expiry','expiry date','expiration date'],optional:['address','barangay','cityMunicipality','province']},
 'Postal ID':{nameLabels:['full name','name'],addressLabels:['address','registered address','residence'],dateLabels:['date of birth','birth date','dob'],numberLabels:['postal id','postal id number','id number'],expirationLabels:['valid until','expiry date','expiration date'],optional:['sex','issueDate']},
 "Voter's ID":{nameLabels:['registered name','full name','name'],addressLabels:['registered address','address','residence','barangay','brgy'],dateLabels:['date of birth','birth date','dob'],numberLabels:['voter id','voter id number','precinct no','precinct number'],optional:['issueDate','expirationDate']},
 'Barangay Residency Document':{nameLabels:['resident','name','full name','this is to certify'],addressLabels:['address','residence','residing at','residence address'],barangayLabels:['barangay','brgy'],dateLabels:['date of birth','birth date','dob'],issueLabels:['date issued','issued this'],numberLabels:['certificate no','certificate number','reference no'],optional:['dateOfBirth','documentNumber','issueDate']}
};

function extractAddress(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const label=/^(?:address|residence|permanent address|residential address|barangay|brgy)[\s:.\-]*$/i.test(lines[i]) ||
      /^(?:address|residence|permanent address|residential address)\s*[:\-]/i.test(lines[i]);
    if(label){
      const start=lines[i].replace(/^(?:address|residence|permanent address|residential address|barangay|brgy)\s*[:\-]?\s*/i,'').trim();
      const collected=[];
      if(start)collected.push(start);
      for(let j=i+1;j<lines.length&&collected.length<5;j++){
        const next=lines[j];
        if(/^(?:name|surname|given|date|birth|sex|nationality|civil|status|signature|id|number|issued|expires)\b/i.test(next)&&collected.length)break;
        collected.push(next);
        if(/philippines|province|zambales|\b\d{4}\b/i.test(next))break;
      }
      if(collected.length)return collected.join(', ').replace(/,\s*,/g,',').trim();
    }
  }
  const addressLines=lines.filter(line=>/(\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|barangay|brgy\.?|blk\.?|block|lot|purok|zone|phase|subdivision|sitio|city|province|residence|address)\b)/i.test(line));
  return addressLines.length?addressLines.join(', ').trim():String(text||'').replace(/\s+/g,' ').trim();
}

function extractDob(text){
  const source=String(text||'');
  const months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  const dobArea=source.split(/\r?\n/).filter(line=>/date\s*(?:of)?\s*birth|birth|dob/i.test(line)).join(' ');
  const candidates=(dobArea||source).match(/(?:\d{4}-\d{1,2}-\d{1,2})|(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})|(?:\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s+\d{4})/ig)||[];
  for(const raw of candidates){
    let d,mo,y;
    if(/^\d{4}-/.test(raw)){[y,mo,d]=raw.split('-').map(Number)}
    else if(/[\/.-]/.test(raw)){
      const parts=raw.split(/[\/.-]/).map(Number);
      if(parts[2]>=100||parts[2]>=1000)y=parts[2]<100?2000+parts[2]:parts[2];else y=parts[2];
      // Philippine documents commonly use DD/MM/YYYY; support MM/DD by using the first value as month only when it is >12.
      if(parts[0]>12){d=parts[0];mo=parts[1]}else{d=parts[1];mo=parts[0]}
    }else{
      const m=raw.match(/(\d{1,2})\s+([A-Za-z]+)\s*,?\s+(\d{4})/);
      if(m){d=Number(m[1]);mo=months[m[2].toLowerCase()]||0;y=Number(m[3])}
    }
    if(!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(d))continue;
    const normalized=RegistrationAge.normalizeDob(`${y}-${mo}-${d}`);
    if(normalized)return normalized;
  }
  return null;
}

function extractFieldLine(text,labels){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const line of lines){
    const lower=line.toLowerCase();
    for(const label of labels||[]){
      if(lower.startsWith(label)){
        const value=line.replace(new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\-]?\\s*','i'),'').trim();
        if(value&&value.length>1)return value;
      }
    }
  }
  return '';
}

function extractSex(text){
  const m=String(text||'').match(/\b(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)\b/i);
  if(!m)return '';
  return /^m/i.test(m[1])?'Male':'Female';
}

function extractDocumentNumber(text,documentType){
  const profile=DOCUMENT_PROFILES[documentType]||{};
  for(const label of profile.numberLabels||[]){
    const m=new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9 \\-]{4,30})','i').exec(text);
    if(m&&m[1]){
      return m[1].replace(/\s+/g,' ').trim();
    }
  }
  return '';
}

function extractMRZ(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x.includes('<')&&x.length>=20);
  if(lines.length<2)return null;
  const passportLine=lines.find(x=>/^P[A-Z<]/.test(x)||x.length>=28);
  if(!passportLine)return null;
  const clean=passportLine.replace(/\s/g,'');
  const passport=clean.match(/[A-Z0-9]{1,2}[0-9]{6,9}/);
  return passport?passport[0]:null;
}

function extractName(text){
  const source=String(text||'');
  const lines=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const skip=/^(republic|philippines|pilipinas|name|surname|given|middle|first|last|address|birth|date|sex|male|female|civil|status|nationality|height|weight|blood|signature|barangay|city|province|zip|no\.?|number|id|license|card|common|bienvenido|authority|issued|expires|valid|driver|professional|unified|multi-purpose|voter|passport|tax|sss|gsis|pag-ibig|philhealth|tin|community|cedula|resident|certificate)\b/i;
  const surname=source.match(/^(?:surname|last name|family name)\s*[:\-]\s*(.+)$/im);
  const given=source.match(/^(?:given name|first name)\s*[:\-]\s*(.+)$/im);
  const middle=source.match(/^(?:middle name)\s*[:\-]\s*(.+)$/im);
  if(surname&&given&&given[1]){
    return [given[1].trim(),middle&&middle[1]?middle[1].trim():'',surname[1].trim()].filter(Boolean).join(' ').replace(/\s+/g,' ');
  }
  for(const line of lines){
    if(skip.test(line))continue;
    if(/^\d+[\.\-]\)?\s/.test(line))continue;
    if(/[\d]{4,}[\/\-]/.test(line))continue;
    const words=line.split(/\s+/).filter(w=>w.length>=2);
    if(words.length>=2&&words.length<=4&&words.every(w=>/^[A-Za-zÑñ]+$/.test(w))){
      return line;
    }
  }
  return null;
}


/* ---- Bilingual (Filipino/English) labelled-field parsing for PhilID / ePhilID ---- */
const PHILID_STOP=/^(?:apelyido|last name|mga pangalan|given names?|gitnang apelyido|middle name|petsa ng kapanganakan|date of birth|kasarian|sex|estado sibil|marital status|uri ng dugo|blood type|lugar ng kapanganakan|place of birth|tirahan|address|republika|republic|pambansang|philippine|pcn|philsys)\b/i;

function cleanLines(text){
  return String(text||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
}

function readLabelled(lines,labelRe,maxLines){
  maxLines=maxLines||1;
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(labelRe);
    if(!m)continue;
    const collected=[];
    const sameLine=lines[i].slice(m.index+m[0].length).replace(/^[\s:\-\/]+/,'').trim();
    if(sameLine)collected.push(sameLine);
    for(let j=i+1;j<lines.length&&collected.length<maxLines;j++){
      if(PHILID_STOP.test(lines[j]))break;
      collected.push(lines[j]);
    }
    if(collected.length)return collected.join(', ');
  }
  return '';
}

function titleCase(v){
  return String(v||'').toLowerCase().replace(/(^|[\s\-'])([a-zñ])/g,(_,a,b)=>a+b.toUpperCase());
}

function parseDateLoose(raw){
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const m=String(raw||'').match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*,?\s+(\d{4})\b/);
  if(m){
    const mo=months[m[1].slice(0,3).toLowerCase()],d=Number(m[2]),y=Number(m[3]);
    const normalized=mo?RegistrationAge.normalizeDob(`${y}-${mo}-${d}`):'';
    if(normalized)return normalized;
  }
  return extractDob(raw)||null;
}


const PHILID_NOISE_WORDS=new Set(['REPUBLIKA','REPUBLIC','NG','OF','THE','PILIPINAS','PHILIPPINES','PHILIPPINE','PAMBANSANG','PAGKAKAKILANLAN','PAGKAKAKILANLAN','IDENTIFICATION','CARD','PHILSYS','PSA','LAST','NAME','NAMES','GIVEN','MIDDLE','DATE','BIRTH','SEX','APELYIDO','MGA','PANGALAN','GITNANG','PETSA','KAPANGANAKAN','KAPANGANAKAN','KASARIAN','ADDRESS','TIRAHAN','MALE','FEMALE','SINGLE','MARRIED','JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']);

/* PhilID photos often OCR with garbled labels. Names are printed in CAPITALS in a fixed order:
   Last name, Given names, Middle name. Rebuild them from capital-letter runs in that order. */
function philIdNamesFromNoisyText(text){
  const src=String(text||'');
  const dobAt=src.search(/date\s*of|petsa\s*ng|kapang/i);
  const area=dobAt>0?src.slice(0,dobAt):src;
  const runs=[];
  const re=/[A-ZÑ]{2,}(?:[ \t]+[A-ZÑ]{2,})*/g;
  let m;
  while((m=re.exec(area))){
    const words=m[0].split(/\s+/).filter(w=>!PHILID_NOISE_WORDS.has(w));
    if(!words.length)continue;
    const value=words.join(' ');
    if(words.length===1&&value.length<3)continue;
    runs.push({value,at:m.index});
  }
  const midAt=src.search(/middle\s*name/i);
  let middle='';
  let before=runs;
  if(midAt>=0){
    const after=runs.find(r=>r.at>midAt);
    if(after)middle=after.value;
    before=runs.filter(r=>r.at<midAt);
  }
  if(!middle&&!(midAt>=0)&&runs.length>=3){middle=runs[2].value;before=runs.slice(0,2)}
  return{last:(before[0]&&before[0].value)||'',given:(before[1]&&before[1].value)||'',middle};
}


/* ---- PhilHealth ID (green card): number, "SURNAME, GIVEN MIDDLE", "MONTH D, YYYY - SEX", then address lines ---- */
const MONTHS_FULL=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
function lcsLen(a,b){let best=0;const dp=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)if(a[i-1]===b[j-1]){dp[i][j]=dp[i-1][j-1]+1;if(dp[i][j]>best)best=dp[i][j]}return best}
function fuzzyMonth(garbled){
  const g=String(garbled||'').toUpperCase().replace(/[^A-Z]/g,'');
  if(g.length<3)return 0;
  let best=0,bestScore=2;
  MONTHS_FULL.forEach((m,i)=>{
    const score=lcsLen(g,m);
    if(score>bestScore||(score===bestScore&&best&&Math.abs(g.length-m.length)<Math.abs(g.length-MONTHS_FULL[best-1].length)))
      {if(score>bestScore||!best){bestScore=score;best=i+1}}
  });
  return best;
}
function extractPhilHealth(text){
  const lines=cleanLines(text);
  const out={fullName:'',dob:null,sex:'',address:'',documentNumber:''};
  const num=String(text||'').match(/\b(\d{2})[-\s]?(\d{9})[-\s]?(\d)\b/);
  if(num)out.documentNumber=`${num[1]}-${num[2]}-${num[3]}`;
  const nameIdx=lines.findIndex(l=>/^[A-ZÑ][A-ZÑ .'\-]{1,40},\s*[A-ZÑ][A-ZÑ .'\-]{2,60}$/.test(l.replace(/[^A-Za-zÑñ ,.'\-]/g,'').toUpperCase())&&/,/.test(l)&&l.replace(/[^A-Za-zÑñ]/g,'').length>=6);
  if(nameIdx>=0){
    const [sur,given]=lines[nameIdx].replace(/[^A-Za-zÑñ ,.'\-]/g,'').split(/,(.+)/);
    out.fullName=titleCase(`${(given||'').trim()} ${(sur||'').trim()}`.replace(/\s+/g,' ').trim());
  }
  // DOB + sex line, searched after the name
  let dobIdx=-1;
  for(let i=Math.max(0,nameIdx+1);i<lines.length;i++){
    const m=lines[i].match(/^(.{0,24}?)[\s.]*(\d{1,2})\s*[.,]?\s*((?:19|20)\d{2})\s*[-–—~=]?\s*([A-Za-z]{3,7})?/);
    if(m&&/(?:19|20)\d{2}/.test(lines[i])){
      const mo=fuzzyMonth(m[1]);
      const d=Number(m[2]),y=Number(m[3]);
      if(mo&&d>=1&&d<=31){const dt=new Date(y,mo-1,d);if(dt.getMonth()===mo-1&&dt.getDate()===d)out.dob=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
      const sx=(m[4]||'').toUpperCase();
      if(/^FE/.test(sx))out.sex='Female';else if(/^MA|^M[A-Z]L/.test(sx)||/^MAL/.test(sx))out.sex='Male';
      dobIdx=i;break;
    }
  }
  // Address = consecutive readable lines after the DOB/sex line (or after the name)
  const start=dobIdx>=0?dobIdx+1:(nameIdx>=0?nameIdx+1:-1);
  if(start>=0){
    const parts=[];
    for(let i=start;i<lines.length&&parts.length<3;i++){
      const l=lines[i].replace(/\s+[A-Za-z]$/,'').trim();
      const alnum=(l.match(/[A-Za-z0-9]/g)||[]).length;
      if(l.length<10||alnum/l.length<0.7)break;
      parts.push(l);
    }
    out.address=parts.join(' ').replace(/\s+,/g,',').replace(/\s+/g,' ').trim();
  }
  return out;
}


/* Guard against OCR garbage: never fill the form with text that does not look like a real name/address. */
const NAME_LABEL_WORDS=new Set(['NAME','NAMES','SURNAME','LAST','FIRST','GIVEN','MIDDLE','FULL','COMPLETE','MEMBER','HOLDER','ADDRESS','DATE','BIRTH','SEX','CIVIL','STATUS','OF','THE']);
function cleanExtractedName(v){
  if(!v)return null;
  const tokens=String(v).replace(/[^A-Za-zÑñ\s.'\-,]/g,' ').split(/[\s,]+/).filter(Boolean);
  const PARTICLES=/^(?:de|del|dela|delos|de\s*la|la|las|los|san|santa|van|von|y|bin|binti)$/i;
  const kept=tokens.filter(t=>t.replace(/[^A-Za-zÑñ]/g,'').length>=2&&!NAME_LABEL_WORDS.has(t.toUpperCase().replace(/[^A-ZÑ]/g,''))&&(/^[A-ZÑ][A-Za-zñ.'\-]*$/.test(t)||PARTICLES.test(t)));
  if(kept.length<2)return null;
  if(kept.some(t=>!/[AEIOUaeiou]/.test(t)&&t.replace(/[^A-Za-zÑñ]/g,'').length>3))return null; // no vowels = noise
  // too many dropped tokens means the line was mostly noise
  if(tokens.length>=4&&kept.length<tokens.length/2)return null;
  return kept.join(' ');
}
function cleanExtractedAddress(v){
  if(!v)return '';
  let t=String(v).replace(/[|]/g,' ').replace(/,\s*,/g,',').replace(/\s+/g,' ').trim();
  // drop stray 1-character noise tokens at the start/end (e.g. "i S ANG PUROK 2" -> "ANG PUROK 2")
  t=t.replace(/^(?:[^\sA-Za-z0-9]*[A-Za-z]\s+)+(?=\S{2,})/,m=>m);
  const parts=t.split(' ');
  while(parts.length>2&&/^[^0-9]$/.test(parts[0]))parts.shift();
  while(parts.length>2&&/^[^0-9]$/.test(parts[parts.length-1]))parts.pop();
  t=parts.join(' ');
  const letters=(t.match(/[A-Za-z]/g)||[]).length;
  if(t.length<8||letters<5)return '';
  return t;
}

/* ---- Philippine Driver's License (LTO): "SURNAME, GIVEN MIDDLE", "PHL M 2004/11/13", Address lines, "C09-25-008266" ---- */
function findCommaName(lines){
  // OCR often puts stray marks before the name ("a 0 DELOS SANTOS, NATHANIEL"): drop leading 1-char / digit-containing tokens.
  const stripNoise=l=>{
    const t=l.replace(/[|]/g,' ').split(/\s+/).filter(Boolean);
    while(t.length>2&&(t[0].length===1||/[\d_]/.test(t[0])||!/[A-Za-zÑñ]/.test(t[0])))t.shift();
    return t.join(' ');
  };
  const ok=(l,sep)=>{
    if(/\d/.test(l)||!l.includes(sep))return false;
    const t=l.replace(/[^A-Za-zÑñ ,.'\-]/g,'').toUpperCase();
    return new RegExp("^[A-ZÑ][A-ZÑ .'\\-]{1,40}\\"+sep+"\\s*[A-ZÑ][A-ZÑ .'\\-]{2,60}$").test(t)&&l.replace(/[^A-Za-zÑñ]/g,'').length>=6;
  };
  const cleaned=lines.map(stripNoise);
  let i=cleaned.findIndex(l=>ok(l,','));
  let sep=',';
  if(i<0){i=cleaned.findIndex(l=>ok(l,'.'));sep='.'}
  if(i<0)return null;
  const [sur,given]=cleaned[i].replace(/[^A-Za-zÑñ ,.'\-]/g,'').split(new RegExp('\\'+sep+'(.+)'));
  return{index:i,fullName:titleCase(`${(given||'').trim()} ${(sur||'').trim()}`.replace(/\s+/g,' ').trim())};
}
function fixYear(y){
  y=Number(y);
  const now=new Date().getFullYear();
  if(y>=1900&&y<=now)return y;
  const alt=Number(String(y).replace(/^7/,'2'));
  return(alt>=1900&&alt<=now)?alt:0;
}
function extractDriversLicense(text){
  const lines=cleanLines(text);
  const out={fullName:'',dob:null,sex:'',address:'',documentNumber:''};
  const lic=String(text||'').match(/\b([A-Z]\d{2})[-\s]?(\d{2})[-\s]?(\d{6})\b/);
  if(lic)out.documentNumber=`${lic[1]}-${lic[2]}-${lic[3]}`;
  const nm=findCommaName(lines);
  if(nm)out.fullName=nm.fullName;
  const from=nm?nm.index+1:0;
  let dobIdx=-1;
  for(let i=from;i<lines.length;i++){
    // year may be 4 digits, an OCR-garbled 7xxx/8xxx, or only 2 digits when the leading "20" was lost (e.g. "M04 /11/13")
    const m=lines[i].match(/(^|[^\d])((?:19|20)\d{2}|[78]\d{3}|\d{2})\s*[\/\-.]\s*(\d{2})\s*[\/\-.]\s*(\d{2})(?!\d)/);
    if(!m)continue;
    let y=m[2].length===2?(Number(m[2])<=new Date().getFullYear()%100?2000+Number(m[2]):1900+Number(m[2])):fixYear(m[2]);
    const mo=Number(m[3]),d=Number(m[4]);
    if(y&&mo>=1&&mo<=12&&d>=1&&d<=31){
      const dt=new Date(y,mo-1,d);
      if(dt.getMonth()===mo-1&&dt.getDate()===d)out.dob=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    const before=lines[i].slice(0,m.index)+m[1];
    const sx=before.match(/\b([MF])\b(?!.*\b[MF]\b)/);
    if(sx)out.sex=sx[1]==='M'?'Male':'Female';
    dobIdx=i;break;
  }
  const STOP=/license|expiration|iration|agency|gency|blood|eyes|dl\s*codes|conditions|signature|assistant|secretary/i;
  let start=dobIdx;
  if(start>=0)start=dobIdx+1;
  else{start=lines.findIndex((l,i)=>i>=from&&/\b(?:PUROK|STREET|ST|BRGY|BARANGAY|AVE|AVENUE|ROAD|RD|CITY|ZAMBALES)\b/i.test(l))}
  if(start>=0){
    const parts=[];
    for(let i=start;i<lines.length&&parts.length<3;i++){
      const l=lines[i].trim();
      if(STOP.test(l)||lic&&l.includes(lic[3]))break;
      if(/^(?:address|tirahan)\b/i.test(l)&&l.length<12)continue;
      const alnum=(l.match(/[A-Za-z0-9]/g)||[]).length;
      if(l.length<8||alnum/l.length<0.7){if(parts.length)break;continue}
      parts.push(l);
    }
    out.address=parts.join(' ').replace(/,\s*,/g,',').replace(/\s+/g,' ').trim();
  }
  return out;
}

function extractPhilId(text){
  const lines=cleanLines(text);
  const last=readLabelled(lines,/(?:apelyido\s*\/?\s*)?last\s*name|apelyido(?!\s*\/?\s*middle)/i);
  const given=readLabelled(lines,/(?:mga\s*pangalan\s*\/?\s*)?given\s*names?|mga\s*pangalan/i);
  const middle=readLabelled(lines,/(?:gitnang\s*apelyido\s*\/?\s*)?middle\s*name|gitnang\s*apelyido/i);
  const clean=v=>String(v||'').replace(/[^A-Za-zÑñ\s\-\.']/g,' ').replace(/\s+/g,' ').trim();
  const pickCaps=v=>{
    const raw=String(v||'');
    const re=/[A-ZÑ]{2,}(?:[ \t]+[A-ZÑ]{2,})*/g;let m;
    while((m=re.exec(raw))){
      const w=m[0].split(/\s+/).filter(x=>!PHILID_NOISE_WORDS.has(x));
      const val=w.join(' ');
      if(w.length&&!(w.length===1&&val.length<3))return val;
    }
    return clean(raw);
  };
  let lastN=pickCaps(last),givenN=pickCaps(given),middleN=pickCaps(middle);
  if(!lastN||!givenN){
    const fb=philIdNamesFromNoisyText(text);
    if(!lastN)lastN=fb.last;
    if(!givenN)givenN=fb.given;
    if(!middleN)middleN=fb.middle;
  }
  const fullName=[givenN,middleN,lastN].filter(Boolean).join(' ');
  const dobRaw=readLabelled(lines,/(?:petsa\s*ng\s*kapanganakan\s*\/?\s*)?date\s*of\s*birth|petsa\s*ng\s*kapanganakan/i);
  const sexRaw=readLabelled(lines,/(?:kasarian\s*\/?\s*)?\bsex\b|kasarian/i);
  const civilRaw=readLabelled(lines,/(?:estado\s*sibil\s*\/?\s*)?marital\s*status|estado\s*sibil/i);
  const address=readLabelled(lines,/(?:tirahan\s*\/?\s*)?\baddress\b|tirahan/i,4);
  const pcnMatch=String(text||'').match(/\b(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{4})\b/);
  const sex=/^\s*m/i.test(sexRaw)?'Male':/^\s*f/i.test(sexRaw)?'Female':'';
  const civilMap=[[/single|binata|dalaga/i,'Single'],[/married|kasal/i,'Married'],[/widow|balo/i,'Widowed'],[/separated|hiwalay/i,'Separated']];
  let civilStatus='';
  for(const [re,val] of civilMap)if(re.test(civilRaw)){civilStatus=val;break}
  return{
    fullName:fullName?titleCase(fullName):'',
    surname:titleCase(lastN),firstName:titleCase(givenN),middleName:titleCase(middleN),
    dob:dobRaw?parseDateLoose(dobRaw):null,
    sex,civilStatus,
    address:address.replace(/\s*,\s*,/g,',').trim(),
    documentNumber:pcnMatch?pcnMatch.slice(1,5).join('-'):''
  };
}

function words(text){
  return new Set(normalizeText(text).split(' ').filter(x=>x.length>=3));
}

function compareAddress(extractedAddress, registeredAddress, barangayName){
  const extracted=normalizeText(extractedAddress);
  const registered=normalizeText(registeredAddress);
  const barangay=normalizeText(barangayName);
  if(!extracted||extracted.length<12)return{status:'unreadable',confidence:0,address:extractedAddress||''};

  const brgyAliases=[barangay, barangay.replace(/^barangay\s*/,''), barangay.replace(/^brgy\.?\s*/, '')]
    .filter(Boolean).map(normalizeText);
  const brgyMatch=brgyAliases.some(alias=>extracted.includes(alias)||registered.includes(alias));
  const addressWords=words(extracted);
  const registeredWords=[...words(registered)].filter(x=>!['house','street','road','barangay','brgy','city','olongapo','zambales'].includes(x));
  const matchedAddressWords=registeredWords.filter(x=>addressWords.has(x));
  const addressMatch=registeredWords.length>0&&matchedAddressWords.length/registeredWords.length>=0.45;

  if(brgyMatch&&addressMatch)return{status:'verified',confidence:0.9,address:extractedAddress};
  if(brgyMatch)return{status:'manual_review',confidence:0.65,address:extractedAddress};
  if(!brgyMatch&&registeredWords.some(x=>addressWords.has(x)))return{status:'manual_review',confidence:0.55,address:extractedAddress};
  return{status:'rejected',confidence:0.8,address:extractedAddress};
}

function extractBarangay(text){
  const source=normalizeText(text);
  for(const name of ['pag asa','pagasa','new kalalake','west tapinac']){
    if(source.includes(name))return name.replace('pag asa','Pag-asa').replace('pagasa','Pag-asa').replace('new kalalake','New Kalalake').replace('west tapinac','West Tapinac');
  }
  const match=String(text||'').match(/(?:barangay|brgy\.?|bgy\.?)\s*[:\-]?\s*([A-Za-z0-9\s-]{2,40})/i);
  return match?match[1].split(/\n|,|province|city/i)[0].trim():null;
}

function nameSimilarity(a,b){
  const normalizeName=value=>normalizeText(value).replace(/\b(jr|sr|ii|iii|iv)\b/g,' ').replace(/\s+/g,' ').trim();
  const aw=new Set(normalizeName(a).split(' ').filter(Boolean)),bw=new Set(normalizeName(b).split(' ').filter(Boolean));
  if(!aw.size||!bw.size)return 0;
  let matched=0;aw.forEach(word=>{if(bw.has(word))matched++});
  return matched/Math.max(aw.size,bw.size);
}

function compareResidencyDocument(text,submittedName,selectedBarangay){
  const normalizedText=normalizeText(text);
  const normalizedBarangay=normalizeText(selectedBarangay);
  const extractedName=extractName(text);
  const extractedBarangay=extractBarangay(text);
  const nameMatch=extractedName?nameSimilarity(extractedName,submittedName)>=0.67:false;
  const barangayMatch=extractedBarangay?normalizeText(extractedBarangay)===normalizedBarangay||normalizedText.includes(normalizedBarangay):false;
  if(!normalizedText||normalizedText.length<20)return{status:'unreadable',confidence:0,name:extractedName,barangay:extractedBarangay};
  if(nameMatch&&barangayMatch)return{status:'manual_review',confidence:.8,name:extractedName,barangay:extractedBarangay,reason:'Document OCR matches the resident and barangay; official verification is still required.'};
  return{status:'manual_review',confidence:.45,name:extractedName,barangay:extractedBarangay,reason:'OCR is incomplete or mismatched. Manual review is required.'};
}

const ocrCache=new Map();
const OCR_CACHE_TTL_MS=10*60*1000;

function cacheOcr(id,result){
  ocrCache.set(id,{result,at:Date.now()});
  const now=Date.now();
  for(const [key,entry] of ocrCache)if(now-entry.at>OCR_CACHE_TTL_MS)ocrCache.delete(key);
}

function getCachedOcr(id){
  const entry=ocrCache.get(id);
  if(!entry)return null;
  if(Date.now()-entry.at>OCR_CACHE_TTL_MS){ocrCache.delete(id);return null}
  return entry.result;
}

function consumeCachedOcr(id){
  const result=getCachedOcr(id);
  if(result)ocrCache.delete(id);
  return result;
}

async function validateImage(dataUrl){
  if(typeof dataUrl!=='string'||!/^data:image\/(jpeg|png);base64,/i.test(dataUrl)){
    return{ok:false,reason:'Only JPG or PNG ID images can be processed.'};
  }
  if(sharp){
    try{
      const base64=dataUrl.slice(dataUrl.indexOf(',')+1);
      const metadata=await sharp(Buffer.from(base64,'base64')).rotate().metadata();
      if(!metadata.width||!metadata.height||metadata.width<100||metadata.height<100){
        return{ok:false,reason:'The uploaded ID is too small or could not be read clearly.'};
      }
    }catch(_){
      return{ok:false,reason:'The uploaded ID is unclear or is not a valid JPG or PNG image.'};
    }
  }
  return{ok:true};
}

/* ID reading is done by AI (Google Gemini vision) - see ./idVision.js. Kept under the old name so callers don't change. */
async function ocrId(dataUrl,documentType){
  const validation=await validateImage(dataUrl);
  if(!validation.ok)return{status:'unreadable',confidence:0,address:'',text:'',reason:validation.reason};
  const {visionConfig,visionExtractId}=require('./idVision');
  if(!visionConfig())return{status:'unreadable',confidence:0,address:'',text:'',reason:'AI ID reading is not set up. Add a real GEMINI_API_KEY to the .env file and restart the server.'};
  const ai=await visionExtractId(dataUrl,documentType);
  if(!ai)return{status:'unreadable',confidence:0,address:'',text:'',reason:'The AI could not read this ID. Please upload a clearer photo of the whole card.'};
  const c=v=>v?0.9:0;
  return{
    status:'readable',confidence:0.9,address:ai.address||'',text:'',
    name:ai.fullName||null,dob:ai.dob||null,barangay:ai.barangay||null,sex:ai.sex||'',civilStatus:ai.civilStatus||'',
    documentNumber:ai.documentNumber||'',expirationDate:ai.expirationDate||'',issueDate:ai.issueDate||'',
    documentType:documentType||null,
    fieldConfidence:{fullName:c(ai.fullName),dateOfBirth:c(ai.dob),address:c(ai.address),barangay:c(ai.barangay)},
    fullName:ai.fullName||'',surname:ai.surname||'',firstName:ai.firstName||'',middleName:ai.middleName||'',suffix:ai.suffix||'',
    dateOfBirth:ai.dob||'',cityMunicipality:'',province:''
  };
}

async function verifyIdAddress(dataUrl, registeredAddress, barangayName){
  const ocr=await ocrId(dataUrl);
  if(ocr.status==='unreadable')return{status:'unreadable',confidence:ocr.confidence,address:ocr.address||'',text:ocr.text||'',reason:ocr.reason};
  return{...compareAddress(ocr.address,registeredAddress,barangayName),text:ocr.text,confidence:ocr.confidence,dob:ocr.dob||null};
}

module.exports={verifyIdAddress,ocrId,cleanExtractedName,cleanExtractedAddress,extractPhilId,extractPhilHealth,extractDriversLicense,parseDateLoose,nameSimilarity,extractAddress,extractName,extractDob,extractBarangay,extractSex,extractDocumentNumber,extractMRZ,compareAddress,compareResidencyDocument,DOCUMENT_PROFILES,normalizeText,getCachedOcr,consumeCachedOcr,cacheOcr};
