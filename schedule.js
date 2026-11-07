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
const fmtTime=e=>e.allDay?"All day":[clock(e.startTime),clock(e.endTime)].filter(Boolean).join("–")+(e.startTime&&e.endTime&&e.endTime<e.startTime?" (next day)":"");

const ASSIGNMENTS=[["","Not set"],["lead","Lead"],["zones","Zones"],["rtc","RTC"],["detail","Detail"],["other","Other"]];
const ZONE_COLORS=[["","Choose zone"],["red","Red Zone"],["orange","Orange Zone"],["yellow","Yellow Zone"],["green","Green Zone"],["blue","Blue Zone"],["purple","Purple Zone"]];
const PARKS=[["IOA","Islands of Adventure"],["USF","Universal Studios Florida"],["CityWalk","CityWalk"],["Other","Other"]];
const assignmentLabel=e=>e.assignment==="zones"?(ZONE_COLORS.find(x=>x[0]===e.zoneColor)?.[1]||"Zones"):(ASSIGNMENTS.find(x=>x[0]===e.assignment)?.[1]||"");
const displayLocation=e=>{
 const loc=String(e.location||"").replace(/^IOA\s*[·/-]\s*/i,"").trim();
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
function create({getEvents,updateEvents,showSheet,closeSheet,toast,openSchedule}){
 const ui={domain:"work",mode:"week",selected:localDate(new Date()),workingImport:null};
 const events=()=>getEvents()||[];
 const filter=e=>ui.domain==="all"||e.domain===ui.domain;
 const selectedEvents=(iso)=>events().filter(e=>filter(e)&&visibleOnDate(e,iso)).sort((a,b)=>(a.allDay?"":a.startTime).localeCompare(b.allDay?"":b.startTime));
 const dateEvents=(iso,domain)=>events().filter(e=>(!domain||e.domain===domain)&&visibleOnDate(e,iso)).sort((a,b)=>a.startTime.localeCompare(b.startTime));
 function nextEvent(domain){
   const now=new Date(),day0=localDate(now);
   for(let i=0;i<365;i++){const day=localDate(shiftDate(now,i));const possible=dateEvents(day,domain).filter(e=>i!==0||e.allDay||!e.endTime||(day+"T"+e.endTime)>=day0+"T"+pad(now.getHours())+":"+pad(now.getMinutes()));if(possible.length)return{...possible[0],occurrenceDate:day};}
   return null;
 }
 function homeSummary(){
   const domains=["work","school"];
   return '<section class="section"><div class="section-head"><h2>Schedule</h2><button class="subtle-link" data-action="schedule-jump" data-domain="work">Calendar '+ic("arrow","tiny")+'</button></div><div class="schedule-home-grid">'+domains.map(domain=>{
    const next=nextEvent(domain),heading=domain==="work"?"Next shift":"Next class";
    return '<button class="schedule-home-item" data-action="schedule-jump" data-domain="'+domain+'"><span class="schedule-tag '+domain+'">'+(domain==="work"?"Work":"School")+'</span><span class="schedule-home-heading">'+heading+'</span><span class="schedule-home-primary">'+(next?esc(labelDate(next.occurrenceDate)):"Nothing scheduled")+'</span><span class="schedule-home-secondary">'+(next?esc(fmtTime(next)+(workMeta(next)?" · "+workMeta(next):"")):(domain==="work"?"Add your work schedule":"Add your class schedule"))+'</span></button>';
   }).join("")+'</div></section>';
 }
 const heading=()=>{
   const date=fromDate(ui.selected),format=ui.mode==="month"?{month:"long",year:"numeric"}:ui.mode==="week"?{month:"short",year:"numeric"}:{weekday:"long",month:"long",day:"numeric"};
   return date.toLocaleDateString(undefined,format);
 };
 function daysForView(){
   const selected=fromDate(ui.selected);
   if(ui.mode==="day")return[selected];
   if(ui.mode==="week"){
     const start=shiftDate(selected,-((selected.getDay()+6)%7));
     return Array.from({length:7},(_,i)=>shiftDate(start,i));
   }
   const first=new Date(selected.getFullYear(),selected.getMonth(),1);
   const start=shiftDate(first,-((first.getDay()+6)%7));
   const last=new Date(selected.getFullYear(),selected.getMonth()+1,0);
   const total=Math.ceil((((last.getDate()+((first.getDay()+6)%7))/7)))*7;
   return Array.from({length:total},(_,i)=>shiftDate(start,i));
 }
 function calendar(){
  const days=daysForView();
  let grid="";
  if(ui.mode!=="day"){
    grid='<div class="schedule-cal-head">'+["M","T","W","T","F","S","S"].map(v=>'<span>'+v+'</span>').join("")+'</div><div class="schedule-cal-grid '+ui.mode+'">'+days.map(d=>{
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
  return '<div class="page-heading"><div><p class="eyebrow">Calendar</p><h1 class="page-title">Schedule</h1></div><div class="action-row"><button class="button secondary" data-action="schedule-import">'+ic("upload")+' Import</button><button class="button" data-action="schedule-add">'+ic("plus")+' Add</button></div></div>'+
   '<div class="schedule-domain-picker" role="group" aria-label="Calendar category">'+["work","school","personal","all"].map(d=>'<button data-action="schedule-domain" data-domain="'+d+'" class="'+(ui.domain===d?"active":"")+'">'+(d==="all"?"All":DOMAINS[d].label)+'</button>').join("")+'</div>'+
   '<div class="schedule-view-bar"><span class="small-label">'+(ui.domain==="all"?"All calendars":DOMAINS[ui.domain].label+" calendar")+'</span><div class="schedule-view-picker">'+["day","week","month"].map(mode=>'<button data-action="schedule-mode" data-mode="'+mode+'" class="'+(ui.mode===mode?"active":"")+'">'+mode[0].toUpperCase()+mode.slice(1)+'</button>').join("")+'</div></div>'+
   calendar()+eventRows()+
   (ui.domain==="school"?'<p class="schedule-hint">For classes that meet on the same weekdays, choose “Repeat weekly” when adding an event.</p>':"");
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
   '<div class="field"><label for="ev-notes">Notes (optional)</label><textarea id="ev-notes" name="notes" rows="2">'+esc(item.notes||"")+'</textarea></div>'+
   '<div class="field"><label for="ev-repeat">Repeat</label><select id="ev-repeat" name="repeat"><option value="none" '+(item.repeat!=="weekly"?"selected":"")+'>Does not repeat</option><option value="weekly" '+(item.repeat==="weekly"?"selected":"")+'>Every week</option></select></div>'+
   '<div class="schedule-repeat-options" id="schedule-repeat-options" '+(item.repeat==="weekly"?"":"hidden")+'><div class="field"><label>On these days</label><div class="weekday-row">'+DAYS.map((d,i)=>'<label class="weekday-check"><input type="checkbox" name="weekday" value="'+i+'" '+((item.weekdays||[fromDate(date)?.getDay()]).includes(i)?"checked":"")+'><span>'+d+'</span></label>').join("")+'</div></div>'+
   '<div class="field"><label for="ev-until">Repeat until (optional)</label><input id="ev-until" type="date" name="until" value="'+val("until")+'"></div><p class="schedule-hint">Editing or deleting a repeating event changes the whole series.</p></div>'+
   '<div class="sheet-actions">'+(item.id?'<button type="button" class="button danger" data-action="schedule-delete" data-id="'+val("id")+'">'+ic("trash")+' Delete</button>':'<span></span>')+'<button class="button" type="submit">'+ic("check")+' Save</button></div></form>');
 }
 function importForm(){
  const domain=ui.domain==="all"?"work":ui.domain;
  ui.workingImport={domain,rows:[],raw:"",ocrRows:[]};
  showSheet('<div class="sheet-head"><h2 class="sheet-title">Import schedule</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+ic("x")+'</button></div>'+
    '<div class="field"><label for="import-domain">Calendar</label><select id="import-domain">'+Object.keys(DOMAINS).map(d=>'<option value="'+d+'" '+(domain===d?"selected":"")+'>'+DOMAINS[d].label+'</option>').join("")+'</select></div>'+
    '<div class="field"><label for="schedule-image-input">Schedule screenshot</label><input type="file" id="schedule-image-input" accept="image/*" multiple></div>'+
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
  const found=draft.rows, target=document.querySelector("#schedule-import-results");if(!target)return;
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
      const detailHtml=(row.domain==="work"?workFields(row,i):
        '<div class="field"><label>Location</label><input name="location-'+i+'" value="'+esc(row.location)+'"></div>');
      return '<div class="schedule-proposed-row" data-review-row="'+i+'">'+
        '<div class="schedule-proposed-top"><label class="schedule-proposed-check"><input type="checkbox" name="include-'+i+'" '+(duplicate||row._include===false||needsEdit?"":"checked")+' aria-label="Include shift '+(i+1)+'">'+
          '<span class="schedule-proposed-main"><strong>'+esc(labelDate(row.date))+'</strong>'+
            '<span>'+esc(status)+'</span>'+
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
    _include:v.has("include-"+i)
  }));
 }
 function toggleRow(index,forceClose=false){
  const fields=document.querySelector("#schedule-review-"+index);
  const button=document.querySelector('[data-action="schedule-review-toggle"][data-index="'+index+'"]');
  if(!fields)return;
  fields.hidden=forceClose?true:!fields.hidden;
  if(button){button.textContent=fields.hidden?"Edit":"Close";button.setAttribute("aria-expanded",String(!fields.hidden));}
  if(forceClose){
    const form=document.querySelector("#schedule-import-form"),row=ui.workingImport?.rows[index];
    if(!form||!row)return;
    const v=new FormData(form),date=parseIso(v.get("date-"+index))||row.date;
    Object.assign(row,{
      date,startTime:String(v.get("start-"+index)||""),endTime:String(v.get("end-"+index)||""),
      location:String(v.get("location-"+index)||"").trim(),
      park:String(v.get("park-"+index)||row.park||"IOA"),
      assignment:String(v.get("assignment-"+index)||""),
      zoneColor:String(v.get("zoneColor-"+index)||"")
    });
    const root=document.querySelector('[data-review-row="'+index+'"]');
    if(root){
      const name=root.querySelector(".schedule-proposed-main strong"),time=root.querySelector(".schedule-proposed-main > span");
      const meta=root.querySelector(".schedule-work-summary");
      const confidence=root.querySelector(".schedule-confidence");
      if(name)name.textContent=labelDate(row.date);
      if(time)time.textContent=fmtTime(row)||"Time needs review";
      if(meta){meta.textContent=row.domain==="work"?workMeta(row):displayLocation(row);meta.className="schedule-work-summary"+zoneStyle(row);}
      if(confidence){confidence.textContent="Reviewed";confidence.className="schedule-confidence confidence-reviewed";}
      row.estimatedDate=false;row.reviewed=true;row.assignmentEstimated=false;row.locationEstimated=false;
    }
  }
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
    const merged=new Map([...plain,...draft.ocrRows].map(e=>[[e.domain,e.date,e.startTime,e.endTime].join("|"),e]));
    draft.rows=window.CommandImportParser.proposeClippedPrevious(draft.raw,[...merged.values()],draft.domain);
    importPreview();
    status.textContent=draft.rows.length+" proposed shift"+(draft.rows.length===1?"":"s")+" ready to review.";
   }
  }catch(err){status.textContent=err.message||"Could not read the image. Try Live Text in Photos.";}
  finally{if(worker)try{await worker.terminate();}catch(e){} if(button)button.disabled=false;}
 }
 function handleAction(b){
  const action=b.dataset.action;
  if(action==="schedule-jump"){ui.domain=b.dataset.domain||"work";openSchedule();return true;}
  if(!action.startsWith("schedule-"))return false;
  if(action==="schedule-domain"){ui.domain=b.dataset.domain;openSchedule(false);}
  if(action==="schedule-mode"){ui.mode=b.dataset.mode;openSchedule(false);}
  if(action==="schedule-select"){ui.selected=b.dataset.date;openSchedule(false);}
  if(action==="schedule-prev"||action==="schedule-next"){const sign=action==="schedule-prev"?-1:1;const d=fromDate(ui.selected);ui.selected=localDate(ui.mode==="day"?shiftDate(d,sign):ui.mode==="week"?shiftDate(d,7*sign):new Date(d.getFullYear(),d.getMonth()+sign,Math.min(d.getDate(),new Date(d.getFullYear(),d.getMonth()+sign+1,0).getDate())));openSchedule(false);}
  if(action==="schedule-today"){ui.selected=localDate(new Date());openSchedule(false);}
  if(action==="schedule-add"){eventForm();}
  if(action==="schedule-edit"){const e=events().find(x=>x.id===b.dataset.id);if(e)eventForm(e);}
  if(action==="schedule-delete"){if(confirm("Delete this event"+(events().find(x=>x.id===b.dataset.id)?.repeat==="weekly"?" and all its repeats":"")+"?")){updateEvents(events().filter(e=>e.id!==b.dataset.id));closeSheet();toast("Event deleted");}}
  if(action==="schedule-import"){importForm();}
  if(action==="schedule-ocr"){readScreenshots();}
  if(action==="schedule-review-toggle"){toggleRow(+b.dataset.index);return true;}
   if(action==="schedule-review-done"){toggleRow(+b.dataset.index,true);return true;}
   if(action==="schedule-add-review"){
    const draft=ui.workingImport;
    if(draft){
     const month=document.querySelector("#schedule-month")?.value||ui.selected.slice(0,7);
     const date=ui.selected.startsWith(month)?ui.selected:month+"-01";
     preserveReviewEdits();
     draft.rows.push({id:uid(),domain:draft.domain,title:draft.domain==="work"?"Work shift":draft.domain==="school"?"Class":"Event",date,startTime:"",endTime:"",allDay:false,location:"",notes:"",repeat:"none",weekdays:[],until:""});
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
    draft.rows=parseImportedText(draft.raw,draft.domain,yr,mo);
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
    const work=document.querySelector("#event-work-fields"),other=document.querySelector(".event-general-location");
    if(work)work.hidden=!isWork;
    if(other)other.hidden=isWork;
    return true;
   }
   if(target?.name==="repeat"){const box=document.querySelector("#schedule-repeat-options");if(box)box.hidden=target.value!=="weekly";return true;}
  return false;
 }
 function handleSubmit(form){
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
   const item={id,domain,title:String(values.get("title")||"").trim().slice(0,140),date,startTime:allDay?"":startTime,endTime:allDay?"":endTime,allDay,
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
    if(!date||!startTime||!endTime){alert("Check the dates and times for selected events.");return true;}
    const key=[draft.domain,date,startTime,endTime].join("|");
    if(existing.has(key))continue;existing.add(key);
    incoming.push({id:uid(),domain:draft.domain,title:String(v.get("title-"+i)||"").trim()||"Event",date,startTime,endTime,allDay:false,
      location:String(v.get("location-"+i)||"").trim(),park:draft.domain==="work"?String(v.get("park-"+i)||"IOA"):"",
      assignment:draft.domain==="work"?String(v.get("assignment-"+i)||""):"",
      zoneColor:draft.domain==="work"?String(v.get("zoneColor-"+i)||""):"",
      notes:String(v.get("notes-"+i)||"").trim(),repeat:"none",weekdays:[],until:""});
   }
   if(!incoming.length){toast("No new events selected");return true;}
   updateEvents([...events(),...incoming]);ui.domain=draft.domain;ui.selected=incoming[0].date;ui.workingImport=null;closeSheet();toast(incoming.length+" event"+(incoming.length===1?"":"s")+" added");return true;
  }
  return false;
 }
 function setDomain(domain){if(["work","school","personal","all"].includes(domain))ui.domain=domain;}
 return{render,homeSummary,handleAction,handleInput,handleSubmit,setDomain};
}
window.CommandSchedule={create,validate:(e)=>({
 id:String(e.id||uid()).slice(0,150),domain:Object.hasOwn(DOMAINS,e.domain)?e.domain:"personal",
 title:String(e.title||"Untitled event").slice(0,140),date:parseIso(e.date),startTime:/^\d\d:\d\d$/.test(e.startTime||"")?e.startTime:"",endTime:/^\d\d:\d\d$/.test(e.endTime||"")?e.endTime:"",
 allDay:!!e.allDay,location:String(e.location||"").slice(0,200),notes:String(e.notes||"").slice(0,2000),
 park:["IOA","USF","CityWalk","Other"].includes(e.park)?e.park:(e.domain==="work"?"IOA":""),
 assignment:["lead","zones","rtc","detail","other"].includes(e.assignment)?e.assignment:"",
 zoneColor:["red","orange","yellow","green","blue","purple"].includes(e.zoneColor)?e.zoneColor:"",
 repeat:e.repeat==="weekly"?"weekly":"none",weekdays:Array.isArray(e.weekdays)?e.weekdays.map(Number).filter(n=>n>=0&&n<=6):[],until:parseIso(e.until)
}),parseImportedText};
})();