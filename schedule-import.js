/* Schedule screenshot parser: works with OCR text and optional positioned TSV words.
   All extracted entries are tentative until reviewed and saved by the user. */
(function(){
"use strict";
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
const WEEKDAYS=["sun","mon","tue","wed","thu","fri","sat"];
const pad=n=>String(n).padStart(2,"0");
const uid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"shift-"+Date.now()+"-"+Math.random().toString(36).slice(2);
const clean=s=>String(s||"").replace(/[\u2013\u2014\u2212\u2011\u2010]/g,"-").replace(/[\u00a0]/g," ").replace(/[ \t]+/g," ").trim();
const timeRegex=/\b(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)\s*[-–—]\s*(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)\b/i;
const dateIso=(year,month,day)=>{
 const d=new Date(year,month-1,day);
 return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?year+"-"+pad(month)+"-"+pad(day):"";
};
const monthIndex=name=>MONTHS.findIndex(s=>s.startsWith(String(name||"").toLowerCase().replace(".","")));
function context(text,year,month){
 const s=String(text||"");
 const m=s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(20\d{2})\b/i);
 if(m){const ix=monthIndex(m[1]);if(ix!==-1)return {year:+m[2],month:ix+1,fromHeader:true};}
 return {year:Number.isInteger(year)?year:new Date().getFullYear(),month:Number.isInteger(month)&&month>=1&&month<=12?month:new Date().getMonth()+1,fromHeader:false};
}
function timeRange(text){
 const s=clean(text);
 const m=timeRegex.exec(s);
 if(!m)return null;
 const to24=(h,minutes,suffix)=>{
   const hour=+h,mm=+minutes;
   if(hour<1||hour>12||mm>59)return null;
   return pad(hour%12+(suffix.toUpperCase()==="PM"?12:0))+":"+pad(mm);
 };
 const startTime=to24(m[1],m[2],m[3]),endTime=to24(m[4],m[5],m[6]);
 if(!startTime||!endTime||startTime===endTime)return null;
 return{startTime,endTime,overnight:endTime<startTime,matched:m[0],index:m.index};
}
function explicitDate(s,ctx){
 const txt=clean(s);
 let m=txt.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
 if(m){const date=dateIso(+m[1],+m[2],+m[3]);if(date)return date;}
 m=txt.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
 if(m){let y=m[3]?+m[3]:ctx.year;if(y<100)y+=2000;const date=dateIso(y,+m[1],+m[2]);if(date)return date;}
 m=txt.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?!\s*[-–]\s*\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
 if(m){const ix=monthIndex(m[1]);if(ix!==-1){const date=dateIso(m[3]?+m[3]:ctx.year,ix+1,+m[2]);if(date)return date;}}
 return "";
}
function dayFromPrefix(raw){
 const str=clean(raw).replace(/[^A-Za-z0-9]+/g," ").trim();
 // Only accept a short weekday/day label, never an arbitrary number in a description.
 const m=str.match(/^(?:(Sun(?:day)?|Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:rs?(?:day)?)?|Fri(?:day)?|Sat(?:urday)?)\.?\s*)?([1-9]|[12]\d|3[01])(?:\s*[.:,])?$/i);
 if(!m)return null;
 return{day:+m[2],weekday:m[1]||""};
}
function rowDate(prefix,lines,index,ctx){
 const full=explicitDate(prefix,ctx);if(full)return full;
 const direct=dayFromPrefix(prefix);
 if(direct)return dateIso(ctx.year,ctx.month,direct.day);
 // OCR often puts the weekday and day number on separate lines.
 const start=Math.max(0,index-4);
 for(let i=index-1;i>=start;i--){
   const line=clean(lines[i]);
   if(timeRange(line))break;
   if(/\b(?:Inbox|Home|Menu|Shortcuts|Request)\b/i.test(line))break;
   const fullPrev=explicitDate(line,ctx);if(fullPrev&&line.length<42)return fullPrev;
   const candidate=dayFromPrefix(line);
   if(candidate)return dateIso(ctx.year,ctx.month,candidate.day);
 }
 return "";
}
function locationFrom(text,domain){
 if(domain!=="work")return "";
 const s=clean(text).replace(/\s*\/\s*/g,"/");
 if(/\bIOA\s*\/\s*Lost\b|\bLost\s+Continent\b/i.test(s))return "IOA · Lost Continent";
 if(/\bHogsmeade\b/i.test(s))return "IOA · Hogsmeade";
 if(/\bMarvel\b/i.test(s))return "IOA · Marvel";
 if(/\bPort of Entry\b/i.test(s))return "IOA · Port of Entry";
 if(/\bUSF\s*\/\s*London\b/i.test(s))return "USF · London";
 if(/\bUSF\s*\/\s*San Francisco\b/i.test(s))return "USF · San Francisco";
 return "";
}
function makeEvent(date,time,domain,location){
 return{id:uid(),domain,title:domain==="work"?"Work shift":domain==="school"?"Class":"Event",
  date,startTime:time.startTime,endTime:time.endTime,allDay:false,location:location||"",notes:"",
  repeat:"none",weekdays:[],until:""};
}
function unique(rows){const seen=new Set();return rows.filter(e=>{
 const key=[e.domain,e.date,e.startTime,e.endTime].join("|");
 if(seen.has(key))return false;seen.add(key);return true;
}).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));}
function countRanges(text){return String(text||"").split(/\r?\n/).reduce((n,line)=>n+(timeRange(line)?1:0),0);}
function parseText(raw,domain,year,month){
 const lines=String(raw||"").split(/\r?\n/).map(clean).filter(Boolean).slice(0,500);
 const ctx=context(raw,year,month),candidates=[];
 for(let i=0;i<lines.length;i++){
  const t=timeRange(lines[i]);if(!t)continue;
  const prefix=lines[i].slice(0,t.index).trim();
  const date=rowDate(prefix,lines,i,ctx);
  let description=lines[i];
  for(let k=i+1;k<Math.min(lines.length,i+5);k++){
   if(timeRange(lines[k])||dayFromPrefix(lines[k]))break;
   description+=" "+lines[k];
  }
  candidates.push({date,time:t,location:locationFrom(description,domain),estimatedDate:false});
 }
 // If OCR recognized a time range but lost its date label, propose a nearby
 // date from neighboring shifts and clearly flag it for review.
 const move=(iso,days)=>{
  const [y,m,d]=iso.split("-").map(Number);
  const dt=new Date(y,m-1,d+days);
  return dateIso(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
 };
 for(let i=0;i<candidates.length;i++){
  if(candidates[i].date)continue;
  let prev=i-1;while(prev>=0&&!candidates[prev].date)prev--;
  let next=i+1;while(next<candidates.length&&!candidates[next].date)next++;
  let guessed="";
  if(prev>=0)guessed=move(candidates[prev].date,i-prev);
  else if(next<candidates.length)guessed=move(candidates[next].date,i-next);
  if(guessed){candidates[i].date=guessed;candidates[i].estimatedDate=true;}
 }
 const results=candidates.filter(row=>row.date).map(row=>({
  ...makeEvent(row.date,row.time,domain,row.location),estimatedDate:row.estimatedDate
 }));
 return unique(results).slice(0,100);
}
function wordsFromTsv(tsv){
 const lines=String(tsv||"").split(/\r?\n/);
 const header=lines[0]?.split("\t");
 if(!header||!header.includes("left")||!header.includes("text"))return[];
 const idx=Object.fromEntries(header.map((n,i)=>[n,i]));
 const out=[];
 for(let i=1;i<lines.length;i++){
  const cells=lines[i].split("\t");
  if(+cells[idx.level]!==5)continue;
  const text=clean(cells.slice(idx.text).join("\t"));
  const left=+cells[idx.left],top=+cells[idx.top],width=+cells[idx.width],height=+cells[idx.height];
  if(!text||!Number.isFinite(left)||!Number.isFinite(top)||!Number.isFinite(width)||!Number.isFinite(height))continue;
  out.push({text,left,right:left+width,top,center:top+height/2,height});
 }
 return out;
}
function parseTsv(tsv,raw,domain,year,month){
 const words=wordsFromTsv(tsv);
 if(words.length<5)return[];
 const ctx=context(raw,year,month);
 const maxX=Math.max(...words.map(w=>w.right)),maxY=Math.max(...words.map(w=>w.top+w.height));
 const heights=words.map(w=>w.height).filter(Boolean).sort((a,b)=>a-b);
 const median=heights[Math.floor(heights.length/2)]||16;
 const tolerance=Math.max(10,Math.min(24,median*.65));
 const lines=[];
 for(const word of [...words].sort((a,b)=>a.center-b.center||a.left-b.left)){
  let line=lines.find(l=>Math.abs(l.center-word.center)<=tolerance);
  if(!line){line={center:word.center,words:[]};lines.push(line);}
  line.words.push(word);
  line.center=(line.center*(line.words.length-1)+word.center)/line.words.length;
 }
 const timeLines=lines.map(l=>({...l,text:[...l.words].sort((a,b)=>a.left-b.left).map(w=>w.text).join(" ")}))
   .map(l=>({...l,time:timeRange(l.text)})).filter(l=>l.time);
 const candidates=words.filter(w=>w.left<maxX*.24)
   .map(w=>({word:w,match:w.text.replace(/[^0-9]/g,"").match(/^\d{1,2}$/)}))
   .filter(v=>v.match&&+v.match[0]>=1&&+v.match[0]<=31);
 const out=[];
 for(const line of timeLines){
  const t=line.time;
  const maxDistance=Math.max(34,Math.min(90,maxX*.125));
  const target=[...candidates].filter(c=>Math.abs(c.word.center-line.center)<=maxDistance)
   .sort((a,b)=>Math.abs(a.word.center-line.center)-Math.abs(b.word.center-line.center))[0];
  if(!target)continue;
  const date=dateIso(ctx.year,ctx.month,+target.match[0]);
  if(!date)continue;
  // Capture text beneath this shift card, stopping before another shift row.
  const nextTimeY=Math.min(maxY+1,...timeLines.filter(l=>l.center>line.center+18).map(l=>l.center));
  const desc=words.filter(w=>w.left>maxX*.2&&w.center>=line.center-15&&w.center<Math.min(nextTimeY-20,line.center+165)).sort((a,b)=>a.center-b.center||a.left-b.left).map(w=>w.text).join(" ");
  out.push(makeEvent(date,t,domain,locationFrom(desc,domain)));
 }
 return unique(out).slice(0,100);
}
window.CommandImportParser={parseText,parseTsv,countRanges,context,timeRange};
})();