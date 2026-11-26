/* Charts: small dependency-free SVG graphs (the CSP only allows our own scripts) */
const PAL=['#006b62','#d88700','#3b6fd4','#a32121','#7a4cc2','#17633a','#c2417a','#2a9d8f','#8a4b00','#5b6b7a','#e76f51','#4f8a10'];
const STC={'SUBMITTED':'#8a94a6','UNDER REVIEW':'#d88700','VERIFIED':'#3b6fd4','ASSIGNED':'#2a9d8f','IN PROGRESS':'#8a4b00','RESOLVED':'#17633a','REJECTED':'#a32121'};
const statusColor=k=>STC[k]||'#8a94a6';
const NODATA='<p class="mu">No data yet.</p>';
const clip=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};
const summary=e=>e.map(([k,v])=>k+': '+v).join(', ');
function niceStep(m){const raw=m/4,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),f=raw/p;return Math.max(1,(f<=1?1:f<=2?2:f<=5?5:10)*p)}
function donutChart(o,title,colorOf){
 const e=Object.entries(o).filter(x=>x[1]>0),t=e.reduce((a,x)=>a+x[1],0);if(!t)return NODATA;
 let acc=0;const col=(k,i)=>colorOf?colorOf(k,i):PAL[i%PAL.length];
 const seg=e.map(([k,v],i)=>{const p=v/t*100,s=`<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${col(k,i)}" stroke-width="6" stroke-dasharray="${p.toFixed(3)} ${(100-p).toFixed(3)}" stroke-dashoffset="${(25-acc).toFixed(3)}"><title>${esc(k)}: ${v} (${Math.round(p)}%)</title></circle>`;acc+=p;return s}).join('');
 const lg=e.map(([k,v],i)=>`<li><i style="background:${col(k,i)}"></i><span>${esc(k)}</span><b>${v}</b><small>${Math.round(v/t*100)}%</small></li>`).join('');
 return `<figure class="chart donut"><svg viewBox="0 0 42 42" role="img" aria-label="${esc(title+' — '+summary(e))}">${seg}<text x="21" y="21.8" text-anchor="middle" class="ct">${t}</text><text x="21" y="26" text-anchor="middle" class="cs">total</text></svg><ul class="legend">${lg}</ul></figure>`}
function barChart(o,title,colorOf){
 const e=Object.entries(o);if(!e.length||!e.some(x=>x[1]>0))return NODATA;
 const W=Math.max(340,e.length*56+56),H=270,L=34,T=16,B=96,pw=W-L-10,ph=H-T-B,max=Math.max(1,...e.map(x=>x[1])),st=niceStep(max),top=Math.ceil(max/st)*st,bw=Math.min(44,pw/e.length*.62);
 let g='';for(let v=0;v<=top;v+=st){const y=T+ph-v/top*ph;g+=`<line x1="${L}" x2="${W-10}" y1="${y}" y2="${y}" class="gl"/><text x="${L-6}" y="${y+3.5}" text-anchor="end" class="ax">${v}</text>`}
 const bars=e.map(([k,v],i)=>{const cx=L+pw/e.length*(i+.5),h=v/top*ph,y=T+ph-h,c=colorOf?colorOf(k,i):PAL[0];
  return `<g><rect x="${(cx-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h,0).toFixed(1)}" rx="3" fill="${c}"><title>${esc(k)}: ${v}</title></rect><text x="${cx.toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" class="val">${v}</text><text transform="translate(${cx.toFixed(1)},${T+ph+14}) rotate(-35)" text-anchor="end" class="ax">${esc(clip(k,18))}</text></g>`}).join('');
 return `<figure class="chart"><div class="chart-scroll"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W,520)}px" role="img" aria-label="${esc(title+' — '+summary(e))}">${g}${bars}</svg></div></figure>`}
function dashboardBarangayChart(o,title){
 const e=Object.entries(o);if(!e.length||!e.some(([,v])=>v>0))return '<div class="citywide-empty"><b>No barangay report data</b><p>Barangay totals will appear after reports are submitted.</p></div>';
 const max=Math.max(1,...e.map(([,v])=>v));
 const columns=e.map(([name,value])=>{const height=value/max*78;return `<div class="citywide-bar-column" role="listitem" aria-label="${esc(name)}: ${value} reports"><div class="citywide-bar-plot" style="--bar-height:${height.toFixed(1)}%"><b class="citywide-bar-value">${value}</b><i class="citywide-bar-fill" aria-hidden="true"></i></div><span class="citywide-bar-label">${esc(name)}</span></div>`}).join('');
 return `<figure class="citywide-bar-chart" role="group" aria-label="${esc(title+' — '+summary(e))}"><div class="citywide-bar-columns" role="list">${columns}</div></figure>`;
}
function compactCategoryChart(o,title){
 const e=Object.entries(o).filter(x=>x[1]>0);if(!e.length)return '<div class="analytics-empty"><b>No complaint category data available.</b></div>';
 const max=Math.max(1,...e.map(x=>x[1]));
 const rows=e.map(([k,v])=>`<div class="category-bar-row" role="listitem" title="${esc(k)}: ${v} reports">
  <span class="category-bar-label">${esc(k)}</span>
  <span class="category-bar-track" aria-hidden="true"><i style="width:${Math.max(2,v/max*100).toFixed(1)}%"></i></span>
  <b class="category-bar-value">${v}</b>
 </div>`).join('');
 return `<figure class="chart compact-category-chart" role="group" aria-label="${esc(title+' — '+summary(e))}"><div class="category-bars" role="list">${rows}</div></figure>`;
}
function lineChart(o,title){
 const e=Object.entries(o);if(!e.length)return NODATA;
 const max=Math.max(1,...e.map(([,v])=>v)),st=niceStep(max),top=Math.ceil(max/st)*st;
 const X=i=>e.length===1?50:4+92*i/(e.length-1),Y=v=>95-v/top*85;
 const points=e.map(([,v],i)=>`${X(i).toFixed(2)},${Y(v).toFixed(2)}`).join(' '),area=`4,95 ${points} ${X(e.length-1).toFixed(2)},95`;
 const axisValues=[];for(let v=top;v>0;v-=st)axisValues.push(v);axisValues.push(0);
 const grid=axisValues.map(v=>{const y=Y(v);return`<line x1="0" x2="100" y1="${y}" y2="${y}" class="gl"/>`}).join('');
 const dots=e.map(([k,v],i)=>`<circle cx="${X(i).toFixed(2)}" cy="${Y(v).toFixed(2)}" r="1.1" fill="${PAL[0]}" stroke="#fff" stroke-width="1.25" vector-effect="non-scaling-stroke"><title>${esc(k)}: ${v} reports</title></circle>`).join('');
 const axis=axisValues.map(v=>`<span style="top:${Y(v)}%">${v}</span>`).join('');
 const labelCount=Math.min(6,e.length),indexes=Array.from({length:labelCount},(_,i)=>labelCount===1?0:Math.round(i*(e.length-1)/(labelCount-1)));
 const labels=indexes.map(i=>{const [month,year]=e[i][0].split(' '),yearSuffix=i===0||i===e.length-1||month==='Jan'?` '${String(year||'').slice(-2)}`:'';return`<span style="left:${X(i)}%" title="${esc(e[i][0])}">${esc(month+yearSuffix)}</span>`}).join('');
 const values=e.length<=8?e.map(([k,v],i)=>{const below=Y(v)<18,top=below?Y(v)+2:Y(v)-7;return`<b class="analytics-line-value${below?' is-below':''}" style="left:${X(i)}%;top:${top}%" title="${esc(k)}: ${v} reports">${v}</b>`}).join(''):'';
 return `<figure class="chart analytics-line-chart" aria-label="${esc(title+' — '+summary(e))}"><div class="analytics-line-plot"><div class="analytics-line-yaxis" aria-hidden="true">${axis}</div><div class="analytics-line-graph"><svg viewBox="0 0 100 100" preserveAspectRatio="none" overflow="hidden" role="img" aria-label="${esc(title+' — '+summary(e))}"><defs><clipPath id="analytics-line-plot-clip"><rect x="0" y="0" width="100" height="100"/></clipPath></defs><g clip-path="url(#analytics-line-plot-clip)">${grid}<polygon points="${area}" fill="${PAL[0]}" opacity=".12"/>${e.length>1?`<polyline points="${points}" fill="none" stroke="${PAL[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`:''}${dots}</g></svg>${values}</div></div><div class="analytics-line-labels" aria-hidden="true">${labels}</div></figure>`}
function monthly(R){
 const m={};R.forEach(r=>{const d=new Date(r.created);if(isNaN(d))return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');m[k]=(m[k]||0)+1});
 const ks=Object.keys(m).sort();if(!ks.length)return{};
 const [y0,m0]=ks[0].split('-').map(Number),[y1,m1]=ks[ks.length-1].split('-').map(Number),o={};
 for(let y=y0,mo=m0;y<y1||(y===y1&&mo<=m1);){const k=y+'-'+String(mo).padStart(2,'0');o[new Date(y,mo-1,1).toLocaleString('en',{month:'short',year:'numeric'})]=m[k]||0;mo++;if(mo>12){mo=1;y++}}
 return o}
