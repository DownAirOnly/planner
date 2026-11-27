/* Shift-card OCR for the light-blue UKG/My Schedule calendar format.
   Uses the colored card boundaries to keep each date/time/position together.
   Other screenshot formats continue through the generic parser. */
(function(){
"use strict";
const dayNames=["sun","mon","tue","wed","thu","fri","sat"];
const monthNames=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const clean=t=>String(t||"").replace(/\u00a0/g," ").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim();
function isoDate(year,month,day){
 const d=new Date(year,month-1,day);
 if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return "";
 return year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
// Visible weeks can cross month boundaries (Mar 30–Apr 5).
// Use only uniquely matching weekday/day labels near a boundary.
function dateFromObservedWeekday(year,month,day,weekday){
 const offsets=[0];
 if(day<=7)offsets.push(1);
 if(day>=24)offsets.push(-1);
 const matches=[];
 for(const offset of offsets){
  const start=new Date(year,month-1+offset,1);
  const date=isoDate(start.getFullYear(),start.getMonth()+1,day);
  if(date&&dayNames[new Date(date+"T12:00:00").getDay()]===weekday)
   matches.push({date,adjacentMonth:offset!==0});
 }
 return matches.length===1?matches[0]:null;
}
function observedDay(text,year,month,weekStart=""){
 const lines=String(text||"").split(/\r?\n/).map(clean).filter(Boolean);
 const found=[];
 for(let i=0;i<lines.length;i++){
  const match=/^(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?)\.?$/i.exec(lines[i]);
  if(!match)continue;
  const weekday=match[1].slice(0,3).toLowerCase();
  let day=0,guessed=false;
  for(let j=i+1;j<Math.min(lines.length,i+4);j++){
   if(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(lines[j]))break;
   const token=lines[j].replace(/\s/g,"").replace(/[.,]$/,"");
   let value=token;
   if(/^[1-3]\d?\/$/.test(token)){value=token.replace("/","7");guessed=true;}
   if(/^(?:[1-9]|[12]\d|3[01])$/.test(value)){day=Number(value);break;}
  }
  if(weekStart){
   const start=new Date(weekStart+"T12:00:00"),ordinal=dayNames.indexOf(weekday);
   if(!Number.isNaN(start.getTime())&&start.getDay()===0&&ordinal>=0){
    start.setDate(start.getDate()+ordinal);
    const date=isoDate(start.getFullYear(),start.getMonth()+1,start.getDate());
    const agrees=day===start.getDate()&&!guessed;
    found.push({date,weekday,dayRead:day||null,confidence:"high",
      reason:agrees?"Visible week heading, weekday and day agree":
        "Date resolved from observed week heading and weekday; digit OCR was incomplete"});
    continue;
   }
  }
  if(!day){found.push({date:"",weekday,dayRead:null,confidence:"low",
    reason:"Weekday read, but day number missing"});continue;}
  const matched=dateFromObservedWeekday(year,month,day,weekday);
  if(matched)found.push({date:matched.date,weekday,dayRead:day,
    confidence:(guessed||matched.adjacentMonth)?"medium":"high",
    reason:guessed?"Date glyph may be 7; confirm screenshot":
      matched.adjacentMonth?"Weekday and day match a neighboring month":
        "Weekday and date visibly printed"});
  else found.push({date:"",weekday,dayRead:day,confidence:"low",
    reason:"Weekday and day do not match screenshot month; review within visible week"});
 }
 return found.length?found[found.length-1]:null;
}
function parseHeader(text,year,month){
 const raw=clean(text);
 const m="(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
 const heading=new RegExp("\\b"+m+"\\.?\\s+(20\\d{2})\\b","i").exec(raw);
 const ix=heading?monthNames.findIndex(n=>heading[1].toLowerCase().startsWith(n)):-1;
 const found=ix>=0;
 const y=found?Number(heading[2]):year,mo=found?ix+1:month;
 const range=new RegExp("\\b"+m+"\\.?\\s+(\\d{1,2})\\s*[-–—]\\s*(?:"+m+"\\.?\\s+)?(\\d{1,2})\\b","i").exec(raw);
 let weekStart="";
 if(range){
  const mi=monthNames.findIndex(n=>range[1].toLowerCase().startsWith(n))+1;
  const next=range[3]?monthNames.findIndex(n=>range[3].toLowerCase().startsWith(n))+1:mi;
  const from=new Date(y,mi-1,Number(range[2]),12);
  let to=new Date(y,next-1,Number(range[4]),12);
  if(to<from)to=new Date(y+(next<mi?1:0),next-1+(next===mi?1:0),Number(range[4]),12);
  if(mi>0&&next>0&&from.getDay()===0&&Math.round((to-from)/86400000)===6)
   weekStart=isoDate(from.getFullYear(),from.getMonth()+1,from.getDate());
 }
 return {year:y,month:mo,fromHeader:found,weekStart};
}

function findCards(imageData,width,height){
 if(!imageData?.data||width<300||height<500)return[];
 const data=imageData.data;
 const points=[Math.round(width*.60),Math.round(width*.77),Math.round(width*.84)];
 const yStart=Math.round(height*.20),yEnd=Math.round(height*.93);
 const gap=Math.max(8,Math.round(width*.015));
 const minCard=Math.max(85,Math.round(width*.065));
 const cards=[];let begin=-1,last=-1;
 for(let y=yStart;y<yEnd;y++){
  let hits=0;
  for(const x of points){
   const at=(y*width+x)*4,r=data[at],g=data[at+1],b=data[at+2];
   const blue=r>=230&&r<=252&&g>=r+2&&b>=g+1&&b<=255;
   // The selected day uses gray rather than the usual light-blue card.
   const selectedGray=r>=208&&r<=236&&g>=r&&g-r<=7&&b>=g+1&&b-g<=9&&b<=245;
   if(blue||selectedGray)hits++;
  }
  if(hits>=2){if(begin<0)begin=y;last=y;}
  else if(begin>=0&&y-last>gap){
   if(last-begin>=minCard)cards.push({top:begin,bottom:last});
   begin=-1;last=-1;
  }
 }
 if(begin>=0&&last-begin>=minCard)cards.push({top:begin,bottom:last});
 // Misclassified tiny fragments or banners must not create a shift.
 return cards.filter(c=>c.bottom-c.top>minCard).slice(0,20);
}
function crop(source,x,y,width,height,scale=1,enhance=false){
 const can=document.createElement("canvas");
 can.width=Math.max(1,Math.round(width*scale));
 can.height=Math.max(1,Math.round(height*scale));
 const ctx=can.getContext("2d",{willReadFrequently:false});
 if(!ctx)throw Error("Could not prepare screenshot crop");
 ctx.fillStyle="#fff";ctx.fillRect(0,0,can.width,can.height);
 if(enhance)ctx.filter="grayscale(100%) contrast(150%)";
 ctx.drawImage(source,x,y,width,height,0,0,can.width,can.height);
 return can;
}
function emptyRow(domain,parsed,dateInfo){
 const random=typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():
    "shift-"+Date.now()+"-"+Math.random().toString(36).slice(2);
 const row=parsed||{id:random,domain,title:domain==="work"?"Work shift":domain==="school"?"Class":"Event",
  date:"",startTime:"",endTime:"",allDay:false,park:domain==="work"?"IOA":"",
  location:"",assignment:"",zoneColor:"",notes:"",breakMinutes:null,
  repeat:"none",weekdays:[],until:""};
 return {...row,date:dateInfo?.date||"",dateConfidence:dateInfo?.confidence||"low",
   confidenceReason:dateInfo?.reason||"Date missing from screenshot — set it before saving",
   estimatedDate:!dateInfo,reviewed:false,_include:dateInfo?.confidence==="high"&&!!row.startTime&&!!row.endTime};
}
function cardRow(cardText,dateInfo,domain,year,month){
 const parser=window.CommandImportParser;
 const time=parser.timeRange(cardText);
 if(!time)return emptyRow(domain,null,dateInfo);
 const date=dateInfo?.date||isoDate(year,month,1);
 const rows=parser.parseText(date+"\n"+cardText,domain,year,month);
 let parsed=rows.find(x=>x.startTime===time.startTime&&x.endTime===time.endTime);
 if(!parsed){
  parsed=parser.timeOnlyRows(cardText,domain)[0]||null;
 }
 return emptyRow(domain,parsed,dateInfo);
}
// When a large multi-line card loses its first line, reread the time line
// independently. The user should not have to supply a shift time that is
// clearly printed on the screenshot.
async function focusedTimeText(canvas,card,worker){
 const width=canvas.width,height=canvas.height;
 const x=Math.round(width*.26),right=Math.round(width*.89);
 const top=Math.max(0,card.top-Math.round(width*.008));
 const bottom=Math.min(height,card.top+Math.round(width*.112));
 if(bottom<=top)return "";
 const strip=crop(canvas,x,top,right-x,bottom-top,2,true);
 try{
  try{await worker.setParameters?.({tessedit_pageseg_mode:"7"});}catch{}
  const result=await worker.recognize(strip,{}, {text:true});
  return result?.data?.text||"";
 }finally{
  try{await worker.setParameters?.({tessedit_pageseg_mode:"6"});}catch{}
 }
}
async function read(file,worker,year,month,domain,onProgress=()=>{}){
 if(typeof createImageBitmap!=="function"||typeof document==="undefined")return {recognized:false};
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  const canvas=document.createElement("canvas");
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return {recognized:false};
  ctx.drawImage(bitmap,0,0);
  const blocks=findCards(ctx.getImageData(0,0,canvas.width,canvas.height),canvas.width,canvas.height);
  if(!blocks.length)return {recognized:false};
  // Only choose this specialized method when there are distinct blue cards
  // typical of the source schedule's UI. Never infer shifts from text alone.
  const rows=[],stats={cards:blocks.length,dates:0,unconfirmed:0,missingTimes:0,clipped:0};
  const heights=blocks.map(c=>c.bottom-c.top).sort((a,b)=>a-b);
  const typicalHeight=heights[Math.floor(heights.length/2)]||0;
  try{await worker.setParameters?.({tessedit_pageseg_mode:"6"});}catch{}
  for(let i=0;i<blocks.length;i++){
   const card=blocks[i],w=canvas.width,h=canvas.height;
   onProgress("Reading shift card "+(i+1)+" of "+blocks.length+"…");
   const left=Math.round(w*.20),right=Math.round(w*.92);
   const cardStart=Math.max(0,card.top-Math.round(w*.015));
   const cardEnd=Math.min(h,card.bottom+Math.round(w*.018));
   const cardCanvas=crop(canvas,left,cardStart,right-left,cardEnd-cardStart);
   const cardResult=await worker.recognize(cardCanvas,{}, {text:true});
   const description=cardResult?.data?.text||"";
   let shiftText=description;
   // The focused read is only needed if the usual multiline OCR loses
   // the time range. Keep the full card for position and area extraction.
   if(!window.CommandImportParser.timeRange(shiftText)){
    const focused=await focusedTimeText(canvas,card,worker);
    if(window.CommandImportParser.timeRange(focused))shiftText=focused+"\n"+description;
   }
   // Date labels align with the top of their own card. Excluding the
   // previous card's label prevents attaching a shift to the wrong day.
   const gutterTop=Math.max(Math.round(h*.18),card.top-Math.round(w*.09));
   const gutterBottom=Math.min(h,card.top+Math.round(w*.19));
   const gutterCanvas=crop(canvas,Math.round(w*.075),gutterTop,Math.round(w*.105),
     gutterBottom-gutterTop,3,true);
   const gutter=await worker.recognize(gutterCanvas,{}, {text:true});
   const dateInfo=observedDay(gutter?.data?.text||"",year,month);
   const row=cardRow(shiftText,dateInfo,domain,year,month);
   // A partial card clipped by scrolling is not an additional shift.
   // Keep full-size cards with missing time for explicit review.
   if(!row.startTime&&!row.endTime&&typicalHeight>0&&
      card.bottom-card.top<typicalHeight*.55){stats.clipped++;continue;}
   row._ocrCardIndex=i+1;
   rows.push(row);
   if(dateInfo)stats.dates++;
   if(!row._include)stats.unconfirmed++;
   if(!row.startTime||!row.endTime){
    stats.missingTimes++;
    // A date without a time cannot be saved as a shift. Keep this evidence
    // for diagnostics but do not display a blank editable proposal.
    row._omitFromReview=true;
   }
  }
  return {recognized:true,rows,stats};
 }finally{bitmap?.close?.();}
}
window.CommandScheduleCardOCR={findCards,observedDay,cardRow,read};
})();