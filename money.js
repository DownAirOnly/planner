(function(){
 "use strict";
 const KEY="command.finance.v1", RECOVERY="command.finance.beforeImport", CLOUD_VERIFIED="command.finance.cloudVerified";
 const FORMAT="everyday-section-v1";
 const iso=x=>typeof x==="string"&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"))&&new Date(x+"T12:00:00Z").toISOString().slice(0,10)===x;
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
   const archived=finance.archivedTransactions??[];
   if(!Array.isArray(archived)||archived.length>50000)throw Error("Invalid archived finance history.");
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
   for(const t of archived){
     if(!t||typeof t.id!=="string"||!t.id.trim()||!iso(t.date)||
        !["expense","income","transfer"].includes(t.kind)||
        !Number.isSafeInteger(t.amountCents)||t.amountCents<=0||
        typeof t.description!=="string"||!t.description.trim())
       throw Error("Invalid archived transaction.");
     ids.push(t.id);
   }
   unique(ids,"active or archived transaction ID");
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
     unresolvedBank:unresolvedBankRows.length,archived:archived.length};
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
   const archivedPrevious=previous.archivedTransactions||[];
   const restored=archivedPrevious.filter(t=>fresh.has(t.id)).length;
   return {added,changed,unchanged,missing,archivedRestored:restored};
 }
 let record=null,error="",pending=null,verified=false,view="overview",span=7,month="all",page=0;
 let search="",kindFilter="all",categoryFilter="all",editId=null,showArchived=false,planEditor=null;
 let classEditing=null,classReview=false;
 let csvMode="bank",csvPending=null,insightPeriod="30d",reviewFilter="all";
 let paycheckCount=1,whatIf={input:"",amountCents:null};
 let spendPeriod="30d",billCheckIndex=0,newKind="expense";
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
   if(pending.diff?.archivedRestored)
     throw Error("This export would restore archived transactions. Review the archived records before replacing Money data.");
   if(record?.editedAt&&pending.sha256!==record.sha256)
     throw Error("This Everyday export would replace locally edited Money data, including budgets or scheduled bills. Export a Command Money backup first; safe conflict merging is not yet implemented.");
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
 const summary=(f,days)=>window.CommandMoneyPlanning.cashFlow(f,day(),days);
 const card=(name,value,detail)=>'<div class="money-stat"><span>'+e(name)+'</span><strong>'+e(value)+'</strong>'+(detail?'<small>'+e(detail)+'</small>':'')+'</div>';
 const section=(title,right,body)=>'<section class="money-section"><div class="section-head"><h2>'+title+'</h2>'+(right||"")+'</div>'+body+'</section>';

 const moneyAmount=input=>{
   const m=String(input||"").trim().replace(/^\$/,"").match(/^(\d{1,8})(?:\.(\d{1,2}))?$/);
   if(!m)throw Error("Enter an amount like 12.50, with no negative sign.");
   const value=Number(m[1])*100+Number((m[2]||"").padEnd(2,"0"));
   if(!Number.isSafeInteger(value)||value<=0)throw Error("Amount must be greater than zero.");
   return value;
 };
 const prettyAmount=n=>(n/100).toFixed(2);
 const makeId=()=>("command-"+(crypto.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)));
 const selectOption=(value,selected,label)=>'<option value="'+e(value)+'"'+(value===selected?' selected':'')+'>'+e(label||value)+'</option>';
 const categories=data=>{
   const known=new Set(["Uncategorized","Groceries","Dining","Transportation","Bills","Health","Entertainment","Shopping","Income","Transfers"]);
   for(const t of data.transactions)if(t.category)known.add(t.category);
   for(const limit of data.budgetPlan.categoryLimits)if(limit.category)known.add(limit.category);
   return [...known].sort((a,b)=>a.localeCompare(b));
 };
 function transactionEditor(f){
   if(editId===null)return "";
   const original=editId==="new"?null:f.transactions.find(t=>t.id===editId);
   if(editId!=="new"&&!original){editId=null;return "";}
   const bank=!!original?.bankDescription,lockedAmount=bank||!!original?.items?.length;
   const d=original||{date:day(),kind:newKind,amountCents:0,description:"",category:"Uncategorized"};
   const catList='<datalist id="money-categories">'+categories(f).map(c=>'<option value="'+e(c)+'"></option>').join("")+'</datalist>';
   const formInput=(label,name,val,type="text",extra="")=>
     '<label class="money-tx-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(val)+'" '+extra+'></label>';
   const options=['expense','income','transfer'].map(k=>selectOption(k,d.kind,k[0].toUpperCase()+k.slice(1))).join("");
   const bankNotice=bank?'<div class="money-bank-lock"><strong>Original bank record · protected</strong><p>'+e(original.bankDescription)+'</p><small>'+
     e(original.accountLabel||"")+' · Posted '+e(original.postedDate||original.date)+' · '+cents(original.amountCents)+
     '</small><p>Bank amount, original date, statement, and reference IDs stay unchanged.</p></div>':"";
   const receipt=original?.items?.length?'<details class="money-receipt-edit"><summary>Receipt items ('+original.items.length+')</summary><p>Item amounts are retained so the receipt continues to reconcile.</p>'+
     original.items.map((i,n)=>'<div class="money-receipt-row"><label>Item <input name="receipt-name-'+n+'" maxlength="120" value="'+e(i.name)+'"></label>'+
       '<label>Category <input name="receipt-category-'+n+'" maxlength="80" value="'+e(i.category)+'"></label>'+
       '<strong>'+cents(i.amountCents)+'</strong></div>').join("")+'</details>':"";
   const eligiblePaydates=[...new Set(window.CommandMoneyPlanning.occurrences(f.budgetPlan,
     plus(d.purchaseDate||d.date,-90),plus(d.purchaseDate||d.date,90))
     .filter(x=>x.kind==="income"&&x.status!=="skipped").map(x=>x.date))].sort();
   if(d.paycheckDate&&!eligiblePaydates.includes(d.paycheckDate))eligiblePaydates.push(d.paycheckDate);
   const paycheckSelect='<label class="money-tx-field money-tx-wide"><span>Paycheck that covers this purchase (optional)</span>'+
     '<select name="paycheckDate">'+selectOption("","", "Use purchase date")+
     eligiblePaydates.map(date=>selectOption(date,d.paycheckDate||"",date)).join("")+'</select>'+
     '<small>Linked scheduled bills follow the bill assignment instead. This does not edit the original transaction date.</small></label>';
   const billDates=(d.kind==="expense"&&f.budgetPlan.schedules.length)?
     window.CommandMoneyPlanning.occurrences(f.budgetPlan,plus(d.purchaseDate||d.date,-60),plus(d.purchaseDate||d.date,60),f.transactions)
       .filter(x=>x.kind==="expense"): [];
   const existingLink=String(d.billKey||"");
   const choices=billDates.map(x=>selectOption(x.id+"|"+x.date,existingLink,x.name+" · "+x.date+" · "+cents(x.amountCents).replace("−","")));
   if(existingLink&&!billDates.some(x=>x.id+"|"+x.date===existingLink))
     choices.unshift(selectOption(existingLink,existingLink,"Saved link (outside nearby dates): "+existingLink));
   const billLink=d.kind==="expense"?
     '<label class="money-tx-field money-tx-wide"><span>Scheduled bill covered by this transaction</span>'+
     '<select name="billKey">'+selectOption("","", "No scheduled bill")+choices.join("")+'</select>'+
     '<small>Link a purchase to its actual scheduled bill so cash-flow projections do not count it twice. Bank source fields are unchanged.</small></label>':
     (existingLink?'<p class="money-warning">This record currently has a bill link but is not an expense. Change it to an expense or unlink it to correct the record.</p>':"");
   return '<section class="money-tx-editor" id="money-tx-editor"><div class="section-head"><h2>'+(original?"Edit transaction":"New transaction")+'</h2>'+
     '<button data-money-action="cancel-edit">Cancel</button></div>'+
     bankNotice+'<form id="money-transaction-form" class="money-transaction-form">'+
     '<div class="money-tx-form-grid">'+
     (lockedAmount?'<div class="money-tx-field"><span>Amount (locked to source)</span><strong>'+cents(d.amountCents)+'</strong></div>':
       formInput("Amount in USD","amount",original?prettyAmount(d.amountCents):"","text",'inputmode="decimal" maxlength="15" placeholder="0.00" required'))+
     (bank?'<div class="money-tx-field"><span>Posted date (locked)</span><strong>'+e(d.date)+'</strong></div>':
       formInput("Date","date",d.date,"date",'required'))+
     formInput("Description","description",d.description,"text",'required maxlength="200"')+
     '<label class="money-tx-field"><span>Type</span><select name="kind">'+options+'</select></label>'+
     formInput("Category","category",d.category,"text",'list="money-categories" maxlength="80"')+
     formInput("Subcategory","subcategory",d.subcategory||"","text",'maxlength="80"')+
     formInput("Merchant","merchant",d.merchant||"","text",'maxlength="160"')+
     (bank?"":formInput("Payment account","accountLabel",d.accountLabel||"","text",'maxlength="120"'))+
     formInput("Purchase date (optional)","purchaseDate",d.purchaseDate||"","date")+
     formInput("Time (optional)","time",d.time||"","time")+
     '</div>'+catList+billLink+paycheckSelect+
     '<label class="money-tx-field money-tx-wide"><span>Note</span><textarea name="note" rows="2" maxlength="500">'+e(d.note||"")+'</textarea></label>'+
     '<label class="money-tx-field money-tx-wide"><span>Receipt notes</span><textarea name="itemization" rows="2" maxlength="3000">'+e(d.itemization||"")+'</textarea></label>'+
     receipt+
     '<div class="money-tx-actions"><button class="button" type="submit">Save transaction</button>'+
     (original?'<button type="button" class="button secondary money-archive-button" data-money-action="archive-transaction" data-id="'+e(original.id)+'">Archive transaction</button>':'')+
     '</div></form></section>';
 }
 function getFormTx(form,f){
   const fields=new FormData(form),v=Object.fromEntries(fields.entries());
   const original=editId&&editId!=="new"?f.transactions.find(t=>t.id===editId):null;
   if(editId!=="new"&&!original)throw Error("The transaction no longer exists.");
   const bank=!!original?.bankDescription;
   const locked=bank||!!original?.items?.length;
   const description=String(v.description||"").trim();
   if(!description||description.length>200)throw Error("A description is required (max 200 characters).");
   const kind=String(v.kind||"");
   if(!["expense","income","transfer"].includes(kind))throw Error("Unknown transaction type.");
   const date=bank?original.date:String(v.date||"");
   if(!iso(date))throw Error("Choose a valid transaction date.");
   const amountCents=locked?original.amountCents:moneyAmount(v.amount);
   const tx=original?structuredClone(original):{id:makeId(),currency:"USD",source:"manual"};
   Object.assign(tx,{date,kind,amountCents,description,category:String(v.category||"").trim()||"Uncategorized"});
   for(const field of ["merchant","subcategory","note","itemization","purchaseDate","time"]){
     const value=String(v[field]||"").trim();
     if(value)tx[field]=value;else delete tx[field];
   }
   if(!bank){
     const account=String(v.accountLabel||"").trim();
     if(account)tx.accountLabel=account;else delete tx.accountLabel;
   }
   if(tx.purchaseDate&&!iso(tx.purchaseDate))throw Error("Invalid purchase date.");
   if(tx.time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(tx.time))throw Error("Invalid time.");
   const payDate=String(v.paycheckDate||"").trim();
   if(payDate){
     if(!iso(payDate))throw Error("Invalid assigned paycheck date.");
     const eligible=window.CommandMoneyPlanning.occurrences(f.budgetPlan,plus(date,-90),plus(date,90))
       .some(x=>x.kind==="income"&&x.date===payDate&&x.status!=="skipped");
     if(!eligible&&payDate!==original?.paycheckDate)throw Error("Choose a scheduled payday to assign this purchase.");
     tx.paycheckDate=payDate;
   }else delete tx.paycheckDate;
   if(original?.items?.length)tx.items=original.items.map((item,n)=>({
     ...item,name:String(v["receipt-name-"+n]||"").trim(),
     category:String(v["receipt-category-"+n]||"").trim()
   }));
   const billLink=String(v.billKey||"").trim();
   if(billLink){
     if(kind!=="expense")throw Error("Only expenses can be linked to scheduled bills.");
     const split=billLink.lastIndexOf("|"),id=billLink.slice(0,split),due=billLink.slice(split+1);
     const scheduled=f.budgetPlan.schedules.find(x=>x.id===id&&x.kind==="expense");
     if(!scheduled||!iso(due)||(!window.CommandMoneyPlanning.occurs(scheduled,due)&&billLink!==original?.billKey))
       throw Error("This scheduled bill no longer exists. Refresh the editor or unlink it.");
     tx.billKey=billLink;
   }else delete tx.billKey;
   return tx;
 }
 async function commitLedger(next,action){
   if(!record||!verified)throw Error("The current financial copy has not passed local verification.");
   const checked=validateFile({format:FORMAT,section:"finances",data:next});
   const hash=await sha(checked.finance);
   // Serialize before making any changes. Never mutate the committed in-memory object.
   const saved={...record,format:"command-finance-v1",data:checked.finance,
     sha256:hash,editedAt:new Date().toISOString(),lastLocalAction:action};
   delete saved.report;
   const serialized=JSON.stringify(saved),previous=localStorage.getItem(KEY);
   if(!previous)throw Error("Finance storage is missing; nothing was changed.");
   const current=JSON.parse(previous);
   if(current.sha256!==record.sha256)
     throw Error("Money changed in another tab or device view. Reload Money before editing further; no records were overwritten.");
   // Require a recovery snapshot, then write and compare the new data.
   // If storage quota is reached, the original record remains untouched.
   localStorage.setItem(RECOVERY,previous);
   localStorage.setItem(KEY,serialized);
   const stored=localStorage.getItem(KEY);
   if(stored!==serialized||await sha(JSON.parse(stored).data)!==hash)
     throw Error("Money save could not be verified. Keep your previous export.");
   record={...saved,report:checked.report};
   verified=true;
   pending=null;
   dispatch();
 }
 async function archiveTransaction(id){
   const original=record?.data.transactions.find(t=>t.id===id);
   if(!original)throw Error("Transaction not found.");
   if(!confirm("Archive "+(original.merchant||original.description)+" ("+cents(original.amountCents)+")? It will no longer affect totals, but its original details can be restored."))return;
   const next=structuredClone(record.data);
   next.transactions=next.transactions.filter(t=>t.id!==id);
   next.archivedTransactions=[...(next.archivedTransactions||[]),{...original,archivedAt:new Date().toISOString()}];
   await commitLedger(next,"archive transaction");
   editId=null;showArchived=true;view="history";dispatch();
 }
 async function restoreTransaction(id){
   const original=record?.data.archivedTransactions?.find(t=>t.id===id);
   if(!original)throw Error("Archived transaction not found.");
   const next=structuredClone(record.data);
   next.archivedTransactions=next.archivedTransactions.filter(t=>t.id!==id);
   const tx={...original};delete tx.archivedAt;
   next.transactions.push(tx);
   await commitLedger(next,"restore transaction");
   showArchived=false;view="history";dispatch();
 }
 function historyRows(f){
   let rows=showArchived?(f.archivedTransactions||[]):f.transactions;
   if(month!=="all")rows=rows.filter(t=>(t.purchaseDate||t.date).startsWith(month));
   if(kindFilter!=="all")rows=rows.filter(t=>t.kind===kindFilter);
   if(categoryFilter!=="all")rows=rows.filter(t=>t.category===categoryFilter);
   if(reviewFilter==="uncategorized")rows=rows.filter(t=>!t.category||t.category.toLowerCase()==="uncategorized");
   else if(reviewFilter==="needs-review")rows=rows.filter(t=>
     !t.category||t.category.toLowerCase()==="uncategorized"||
     window.CommandMoneyBankImport.financeReviewFlags(t).length>0);
   const q=search.trim().toLocaleLowerCase();
   if(q)rows=rows.filter(t=>[
     t.description,t.merchant,t.category,t.subcategory,t.bankDescription,
     t.accountLabel,t.statementLabel,t.note,t.itemization,t.id
   ].some(x=>String(x||"").toLocaleLowerCase().includes(q))||
     t.items?.some(i=>String(i.name||"").toLocaleLowerCase().includes(q)));
   rows=[...rows].sort((a,b)=>b.date.localeCompare(a.date)||(b.time||"").localeCompare(a.time));
   page=Math.min(page,Math.max(0,Math.ceil(rows.length/35)-1));
   const shown=rows.slice(page*35,(page+1)*35);
   const total=rows.reduce((sum,t)=>sum+(t.kind==="expense"?-t.amountCents:t.kind==="income"?t.amountCents:0),0);
   return '<div class="money-history-count"><span>'+rows.length+' '+(showArchived?"archived":"matching")+' transactions</span><strong>Net '+cents(total)+'</strong></div>'+
     '<div class="money-history">'+(shown.length?shown.map(t=>'<details class="money-transaction"><summary><span><strong>'+e(t.merchant||t.description)+'</strong><small>'+e(t.date)+' · '+e(t.category||"Uncategorized")+
     (t.bankDescription?' · Bank':"")+'</small></span><b class="money-'+e(t.kind)+'">'+(t.kind==="expense"?"−":t.kind==="income"?"+":"↔")+cents(t.amountCents).replace("−","")+'</b></summary>'+
     '<div class="money-transaction-details"><p><strong>Description:</strong> '+e(t.description)+'</p>'+
     (t.bankDescription?'<p><strong>Original bank text:</strong> '+e(t.bankDescription)+'</p>':'')+
     (t.accountLabel?'<p><strong>Account:</strong> '+e(t.accountLabel)+'</p>':'')+
     (t.statementLabel?'<p><strong>Statement:</strong> '+e(t.statementLabel)+'</p>':'')+
     (t.note?'<p><strong>Note:</strong> '+e(t.note)+'</p>':'')+
     (t.items?.length?'<div><strong>Receipt items</strong>'+t.items.map(i=>'<p>'+e(i.name)+' · '+e(i.category)+' · '+cents(i.amountCents)+'</p>').join("")+'</div>':'')+
     '<p class="money-tx-id">ID: '+e(t.id)+'</p>'+
     (showArchived?'<button class="button secondary" data-money-action="restore-transaction" data-id="'+e(t.id)+'">Restore transaction</button>':
       '<button class="button secondary" data-money-action="edit-transaction" data-id="'+e(t.id)+'">Edit transaction</button>')+
     '</div></details>').join(""):'<p class="money-help money-empty-results">No matching transactions.</p>')+'</div>'+
     (rows.length>35?'<div class="money-pager"><button data-money-action="prev-page" '+(page===0?'disabled':'')+'>Previous</button><span>Page '+(page+1)+' of '+Math.ceil(rows.length/35)+'</span><button data-money-action="next-page" '+((page+1)*35>=rows.length?'disabled':'')+'>Next</button></div>':'');
 }
 function recordsView(f){
   const dates=[...new Set([...f.transactions,...(f.archivedTransactions||[])].map(t=>(t.purchaseDate||t.date).slice(0,7)))].sort().reverse();
   if(month!=="all"&&!dates.includes(month))month="all";
   const allCats=[...new Set(f.transactions.map(t=>t.category).filter(Boolean))].sort();
   return '<div class="money-history-toolbar"><button class="button" data-money-action="new-transaction">+ New transaction</button>'+
     '<button class="button secondary'+(showArchived?" active":"")+'" data-money-action="toggle-archived">'+(showArchived?"Show active":"Archived ("+(f.archivedTransactions?.length||0)+")")+'</button></div>'+
     '<div class="money-history-filters">'+
     '<label>Search<input id="money-search" type="search" value="'+e(search)+'" placeholder="Merchant, description, bank text…" autocomplete="off"></label>'+
     '<label>Month<select id="money-month"><option value="all">All history</option>'+
     dates.map(m=>selectOption(m,month,m)).join("")+'</select></label>'+
     '<label>Type<select id="money-kind">'+[["all","All types"],["expense","Expenses"],["income","Income"],["transfer","Transfers"]].map(([k,label])=>selectOption(k,kindFilter,label)).join("")+'</select></label>'+
     '<label>Review<select id="money-review-filter">'+[["all","All records"],["needs-review","Needs review"],["uncategorized","Uncategorized"]].map(([k,label])=>selectOption(k,reviewFilter,label)).join("")+'</select></label>'+
     '<label>Category<select id="money-category">'+selectOption("all",categoryFilter,"All categories")+
     allCats.map(k=>selectOption(k,categoryFilter,k)).join("")+'</select></label></div>'+
     '<div id="money-history-results">'+historyRows(f)+'</div>';
 }
 function budgetView(f){return window.CommandMoneyBillsUI.budgets(f,planEditor,day());}
 function billsView(f){return window.CommandMoneyBillsUI.bills(f,planEditor,day());}
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
     (diff.archivedRestored?'<p class="money-warning">This export contains archived records. Re-import is blocked to preserve your archive decisions.</p>':'')+
     (record?.editedAt&&!same?'<p class="money-warning">This export would replace locally edited budgets, schedules or transactions. Import is blocked until conflict merging is supported.</p>':'')+
     '<div class="money-compare"><div><span>Income</span><strong>'+cents(r.income)+'</strong></div>'+
     '<div><span>Expenses</span><strong>'+cents(r.expense)+'</strong></div>'+
     '<div><span>Transfers (not spending)</span><strong>'+cents(r.transfer)+'</strong></div>'+
     '<div><span>Dates</span><strong>'+e(r.minDate)+' – '+e(r.maxDate)+'</strong></div>'+
     '<div><span>Bank / receipt records</span><strong>'+r.bankTransactions+' / '+r.receipts+'</strong></div>'+
     '<div><span>Rules / pending bank rows</span><strong>'+r.rules+' / '+r.unresolvedBank+'</strong></div></div>'+
     (potentiallyIncomplete?'<p class="money-warning">This export has zero transactions. It may only contain settings, not full financial history.</p>':'')+
     '<p class="money-warning">Everyday is NOT changed. Importing makes an exact local copy; it does not merge entries, and it does not upload to Firebase. '+(record?'The previous Command finance copy is saved for recovery.':'')+'</p>'+
     (same?'<p class="money-ok">This file is already imported.</p>':
       (diff.missing||diff.archivedRestored||(record?.editedAt&&!same)?'<p>Review missing, archived or conflicting finance data before importing.</p>':
       '<button class="button" data-money-action="confirm-import">Import this finance file</button>'))+'</section>';
 }


 function planEditorStart(kind,id="",date="",defaultKind="expense"){
   planEditor={kind,id,date,defaultKind};dispatch();
   document.querySelector("#money-plan-editor")?.scrollIntoView({block:"nearest",behavior:"smooth"});
 }
 const planMoneyAmount=value=>moneyAmount(value);
 function parseBalance(value){
   const match=String(value||"").trim().match(/^(-)?(\d{1,8})(?:\.(\d{1,2}))?$/);
   if(!match)throw Error("Enter a cash amount like 250.00 or -15.50.");
   const n=(Number(match[2])*100+Number((match[3]||"").padEnd(2,"0")))*(match[1]?-1:1);
   if(!Number.isSafeInteger(n)||Math.abs(n)>10000000000)throw Error("Cash amount is outside the supported range.");
   return n;
 }
 async function markOccurrence(id,date,status){
   if(!["paid","skipped","pending"].includes(status)||!iso(date))throw Error("Invalid scheduled date.");
   const r=record?.data.budgetPlan.schedules.find(x=>x.id===id);
   if(!r||!window.CommandMoneyPlanning.occurs(r,date))throw Error("That scheduled occurrence doesn't exist.");
   const next=structuredClone(record.data);
   const target=next.budgetPlan.schedules.find(x=>x.id===id);
   if(status==="pending")delete target.occurrences[date];
   else target.occurrences[date]=status;
   await commitLedger(next,status==="pending"?"unmark occurrence":"mark occurrence "+status);
 }
 async function resetPaycheck(id,date){
   const r=record?.data.budgetPlan.schedules.find(x=>x.id===id);
   if(!r||r.kind!=="income"||!window.CommandMoneyPlanning.occurs(r,date))throw Error("Paycheck not found.");
   const next=structuredClone(record.data);
   delete next.budgetPlan.paycheckAmounts[id+"|"+date];
   await commitLedger(next,"reset paycheck override");
   planEditor=null;
 }
 async function removeLimit(category){
   if(!record.data.budgetPlan.categoryLimits.some(x=>x.category===category))throw Error("Budget limit not found.");
   if(!confirm("Remove the "+category+" monthly limit? Existing transactions keep their categories."))return;
   const next=structuredClone(record.data);
   next.budgetPlan.categoryLimits=next.budgetPlan.categoryLimits.filter(x=>x.category!==category);
   await commitLedger(next,"remove category limit");
   planEditor=null;
 }
 async function savePlanForm(form){
   if(!record||!verified)throw Error("Money must be locally verified before editing.");
   const kind=form.dataset.planKind,values=Object.fromEntries(new FormData(form).entries());
   const next=structuredClone(record.data),plan=next.budgetPlan;
   if(kind==="schedule"){
     const name=String(values.name||"").trim(),type=String(values.kind||"");
     const frequency=String(values.frequency||""),first=String(values.startDate||"");
     const end=String(values.endDate||"");
     if(!name||name.length>120||!["expense","income"].includes(type)||
        !["once","weekly","biweekly","monthly"].includes(frequency)||!iso(first)||
        end&&(!iso(end)||end<first))throw Error("Check the name, type, frequency, and dates.");
     const amountCents=planMoneyAmount(values.amount);
     const id=String(values.id||"");
     const prior=id?plan.schedules.find(r=>r.id===id):null;
     if(id&&!prior)throw Error("This recurring plan no longer exists.");
     if(!prior&&plan.schedules.length>=250)throw Error("The schedule limit has been reached.");
     if(prior&&(prior.startDate!==first||prior.frequency!==frequency||prior.kind!==type)&&
        Object.keys(prior.occurrences).length>0&&
        !confirm("This changes a repeat rule that has saved Paid or Skipped markers. Those markers will be kept on their original dates. Continue?"))return;
     const edited={...(prior||{}),id:prior?.id||makeId(),name,kind:type,amountCents,startDate:first,frequency,
       occurrences:prior?.occurrences||{}};
     if(end)edited.endDate=end;else delete edited.endDate;
     if(prior)plan.schedules=plan.schedules.map(x=>x.id===id?edited:x);
     else plan.schedules.push(edited);
   }else if(kind==="limit"){
     const original=String(values.originalCategory||"");
     const category=String(values.category||"").trim();
     if(!category||category.length>80)throw Error("Enter a category (80 characters max).");
     const amountCents=planMoneyAmount(values.amount);
     const prior=plan.categoryLimits.find(x=>x.category===original);
     if(original&&!prior)throw Error("Budget category was changed elsewhere.");
     if(plan.categoryLimits.some(x=>x.category.toLocaleLowerCase()===category.toLocaleLowerCase()&&x.category!==original))
       throw Error("A budget limit already exists for that category.");
     if(prior)plan.categoryLimits=plan.categoryLimits.map(x=>x.category===original?{category,amountCents}:x);
     else plan.categoryLimits.push({category,amountCents});
   }else if(kind==="balance"){
     if(!iso(values.asOf)||values.asOf>day())throw Error("Choose today or an earlier date for the cash balance.");
     plan.balanceCents=parseBalance(values.balance);
     plan.balanceAsOf=values.asOf;
   }else if(kind==="assignment"){
     const id=String(values.id||""),date=String(values.date||""),selected=String(values.paycheckDate||"");
     const rule=plan.schedules.find(r=>r.id===id&&r.kind==="expense");
     if(!rule||!iso(date)||!window.CommandMoneyPlanning.occurs(rule,date))
       throw Error("That scheduled bill was not found.");
     const key=id+"|"+date;
     if(selected){
       const found=window.CommandMoneyPlanning.occurrences(plan,plus(date,-75),plus(date,75))
         .some(x=>x.kind==="income"&&x.status!=="skipped"&&x.date===selected);
       if(!found&&selected!==plan.billAssignments[key])
         throw Error("Choose an existing scheduled payday.");
       plan.billAssignments[key]=selected;
     }else delete plan.billAssignments[key];
   }else if(kind==="override"){
     const id=String(values.id||""),date=String(values.date||"");
     const r=plan.schedules.find(x=>x.id===id);
     if(!r||r.kind!=="income"||!window.CommandMoneyPlanning.occurs(r,date))
       throw Error("That paycheck occurrence is no longer scheduled.");
     plan.paycheckAmounts[id+"|"+date]=planMoneyAmount(values.amount);
   }else throw Error("Unknown planning form.");
   await commitLedger(next,"update "+kind);
   planEditor=null;dispatch();
 }

 function isSyncEditing(){
   return editId!==null||planEditor!==null||pending!==null||
     classEditing!==null||classReview||csvPending!==null;
 }
 // Called only by the opt-in sync coordinator after a complete, checksum-
 // verified cloud read. Saved local data and the open editor are checked again
 // at commit time; a remote snapshot never discards unsaved edits.
 async function applySyncedData(snapshot,expectedLocalHash){
   if(isSyncEditing())throw Error("Close your open Money editor before applying cloud changes.");
   const raw=localStorage.getItem(KEY);
   const current=raw?JSON.parse(raw):null;
   if((current?.sha256??null)!==(expectedLocalHash??null))
     throw Error("Money changed locally while downloading. Nothing was replaced.");
   const checked=validateFile({format:FORMAT,section:"finances",data:snapshot?.data});
   const digest=await sha(checked.finance);
   if(digest!==snapshot.sha256)throw Error("Synced Money checksum did not match.");
   if((localStorage.getItem(KEY)||null)!==raw)
     throw Error("Money changed in another tab. Cloud restore was stopped.");
   const stored={format:"command-finance-v1",sourceFormat:FORMAT,
     importedAt:current?.importedAt||new Date().toISOString(),
     sourceFilename:current?.sourceFilename||"Verified Google Money sync",
     sha256:digest,data:checked.finance,syncedAt:new Date().toISOString()};
   const serialized=JSON.stringify(stored);
   if(raw)localStorage.setItem(RECOVERY,raw);
   localStorage.setItem(KEY,serialized);
   if(localStorage.getItem(KEY)!==serialized||await sha(JSON.parse(serialized).data)!==digest)
     throw Error("Cloud Money restore did not verify. The previous copy was preserved.");
   record={...stored,report:checked.report};
   error="";verified=true;editId=null;planEditor=null;pending=null;
   dispatch();
   return true;
 }

 function renderClassification(f){
   const model=window.CommandMoneyClassification;
   const proposals=classReview?model.proposals(f.transactions,f.classificationRules):[];
   return model.render(f,classEditing,classReview,proposals);
 }
 function classStart(id){
   classEditing=id;classReview=false;view="budgets";dispatch();
   document.querySelector("#money-classification-editor")?.scrollIntoView({block:"nearest"});
 }
 async function classSave(form){
   if(!record||!verified)throw Error("Money must be verified before changing classification rules.");
   const v=Object.fromEntries(new FormData(form).entries());
   const id=String(v.id||"");
   const previous=id?record.data.classificationRules.find(x=>x.id===id):null;
   if(id&&!previous)throw Error("This classification rule is no longer available.");
   const matchText=String(v.matchText||"").trim();
   const rule={...(previous||{}),id:previous?.id||makeId(),
     name:String(v.name||"").trim(),matchText,
     matchField:String(v.matchField||"any"),
     category:String(v.category||"").trim(),
     subcategory:String(v.subcategory||"").trim(),
     merchant:String(v.merchant||"").trim(),
     enabled:v.enabled!=="no"};
   if(String(v.amount||"").trim())rule.amountCents=moneyAmount(v.amount);
   else delete rule.amountCents;
   window.CommandMoneyClassification.validateRule(rule);
   const next=structuredClone(record.data);
   if(previous)next.classificationRules=next.classificationRules.map(x=>x.id===id?rule:x);
   else{
     if(next.classificationRules.length>=300)throw Error("Classification rule limit reached.");
     next.classificationRules.push(rule);
   }
   await commitLedger(next,previous?"edit classification rule":"add classification rule");
   classEditing=null;classReview=false;dispatch();
 }
 async function classDelete(id){
   const old=record?.data.classificationRules.find(x=>x.id===id);
   if(!old)throw Error("Classification rule not found.");
   if(!confirm("Remove the rule '"+old.name+"'? Existing transaction categories will not change."))return;
   const next=structuredClone(record.data);
   next.classificationRules=next.classificationRules.filter(r=>r.id!==id);
   await commitLedger(next,"remove classification rule");
   classEditing=null;classReview=false;dispatch();
 }
 async function classApply(){
   if(!record||!verified)throw Error("Money must be verified to apply classification changes.");
   const checked=[...document.querySelectorAll(".money-class-review input[data-class-selected]:checked")].map(x=>x.value);
   if(!checked.length)throw Error("Select at least one transaction to update.");
   if(new Set(checked).size!==checked.length)throw Error("Duplicate transaction selected.");
   const proposals=window.CommandMoneyClassification.proposals(record.data.transactions,record.data.classificationRules);
   const next=window.CommandMoneyClassification.apply(record.data,proposals,checked);
   if(!confirm("Apply "+checked.length+" reviewed classification update"+(checked.length===1?"":"s")+"? Original bank amounts and descriptions will not change."))return;
   await commitLedger(next,"apply reviewed classification suggestions");
   classReview=true;classEditing=null;dispatch();
 }

 // CSV imports reuse exactly the same local validation, recovery and account-
 // scoped sync path as manual transaction edits. No remote bank files are sent.
 function csvReady(){
   if(!record||!verified)throw Error("Import and verify the Money ledger first.");
   if(editId!==null||planEditor!==null||classEditing!==null)
     throw Error("Close transaction, bill, or classification editors before importing.");
 }
 async function csvReadForm(form){
   csvReady();
   const data=new FormData(form),file=data.get("file");
   const pasted=String(data.get("text")||"").trim();
   if(file?.size>5000000||pasted.length>5000000)throw Error("CSV must be under 5 MB.");
   const text=pasted||(file?.size?await file.text():"");
   if(!text.trim())throw Error("Choose a CSV file or paste rows to preview.");
   const filename=pasted?"Pasted CSV":file.name;
   const base=record.sha256,finance=record.data;
   if(csvMode==="bank"){
     const bank=window.CommandMoneyBankImport;
     const accountLabel=String(data.get("accountLabel")||"").trim();
     const statementLabel=String(data.get("statementLabel")||"").trim()||bank.inferBofaStatementLabel(text);
     if(!statementLabel)throw Error("Enter a statement label or use a CSV with recognizable dates.");
     const parsed=bank.readBofaCSV(text,{accountLabel,statementLabel});
     const plan=window.CommandMoneyBankReview.prepareReconciliation(parsed.records,finance,{
       errors:parsed.errors,warnings:parsed.warnings,details:parsed.details,filename
     });
     csvPending={kind:"bank",sourceHash:base,filename,plan,
       sourceTransactions:finance.transactions,errors:plan.errors,warnings:[]};
   }else{
     const result=csvMode==="receipt"?
       window.CommandMoneyCsvModel.receiptPreview(text,finance):
       window.CommandMoneyCsvModel.enrichmentPreview(text,finance);
     csvPending={...result,sourceHash:base,filename};
   }
   dispatch();
   document.querySelector("#money-import-preview")?.scrollIntoView({block:"start",behavior:"smooth"});
 }
 function csvReviewSaved(){
   csvReady();
   const rows=record.data.budgetPlan.unresolvedBankRows||[];
   if(!rows.length)throw Error("No unresolved bank rows are saved.");
   const plan=window.CommandMoneyBankReview.prepareReconciliation(rows,record.data,{
     warnings:["These bank rows were saved for review. No transactions have been added yet."],
     filename:"Saved unresolved bank rows"
   });
   csvMode="bank";
   csvPending={kind:"bank",sourceHash:record.sha256,filename:"Saved unresolved bank rows",
     sourceTransactions:record.data.transactions,plan,errors:plan.errors,warnings:[]};
   view="import";dispatch();
 }
 function csvChoose(rowId,choice,receipt="",adjustment="Uncategorized",note=""){
   if(!csvPending||csvPending.kind!=="bank")throw Error("No bank review is open.");
   if(!csvPending.plan.bankRecords.some(r=>r.id===rowId))throw Error("Bank row is not in this review.");
   const plan=window.CommandMoneyBankReview.bankChoose(csvPending.plan,record.data,rowId,
     choice,receipt,adjustment,note);
   csvPending.plan=plan;
   csvPending.errors=plan.errors;
   dispatch();
 }
 async function csvCommit(){
   csvReady();
   if(!csvPending)throw Error("No CSV import has been previewed.");
   if(csvPending.sourceHash!==record.sha256)
     throw Error("Money changed since the import preview. Preview the CSV again.");
   if(csvPending.errors?.length)throw Error("Fix every CSV preview error before importing.");
   const p=csvPending,next=structuredClone(record.data);
   let changes=0;
   if(p.kind==="bank"){
     if(!p.plan.candidate)throw Error("Bank reconciliation has unresolved errors.");
     const result=p.plan.candidate;
     next.transactions=result.transactions;
     next.budgetPlan=result.budgetPlan;
     changes=p.plan.bankReview.newRows.length+p.plan.bankReview.matched.length+
       p.plan.bankReview.needsReview.length;
     if(!changes){csvPending=null;dispatch();alert("All statement rows have already been processed.");return;}
   }else if(p.kind==="receipt"){
     if(!p.rows.length){csvPending=null;dispatch();alert("All matching receipt IDs were already saved.");return;}
     next.transactions.push(...p.rows.map(x=>structuredClone(x)));
     changes=p.rows.length;
   }else if(p.kind==="enrichment"){
     if(!p.rows.length){csvPending=null;dispatch();alert("No changed clarifications to apply.");return;}
     const indices=new Map(next.transactions.map((tx,i)=>[tx.id,i]));
     for(const row of p.rows){
       const index=indices.get(row.record.id);
       if(index==null||JSON.stringify(next.transactions[index])!==JSON.stringify(row.previous))
         throw Error("A transaction was edited after the CSV export. Nothing was changed.");
       next.transactions[index]=structuredClone(row.record);
     }
     changes=p.rows.length;
   }else throw Error("Unknown CSV import.");
   if(prompt("Confirm "+changes+" "+(p.kind==="bank"?"bank review decisions":p.kind==="receipt"?"new transactions":"transaction clarifications")+
      "? This saves a local recovery copy and can sync to your Google account when automatic sync is enabled. Type IMPORT.")!=="IMPORT")return;
   await commitLedger(next,p.kind==="bank"?"import reviewed bank statement":
       p.kind==="receipt"?"import reviewed receipt CSV":"apply transaction clarifications");
   csvPending=null;dispatch();
   alert("Finance CSV committed. "+changes+" reviewed action"+(changes===1?"":"s")+
     " saved locally. Check the Money sync status or make a manual Firebase backup.");
 }
 function downloadText(filename,body,type="text/csv"){
   const b=new Blob([body],{type:type+";charset=utf-8"}),u=URL.createObjectURL(b);
   const a=document.createElement("a");a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 function csvView(){
   return window.CommandMoneyImportUI.entry(csvMode)+
     (record?.data.budgetPlan.unresolvedBankRows.length?
       '<div class="money-csv-actions"><button class="button secondary" data-money-action="csv-review-unresolved">'+
       'Review '+record.data.budgetPlan.unresolvedBankRows.length+' saved bank rows</button></div>':"")+
     window.CommandMoneyImportUI.preview(csvPending);
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
   const ui=window.CommandMoneySimpleUI;
   if(!ui)return '<div class="money-warning">The Money interface is still loading. Reopen Money to retry.</div>';
   const syncControls=window.CommandMoneySync?.renderControls?.()||
     '<p class="money-help">Sign in through Settings to configure Money sync.</p>';
   const header=ui.advancedHeader("Money data");
   const importControl='<input id="money-import-input" type="file" accept=".json,application/json" hidden>';
   if(error)return header+'<div class="money-warning"><strong>Money needs recovery</strong><p>'+
     e(error)+'</p><p>Your saved financial data has not been deliberately deleted. Do not reset or clear the app.</p></div>'+
     importControl+'<button class="button" data-money-action="cloud-check">Check cloud backup</button>'+
     '<button class="button secondary" data-money-action="pick-file">Import a verified finance JSON</button>'+
     '<div id="money-sync-panel">'+syncControls+'</div>';
   if(!record)return ui.advancedHeader("Set up Money","Your history and financial records can be imported without adding sample data.")+
     '<div class="moneys-surface"><h2>No money records on this device</h2>'+
     '<p>Import your existing Everyday Finances JSON or restore a verified Google Money backup.</p>'+
     importControl+
     '<div class="moneys-manage-actions"><button class="button" data-money-action="pick-file">Import finance JSON</button>'+
     '<button class="button secondary" data-money-action="cloud-check">Check cloud backup</button></div>'+
     previewView()+'</div><div id="money-sync-panel">'+syncControls+'</div>';
   const f=record.data,r=record.report;
   const localEditing=planEditor?window.CommandMoneyBillsUI.editor(f,planEditor):"";
   const syncCurrent=window.CommandMoneySync?.isCurrent?.(record.sha256)===true;
   const backup=cloudRecord();
   const outdated=record.editedAt&&!syncCurrent&&!backup;
   const integrity=verified?
     r.transactions+' active transactions · '+r.archived+' archived · '+r.schedules+' scheduled bills and paychecks.':
     'Checking your locally stored finance records.';
   const manage=ui.management(f,{preview:previewView(),sync:syncControls,integrity});
   const body=view==="overview"?
     localEditing+ui.overview(f,day()):
     view==="insights"?ui.spending(f,day(),spendPeriod):
     view==="history"?ui.transactions(f,{
       kind:kindFilter,month,search,review:reviewFilter,category:categoryFilter,archived:showArchived
     },transactionEditor(f),historyRows(f)):
     view==="bills"?
       localEditing+ui.bills(f,day(),billCheckIndex,whatIf):
     view==="manage"?manage:
     view==="import"?ui.advancedHeader("Import and review","Advanced bank and receipt tools.")+csvView()+previewView():
     view==="budgets"?ui.advancedHeader("Spending limits & rules","Monthly spending caps and transaction categorization.")+
       budgetView(f)+renderClassification(f):
     view==="bills-detail"?ui.advancedHeader("All bills & paychecks","Schedules, due dates, and assignments.")+billsView(f):
     ui.overview(f,day());
   const title=view==="insights"?"Spending":view==="history"?"Transactions":
     view==="bills"?"Bills & paychecks":"Money";
   const primary=["overview","insights","history","bills"].includes(view);
   const foot=outdated?'<div class="moneys-backup-note">You have changes that need a verified cloud backup. '+
     '<button data-money-action="subview" data-subview="manage">Manage backups</button></div>':"";
   return primary?ui.shell(title,view,body)+foot:
     '<div class="moneys-shell">'+body+'</div>';
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
     if(action==="simple-period"){
       spendPeriod=["7d","30d","90d"].includes(button.dataset.period)?button.dataset.period:"30d";
       dispatch();return;
     }
     if(action==="simple-kind"){
       kindFilter=["all","expense","income","transfer"].includes(button.dataset.kind)?button.dataset.kind:"all";
       page=0;dispatch();return;
     }
     if(action==="simple-review"){
       view="history";showArchived=false;reviewFilter="needs-review";
       kindFilter="all";page=0;dispatch();return;
     }
     if(action==="simple-uncategorized"){
       view="history";showArchived=false;reviewFilter="uncategorized";
       kindFilter="expense";page=0;dispatch();return;
     }
     if(action==="simple-check"){
       billCheckIndex=button.dataset.index==="1"?1:0;
       whatIf={input:"",amountCents:null};dispatch();return;
     }
     if(action==="simple-balance"){
       planEditorStart("balance");return;
     }
     if(action==="simple-add"||action==="simple-transfer"){
       newKind=action==="simple-transfer"?"transfer":"expense";
       view="history";showArchived=false;reviewFilter="all";
       kindFilter="all";editId="new";dispatch();
       document.querySelector("#money-tx-editor")?.scrollIntoView({block:"start"});
       return;
     }
     if(action==="open-transaction"){
       const tx=record?.data.transactions.find(t=>t.id===button.dataset.id);
       if(!tx)throw Error("Transaction could not be found.");
       view="history";showArchived=false;editId=tx.id;page=0;dispatch();
       document.querySelector("#money-tx-editor")?.scrollIntoView({block:"start"});
       return;
     }
     if(action==="insights-uncategorized"){view="history";reviewFilter="uncategorized";page=0;dispatch();return;}
     if(action==="insights-needs-review"){view="history";reviewFilter="needs-review";page=0;dispatch();return;}
     if(action==="csv-mode"){csvMode=button.dataset.csvMode;csvPending=null;dispatch();return;}
     if(action==="csv-cancel"){csvPending=null;dispatch();return;}
     if(action==="csv-review-unresolved"){csvReviewSaved();return;}
     if(action==="csv-commit"){await csvCommit();return;}
     if(action==="csv-template"){
       try{await navigator.clipboard.writeText(window.CommandMoneyImportUI.csvSample);alert("Receipt CSV template copied.");}
       catch{prompt("Copy this receipt CSV:",window.CommandMoneyImportUI.csvSample);}
       return;
     }
     if(action==="csv-enrichment-export"){
       csvReady();
       downloadText("command-finance-enrichment-"+day()+".csv",
         window.CommandMoneyBankImport.financeEnrichmentCSV(record.data.transactions));
       return;
     }
     if(action==="class-new"){classStart("new");return;}
     if(action==="class-edit"){classStart(button.dataset.id);return;}
     if(action==="class-cancel"){classEditing=null;dispatch();return;}
     if(action==="class-review"){classEditing=null;classReview=true;dispatch();return;}
     if(action==="class-hide"){classReview=false;dispatch();return;}
     if(action==="class-apply"){await classApply();return;}
     if(action==="class-delete"){await classDelete(button.dataset.id);return;}
     if(action==="paycheck-setup"){view="bills";planEditorStart("schedule","","","income");return;}
     if(action==="checks"){paycheckCount=Number(button.dataset.checks)===2?2:1;whatIf={input:"",amountCents:null};dispatch();return;}
     if(action==="plan-assign-bill"){planEditorStart("assignment",button.dataset.id,button.dataset.date);return;}
     if(action==="plan-add-schedule"){planEditorStart("schedule");return;}
     if(action==="plan-edit-schedule"){planEditorStart("schedule",button.dataset.id);return;}
     if(action==="plan-add-limit"){planEditorStart("limit");return;}
     if(action==="plan-edit-limit"){planEditorStart("limit",button.dataset.id);return;}
     if(action==="plan-edit-balance"){planEditorStart("balance");return;}
     if(action==="plan-adjust-paycheck"){planEditorStart("override",button.dataset.id,button.dataset.date);return;}
     if(action==="plan-cancel"){planEditor=null;dispatch();return;}
     if(action==="plan-mark-paid"||action==="plan-mark-skipped"||action==="plan-mark-pending"){
       await markOccurrence(button.dataset.id,button.dataset.date,action==="plan-mark-paid"?"paid":action==="plan-mark-skipped"?"skipped":"pending");
       dispatch();return;
     }
     if(action==="plan-reset-paycheck"){await resetPaycheck(button.dataset.id,button.dataset.date);dispatch();return;}
     if(action==="plan-delete-limit"){await removeLimit(button.dataset.id);dispatch();return;}
     if(action==="pick-file")document.querySelector("#money-import-input")?.click();
     if(action==="new-transaction"){newKind="expense";view="history";showArchived=false;editId="new";dispatch();document.querySelector("#money-tx-editor")?.scrollIntoView({block:"start"});return;}
     if(action==="edit-transaction"){view="history";showArchived=false;editId=button.dataset.id;dispatch();document.querySelector("#money-tx-editor")?.scrollIntoView({block:"start"});return;}
     if(action==="cancel-edit"){editId=null;dispatch();return;}
     if(action==="toggle-archived"){showArchived=!showArchived;page=0;editId=null;dispatch();return;}
     if(action==="archive-transaction"){await archiveTransaction(button.dataset.id);return;}
     if(action==="restore-transaction"){await restoreTransaction(button.dataset.id);return;}
     if(action==="cancel-preview"){pending=null;dispatch();}
     if(action==="subview"){
       view=["overview","history","insights","bills","bills-detail","budgets","import","manage"].includes(button.dataset.subview)?
         button.dataset.subview:"overview";
       page=0;editId=null;planEditor=null;classEditing=null;classReview=false;csvPending=null;dispatch();
     }
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
 document.addEventListener("input",event=>{
   if(event.target?.id!=="money-search")return;
   search=event.target.value;page=0;
   const results=document.querySelector("#money-history-results");
   if(results&&record)results.innerHTML=historyRows(record.data);
 });
 document.addEventListener("submit",async event=>{
   if(event.target?.id==="money-what-if-form"){
     event.preventDefault();
     try{
       const input=String(new FormData(event.target).get("amount")||"");
       const n=moneyAmount(input);
       const view=window.CommandMoneyPaychecks.paycheckWindows(record.data.budgetPlan,record.data.transactions,day(),paycheckCount);
       if(!view.configured||!view.periods.length)throw Error("Set up a payday first.");
       whatIf={input,amountCents:n};dispatch();
     }catch(error){alert("What-if calculation: "+error.message);}
     return;
   }
   if(event.target?.id==="money-csv-form"){
     event.preventDefault();
     try{await csvReadForm(event.target);}
     catch(error){alert("CSV preview failed: "+error.message);}
     return;
   }
   if(event.target?.id==="money-class-form"){
     event.preventDefault();
     try{await classSave(event.target);}catch(error){alert("Classification rule not saved: "+error.message);}
     return;
   }
   if(event.target?.id==="money-plan-form"){
     event.preventDefault();
     try{await savePlanForm(event.target);}
     catch(error){alert("Planning update not saved: "+error.message);}
     return;
   }
   if(event.target?.id!=="money-transaction-form")return;
   event.preventDefault();
   try{
     const tx=getFormTx(event.target,record.data);
     const next=structuredClone(record.data);
     const index=editId==="new"?-1:next.transactions.findIndex(t=>t.id===editId);
     if(editId!=="new"&&index<0)throw Error("The edited transaction was not found.");
     if(index<0)next.transactions.push(tx);else next.transactions[index]=tx;
     if(tx.billKey&&next.transactions.some(t=>t.id!==tx.id&&t.billKey===tx.billKey))
       if(!confirm("Another transaction is already linked to this scheduled bill. Keep both links? This could conceal spending in your cash-flow summary."))return;
     await commitLedger(next,index<0?"add transaction":"edit transaction");
     editId=null;view="history";showArchived=false;dispatch();
     alert("Transaction saved locally. Remember to back up Money to Firebase after edits.");
   }catch(error){alert("Transaction not saved: "+error.message);}
 });

 document.addEventListener("change",async event=>{
   const target=event.target;
   if(target?.matches?.("[data-money-bank-choice], [data-money-bank-receipt], [data-money-bank-adjustment], [data-money-bank-note]")){
     try{
       const row=target.dataset.moneyBankChoice||target.dataset.moneyBankReceipt||
         target.dataset.moneyBankAdjustment||target.dataset.moneyBankNote;
       const p=csvPending,existing=p?.plan?.bankDecisions?.[row]||{action:"defer"};
       const choice=target.dataset.moneyBankChoice!=null?target.value:existing.action;
       const bankRow=p.plan.bankRecords.find(x=>x.id===row);
       const candidates=window.CommandMoneyBankReview.bankReceiptCandidates(bankRow,record.data.transactions);
       let receipt=target.dataset.moneyBankReceipt!=null?target.value:existing.receiptId||"";
       if(choice==="match"&&!receipt)receipt=candidates[0]?.tx.id||"";
       const category=target.dataset.moneyBankAdjustment!=null?target.value:existing.adjustmentCategory||"Uncategorized";
       const note=target.dataset.moneyBankNote!=null?target.value:existing.adjustmentNote||"";
       csvChoose(row,choice,receipt,category,note);return;
     }catch(error){alert("Bank review choice: "+error.message);return;}
   }
   if(target?.id==="money-insights-period"){insightPeriod=target.value;dispatch();return;}
   if(target?.id==="money-review-filter"){reviewFilter=target.value;page=0;dispatch();return;}
   if(target?.id==="money-month"){month=target.value;page=0;dispatch();return;}

   if(event.target?.id==="money-kind"){kindFilter=event.target.value;page=0;dispatch();return;}
   if(event.target?.id==="money-category"){categoryFilter=event.target.value;page=0;dispatch();return;}
   if(event.target?.id!=="money-import-input")return;
   const file=event.target.files?.[0];
   try{await onFile(file);}catch(err){alert("Finance preview failed: "+err.message);}
   finally{event.target.value="";}
 });
 read();
 window.CommandMoney={render,getRecord:()=>record,getData:()=>record?.data||null,report:()=>record?.report||null,verified:()=>verified,
   isSyncEditing,applySyncedData,
   download:()=>{if(record)download("command-finances-"+day()+".json",{format:FORMAT,section:"finances",data:record.data});},
   reload:read,validateFile,sha};
})();
