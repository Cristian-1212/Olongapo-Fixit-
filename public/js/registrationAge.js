(function(root){
 'use strict';
 const messages={
  invalid:'Please verify your date of birth. The extracted information could not be validated.',
  underage:'Registration denied. You must be at least 15 years old.',
  ocrReview:'Please verify your date of birth. The extracted information could not be validated.',
  eligible:'Age requirement satisfied. You are eligible for registration.'
 };
 function dateParts(value){
  const text=String(value||'').trim();
  const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const monthFirst=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!iso&&!monthFirst)return null;
  const year=Number(iso?iso[1]:monthFirst[3]),month=Number(iso?iso[2]:monthFirst[1]),day=Number(iso?iso[3]:monthFirst[2]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1])return null;
  return{year,month,day};
 }
 function todayParts(now){
  const parts=new Intl.DateTimeFormat('en-US',{
   timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now||new Date());
  const values={};
  for(const part of parts)if(part.type!=='literal')values[part.type]=Number(part.value);
  return{year:values.year,month:values.month,day:values.day};
 }
 function compareDates(left,right){
  return left.year-right.year||left.month-right.month||left.day-right.day;
 }
 function isValidDob(value){
  return dateParts(value)!==null;
 }
 function normalizeDob(value){
  const birth=dateParts(value);
  return birth?`${String(birth.year).padStart(4,'0')}-${String(birth.month).padStart(2,'0')}-${String(birth.day).padStart(2,'0')}`:'';
 }
 function calculateAge(value,now){
  const birth=dateParts(value);
  if(!birth)return{status:'invalid',age:null};
  const today=todayParts(now);
  if(compareDates(birth,today)>0)return{status:'invalid',age:null};
  const age=today.year-birth.year-(compareDates({year:today.year,month:birth.month,day:birth.day},today)>0?1:0);
  return{status:age>=15?'eligible':'underage',age};
 }
 function todayDate(now){
  const today=todayParts(now);
  return`${today.year}-${String(today.month).padStart(2,'0')}-${String(today.day).padStart(2,'0')}`;
 }
 const api={messages,isValidDob,normalizeDob,calculateAge,todayDate,minimumAge:15};
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.RegistrationAge=api;
})(typeof window!=='undefined'?window:globalThis);
