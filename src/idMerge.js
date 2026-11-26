'use strict';
/* Combines ID data from three sources. Priority per field: QR code > AI vision > Tesseract OCR. */
const {nameSimilarity}=require('./addressVerification');

const FIELDS=['name','dob','address','barangay','sex','civilStatus','documentNumber','expirationDate','issueDate','surname','firstName','middleName'];
const CONF={qr:0.99,ai:0.9};

function norm(src,kind){
  if(!src)return null;
  if(kind==='qr')return{name:src.fullName,dob:src.dob,sex:src.sex,documentNumber:src.documentNumber,surname:src.surname,firstName:src.firstName,middleName:src.middleName};
  if(kind==='ai')return{name:src.fullName,dob:src.dob,address:src.address,barangay:src.barangay,sex:src.sex,civilStatus:src.civilStatus,documentNumber:src.documentNumber,expirationDate:src.expirationDate,issueDate:src.issueDate,surname:src.surname,firstName:src.firstName,middleName:src.middleName};
  return{name:src.name,dob:src.dob,address:src.address,barangay:src.barangay,sex:src.sex,civilStatus:src.civilStatus,documentNumber:src.documentNumber,expirationDate:src.expirationDate,issueDate:src.issueDate,surname:src.surname,firstName:src.firstName,middleName:src.middleName};
}

function firstOf(list,key){
  for(const x of list)if(x&&x[key])return x[key];
  return '';
}

function mergeId({qr,ai,ocr}){
  const aiList=(Array.isArray(ai)?ai:[ai]).filter(Boolean).map(a=>norm(a,'ai'));
  const aiMerged={};
  for(const f of FIELDS)aiMerged[f]=firstOf(aiList,f);
  const sources={qr:norm(qr,'qr'),ai:aiList.length?aiMerged:null,ocr:norm(ocr,'ocr')};
  const out={sources:{}};
  for(const f of FIELDS){
    out[f]='';
    for(const kind of ['qr','ai','ocr']){
      const v=sources[kind]&&sources[kind][f];
      if(v){out[f]=v;out.sources[f]=kind;break}
    }
  }
  const ocrConf=(ocr&&ocr.fieldConfidence)||{};
  const conf=(field,ocrKey)=>{
    const kind=out.sources[field];
    if(!kind)return 0;
    return kind==='ocr'?Number(ocrConf[ocrKey]||0.5):CONF[kind];
  };
  out.fieldConfidence={fullName:conf('name','fullName'),dateOfBirth:conf('dob','dateOfBirth'),address:conf('address','address'),barangay:conf('barangay','barangay')};

  // Cross-check: QR data vs what was read from the printed face of the ID.
  out.crossCheck='n/a';
  if(qr){
    const printed=sources.ai||sources.ocr;
    const checks=[];
    if(printed&&printed.name&&qr.fullName)checks.push(nameSimilarity(qr.fullName,printed.name)>=0.6);
    if(printed&&printed.dob&&qr.dob)checks.push(printed.dob===qr.dob);
    if(checks.length)out.crossCheck=checks.every(Boolean)?'match':'mismatch';
  }
  return out;
}
module.exports={mergeId};
