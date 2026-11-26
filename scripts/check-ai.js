'use strict';
/* Quick check that the Gemini API key in .env works (text + image input).  Run:  npm run check-ai
   It never prints your key. */
const fs=require('fs'),path=require('path');

function loadEnv(){
  const file=path.join(__dirname,'..','.env');
  if(!fs.existsSync(file))return false;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!m||line.trim().startsWith('#'))continue;
    const v=m[2].replace(/^["']|["']$/g,'');
    if(process.env[m[1]]===undefined)process.env[m[1]]=v;
  }
  return true;
}

const PLACEHOLDER=/(^replace[-_ ]?with)|(^your[-_ ])|(^paste[-_ ]?your)/i;
// 1x1 red PNG
const RED_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function call(key,model,parts){
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',
    headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0,maxOutputTokens:300}}),
    signal:AbortSignal.timeout(30000)
  });
  let body=null;try{body=await res.json()}catch(_){}
  return{status:res.status,body};
}

function explain(status,body){
  const msg=(body&&body.error&&body.error.message)||'';
  if(status===400&&/api key/i.test(msg))return'The API key is not valid. Copy it again from https://aistudio.google.com/apikey (no spaces or quotes).';
  if(status===400)return`Bad request: ${msg||'unknown'}`;
  if(status===401||status===403)return`The key was rejected or is not allowed here (HTTP ${status}). ${msg}`;
  if(status===404)return`The model was not found. Set GEMINI_VISION_MODEL=gemini-2.5-flash in .env. ${msg}`;
  if(status===429)return'Quota or rate limit reached (free tier). Wait a minute, or check Usage in Google AI Studio.';
  if(status>=500)return`Google had a problem (HTTP ${status}). Try again in a bit.`;
  return`HTTP ${status}. ${msg}`;
}

(async()=>{
  const hasEnv=loadEnv();
  const key=(process.env.GEMINI_API_KEY||'').trim();
  const model=(process.env.GEMINI_VISION_MODEL||process.env.GEMINI_MODEL||'').trim()||'gemini-2.5-flash';
  console.log('Checking Gemini API for FixIt ID reading...');
  if(!hasEnv)console.log('! No .env file found in the project folder (copy .env.example to .env).');
  if(!key||PLACEHOLDER.test(key)){console.log('FAIL: GEMINI_API_KEY is missing or still a placeholder in .env.');process.exit(1)}
  console.log(`  key: found (${key.length} characters, hidden)`);
  console.log(`  model: ${model}`);
  if(process.env.ID_AI_VISION==='0')console.log('  note: ID_AI_VISION=0, so the app will NOT use AI for IDs until you remove that line.');
  try{
    const t=await call(key,model,[{text:'Reply with the single word OK.'}]);
    if(t.status!==200){console.log('FAIL (text test):',explain(t.status,t.body));process.exit(1)}
    console.log('  text test: OK');
    const v=await call(key,model,[{text:'What color is this image? Answer in one word.'},{inline_data:{mime_type:'image/png',data:RED_PNG}}]);
    if(v.status!==200){console.log('FAIL (image test):',explain(v.status,v.body));process.exit(1)}
    const txt=((v.body.candidates||[])[0]||{}).content;
    console.log('  image test: OK');
    console.log('\nPASS: the API key works and can read images. ID autofill should work.');
  }catch(e){
    console.log('FAIL: could not reach Google ('+(e&&e.message)+'). Check your internet connection or firewall.');
    process.exit(1);
  }
})();
