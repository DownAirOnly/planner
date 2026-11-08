(function(){
"use strict";
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOMAINS={work:{label:"Work",color:"work"},school:{label:"School",color:"school"},personal:{label:"Personal",color:"personal"}};
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic=(name,extra="")=>'<svg class="icon '+extra+'" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>';
const pad=n=>String(n).padStart(2,"0");
const localDate=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromDate=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||"");if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;};
const shiftDate=(d,num)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+num);return x;};
const labelDate=s=>{const d=fromDate(s);return d?d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):s;};
const fullDate=s=>{const d=fromDate(s);return d?d.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}):s;};
const clock=t=>{if(!t)return"";const bits=t.split(":");let h=+bits[0];return (h%12||12)+":"+bits[1]+" "+(h>=12?"PM":"AM");};
const uid=()=>crypto&&crypto.randomUUID?crypto.randomUUID():"event-"+Date.now()+"-"+Math.floor(Math.random()*99999);
const fmtTime=e=>e.allDay?"All day":[clock(e.startTime),clock(e.endTime)].filter(Boolean).join("–");
const timekeeping=window.CommandTimekeeping;

const ASSIGNMENTS=[["","Not set"],["lead","Lead"],["support","Area Support"],["zones","Zones"],["rtc","RTC"],["detail","Detail"],["other","Other"]];
const ZONE_COLORS=[["","Choose zone"],["red","Red Zone"],["orange","Orange Zone"],["yellow","Yellow Zone"],["green","Green Zone"],["blue","Blue Zone"],["purple","Purple Zone"]];
const PARKS=[["IOA","Islands of Adventure"],["USF","Universal Studios Florida"],["CityWalk","CityWalk"],["Other","Other"]];
const assignmentLabel=e=>e.assignment==="zones"?(ZONE_COLORS.find(x=>x[0]===e.zoneColor)?.[1]||"Zones"):(ASSIGNMENTS.find(x=>x[0]===e.assignment)?.[1]||"");
const displayLocation=e=>{
 const loc=String(e.location||"").replace(/^IOA\s*[·/-]\s*/i,"").trim().replace(/^Hogsmeade(?: Village)?$/i,"Hogsmeade Village");
 const park=e.park||(/^(?:IOA|USF|CityWalk)\b/.exec(e.location||"")?.[0])||"IOA";
 if(e.domain!=="work")return loc;
 return park==="IOA"?loc:[park,loc].filter(Boolean).join(" · ");
};
const workMeta=e=>{const assignment=assignmentLabel(e)+(e.assignmentEstimated?" (suggested)":"");const area=displayLocation(e)+(e.locationEstimated?" (suggested)":"");return [assignment,area].filter(Boolean).join(" · ");};
const zoneStyle=e=>e.assignment==="zones"&&!!e.zoneColor&&ZONE_COLORS.some(x=>x[0]===e.zoneColor)?' zone-'+e.zoneColor:"";
const options=(arr,value)=>arr.map(([key,label])=>'<option value="'+esc(key)+'" '+(key===value?"selected":"")+'>'+esc(label)+'</option>').join("");
function workFields(e,suffix){
 const name=(field)=>field+(suffix!==""?"-"+suffix:"");
 const loc=String(e.location||"").replace(/^(?:IOA|USF|CityWalk)\s*[·/-]\s*/i,"").trim();
 return '<div class="work-fields">'+
  '<div class="field"><label>What am I doing?</label><select name="'+name("assignment")+'" class="work-assignment-select">'+options(ASSIGNMENTS,e.assignment||"")+'</select></div>'+
  '<div class="field work-zone-field" '+(e.assignment==="zones"?"":"hidden")+'><label>Zone color</label><select name="'+name("zoneColor")+'">'+options(ZONE_COLORS,e.zoneColor||"")+'</select></div>'+
  '<div class="form-grid"><div class="field"><label>Park</label><select name="'+name("park")+'">'+options(PARKS,e.park||"IOA")+'</select></div>'+
  '<div class="field"><label>Area (optional)</label><input name="'+name("location")+'" value="'+esc(loc)+'" placeholder="Lost Continent"></div></div>'+
 '</div>';
}

const keyDate=d=>d.getDay();
function visibleOnDate(e,iso){
 if(!e||!iso||!e.date||iso<e.date)return false;
 if(e.repeat==="weekly"){
   if(e.until&&iso>e.until)return false;
   const d=fromDate(iso);return !!d&&Array.isArray(e.weekdays)&&e.weekdays.includes(d.getDay());
 }
 return e.date===iso;
}
function parseIso(value){
 const d=fromDate(value);return d?localDate(d):"";
}
function parseDateLoose(raw,year){
 const s=String(raw).replace(/[|]/g," ");
 let m=s.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
 if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);if(d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3])return {iso:localDate(d),matched:m[0]};}
 m=s.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
 if(m){let y=m[3]?+m[3]:year;if(y<100)y+=2000;const d=new Date(y,+m[1]-1,+m[2]);if(d.getFullYear()===y&&d.getMonth()===+m[1]-1&&d.getDate()===+m[2])return{iso:localDate(d),matched:m[0]};}
 m=s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
 if(m){const names=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];const month=names.findIndex(x=>m[1].toLowerCase().startsWith(x));const y=m[3]?+m[3]:year;const d=new Date(y,month,+m[2]);if(month>=0&&d.getFullYear()===y&&d.getMonth()===month&&d.getDate()===+m[2])return{iso:localDate(d),matched:m[0]};}
 return null;
}
function parseTimeRange(text){
 const s=String(text).replace(/[\u2013\u2014\u2212]/g,"-").replace(/\bto\b/gi,"-");
 const pattern=/\b(\d{1,2})(?::(\d{2}))\s*(AM|PM|A|P)?\s*-\s*(\d{1,2})(?::(\d{2}))\s*(AM|PM|A|P)?\b/i;
 const m=s.match(pattern);if(!m)return null;
 let a=m[3]?m[3].toUpperCase():"",b=m[6]?m[6].toUpperCase():"";
 const normalizeSuffix=x=>x==="A"?"AM":x==="P"?"PM":x;
 a=normalizeSuffix(a);b=normalizeSuffix(b);
 // Missing AM/PM is ambiguous (8:00 - 4:00 PM could mean 8 AM - 4 PM).
 // Do not create a misleading event without a clear time range.
 if(!a||!b)return null;
 const conv=(hour,min,suffix)=>{
  let h=+hour,minute=+min;
  if(h<1||h>12||minute>59)return null;
  return pad((h%12)+(suffix==="PM"?12:0))+":"+pad(minute);
 };
 const start=conv(m[1],m[2],a),end=conv(m[4],m[5],b);
 return start&&end?{startTime:start,endTime:end,matched:m[0]}:null;
}
function parseImportedText(raw,domain,year,month){return window.CommandImportParser.parseText(raw,domain,year,month);}
function create({getEvents,updateEvents,getSchedulePrefs,setSchedulePrefs,showSheet,closeSheet,toast,openSchedule}){
 const UI_PREFS_KEY="command.schedule.ui.v1";
 function readUiPrefs(){
  try{
   const raw=JSON.parse(localStorage.getItem(UI_PREFS_KEY)||"{}");
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
   return raw;
  }catch{return {};}
 }
 const storedUi=readUiPrefs();
 const savedDomain=["work","school","personal","all"].includes(storedUi.domain)?storedUi.domain:"work";
 const savedMode=["week","month","day","fourweeks"].includes(storedUi.mode)?storedUi.mode:"week";
 const safeMode=savedDomain==="work"&&savedMode==="day"||savedDomain!=="work"&&savedMode==="fourweeks"?"week":savedMode;
 const ui={domain:savedDomain,mode:safeMode,periodMode:storedUi.periodMode==="work"?"work":"pay",selected:localDate(new Date()),fourWeekStart:localDate(shiftDate(new Date(),-new Date().getDay())),workingImport:null};
 const rememberUi=()=>{
  try{localStorage.setItem(UI_PREFS_KEY,JSON.stringify({domain:ui.domain,mode:ui.mode,periodMode:ui.periodMode}));}
  catch(error){console.warn("Schedule view preference was not saved.",error);}
 };
 const events=()=>getEvents()||[];
 const usualWorkdays=()=>getSchedulePrefs?.()?.usualWorkdays||[5,6,0,1,2];
 const workWeekOrder=[5,6,0,1,2,3,4];
 const workweekText=()=>{
   const usual=usualWorkdays();
   if([5,6,0,1,2].every(n=>usual.includes(n))&&usual.length===5)return "Fri–Tue";
   return workWeekOrder.filter(n=>usual.includes(n)).map(n=>DAYS[n]).join(", ");
 };
 const sortedDraft=rows=>(rows||[]).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.startTime||"").localeCompare(String(b.startTime||"")));
 const filter=e=>ui.domain==="all"||e.domain===ui.domain;
 const selectedEvents=(iso)=>events().filter(e=>filter(e)&&visibleOnDate(e,iso)).sort((a,b)=>(a.allDay?"":a.startTime).localeCompare(b.allDay?"":b.startTime));
 const dateEvents=(iso,domain)=>events().filter(e=>(!domain||e.domain===domain)&&visibleOnDate(e,iso)).sort((a,b)=>a.startTime.localeCompare(b.startTime));
 const period=()=>timekeeping.period(ui.selected,ui.periodMode);
 const periodEvents=()=>period().days.flatMap(date=>dateEvents(date,"work").map(e=>({...e,occurrenceDate:date})));
 const duration=e=>timekeeping.minutesLabel(timekeeping.shiftTotals(e).scheduled);
 const adjusted=e=>timekeeping.minutesLabel(timekeeping.shiftTotals(e).adjusted);
 const breakDisplay=e=>timekeeping.shiftTotals(e).breaks+"m";
 function timeSummary(t){
  return '<div class="schedule-time-summary"><div><strong>'+timekeeping.minutesLabel(t.scheduled)+'</strong><span>Scheduled</span></div>'+
    '<div><strong>−'+timekeeping.minutesLabel(t.breaks)+'</strong><span>Breaks</span></div>'+
    '<div><strong>'+timekeeping.minutesLabel(t.adjusted)+'</strong><span>Adjusted</span></div></div>';
 }
 function breakFields(e,suffix){
  const name=k=>k+(suffix!==""?"-"+suffix:"");
  const m=timekeeping.validOverride(e.breakMinutes);
  const auto=timekeeping.autoBreakMinutes(timekeeping.scheduledMinutes(e));
  return '<div class="schedule-break-field"><label>Break deduction</label><div class="schedule-break-inputs">'+
    '<select class="schedule-break-mode" name="'+name("breakMode")+'"><option value="auto" '+(m===null?"selected":"")+'>Automatic ('+auto+' min)</option>'+
    '<option value="manual" '+(m!==null?"selected":"")+'>Manual</option></select>'+
    '<div class="schedule-break-manual" '+(m===null?"hidden":"")+'><input type="number" min="0" max="1440" step="1" inputmode="numeric" name="'+name("breakMinutes")+'" value="'+(m===null?"":m)+'" aria-label="Manual break minutes"><span>min</span></div></div>'+
    '<small>Auto: 0 min up to 6h; 15 min over 6h; 30 min over 8h.</small></div>';
 }
 function breakValue(values,suffix,entry){
  const name=k=>k+(suffix!==""?"-"+suffix:"");
  if(values.get(name("breakMode"))!=="manual")return null;
  const input=String(values.get(name("breakMinutes"))??"").trim();
  if(!input)throw new Error("Enter manual break minutes, or switch to Automatic.");
  const amount=Number(input),duration=timekeeping.scheduledMinutes(entry);
  if(!Number.isInteger(amount)||amount<0||amount>1440)throw new Error("Break must be a whole number of minutes between 0 and 1440.");
  if(duration!=null&&amount>duration)throw new Error("Break cannot exceed the scheduled shift length.");
  return amount;
 }
 function periodHeader(p){
  return labelDate(p.start)+' – '+labelDate(p.end);
 }
 function workPeriodSummary(){
  const p=period(),items=periodEvents(),totals=timekeeping.aggregate(items);
  return '<section class="schedule-period-block">'+
    '<div class="schedule-period-switch" role="group" aria-label="Hours grouping">'+
      '<button type="button" class="'+(ui.periodMode==="pay"?"active":"")+'" data-action="schedule-period" data-period="pay">Pay Week</button>'+
      '<button type="button" class="'+(ui.periodMode==="work"?"active":"")+'" data-action="schedule-period" data-period="work">Work Week</button></div>'+
    '<div class="schedule-period-caption"><strong>'+esc(periodHeader(p))+'</strong></div>'+
    timeSummary(totals)+
    
   '</section>';
 }
 function workShiftList(){
 const days=daysForView().map(localDate),count=days.reduce((n,d)=>n+dateEvents(d,"work").length,0);
 const rows=days.map(date=>{
  const items=dateEvents(date,"work");
  if(!items.length)return ui.mode==="week"?'<div class="schedule-compact-off"><span>'+esc(labelDate(date))+'</span><small>No shift saved</small></div>':"";
  return items.map(e=>'<button class="schedule-compact-shift'+zoneStyle(e)+'" data-action="schedule-edit" data-id="'+esc(e.id)+'"><span class="schedule-compact-day">'+esc(labelDate(date))+'</span><span class="schedule-compact-main"><strong>'+esc(fmtTime(e))+'</strong><small>'+esc(workMeta(e)||"Work shift")+'</small></span><strong class="schedule-compact-hours">'+esc(adjusted(e))+'</strong></button>').join("");
 }).join("");
 return '<section class="section schedule-agenda schedule-work-list"><div class="section-head"><h2>Shifts</h2><span class="muted">'+count+' scheduled</span></div>'+
  (count?'<div class="schedule-compact-list">'+rows+'</div>':'<div class="empty"><strong>No shifts saved here</strong><p>Import or add your work schedule.</p></div>')+'</section>';
}
function homeWorkShifts(){
 const now=new Date(),minute=now.getHours()*60+now.getMinutes(),list=[];
 for(let offset=0;offset<366&&list.length<3;offset++){
  const date=localDate(shiftDate(now,offset));
  for(const e of dateEvents(date,"work")){
   if(offset===0&&e.startTime&&!e.allDay){
    const [h,m]=e.startTime.split(":").map(Number),start=h*60+m,duration=timekeeping.scheduledMinutes(e);
    if((duration!==null&&minute>=start+duration)||(duration===null&&minute>start))continue;
   }
   list.push({...e,occurrenceDate:date});if(list.length===3)break;
  }
 }
 return '<section class="section schedule-next-shifts"><div class="section-head"><h2>Next shifts</h2><button class="subtle-link" data-action="schedule-jump" data-domain="work">Schedule</button></div>'+
 (list.length?'<div class="schedule-next-list">'+list.map(e=>'<button class="schedule-next-row'+zoneStyle(e)+'" data-action="schedule-jump" data-domain="work" data-date="'+esc(e.occurrenceDate)+'"><span class="schedule-next-date">'+esc(labelDate(e.occurrenceDate))+'</span><strong class="schedule-next-time">'+esc(fmtTime(e))+'</strong><small class="schedule-next-meta">'+esc(workMeta(e)||"Work")+'</small>'+ic("chevron-right","tiny")+'</button>').join("")+'</div>':'<div class="schedule-next-empty">No upcoming work shifts saved.</div>')+'</section>';
}
function nextEvent(domain){
   const now=new Date(),day0=localDate(now);
   for(let i=0;i<365;i++){const day=localDate(shiftDate(now,i));const possible=dateEvents(day,domain).filter(e=>i!==0||e.allDay||!e.endTime||(day+"T"+e.endTime)>=day0+"T"+pad(now.getHours())+":"+pad(now.getMinutes()));if(possible.length)return{...possible[0],occurrenceDate:day};}
   return null;
 }
 function homeSummary(){
   const domains=["school","personal"];
   return '<section class="section"><div class="section-head"><h2>Coming up</h2><button class="subtle-link" data-action="schedule-jump" data-domain="work">Calendar '+ic("arrow","tiny")+'</button></div><div class="schedule-home-grid">'+domains.map(domain=>{
    const next=nextEvent(domain),heading=domain==="work"?"Next shift":domain==="school"?"Next class":"Next plan";
    return '<button class="schedule-home-item" data-action="schedule-jump" data-domain="'+domain+'"><span class="schedule-tag '+domain+'">'+(domain==="work"?"Work":domain==="school"?"School":"Personal")+'</span><span class="schedule-home-heading">'+heading+'</span><span class="schedule-home-primary">'+(next?esc(labelDate(next.occurrenceDate)):"Nothing scheduled")+'</span><span class="schedule-home-secondary">'+(next?esc(fmtTime(next)+(workMeta(next)?" · "+workMeta(next):"")):(domain==="work"?"Add your work schedule":domain==="school"?"Add your class schedule":"Add a personal plan"))+'</span></button>';
   }).join("")+'</div></section>';
 }
 const heading=()=>{
   const date=fromDate(ui.selected);
   if(ui.mode==="week"||ui.mode==="fourweeks"){
     const visible=daysForView();
     return labelDate(localDate(visible[0]))+" – "+labelDate(localDate(visible[visible.length-1]));
   }
   return date.toLocaleDateString(undefined,ui.mode==="month"?{month:"long",year:"numeric"}:{weekday:"long",month:"long",day:"numeric"});
 };
 function daysForView(){
   const selected=fromDate(ui.selected);
   if(ui.mode==="day")return[selected];
   if(ui.mode==="fourweeks")return Array.from({length:28},(_,i)=>shiftDate(fromDate(ui.fourWeekStart),i));
   if(ui.mode==="week"){
     // Calendar weeks always start Sunday regardless of Work/Pay Week accounting.
     const start=shiftDate(selected,-selected.getDay());
     return Array.from({length:7},(_,i)=>shiftDate(start,i));
   }
   const first=new Date(selected.getFullYear(),selected.getMonth(),1);
   const start=shiftDate(first,-first.getDay());
   const last=new Date(selected.getFullYear(),selected.getMonth()+1,0);
   const total=Math.ceil((last.getDate()+first.getDay())/7)*7;
   return Array.from({length:total},(_,i)=>shiftDate(start,i));
 }
 function calendar(){
  const days=daysForView();
  let grid="";
  if(ui.mode!=="day"){
    grid='<div class="schedule-cal-head">'+["S","M","T","W","T","F","S"].map(v=>'<span>'+v+'</span>').join("")+'</div><div class="schedule-cal-grid '+ui.mode+'">'+days.map(d=>{
       const iso=localDate(d),matches=selectedEvents(iso),active=iso===ui.selected,other=d.getMonth()!==fromDate(ui.selected).getMonth();
       let dots="";
       if(matches.length)dots='<span class="schedule-dots">'+[...new Set(matches.map(e=>e.domain))].slice(0,3).map(domain=>'<i class="'+domain+'"></i>').join("")+'</span>';
       return '<button class="schedule-date '+(active?"selected ":"")+(other&&ui.mode==="month"?"outside":"")+'" data-action="schedule-select" data-date="'+iso+'" aria-label="'+esc(fullDate(iso))+', '+matches.length+' events"><span>'+d.getDate()+'</span>'+dots+'</button>';
    }).join("")+'</div>';
  }
  return '<div class="schedule-calendar"><div class="schedule-calendar-top"><button class="icon-button" data-action="schedule-prev" aria-label="Previous '+ui.mode+'">'+ic("chevron-left")+'</button><strong>'+esc(heading())+'</strong><div class="schedule-calendar-controls"><button class="today-button" data-action="schedule-today">Today</button><button class="icon-button" data-action="schedule-next" aria-label="Next '+ui.mode+'">'+ic("chevron-right")+'</button></div></div>'+grid+'</div>';
 }
 function eventRows(){
  const selected=selectedEvents(ui.selected);
  return '<section class="section schedule-agenda"><div class="section-head"><h2>'+esc(fullDate(ui.selected))+'</h2><span class="muted">'+selected.length+' event'+(selected.length===1?"":"s")+'</span></div>'+
   (selected.length?'<div class="schedule-event-list">'+selected.map(e=>'<button class="schedule-event '+e.domain+zoneStyle(e)+'" data-action="schedule-edit" data-id="'+esc(e.id)+'"><span class="schedule-event-line"></span><span class="schedule-event-body"><span class="schedule-event-title">'+esc(e.title)+'</span><span class="schedule-event-time">'+esc(fmtTime(e)+(e.domain==="work"?(workMeta(e)?" · "+workMeta(e):""):(e.location?" · "+e.location:"")))+'</span></span>'+ic("chevron-right")+'</button>').join("")+'</div>':
   '<div class="empty"><strong>No '+(ui.domain==="all"?"events":DOMAINS[ui.domain].label.toLowerCase()+" events")+' scheduled</strong><p>Add an event or import a schedule.</p></div>')+'</section>';
 }
 function render(){
 const modes=ui.domain==="work"?[["week","Week"],["month","Month"],["fourweeks","4 Weeks"]]:[["day","Day"],["week","Week"],["month","Month"]];
 return '<div class="schedule-domain-picker" role="group" aria-label="Calendar category">'+["work","school","personal","all"].map(d=>'<button data-action="schedule-domain" data-domain="'+d+'" class="'+(ui.domain===d?"active":"")+'">'+(d==="all"?"All":DOMAINS[d].label)+'</button>').join("")+'</div>'+
 '<div class="schedule-view-bar"><div class="schedule-view-picker" role="group" aria-label="Calendar view">'+modes.map(([mode,label])=>'<button data-action="schedule-mode" data-mode="'+mode+'" class="'+(ui.mode===mode?"active":"")+'">'+label+'</button>').join("")+'</div><div class="schedule-view-actions"><button class="button secondary" data-action="schedule-import">'+ic("upload")+' Import</button><button class="button" data-action="schedule-add">'+ic("plus")+' Add</button></div></div>'+
 calendar()+(ui.domain==="work"?workShiftList():eventRows())+
 (ui.domain==="work"?workPeriodSummary()+'<div class="schedule-workweek-note"><span>Usual workdays: <strong>'+esc(workweekText())+'</strong></span><button type="button" data-action="schedule-workweek">Edit</button></div>':"")+
 (ui.domain==="school"?'<p class="schedule-hint">Use Repeat weekly for recurring classes.</p>':"");
}
function eventForm(item={}){
  const domain=item.domain|| (ui.domain==="all"?"personal":ui.domain);
  const date=item.date||ui.selected;
  const val=(x)=>esc(item[x]??"");
  const title=item.id?"Edit event":"New event";
  showSheet('<div class="sheet-head"><h2 class="sheet-title">'+title+'</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+ic("x")+'</button></div>'+
   '<form id="schedule-event-form" data-id="'+val("id")+'"><div class="field"><label for="ev-title">Title</label><input id="ev-title" required name="title" value="'+val("title")+'" placeholder="Work shift, Biology lab, appointment"></div>'+
   '<div class="form-grid"><div class="field"><label for="ev-domain">Calendar</label><select id="ev-domain" name="domain">'+Object.keys(DOMAINS).map(d=>'<option value="'+d+'" '+(domain===d?"selected":"")+'>'+DOMAINS[d].label+'</option>').join("")+'</select></div><div class="field"><label for="ev-date">Date</label><input id="ev-date" type="date" required name="date" value="'+esc(date)+'"></div></div>'+
   '<div class="form-grid"><div class="field"><label for="ev-start">Start</label><input id="ev-start" type="time" name="startTime" value="'+val("startTime")+'"></div><div class="field"><label for="ev-end">End</label><input id="ev-end" type="time" name="endTime" value="'+val("endTime")+'"></div></div>'+
   '<div class="field"><label class="checkbox-label"><input type="checkbox" name="allDay" '+(item.allDay?"checked":"")+'> All day (no times)</label></div>'+
   '<div id="event-work-fields" '+(domain==="work"?"":"hidden")+'>'+workFields(item,"")+'</div>'+ 
   '<div class="field event-general-location" '+(domain==="work"?"hidden":"")+'><label for="ev-location">Location (optional)</label><input id="ev-location" name="generalLocation" value="'+val("location")+'"></div>'+
   '<div id="event-break-fields" '+(domain==="work"?"":"hidden")+'>'+breakFields(item,"")+'</div>'+
    '<div class="field"><label for="ev-notes">Notes (optional)</label><textarea id="ev-notes" name="notes" rows="2">'+esc(item.notes||"")+'</textarea></div>'+
   '<div class="field"><label for="ev-repeat">Repeat</label><select id="ev-repeat" name="repeat"><option value="none" '+(item.repeat!=="weekly"?"selected":"")+'>Does not repeat</option><option value="weekly" '+(item.repeat==="weekly"?"selected":"")+'>Every week</option></select></div>'+
   '<div class="schedule-repeat-options" id="schedule-repeat-options" '+(item.repeat==="weekly"?"":"hidden")+'><div class="field"><label>On these days</label><div class="weekday-row">'+DAYS.map((d,i)=>'<label class="weekday-check"><input type="checkbox" name="weekday" value="'+i+'" '+((item.weekdays||[fromDate(date)?.getDay()]).includes(i)?"checked":"")+'><span>'+d+'</span></label>').join("")+'</div></div>'+
   '<div class="field"><label for="ev-until">Repeat until (optional)</label><input id="ev-until" type="date" name="until" value="'+val("until")+'"></div><p class="schedule-hint">Editing or deleting a repeating event changes the whole series.</p></div>'+
   '<div class="sheet-actions">'+(item.id?'<button type="button" class="button danger" data-action="schedule-delete" data-id="'+val("id")+'">'+ic("trash")+' Delete</button>':'<span></span>')+'<button class="button" type="submit">'+ic("check")+' Save</button></div></form>');
 }
 function workweekForm(){
  const selected=usualWorkdays();
  showSheet('<div class="sheet-head"><h2 class="sheet-title">Usual workdays</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+ic("x")+'</button></div>'+
    '<p class="schedule-hint">These days help Command interpret unclear screenshot dates. Actual shifts still come from your schedule.</p>'+
    '<form id="schedule-workweek-form"><div class="schedule-weekday-prefs">'+workWeekOrder.map(d=>'<label class="schedule-workday-option"><input type="checkbox" name="usualDay" value="'+d+'" '+(selected.includes(d)?"checked":"")+'><span>'+["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d]+'</span></label>').join("")+'</div>'+
    '<div class="sheet-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button" type="submit">'+ic("check")+' Save days</button></div></form>');
 }
 function importForm(){
  const domain=ui.domain==="all"?"work":ui.domain;
  ui.workingImport={domain,rows:[],raw:"",ocrRows:[]};
  showSheet('<div class="sheet-head"><h2 class="sheet-title">Import schedule</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+ic("x")+'</button></div>'+
    '<div class="field"><label for="import-domain">Calendar</label><select id="import-domain">'+Object.keys(DOMAINS).map(d=>'<option value="'+d+'" '+(domain===d?"selected":"")+'>'+DOMAINS[d].label+'</option>').join("")+'</select></div>'+
    '<div class="field"><label for="schedule-image-input">Schedule screenshot</label><input type="file" id="schedule-image-input" accept="image/*" multiple></div>'+
    (domain==="work"?'<div class="schedule-workweek-import"><span>Usual workdays: '+esc(workweekText())+'</span></div>':"")+
    '<p id="schedule-ocr-status" class="schedule-hint" role="status">Choose a screenshot. Command will propose shifts for you to review.</p>'+
    '<div id="schedule-import-results" class="schedule-import-results"></div>'+
    '<details class="schedule-import-advanced"><summary>Other import options</summary><div class="schedule-import-advanced-content">'+
      '<div class="field"><label for="schedule-month">Schedule month</label><input id="schedule-month" type="month" value="'+esc(ui.selected.slice(0,7))+'"></div>'+
      '<button class="button secondary" data-action="schedule-ocr" type="button">'+ic("upload")+' Read screenshot again</button>'+
      '<div class="field"><label for="schedule-raw-text">Copied or extracted schedule text</label><textarea id="schedule-raw-text" rows="5" placeholder="Nov 6 2:45 PM-1:00 AM&#10;Nov 7 1:30 PM-8:30 PM"></textarea></div>'+
      '<button class="button secondary" data-action="schedule-parse" type="button">Build schedule from text</button>'+
      '<p class="schedule-hint">This text is only for troubleshooting. It is never added to your calendar as notes.</p>'+
    '</div></details>');
 }
 function importPreview(){
  const draft=ui.workingImport;if(!draft)return;
  const found=sortedDraft(draft.rows), target=document.querySelector("#schedule-import-results");if(!target)return;
  const existing=new Set(events().map(e=>[e.domain,e.date,e.startTime,e.endTime].join("|")));
  target.innerHTML=(found.length?'<div class="section-head schedule-review-heading"><h2>Proposed schedule</h2><span class="muted">'+found.length+' shift'+(found.length===1?"":"s")+'</span></div>'+
    '<p class="schedule-hint">Check the shifts, then save. Tap Edit to change anything.</p>'+
    '<form id="schedule-import-form"><div class="schedule-import-preview">'+found.map((row,i)=>{
      const duplicate=existing.has([row.domain,row.date,row.startTime,row.endTime].join("|"));
      const confidence=(!row.startTime||!row.endTime)?"low":(row.dateConfidence|| (row.estimatedDate?"low":"medium"));
      const level=typeof confidence==="string"?confidence:"medium";
      const confText=row.reviewed?"Reviewed":(level==="high"?"High confidence":level==="medium"?"Medium confidence":"Low confidence");
      const needsEdit=!row.startTime||!row.endTime;
      const detail=row.confidenceReason||(!row.startTime||!row.endTime?"Times could not be read":"Date and time inferred");
      const status=(!row.startTime||!row.endTime)?"Times need review":fmtTime(row);
      const totals=timekeeping.shiftTotals(row);
      const hours=totals.scheduled!=null?timekeeping.minutesLabel(totals.scheduled)+" scheduled · "+totals.breaks+"m break · "+timekeeping.minutesLabel(totals.adjusted)+" adjusted":"Hours need review";
      const detailHtml=(row.domain==="work"?workFields(row,i):
        '<div class="field"><label>Location</label><input name="location-'+i+'" value="'+esc(row.location)+'"></div>');
      return '<div class="schedule-proposed-row" data-review-row="'+i+'">'+
        '<div class="schedule-proposed-top"><label class="schedule-proposed-check"><input type="checkbox" name="include-'+i+'" '+(duplicate||row._include===false||needsEdit?"":"checked")+' aria-label="Include shift '+(i+1)+'">'+
          '<span class="schedule-proposed-main"><strong>'+esc(labelDate(row.date))+'</strong>'+
            '<span>'+esc(status)+'</span>'+
            '<small class="schedule-import-hours">'+esc(hours)+'</small>'+
            '<small class="schedule-work-summary'+zoneStyle(row)+'">'+esc(row.domain==="work"?workMeta(row):displayLocation(row))+'</small>'+
            '<small class="schedule-confidence confidence-'+(row.reviewed?"reviewed":level)+'" title="'+esc(detail)+'">'+confText+(row.reviewed||level==="high"?"":" · "+esc(detail))+'</small>'+
          '</span></label>'+
          '<button type="button" class="schedule-row-edit" data-action="schedule-review-toggle" data-index="'+i+'" aria-expanded="'+(needsEdit?"true":"false")+'">Edit</button></div>'+
        (duplicate?'<div class="schedule-duplicate-note">Already saved — unchecked</div>':"")+
        '<div class="schedule-row-editor" id="schedule-review-'+i+'" '+(needsEdit?"":"hidden")+'>'+
          '<div class="field"><label>Title</label><input name="title-'+i+'" value="'+esc(row.title)+'"></div>'+
          '<div class="form-grid"><div class="field"><label>Date</label><input type="date" name="date-'+i+'" value="'+esc(row.date)+'"></div>'+
          '<div class="field"><label>Start</label><input type="time" name="start-'+i+'" value="'+esc(row.startTime)+'"></div></div>'+
          '<div class="form-grid"><div class="field"><label>End</label><input type="time" name="end-'+i+'" value="'+esc(row.endTime)+'"></div></div>'+
          detailHtml+
          (row.domain==="work"?breakFields(row,i):"")+
          '<div class="field"><label>Notes</label><input name="notes-'+i+'" value="'+esc(row.notes)+'"></div>'+
          '<button type="button" class="button secondary" data-action="schedule-review-done" data-index="'+i+'">Done editing</button>'+
        '</div></div>';
    }).join("")+'</div><div class="schedule-import-actions"><button class="button" type="submit">'+ic("check")+' Save selected shifts</button>'+
      '<button class="button secondary" type="button" data-action="schedule-add-review">'+ic("plus")+' Add shift</button></div></form>':
      '<div class="schedule-review-empty"><strong>No shifts detected yet.</strong><p>Try another screenshot, or open Other import options to paste the schedule.</p>'+
      '<button class="button secondary" type="button" data-action="schedule-add-review">'+ic("plus")+' Add a shift</button></div>');
 }
 function preserveReviewEdits(){
  const draft=ui.workingImport,form=document.querySelector("#schedule-import-form");
  if(!draft||!form)return;
  const v=new FormData(form);
  draft.rows=draft.rows.map((row,i)=>({...row,
    date:parseIso(v.get("date-"+i))||row.date,
    title:String(v.get("title-"+i)||row.title).trim(),
    startTime:String(v.get("start-"+i)||""),
    endTime:String(v.get("end-"+i)||""),
    location:String(v.get("location-"+i)||"").trim(),
    park:String(v.get("park-"+i)||row.park||"IOA"),
    assignment:String(v.get("assignment-"+i)||""),
    zoneColor:String(v.get("zoneColor-"+i)||""),
    notes:String(v.get("notes-"+i)||"").trim(),
    breakMinutes:v.get("breakMode-"+i)==="manual"?timekeeping.validOverride(v.get("breakMinutes-"+i)):null,
    _include:v.has("include-"+i)
  }));
 }
 function toggleRow(index,forceClose=false){
  const fields=document.querySelector("#schedule-review-"+index);
  const button=document.querySelector('[data-action="schedule-review-toggle"][data-index="'+index+'"]');
  if(!fields)return;
  if(forceClose){
    preserveReviewEdits();
    const row=ui.workingImport?.rows[index];
    if(row){row.reviewed=true;row.estimatedDate=false;row.assignmentEstimated=false;row.locationEstimated=false;}
    sortedDraft(ui.workingImport.rows);
    importPreview();
    return;
  }
  fields.hidden=!fields.hidden;
  if(button){button.textContent=fields.hidden?"Edit":"Close";button.setAttribute("aria-expanded",String(!fields.hidden));}
 }
 function loadTesseract(){
  if(window.Tesseract&&typeof window.Tesseract.createWorker==="function")return Promise.resolve();
  if(window.__commandOcrPromise)return window.__commandOcrPromise;
  window.__commandOcrPromise=new Promise((resolve,reject)=>{
   const script=document.createElement("script");
   script.src="https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
   script.crossOrigin="anonymous";
   script.onload=()=>window.Tesseract?.createWorker?resolve():reject(new Error("OCR library did not initialize"));
   script.onerror=()=>reject(new Error("Could not load OCR. Try copying text from Photos instead."));
   document.head.appendChild(script);
  }).catch(err=>{window.__commandOcrPromise=null;throw err;});
  return window.__commandOcrPromise;
 }
 async function inspectTopOfScreenshot(file,worker){
  // A second, enlarged OCR pass can recover the first card when part
  // of the previous day is clipped or visually close to the month heading.
  if(typeof createImageBitmap!=="function")return null;
  let image;
  try{
    image=await createImageBitmap(file);
    const cropHeight=Math.min(image.height,Math.round(image.height*.59));
    const scale=Math.min(2.2,1800/image.width);
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(image.width*scale);
    canvas.height=Math.round(cropHeight*scale);
    const ctx=canvas.getContext("2d");
    if(!ctx)return null;
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.filter="grayscale(100%) contrast(155%)";
    ctx.drawImage(image,0,0,image.width,cropHeight,0,0,canvas.width,canvas.height);
    return await worker.recognize(canvas,{}, {text:true,tsv:true});
  }catch(err){console.warn("Top-of-screenshot scan skipped",err);return null;}
  finally{image?.close?.();}
 }
 async function readScreenshots(){
  const input=document.querySelector("#schedule-image-input"),status=document.querySelector("#schedule-ocr-status"),raw=document.querySelector("#schedule-raw-text");
  const files=Array.from(input?.files||[]).filter(f=>f.type.startsWith("image/")).slice(0,5);
  if(!files.length){toast("Choose a screenshot first");return;}
  if(!status||!raw)return;
  const button=document.querySelector('[data-action="schedule-ocr"]');
  if(button)button.disabled=true;
  let worker;
  try{
   status.textContent="Loading text reader…";await loadTesseract();
   worker=await window.Tesseract.createWorker("eng");
   const texts=[],detected=[];
   for(let i=0;i<files.length;i++){
    status.textContent="Reading screenshot "+(i+1)+" of "+files.length+"…";
    const result=await worker.recognize(files[i],{}, {text:true,tsv:true});
     const [yr,mo]=(document.querySelector("#schedule-month")?.value||ui.selected.slice(0,7)).split("-").map(Number);
     const activeDomain=document.querySelector("#import-domain")?.value||"work";
     const spatial=window.CommandImportParser.parseTsv(result.data?.tsv||"",result.data?.text||"",activeDomain,yr,mo);
     const plain=parseImportedText(result.data?.text||"",activeDomain,yr,mo);
     detected.push(...spatial,...plain);
    texts.push(result.data?.text||"");
    if(activeDomain==="work"&&i===0&&detected.length>=2&&detected.length<=5){
      status.textContent="Checking the top of the screenshot for a missing shift…";
      const top=await inspectTopOfScreenshot(files[i],worker);
      if(top){
        const topText=top.data?.text||"";
        const fromCrop=window.CommandImportParser.parseTsv(top.data?.tsv||"",topText,activeDomain,yr,mo);
        const fromCropText=parseImportedText(topText,activeDomain,yr,mo);
        detected.push(...fromCrop,...fromCropText);
        texts.push(topText);
      }
    }
   }
   raw.value=texts.map(t=>t.trim()).filter(Boolean).join("\n");
   const recognized=new Map(detected.map(e=>[[e.domain,e.date,e.startTime,e.endTime].join("|"),e]));
   if(ui.workingImport)ui.workingImport.ocrRows=[...recognized.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));
   status.textContent="Screenshot read. Preparing your schedule…";
   const draft=ui.workingImport;
   if(draft){
    draft.domain=document.querySelector("#import-domain")?.value||draft.domain;
    draft.raw=raw.value;
    const [yr,mo]=(document.querySelector("#schedule-month")?.value||ui.selected.slice(0,7)).split("-").map(Number);
    const plain=parseImportedText(draft.raw,draft.domain,yr,mo);
    draft.rows=window.CommandImportParser.proposeClippedPrevious(draft.raw,
      window.CommandImportParser.reconcileRows([...plain,...draft.ocrRows],draft.domain,usualWorkdays()),draft.domain);
    sortedDraft(draft.rows);
    importPreview();
    status.textContent=draft.rows.length+" proposed shift"+(draft.rows.length===1?"":"s")+" ready to review.";
   }
  }catch(err){status.textContent=err.message||"Could not read the image. Try Live Text in Photos.";}
  finally{if(worker)try{await worker.terminate();}catch(e){} if(button)button.disabled=false;}
 }
 function handleAction(b){
  const action=b.dataset.action;
  if(action==="schedule-jump"){ui.domain=b.dataset.domain||"work";if((ui.domain==="work"&&ui.mode==="day")||(ui.domain!=="work"&&ui.mode==="fourweeks"))ui.mode="week";if(b.dataset.date){ui.selected=b.dataset.date;ui.mode="week";ui.periodMode="work";}openSchedule();return true;}
  if(!action.startsWith("schedule-"))return false;
  if(action==="schedule-domain"){ui.domain=b.dataset.domain;if((ui.domain==="work"&&ui.mode==="day")||(ui.domain!=="work"&&ui.mode==="fourweeks"))ui.mode="week";rememberUi();openSchedule(false);}
  if(action==="schedule-mode"){ui.mode=b.dataset.mode;if(ui.mode==="fourweeks"){const date=fromDate(ui.selected);ui.fourWeekStart=localDate(shiftDate(date,-date.getDay()));}rememberUi();openSchedule(false);}
  if(action==="schedule-period"){ui.periodMode=b.dataset.period==="pay"?"pay":"work";rememberUi();openSchedule(false);}
  if(action==="schedule-select"){ui.selected=b.dataset.date;openSchedule(false);}
  if(action==="schedule-prev"||action==="schedule-next"){const sign=action==="schedule-prev"?-1:1;const d=fromDate(ui.selected);if(ui.mode==="fourweeks"){ui.fourWeekStart=localDate(shiftDate(fromDate(ui.fourWeekStart),28*sign));ui.selected=ui.fourWeekStart;}else{ui.selected=localDate(ui.mode==="day"?shiftDate(d,sign):ui.mode==="week"?shiftDate(d,7*sign):new Date(d.getFullYear(),d.getMonth()+sign,Math.min(d.getDate(),new Date(d.getFullYear(),d.getMonth()+sign+1,0).getDate())));}openSchedule(false);}
  if(action==="schedule-today"){const date=new Date();ui.selected=localDate(date);ui.fourWeekStart=localDate(shiftDate(date,-date.getDay()));openSchedule(false);}
  if(action==="schedule-add"){eventForm();}
  if(action==="schedule-edit"){const e=events().find(x=>x.id===b.dataset.id);if(e)eventForm(e);}
  if(action==="schedule-delete"){if(confirm("Delete this event"+(events().find(x=>x.id===b.dataset.id)?.repeat==="weekly"?" and all its repeats":"")+"?")){updateEvents(events().filter(e=>e.id!==b.dataset.id));closeSheet();toast("Event deleted");}}
  if(action==="schedule-import"){importForm();}
  if(action==="schedule-ocr"){readScreenshots();}
  if(action==="schedule-workweek"){workweekForm();}
  if(action==="schedule-review-toggle"){toggleRow(+b.dataset.index);return true;}
   if(action==="schedule-review-done"){toggleRow(+b.dataset.index,true);return true;}
   if(action==="schedule-add-review"){
    const draft=ui.workingImport;
    if(draft){
     const month=document.querySelector("#schedule-month")?.value||ui.selected.slice(0,7);
     const date=ui.selected.startsWith(month)?ui.selected:month+"-01";
     preserveReviewEdits();
     draft.rows.push({id:uid(),domain:draft.domain,title:draft.domain==="work"?"Work shift":draft.domain==="school"?"Class":"Event",date,startTime:"",endTime:"",allDay:false,location:"",notes:"",breakMinutes:null,repeat:"none",weekdays:[],until:""});
     importPreview();
      const newIndex=draft.rows.length-1;
      const target=document.querySelector("#schedule-review-"+newIndex);
      if(target)target.scrollIntoView({block:"nearest",behavior:"smooth"});
    }
   }
   if(action==="schedule-parse"){
   const draft=ui.workingImport;if(!draft)return true;
   draft.domain=document.querySelector("#import-domain").value;
   draft.raw=document.querySelector("#schedule-raw-text").value;
   const [yr,mo]=(document.querySelector("#schedule-month")?.value||ui.selected.slice(0,7)).split("-").map(Number);
    draft.rows=window.CommandImportParser.reconcileRows(parseImportedText(draft.raw,draft.domain,yr,mo),draft.domain,usualWorkdays());
    draft.ocrRows=[];
   importPreview();
  }
  return true;
 }
 function handleInput(target){
  if(target?.id==="schedule-image-input"){readScreenshots();return true;}
  if(target?.classList?.contains("work-assignment-select")){
    const group=target.closest(".work-fields");
    const zone=group?.querySelector(".work-zone-field");
    if(zone)zone.hidden=target.value!=="zones";
    return true;
   }
   if(target?.id==="ev-domain"){
    const isWork=target.value==="work";
    const work=document.querySelector("#event-work-fields"),other=document.querySelector(".event-general-location"),breaks=document.querySelector("#event-break-fields");
    if(work)work.hidden=!isWork;
    if(other)other.hidden=isWork;
    if(breaks)breaks.hidden=!isWork;
    return true;
   }
   if(target?.classList?.contains("schedule-break-mode")){
    const manual=target.closest(".schedule-break-inputs")?.querySelector(".schedule-break-manual");
    if(manual)manual.hidden=target.value!=="manual";
    return true;
   }
   if(target?.name==="repeat"){const box=document.querySelector("#schedule-repeat-options");if(box)box.hidden=target.value!=="weekly";return true;}
  return false;
 }
 function handleSubmit(form){
  if(form.id==="schedule-workweek-form"){
    const days=new FormData(form).getAll("usualDay").map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6);
    if(!days.length){alert("Choose at least one usual workday.");return true;}
    setSchedulePrefs({usualWorkdays:workWeekOrder.filter(d=>days.includes(d))});
    closeSheet();openSchedule(false);toast("Usual workdays saved");
    return true;
  }
  if(form.id==="schedule-event-form"){
   const values=new FormData(form);
   const id=form.dataset.id||uid();
   const date=parseIso(values.get("date"));
   const allDay=values.has("allDay");
   const startTime=String(values.get("startTime")||""),endTime=String(values.get("endTime")||"");
   const repeat=values.get("repeat")==="weekly"?"weekly":"none";
   const weekdays=repeat==="weekly"?values.getAll("weekday").map(Number):[];
   const until=parseIso(values.get("until"));
   if(!date){alert("Choose a valid date.");return true;}
   if(!allDay&&(!startTime||!endTime)){alert("Enter start and end times, or choose All day.");return true;}
   if(!allDay&&startTime===endTime){alert("Start and end times cannot be the same.");return true;}
   if(repeat==="weekly"&&!weekdays.length){alert("Select at least one repeat day.");return true;}
   if(until&&until<date){alert("Repeat-until date cannot be before the start date.");return true;}
   const domain=String(values.get("domain"));
   let manualBreak=null;
   if(domain==="work"&&!allDay){
     try{manualBreak=breakValue(values,"",{startTime,endTime,allDay});}
     catch(err){alert(err.message);return true;}
   }
   const item={id,domain,title:String(values.get("title")||"").trim().slice(0,140),date,startTime:allDay?"":startTime,endTime:allDay?"":endTime,allDay,breakMinutes:manualBreak,
    location:String(values.get(domain==="work"?"location":"generalLocation")||"").trim().slice(0,200),
    park:domain==="work"?String(values.get("park")||"IOA"):"",assignment:domain==="work"?String(values.get("assignment")||""):"",
    zoneColor:domain==="work"?String(values.get("zoneColor")||""):"",
    notes:String(values.get("notes")||"").trim().slice(0,2000),repeat,weekdays,until};
   if(!item.title){alert("Enter a title.");return true;}
   updateEvents(events().some(e=>e.id===id)?events().map(e=>e.id===id?item:e):[...events(),item]);
   ui.selected=date;closeSheet();toast("Event saved");return true;
  }
  if(form.id==="schedule-import-form"){
   const draft=ui.workingImport;if(!draft)return true;
   const v=new FormData(form),incoming=[],existing=new Set(events().map(e=>[e.domain,e.date,e.startTime,e.endTime].join("|")));
   for(let i=0;i<draft.rows.length;i++){
    if(!v.has("include-"+i))continue;
    const date=parseIso(v.get("date-"+i)),startTime=String(v.get("start-"+i)||""),endTime=String(v.get("end-"+i)||"");
    if(!date||!startTime||!endTime||timekeeping.scheduledMinutes({startTime,endTime})==null){alert("Check the dates and times for selected events.");return true;}
    let manualBreak=null;
    if(draft.domain==="work"){
      try{manualBreak=breakValue(v,i,{startTime,endTime});}
      catch(err){alert("Shift "+(i+1)+": "+err.message);return true;}
    }
    const key=[draft.domain,date,startTime,endTime].join("|");
    if(existing.has(key))continue;existing.add(key);
    incoming.push({id:uid(),domain:draft.domain,title:String(v.get("title-"+i)||"").trim()||"Event",date,startTime,endTime,allDay:false,
      location:String(v.get("location-"+i)||"").trim(),park:draft.domain==="work"?String(v.get("park-"+i)||"IOA"):"",
      assignment:draft.domain==="work"?String(v.get("assignment-"+i)||""):"",
      zoneColor:draft.domain==="work"?String(v.get("zoneColor-"+i)||""):"",
      notes:String(v.get("notes-"+i)||"").trim(),breakMinutes:manualBreak,repeat:"none",weekdays:[],until:""});
   }
   if(!incoming.length){toast("No new events selected");return true;}
   updateEvents([...events(),...incoming]);ui.domain=draft.domain;ui.selected=incoming[0].date;ui.workingImport=null;closeSheet();toast(incoming.length+" event"+(incoming.length===1?"":"s")+" added");return true;
  }
  return false;
 }
 function setDomain(domain){if(["work","school","personal","all"].includes(domain)){ui.domain=domain;if((domain==="work"&&ui.mode==="day")||(domain!=="work"&&ui.mode==="fourweeks"))ui.mode="week";rememberUi();}}
 return{render,homeSummary,homeWorkShifts,handleAction,handleInput,handleSubmit,setDomain};
}
window.CommandSchedule={create,validate:(e)=>({
 id:String(e.id||uid()).slice(0,150),domain:Object.hasOwn(DOMAINS,e.domain)?e.domain:"personal",
 title:String(e.title||"Untitled event").slice(0,140),date:parseIso(e.date),startTime:/^\d\d:\d\d$/.test(e.startTime||"")?e.startTime:"",endTime:/^\d\d:\d\d$/.test(e.endTime||"")?e.endTime:"",
 allDay:!!e.allDay,location:String(e.location||"").slice(0,200),notes:String(e.notes||"").slice(0,2000),
 breakMinutes:timekeeping.validOverride(e.breakMinutes),
 park:["IOA","USF","CityWalk","Other"].includes(e.park)?e.park:(e.domain==="work"?"IOA":""),
 assignment:["lead","support","zones","rtc","detail","other"].includes(e.assignment)?e.assignment:"",
 zoneColor:["red","orange","yellow","green","blue","purple"].includes(e.zoneColor)?e.zoneColor:"",
 repeat:e.repeat==="weekly"?"weekly":"none",weekdays:Array.isArray(e.weekdays)?e.weekdays.map(Number).filter(n=>n>=0&&n<=6):[],until:parseIso(e.until)
}),parseImportedText};
})();