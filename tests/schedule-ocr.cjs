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
assert.equal(ocr.observedDay("Thu\n4",2025,3),null);
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
console.log("Schedule OCR: selected gray card, cross-month dates, overlap and duplicate safeguards passed.");
