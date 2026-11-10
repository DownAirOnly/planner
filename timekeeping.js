/* Pure calendar time calculations; no payroll punch data. */
(function(){
"use strict";
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseDate=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||"");if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;};
const dateOffset=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
function scheduledMinutes(event){
 if(!event||event.allDay)return null;
 const start=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(event.startTime||"");
 const end=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(event.endTime||"");
 if(!start||!end)return null;
 const from=(+start[1])*60+(+start[2]),to=(+end[1])*60+(+end[2]);
 const diff=(to-from+1440)%1440;
 return diff>0?diff:null;
}
function autoBreakMinutes(duration){
 if(!Number.isFinite(duration)||duration<=0)return 0;
 return duration>=480?30:duration>=360?15:0;
}
function validOverride(value){
 if(value==null||value==="")return null;
 const n=Number(value);
 return Number.isInteger(n)&&n>=0&&n<=1440?n:null;
}
function shiftTotals(e){
 const scheduled=scheduledMinutes(e);
 if(scheduled==null)return{scheduled:null,breaks:0,adjusted:null,auto:0,manual:false};
 const manualValue=validOverride(e.breakMinutes);
 const manual=manualValue!=null;
 const breaks=Math.min(scheduled,manual?manualValue:autoBreakMinutes(scheduled));
 return{scheduled,breaks,adjusted:scheduled-breaks,auto:autoBreakMinutes(scheduled),manual};
}
function minutesLabel(n){
 if(!Number.isFinite(n)||n<0)return "—";
 const h=Math.floor(n/60),m=n%60;
 return m?(h?h+"h "+m+"m":m+"m"):h+"h";
}
function period(selected,mode){
 const ref=parseDate(selected)||new Date();
 const startDay=mode==="pay"?0:5;
 const diff=(ref.getDay()-startDay+7)%7;
 const start=dateOffset(ref,-diff),end=dateOffset(start,6);
 return{start:iso(start),end:iso(end),days:Array.from({length:7},(_,i)=>iso(dateOffset(start,i))),mode:mode==="pay"?"pay":"work"};
}
function aggregate(items){
 return items.reduce((sum,item)=>{
  const t=shiftTotals(item);
  if(t.scheduled==null)return sum;
  sum.shifts++;
  sum.scheduled+=t.scheduled;sum.breaks+=t.breaks;sum.adjusted+=t.adjusted;
  return sum;
 },{shifts:0,scheduled:0,breaks:0,adjusted:0});
}
window.CommandTimekeeping={scheduledMinutes,autoBreakMinutes,validOverride,shiftTotals,minutesLabel,period,aggregate};
})();