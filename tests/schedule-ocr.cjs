// Regression tests use synthetic schedules; never commit real employee screenshots.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const window={};
const context={window,console};
vm.createContext(context);
for(const name of ["schedule-import.js","schedule-card-ocr.js"])
 vm.runInContext(fs.readFileSync(path.join(__dirname,"..",name),"utf8"),context);
const parser=window.CommandImportParser,ocr=window.CommandScheduleCardOCR;
const labels=[
 ["Sun\n30","2025-03-30"],["Mon\n31","2025-03-31"],
 ["Tue\n1","2025-04-01"],["Fri\n4","2025-04-04"],["Sat\n5","2025-04-05"]
];
for(const [label,want] of labels)
 assert.equal(ocr.observedDay(label,2025,3)?.date,want);
assert.equal(ocr.observedDay("Thu\n4",2025,3)?.date,"");
assert.equal(ocr.observedDay("Thu\n4",2025,3)?.confidence,"low");
assert.equal(ocr.observedDay("Sat\n1",2021,12)?.date,"2022-01-01");
const raw=`March 2025
March 30 - April 05
Sun
30
8:00 AM-4:00 PM
IOA/Lost/Lead
Mon
31
8:00 AM-4:00 PM
IOA/Lost/Lead
Tue
1
9:00 AM-5:00 PM
IOA/Rescue/Attnd-Park
Fri
4
2:00 PM-10:00 PM
IOA/Lost/Lead
Sat
5
2:00 PM-10:00 PM
IOA/Lost/Lead`;
const rows=parser.parseText(raw,"work",2025,3);
assert.deepEqual(Array.from(rows,r=>r.date),labels.map(([,d])=>d));
assert.equal(rows[2].location,"Rescue");
assert.equal(parser.reconcileRows([...rows,...rows],"work").length,5);
const width=400,height=1500,rgba=new Uint8ClampedArray(width*height*4);
rgba.fill(255);
for(const [start,end,rgb] of [[350,555,[245,249,252]],[650,855,[226,230,233]],[950,1155,[245,249,252]]])
 for(let y=start;y<end;y++)for(const x of [240,308,336]){
  const off=(y*width+x)*4;
  for(let channel=0;channel<3;channel++)rgba[off+channel]=rgb[channel];
 }
assert.equal(ocr.findCards({data:rgba},width,height).length,3);
const row=(date,time,id)=>({domain:"work",date,
 startTime:time.split("|")[0],endTime:time.split("|")[1],
 dateConfidence:date?"high":"low",estimatedDate:!date,id});
const a=[row("2025-03-30","08:00|16:00","a1"),
 row("2025-03-31","08:00|16:00","a2"),
 row("","14:00|22:00","a3"),row("","14:00|22:00","a4")];
const b=[row("2025-03-31","08:00|16:00","b1"),
 row("2025-04-04","14:00|22:00","b2"),
 row("2025-04-05","14:00|22:00","b3")];
const dedup=parser.reduceOverlappingCardUnknowns([a,b]);
assert(!dedup.has(a[2])&&!dedup.has(a[3]));
const c=[row("2025-03-31","08:00|16:00","c1"),
 row("","14:00|22:00","c2"),row("","14:00|22:00","c3")];
const kept=parser.reduceOverlappingCardUnknowns([a,c]);
assert.equal([...kept].filter(r=>r.startTime==="14:00").length,2);
// A misread "Fri 11" -> "Fri 1" must not become January 1 merely
// because both days are Fridays. Keep its time as an unconfirmed candidate.
const complete=(date,startTime,endTime,dateConfidence="high",reason="")=>({
 domain:"work",date,startTime,endTime,dateConfidence,
 confidenceReason:reason,estimatedDate:false,_include:true
});
const questionable=[
 complete("2026-12-06","13:15","20:30"),
 complete("2026-12-12","15:45","02:00"),
 complete("2027-01-01","16:15","02:00","medium","Weekday and day visibly match the neighboring month")
];
const screened=parser.verifyNeighboringMonth(questionable,2026,12);
assert.equal(screened.accepted.length,2);
assert.equal(screened.rejected.length,1);
assert.equal(screened.rejected[0].date,"");
assert.equal(screened.rejected[0].startTime,"16:15");
assert.equal(ocr.observedDay("Fri\n1",2026,12)?.confidence,"medium");
// Legitimate Nov–Dec weeks must still remain eligible without retyping.
const rollover=parser.verifyNeighboringMonth([
 complete("2026-11-29","13:30","20:30"),
 complete("2026-11-30","13:30","20:30"),
 complete("2026-12-04","15:45","02:00","medium","Weekday and day visibly match the neighboring month")
],2026,11);
assert.equal(rollover.rejected.length,0);
assert(rollover.accepted.every(row=>row.dateConfidence==="high"));
// The screenshot says December even when Command was last showing November.
const head=ocr.parseHeader("December 2026\nDecember 06 – 12",2026,11);
assert.equal(head.month,12);
assert.equal(head.weekStart,"2026-12-06");
assert.equal(ocr.observedDay("Tue\n3",2026,12,head.weekStart)?.date,"2026-12-08");
assert.equal(ocr.observedDay("Fri\n1",2026,12,head.weekStart)?.date,"2026-12-11");
assert.equal(ocr.observedDay("Mon 7",2026,12,head.weekStart)?.date,"2026-12-07");
// When the week heading is clipped, two other dated shifts can establish
// that the same Friday card belongs to December 11, not January 1.
const card=(index,day,date,startTime,endTime,confidence="high")=>({
 _ocrCardIndex:index,_ocrWeekday:day,_ocrDayRead:null,
 date,domain:"work",startTime,endTime,dateConfidence:confidence,
 estimatedDate:!date,_include:!!date
});
const weekCards=[
 card(1,"mon","2026-12-07","13:15","20:30"),
 card(2,"tue","2026-12-08","12:45","20:00"),
 card(3,"fri","2027-01-01","16:15","02:00","medium"),
 card(4,"sat","2026-12-12","15:45","02:00"),
 card(5,"fri","2027-01-01","16:15","02:00","medium")
];
const repaired=parser.stabilizeCardWeeks([weekCards]);
assert.equal(repaired.length,1);
assert.equal(weekCards[2].date,"2026-12-11");
assert.equal(weekCards[4].date,"2027-01-01"); // unbracketed later section
console.log("Schedule OCR: selected gray card, cross-month dates, overlap and duplicate safeguards passed.");
