(function(){
 "use strict";
 const KEY="command.finance.v1", RECOVERY="command.finance.beforeImport", CLOUD_VERIFIED="command.finance.cloudVerified";
 const FORMAT="everyday-section-v1";
 const iso=x=>typeof x==="string"&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"));
 const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const plus=(date,n)=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const cents=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
 const unique=(list,msg)=>{const a=new Set();for(const x of list){if(!x||a.has(x))throw Error("Missing or duplicate "+msg+".");a.add(x);}};
 const safeInteger=n=>Number.isSafeInteger(n)&&n>=0;
 function validateFile(input){
   // Accept the finance-only section created by Everyday (recommended),
   // or a full Everyday JSON export; never import Food or Lifting records.
   let finance,kind;
   if(input?.format===FORMAT&&input.section==="finances"&&input.data){
     finance=input.data;kind="Everyday Finance section";
   }else if(Array.isArray(input?.transactions)&&input.budgetPlan&&Array.isArray(input.classificationRules)){
     finance={transactions:input.transactions,classificationRules:input.classificationRules,budgetPlan:input.budgetPlan};
     kind="Everyday full JSON";
   }else throw Error("Choose Everyday's Finances JSON export, or a complete Everyday backup.");
   if(!finance||typeof finance!=="object"||Array.isArray(finance))throw Error("Invalid finance section.");
   const {transactions,classificationRules,budgetPlan}=finance;
   if(!Array.isArray(transactions)||transactions.length>50000||!Array.isArray(classificationRules)||classificationRules.length>300||
      !budgetPlan||typeof budgetPlan!=="object"||Array.isArray(budgetPlan))throw Error("Finance file is missing valid transactions, rules, or budget plan.");
   const ids=[],ext=new Set(),duplicateExternal=[];
   let income=0,expense=0,transfer=0,receipts=0,bank=0,itemized=0,min="",max="",missingCategory=0;
   for(const t of transactions){
     if(!t||typeof t!=="object"||typeof t.id!=="string"||!t.id.trim()||t.id.length>160||
        !iso(t.date)||!["expense","income","transfer"].includes(t.kind)||!Number.isSafeInteger(t.amountCents)||t.amountCents<=0||
        typeof t.description!=="string"||!t.description.trim()||t.currency&&t.currency!=="USD")
       throw Error("Invalid transaction entry: "+String(t?.id||"(unknown)"));
     if(t.purchaseDate!=null&&!iso(t.purchaseDate)||t.postedDate!=null&&!iso(t.postedDate))throw Error("Invalid purchase or posting date.");
     if(t.items!=null){
       if(!Array.isArray(t.items)||t.items.length>100||
         t.items.some(i=>!i||typeof i.name!=="string"||typeof i.category!=="string"||!safeInteger(i.amountCents)))
         throw Error("Malformed receipt items in "+t.id);
       if(t.items.length){
         const total=t.items.reduce((n,i)=>n+i.amountCents,0);
         if(total!==(t.receiptAmountCents??t.amountCents))throw Error("Receipt totals do not match transaction "+t.id);
         receipts++;itemized+=t.items.length;
       }
     }
     if(t.bankDescription||t.externalId||t.accountLabel)bank++;
     if(t.externalId){if(ext.has(t.externalId))duplicateExternal.push(t.externalId);ext.add(t.externalId);}
     if(!t.category)missingCategory++;
     ids.push(t.id);
     if(!min||t.date<min)min=t.date;if(!max||t.date>max)max=t.date;
     if(t.kind==="expense")expense+=t.amountCents;
     else if(t.kind==="income")income+=t.amountCents;
     else transfer+=t.amountCents;
   }
   unique(ids,"transaction ID");
   const ruleIds=classificationRules.map(x=>x?.id);
   for(const rule of classificationRules)if(!rule||typeof rule.name!=="string"||!rule.name.trim()||!rule.matchText||!rule.category)throw Error("Invalid classification rule.");
   unique(ruleIds,"classification rule ID");
   const {categoryLimits,schedules,paycheckAmounts,billAssignments,unresolvedBankRows}=budgetPlan;
   if(!Array.isArray(categoryLimits)||!Array.isArray(schedules)||!paycheckAmounts||typeof paycheckAmounts!=="object"||
     !billAssignments||typeof billAssignments!=="object"||!Array.isArray(unresolvedBankRows))
     throw Error("Finance plan is missing limits, schedules or bank-review data.");
   if(categoryLimits.some(x=>!x||typeof x.category!=="string"||!Number.isSafeInteger(x.amountCents)||x.amountCents<=0))
     throw Error("Invalid category spending limit.");
   unique(categoryLimits.map(x=>x.category.toLowerCase()),"budget category");
   for(const s of schedules){
     if(!s||typeof s.id!=="string"||!s.id.trim()||typeof s.name!=="string"||!s.name.trim()||
       !["income","expense"].includes(s.kind)||!Number.isSafeInteger(s.amountCents)||s.amountCents<=0||
       !iso(s.startDate)||!["once","weekly","biweekly","monthly"].includes(s.frequency)||!s.occurrences||typeof s.occurrences!=="object")
       throw Error("Invalid recurring bill or income schedule.");
     if(Object.entries(s.occurrences).some(([d,status])=>!iso(d)||!["paid","skipped"].includes(status)))
       throw Error("Invalid bill occurrence status in "+s.id);
   }
   unique(schedules.map(x=>x.id),"schedule ID");
   if(budgetPlan.balanceCents!=null&&!Number.isSafeInteger(budgetPlan.balanceCents))throw Error("Invalid cash balance.");
   if(budgetPlan.balanceAsOf&&!iso(budgetPlan.balanceAsOf))throw Error("Invalid balance date.");
   if(Object.values(paycheckAmounts).some(n=>!Number.isSafeInteger(n)||n<=0))throw Error("Invalid paycheck override.");
   if(Object.values(billAssignments).some(n=>!iso(n)))throw Error("Invalid bill assignment date.");
   unique(unresolvedBankRows.map(x=>x?.id),"unresolved bank ID");
   const report={transactions:transactions.length,income,expense,transfer,minDate:min,maxDate:max,
     bankTransactions:bank,receipts,itemized,duplicateExternal:duplicateExternal.length,missingCategory,
     rules:classificationRules.length,schedules:schedules.length,
     bills:schedules.filter(x=>x.kind==="expense").length,
     paychecks:schedules.filter(x=>x.kind==="income").length,
     categoryLimits:categoryLimits.length,
     paycheckOverrides:Object.keys(paycheckAmounts).length,billAssignments:Object.keys(billAssignments).length,
     unresolvedBank:unresolvedBankRows.length};
   return {finance:structuredClone(finance),report,kind};
 }
 async function sha(data){
   const bytes=new TextEncoder().encode(JSON.stringify(data));
   const digest=await crypto.subtle.digest("SHA-256",bytes);
   return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
 }
 function compareLedgers(incoming,previous){
   if(!previous)return {added:incoming.transactions.length,changed:0,unchanged:0,missing:0};
   const old=new Map(previous.transactions.map(t=>[t.id,t]));
   const fresh=new Map(incoming.transactions.map(t=>[t.id,t]));
   let added=0,changed=0,unchanged=0,missing=0;
   for(const [id,tx] of fresh){
     if(!old.has(id))added++;
     else if(JSON.stringify(old.get(id))===JSON.stringify(tx))unchanged++;
     else changed++;
   }
   for(const id of old.keys())if(!fresh.has(id))missing++;
   return {added,changed,unchanged,missing};
 }
 let record=null,error="",pending=null,verified=false,view="overview",span=7,month="all",page=0;
 function read(){
   const raw=localStorage.getItem(KEY);
   if(!raw){record=null;return;}
   try{
     const saved=JSON.parse(raw);
     if(saved?.format!=="command-finance-v1"||!saved.data)throw Error("Unknown stored finance format.");
     const check=validateFile({format:FORMAT,section:"finances",data:saved.data});
     record={...saved,report:check.report};
     verified=false;
     sha(saved.data).then(d=>{verified=d===saved.sha256;dispatch();}).catch(()=>{verified=false;dispatch();});
   }catch(err){error="Finance could not be read. The original local data has not been replaced: "+err.message;record=null;}
 }
 const dispatch=()=>window.dispatchEvent(new CustomEvent("command-money-updated"));
 function savePending(){
   if(!pending)return;
   if(record?.report?.transactions>0&&pending.report.transactions===0)
     throw Error("Refusing to replace financial history with a settings-only file.");
   if(pending.diff?.missing)
     throw Error("The selected export is missing "+pending.diff.missing+" previously imported transaction IDs. No records were changed. Export a newer, complete Everyday finance file.");
   if(record?.sha256===pending.sha256){pending=null;dispatch();return;}
   // No automatic merge or overwrite: an updated export has to be consciously
   // reviewed, and the previous local copy is preserved for recovery.
   if(record){
     const prev=localStorage.getItem(KEY);
     if(prev)localStorage.setItem(RECOVERY,prev);
   }
   const saved={format:"command-finance-v1",sourceFormat:FORMAT,importedAt:new Date().toISOString(),
     sourceFilename:pending.filename,sha256:pending.sha256,data:pending.finance};
   const serialized=JSON.stringify(saved);
   localStorage.setItem(KEY,serialized);
   if(localStorage.getItem(KEY)!==serialized)throw Error("Saved data did not match on read-back.");
   const checked=validateFile({format:FORMAT,section:"finances",data:JSON.parse(localStorage.getItem(KEY)).data});
   if(JSON.stringify(checked.report)!==JSON.stringify(pending.report))throw Error("Imported finance totals changed unexpectedly.");
   record={...saved,report:checked.report};verified=true;pending=null;
   dispatch();
 }
 function download(filename,content){
   const blob=new Blob([JSON.stringify(content,null,2)],{type:"application/json"});
   const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 const occurrences=(plan,start,end)=>{
   const rows=[];
   const localDate=date=>new Date(date+"T12:00:00Z");
   for(const rule of plan.schedules){
     for(let d=start;d<=end;d=plus(d,1)){
       if(d<rule.startDate||rule.endDate&&d>rule.endDate)continue;
       const diff=Math.round((localDate(d)-localDate(rule.startDate))/86400000);
       if(rule.frequency==="once"&&diff!==0||rule.frequency==="weekly"&&diff%7!==0||
          rule.frequency==="biweekly"&&diff%14!==0)continue;
       if(rule.frequency==="monthly"){
         const originDay=Number(rule.startDate.slice(-2)),date=localDate(d),
           last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
         if(Number(d.slice(-2))!==Math.min(originDay,last))continue;
       }
       const status=rule.occurrences[d]||"pending";
       const amount=rule.kind==="income"?(plan.paycheckAmounts[rule.id+"|"+d]??rule.amountCents):rule.amountCents;
       rows.push({id:rule.id,date:d,kind:rule.kind,name:rule.name,amountCents:amount,status});
     }
   }
   return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 };
 const summary=(f,days)=>{
   const start=day(),end=plus(start,days-1),events=occurrences(f.budgetPlan,start,end).filter(x=>x.status==="pending");
   const income=events.filter(x=>x.kind==="income").reduce((n,x)=>n+x.amountCents,0);
   const bills=events.filter(x=>x.kind==="expense").reduce((n,x)=>n+x.amountCents,0);
   const purchases=f.transactions.filter(x=>x.kind==="expense"&&!x.billKey&&(x.purchaseDate||x.date)>=start&&(x.purchaseDate||x.date)<=end)
     .reduce((n,x)=>n+x.amountCents,0);
   return {start,end,income,bills,purchases,available:income-bills-purchases,events};
 };
 const card=(name,value,detail)=>'<div class="money-stat"><span>'+e(name)+'</span><strong>'+e(value)+'</strong>'+(detail?'<small>'+e(detail)+'</small>':'')+'</div>';
 const section=(title,right,body)=>'<section class="money-section"><div class="section-head"><h2>'+title+'</h2>'+(right||"")+'</div>'+body+'</section>';
 function recordsView(f){
   const dates=[...new Set(f.transactions.map(t=>(t.purchaseDate||t.date).slice(0,7)))].sort().reverse();
   if(month!=="all"&&!dates.includes(month))month="all";
   const rows=f.transactions.filter(t=>month==="all"||(t.purchaseDate||t.date).startsWith(month))
     .sort((a,b)=>b.date.localeCompare(a.date)||(b.time||"").localeCompare(a.time||""));
   const shown=rows.slice(page*35,(page+1)*35);
   return '<div class="money-list-toolbar"><label>Month <select id="money-month"><option value="all">All history</option>'+
     dates.map(m=>'<option value="'+m+'" '+(m===month?'selected':'')+'>'+m+'</option>').join("")+'</select></label><span>'+rows.length+' transactions</span></div>'+
     '<div class="money-history">'+shown.map(t=>'<details class="money-transaction"><summary><span><strong>'+e(t.merchant||t.description)+'</strong><small>'+e(t.date)+' · '+e(t.category||"Uncategorized")+'</small></span><b class="money-'+e(t.kind)+'">'+(t.kind==="expense"?"−":t.kind==="income"?"+":"↔")+cents(t.amountCents).replace("−","")+'</b></summary>'+
     '<div class="money-transaction-details"><p><strong>Description:</strong> '+e(t.description)+'</p>'+
     (t.bankDescription?'<p><strong>Original bank text:</strong> '+e(t.bankDescription)+'</p>':'')+
     (t.accountLabel?'<p><strong>Account:</strong> '+e(t.accountLabel)+'</p>':'')+
     (t.statementLabel?'<p><strong>Statement:</strong> '+e(t.statementLabel)+'</p>':'')+
     (t.note?'<p><strong>Note:</strong> '+e(t.note)+'</p>':'')+
     (t.items?.length?'<div><strong>Receipt items</strong>'+t.items.map(i=>'<p>'+e(i.name)+' · '+e(i.category)+' · '+cents(i.amountCents)+'</p>').join("")+'</div>':'')+
     '<p class="money-tx-id">ID: '+e(t.id)+'</p></div></details>').join("")+'</div>'+
     (rows.length>35?'<div class="money-pager"><button data-money-action="prev-page" '+(page===0?'disabled':'')+'>Previous</button><span>Page '+(page+1)+' of '+Math.ceil(rows.length/35)+'</span><button data-money-action="next-page" '+((page+1)*35>=rows.length?'disabled':'')+'>Next</button></div>':'');
 }
 function budgetView(f){
   const plan=f.budgetPlan,monthDate=day().slice(0,7),expenses=f.transactions.filter(t=>t.kind==="expense"&&(t.purchaseDate||t.date).startsWith(monthDate));
   const used=category=>expenses.reduce((n,t)=>{
     if(t.items?.length)return n+t.items.filter(i=>i.category===category).reduce((sum,i)=>sum+i.amountCents,0);
     return n+(t.category===category?t.amountCents:0);
   },0);
   return section("Monthly limits",'<span class="muted">'+e(monthDate)+'</span>',
     '<div class="money-budget-list">'+plan.categoryLimits.map(l=>{
       const spent=used(l.category),percent=Math.min(100,Math.round(100*spent/l.amountCents));
       return '<div class="money-budget-row"><div><strong>'+e(l.category)+'</strong><span>'+cents(spent)+' / '+cents(l.amountCents)+'</span></div><progress max="100" value="'+percent+'"></progress></div>';
     }).join("")+'</div>')+
     section("Classification rules",'<span class="muted">'+f.classificationRules.length+' saved</span>',
       '<div class="money-summary-list">'+f.classificationRules.map(r=>'<div class="money-detail-row"><strong>'+e(r.name)+'</strong><small>'+e(r.category)+' · '+e(r.matchText)+'</small></div>').join("")+'</div>');
 }
 function billsView(f){
   const bills=[...f.budgetPlan.schedules].sort((a,b)=>a.startDate.localeCompare(b.startDate));
   const overrideCount=Object.keys(f.budgetPlan.paycheckAmounts).length;
   return section("Recurring bills & income",'<span class="muted">'+bills.length+' schedules</span>',
     '<div class="money-summary-list">'+bills.map(b=>'<div class="money-detail-row"><strong>'+e(b.name)+'</strong><small>'+e(b.kind)+' · '+e(b.frequency)+' · starts '+e(b.startDate)+'</small><b>'+cents(b.amountCents)+'</b><small>'+Object.keys(b.occurrences).length+' marked occurrences</small></div>').join("")+'</div>')+
     section("Saved finance adjustments","",'<div class="money-stats">'+
       card("Paycheck overrides",String(overrideCount),"")+
       card("Bill assignments",String(Object.keys(f.budgetPlan.billAssignments).length),"")+
       card("Unresolved bank rows",String(f.budgetPlan.unresolvedBankRows.length),"")+'</div>');
 }
 function previewView(){
   if(!pending)return "";
   const r=pending.report;
   const current=record?.report;
   const same=record?.sha256===pending.sha256;
   const diff=pending.diff||compareLedgers(pending.finance,record?.data);
   const potentiallyIncomplete=pending.report.transactions===0;
   return '<section class="money-preview" role="status"><div class="section-head"><h2>Import verification preview</h2><button data-money-action="cancel-preview">Cancel</button></div>'+
     '<p><strong>'+e(pending.filename)+'</strong> · '+e(pending.kind)+(same?' · Same as saved copy':'')+'</p>'+
     '<div class="money-stats">'+card("Transactions",String(r.transactions),current?"Current "+current.transactions:"")+
     card("Recurring items",String(r.schedules),current?"Current "+current.schedules:"")+
     card("Monthly budgets",String(r.categoryLimits),current?"Current "+current.categoryLimits:"")+'</div>'+
     (current?'<p class="money-help">Compared with Command: '+diff.added+' new IDs, '+diff.changed+' changed records, '+diff.unchanged+' unchanged, '+diff.missing+' MISSING from this export.</p>':'')+
     (diff.missing?'<p class="money-warning">This export omits previously imported transactions. Import is blocked to protect existing history.</p>':'')+
     '<div class="money-compare"><div><span>Income</span><strong>'+cents(r.income)+'</strong></div>'+
     '<div><span>Expenses</span><strong>'+cents(r.expense)+'</strong></div>'+
     '<div><span>Transfers (not spending)</span><strong>'+cents(r.transfer)+'</strong></div>'+
     '<div><span>Dates</span><strong>'+e(r.minDate)+' – '+e(r.maxDate)+'</strong></div>'+
     '<div><span>Bank / receipt records</span><strong>'+r.bankTransactions+' / '+r.receipts+'</strong></div>'+
     '<div><span>Rules / pending bank rows</span><strong>'+r.rules+' / '+r.unresolvedBank+'</strong></div></div>'+
     (potentiallyIncomplete?'<p class="money-warning">This export has zero transactions. It may only contain settings, not full financial history.</p>':'')+
     '<p class="money-warning">Everyday is NOT changed. Importing makes an exact local copy; it does not merge entries, and it does not upload to Firebase. '+(record?'The previous Command finance copy is saved for recovery.':'')+'</p>'+
     (same?'<p class="money-ok">This file is already imported.</p>':
       (diff.missing?'<p>Choose a newer full export from Everyday.</p>':
       '<button class="button" data-money-action="confirm-import">Import this finance file</button>'))+'</section>';
 }

 function cloudRecord(){
   const cloud=window.CommandCloud;
   if(!cloud?.ready||!cloud.user)return null;
   try{
     const stored=JSON.parse(localStorage.getItem(CLOUD_VERIFIED)||"null");
     if(stored?.uid===cloud.user.uid&&stored.sha256===record?.sha256)return stored;
   }catch{}
   return null;
 }
 function stampCloud(revision,sha256){
   const cloud=window.CommandCloud;
   if(!cloud?.user)throw Error("Sign in to Google first.");
   localStorage.setItem(CLOUD_VERIFIED,JSON.stringify({
     uid:cloud.user.uid,revision,sha256,verifiedAt:new Date().toISOString()
   }));
 }
 async function backupCloud(){
   const cloud=window.CommandCloud;
   if(!cloud?.ready||!cloud.user)throw Error("Sign in with Google in Command Settings before cloud backup.");
   if(!record||!verified)throw Error("Import and verify a local finance file first.");
   const manifest=await cloud.getFinanceManifest();
   if(manifest?.sha256===record.sha256){
     const back=await cloud.getFinanceBackup();
     if(JSON.stringify(back.data)!==JSON.stringify(record.data))throw Error("Cloud copy content differs from device data.");
     stampCloud(back.revision,back.sha256);dispatch();
     alert("Cloud finance backup verified. Source IDs and all finance fields match the local copy.");
     return;
   }
   const label=manifest?"REPLACE":"BACKUP";
   const counts=manifest?manifest.transactions+" transactions, "+manifest.rules+" rules, "+manifest.schedules+" schedules":"no prior finance backup";
   if(prompt("Upload "+record.report.transactions+" finance transactions to your Google account? Current cloud: "+counts+". This is a manual snapshot, not automatic sync. Type "+label+" to continue.")!==label)return;
   const revision=await cloud.saveFinanceBackup(record.data,record.sha256,manifest?.revision??null);
   // Verify the complete snapshot by fetching and comparing it from Firestore.
   const back=await cloud.getFinanceBackup();
   if(back.revision!==revision||back.sha256!==record.sha256||
      JSON.stringify(back.data)!==JSON.stringify(record.data))
     throw Error("Cloud upload could not be verified. Do NOT delete Everyday's finance data.");
   stampCloud(back.revision,back.sha256);dispatch();
   alert("Finance cloud backup verified. Every original transaction and budget field matches.");
 }
 async function inspectCloud(){
   const cloud=window.CommandCloud;
   if(!cloud?.ready||!cloud.user)throw Error("Sign in with Google in Command Settings first.");
   const back=await cloud.getFinanceBackup();
   if(!back){alert("No finance backup exists for this Google account yet.");return;}
   const checked=validateFile({format:FORMAT,section:"finances",data:back.data});
   const report=checked.report;
   if(record?.sha256===back.sha256&&JSON.stringify(record.data)===JSON.stringify(back.data)){
     stampCloud(back.revision,back.sha256);dispatch();
     alert("Cloud and local finance data match exactly. "+report.transactions+" transaction IDs verified.");
     return;
   }
   const current=record?.report?.transactions??0;
   if(prompt("Verified cloud backup has "+report.transactions+" transactions, "+report.schedules+" recurring items, "+report.categoryLimits+" category limits (local copy: "+current+" transactions). Restoring replaces the local Money copy but keeps an on-device recovery snapshot. Type RESTORE to continue.")!=="RESTORE")return;
   if(record){
     const previous=localStorage.getItem(KEY);
     if(previous)localStorage.setItem(RECOVERY,previous);
   }
   const saved={format:"command-finance-v1",sourceFormat:FORMAT,importedAt:new Date().toISOString(),
     sourceFilename:"Google cloud backup",sha256:back.sha256,data:back.data};
   const serialized=JSON.stringify(saved);
   localStorage.setItem(KEY,serialized);
   if(localStorage.getItem(KEY)!==serialized||await sha(saved.data)!==back.sha256)
     throw Error("Cloud restore verification failed. Previous data is saved in recovery.");
   record={...saved,report:report};verified=true;pending=null;
   stampCloud(back.revision,back.sha256);dispatch();
   alert("Cloud money restored and verified. Everyday's data was not touched.");
 }
 function render(){
   const importControls='<input id="money-import-input" type="file" accept=".json,application/json" hidden>'+
     '<div class="money-actions"><button class="button" data-money-action="pick-file">Import Everyday finance</button>'+
     (record?'<button class="button secondary" data-money-action="export-finance">Export Money JSON</button><button class="button secondary" data-money-action="export-audit">Audit report</button>':'')+
     '<button class="button secondary" data-money-action="cloud-check">Check cloud backup</button>'+
     (record?'<button class="button secondary" data-money-action="cloud-backup">Back up to Firebase</button>':'')+'</div>';
   const header='<div class="money-header"><div><h1>Money</h1><p>Your paychecks, purchases, bills and budgets</p></div></div>';
   if(error)return header+'<div class="money-warning">'+e(error)+'</div>'+importControls;
   if(!record)return header+importControls+previewView()+
     '<div class="money-empty"><strong>No finances imported yet</strong><p>In Everyday, export the <b>Finances JSON</b> section. Choose that file here to see a verification report before saving. Your work schedule and existing Command data will remain untouched.</p></div>';
   const f=record.data,r=record.report;
   const currentCloud=cloudRecord();
   const verification=section("Import integrity",'<span class="money-verified">'+(verified?"Local copy verified":"Checking saved copy")+'</span>',
     '<p class="money-help">'+r.transactions+' original IDs · '+r.rules+' classification rules · '+r.schedules+' recurring items · '+r.categoryLimits+' limits · '+r.unresolvedBank+' unresolved bank rows.</p>'+
     '<p class="money-help">Imported '+e(record.importedAt.slice(0,10))+' from '+e(record.sourceFilename)+'. '+(currentCloud?'Google backup checked '+e(currentCloud.verifiedAt.slice(0,10))+' (same checksum).':'Google cloud backup not verified for this copy.')+'</p>');
   const nav='<div class="money-subnav">'+[["overview","Overview"],["history","History"],["bills","Bills"],["budgets","Budgets"]].map(([key,name])=>
     '<button class="'+(view===key?'active':'')+'" data-money-action="subview" data-subview="'+key+'">'+name+'</button>').join("")+'</div>';
   let body="";
   if(view==="history")body=section("Transactions",'<span class="muted">'+r.transactions+' imported</span>',recordsView(f));
   else if(view==="bills")body=billsView(f);
   else if(view==="budgets")body=budgetView(f);
   else{
     const p=summary(f,span),balance=f.budgetPlan.balanceCents;
     body='<section class="money-section"><div class="section-head"><h2>Planned cash flow</h2><div class="money-period"><button data-money-action="span" data-days="7" class="'+(span===7?'active':'')+'">1 week</button><button data-money-action="span" data-days="14" class="'+(span===14?'active':'')+'">2 weeks</button></div></div>'+
       '<p class="money-help">'+e(p.start)+' – '+e(p.end)+'. Pending scheduled income and bills, less purchases logged in this period. This is NOT your bank balance.</p>'+
       '<div class="money-stats">'+card("Expected income",cents(p.income),"")+
       card("Scheduled bills","−"+cents(p.bills),"")+
       card("Purchases","−"+cents(p.purchases),"")+
       card("Period remainder",cents(p.available),"Expected − Bills − Purchases")+'</div>'+
       (balance!==null?'<p class="money-help">Manual balance: '+cents(balance)+' as of '+e(f.budgetPlan.balanceAsOf)+'. Not added to projected income.</p>':'')+'</section>'+
       section("Overview",'<span class="muted">'+r.transactions+' transactions</span>',
       '<div class="money-stats">'+card("Bank records",String(r.bankTransactions),"")+
       card("Receipt itemizations",String(r.receipts),"")+
       card("Monthly limits",String(r.categoryLimits),"")+'</div>');
   }
   return header+importControls+previewView()+nav+body+verification;
 }
 async function onFile(file){
   if(!file)return;
   if(file.size>25*1024*1024)throw Error("Finance export exceeds 25 MB.");
   const input=JSON.parse(await file.text()),v=validateFile(input),digest=await sha(v.finance);
   pending={...v,filename:file.name,sha256:digest,diff:compareLedgers(v.finance,record?.data)};
   dispatch();
 }
 document.addEventListener("click",async event=>{
   const button=event.target.closest("[data-money-action]");
   if(!button)return;
   const action=button.dataset.moneyAction;
   try{
     if(action==="pick-file")document.querySelector("#money-import-input")?.click();
     if(action==="cancel-preview"){pending=null;dispatch();}
     if(action==="subview"){view=button.dataset.subview;page=0;dispatch();}
     if(action==="span"){span=Number(button.dataset.days)===14?14:7;dispatch();}
     if(action==="prev-page"){page=Math.max(0,page-1);dispatch();}
     if(action==="next-page"){page++;dispatch();}
     if(action==="month"){month=button.value;page=0;dispatch();}
     if(action==="export-finance"&&record)download("command-finances-"+day()+".json",{format:FORMAT,section:"finances",data:record.data});
     if(action==="export-audit"&&record){
       const idHash=await sha(record.data.transactions.map(t=>t.id).sort());
       download("command-money-audit-"+day()+".json",{
         format:"command-money-audit-v1",sourceFile:record.sourceFilename,importedAt:record.importedAt,
         sha256:record.sha256,transaction_id_sha256:idHash,
         locallyVerified:verified,report:record.report,
         cloudVerified:cloudRecord()?{verifiedAt:cloudRecord().verifiedAt,revision:cloudRecord().revision}:null
       });
     }
     if(action==="cloud-backup"){await backupCloud();return;}
     if(action==="cloud-check"){await inspectCloud();return;}
     if(action==="confirm-import"){
       if(!pending)return;
       const same=record?.sha256===pending.sha256;
       if(!same&&prompt("Copy the verified finance file into Command? Everyday stays untouched. Type IMPORT to confirm.")!=="IMPORT")return;
       savePending();
     }
   }catch(err){alert("Money action failed: "+err.message);}
 });
 document.addEventListener("change",async event=>{
   if(event.target?.id==="money-month"){month=event.target.value;page=0;dispatch();return;}
   if(event.target?.id!=="money-import-input")return;
   const file=event.target.files?.[0];
   try{await onFile(file);}catch(err){alert("Finance preview failed: "+err.message);}
   finally{event.target.value="";}
 });
 read();
 window.CommandMoney={render,getRecord:()=>record,getData:()=>record?.data||null,report:()=>record?.report||null,verified:()=>verified,
   download:()=>{if(record)download("command-finances-"+day()+".json",{format:FORMAT,section:"finances",data:record.data});},
   reload:read,validateFile,sha};
})();
