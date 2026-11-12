(function(){
"use strict";
// Simple front end for Money. Existing ledger, bank imports, recovery and sync
// remain in their original modules, not in this presentation layer.
const E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const USD=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const DATE=s=>s?new Date(s+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}):"";
const DAY=86400000;
const dateShift=(str,n)=>new Date(Date.parse(str+"T12:00:00Z")+n*DAY).toISOString().slice(0,10);
const displayedDate=t=>t.purchaseDate||t.date;
const icon=name=>'<svg class="icon" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>';
const btn=(action,label,extra="")=>'<button data-money-action="'+action+'" '+extra+'>'+label+'</button>';
const nothing=(message,action="",label="")=>'<div class="moneys-empty">'+E(message)+(action?'<div>'+btn(action,label)+'</div>':"")+'</div>';
const summaryCard=(label,number,description)=>'<div class="moneys-summary-card"><span>'+E(label)+'</span>'+
  '<strong>'+E(number)+'</strong>'+(description?'<small>'+E(description)+'</small>':"")+'</div>';
const scheduleWindow=(f,today)=>{
 const planning=window.CommandMoneyPlanning;
 const horizon=planning.occurrences(f.budgetPlan,today,dateShift(today,60),f.transactions);
 const upcomingPay=horizon.filter(x=>x.kind==="income"&&x.date>today&&x.status!=="skipped")[0]||null;
 const stop=upcomingPay?.date||dateShift(today,14);
 const bills=horizon.filter(x=>x.kind==="expense"&&!x.settled&&x.date>=today&&x.date<stop);
 const reserved=bills.reduce((n,x)=>n+x.amountCents,0);
 const cash=f.budgetPlan.balanceCents,asOf=f.budgetPlan.balanceAsOf;
 const balanceKnown=Number.isSafeInteger(cash)&&typeof asOf==="string"&&asOf.length===10;
 return {nextPay:upcomingPay,bills,reserved,balanceKnown,cash,asOf,stale:balanceKnown&&asOf!==today,
   available:balanceKnown?cash-reserved:null};
};
const categorize=(transactions,start,end)=>{
 const groups=new Map();let total=0;
 const add=(label,amount,count)=>{
   if(!amount)return;
   const name=String(label||"Uncategorized").trim()||"Uncategorized";
   const key=name.toLocaleLowerCase();if(!groups.has(key))groups.set(key,{name,amountCents:0,count:0});
   const g=groups.get(key);g.amountCents+=amount;g.count+=count;
 };
 for(const t of transactions){
   if(t.kind!=="expense")continue;
   const d=displayedDate(t);if(d<start||d>end)continue;
   total+=t.amountCents;
   if(t.items?.length){
     let sum=0;
     for(const item of t.items){add(item.category||t.category,item.amountCents,1);sum+=item.amountCents;}
     const adjustment=t.amountCents-sum;if(adjustment)add(t.adjustmentCategory||t.category||"Uncategorized",adjustment,1);
   }else{
     const base=t.receiptAmountCents??t.amountCents;
     add(t.category,base,1);
     if(base!==t.amountCents)add(t.adjustmentCategory||"Uncategorized",t.amountCents-base,1);
   }
 }
 return {total,groups:[...groups.values()].filter(g=>g.amountCents>0)
   .sort((a,b)=>b.amountCents-a.amountCents||a.name.localeCompare(b.name))};
};
const cardTitle=(title,action,label)=>'<div class="moneys-card-head"><h3>'+title+'</h3>'+
  (action?btn("subview",E(label||"See all")+' <span class="moneys-chevron">›</span>','data-subview="'+action+'"'):"")+'</div>';
const categoryBars=(data,max,short=false)=>{
 const groups=data.slice(0,max);
 if(!groups.length)return nothing("No categorized spending in this period.");
 const maximum=Math.max(1,...groups.map(g=>g.amountCents));
 return '<div class="moneys-bars">'+groups.map(g=>
   '<div class="moneys-bar-row"><span>'+E(g.name)+'</span><div class="moneys-meter"><i style="width:'+
   Math.min(100,Math.max(0,100*g.amountCents/maximum)).toFixed(1)+'%"></i></div>'+
   '<b>'+USD(g.amountCents)+'</b><small>'+(data.reduce((n,x)=>n+x.amountCents,0)>0?
     Math.round(g.amountCents/data.reduce((n,x)=>n+x.amountCents,0)*100):0)+'%</small></div>').join("")+'</div>';
};
const reviewCount=transactions=>transactions.filter(t=>t.kind==="expense"&&
   (!t.category||t.category.toLowerCase()==="uncategorized"||
    window.CommandMoneyBankImport?.financeReviewFlags?.(t)?.length>0)).length;
const needReview=count=>count?'<button class="moneys-review" data-money-action="simple-review">'+
 icon("check")+'<span><strong>Needs review</strong><small>'+count+' transaction'+(count===1?"":"s")+
 ' to categorize or check</small></span><span class="moneys-chevron">›</span></button>':"";
const dateLabel=d=>d?DATE(d):"";
function recent(f,count=3){
 const items=[...f.transactions].filter(t=>t.kind==="expense").sort((a,b)=>
  displayedDate(b).localeCompare(displayedDate(a))||b.date.localeCompare(a.date)).slice(0,count);
 if(!items.length)return nothing("No recorded purchases yet.");
 return '<div class="moneys-recent">'+items.map(t=>'<button data-money-action="open-transaction" data-id="'+E(t.id)+'">'+
  '<span class="moneys-merchant-mark">'+E((t.merchant||t.description||"?").charAt(0).toUpperCase())+'</span>'+
  '<span class="moneys-tx-copy"><strong>'+E(t.merchant||t.description)+'</strong><small>'+E(t.category||"Uncategorized")+'</small></span>'+
  '<time>'+dateLabel(displayedDate(t))+'</time><b>−'+USD(t.amountCents)+'</b></button>').join("")+'</div>';
}
const titleBar=(title)=>'<div class="moneys-title"><h1>'+title+'</h1>'+
   '<button data-money-action="subview" data-subview="manage" aria-label="Manage Money" title="Manage Money">'+icon("settings")+'</button></div>';
function overview(f,today){
 const w=scheduleWindow(f,today),month=today.slice(0,7);
 const spending=categorize(f.transactions,month+"-01",dateShift(month+"-01",35).slice(0,7)==month?dateShift(month+"-01",35):new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10));
 const count=reviewCount(f.transactions);
 const hero='<section class="moneys-hero">'+
   '<span>Available now'+(w.stale?'<em>Update needed</em>':'')+'</span>'+
   '<strong>'+(w.balanceKnown?USD(w.available):'Set your balance')+'</strong>'+
   '<p>'+(w.balanceKnown?
     (w.stale?'Estimate from '+DATE(w.asOf)+'. Update cash for a reliable figure.':
     'Cash on hand minus unpaid bills before the next paycheck.') :
     'Enter your cash balance to estimate what is safe to spend after upcoming bills.')+'</p>'+
   '<button data-money-action="simple-balance">'+(w.balanceKnown?'Update balance':'Set cash balance')+
   ' <span class="moneys-chevron">›</span></button></section>';
 const pay=w.nextPay?USD(w.nextPay.amountCents):"Not set";
 const paySub=w.nextPay?DATE(w.nextPay.date):"Add a payday";
 const essentials='<div class="moneys-two">'+summaryCard("Bills before payday",USD(w.reserved),w.bills.length+" outstanding")+
   summaryCard("Next paycheck",pay,paySub)+'</div>';
 return hero+essentials+
   '<section class="moneys-surface moneys-tappable" data-money-action="noop">'+cardTitle("Where it's going","insights","This month")+
     categoryBars(spending.groups,4,true)+'</section>'+
   '<section class="moneys-surface">'+cardTitle("Recent spending","history","See all")+recent(f,3)+'</section>'+
   needReview(count)+
   '<div class="moneys-quick">'+btn("simple-add","<span>＋</span> Add expense")+
   btn("simple-transfer","↔ Transfer")+btn("simple-review","Review")+'</div>';
}
const breakdownOptions=[["7d","7 days"],["30d","30 days"],["90d","90 days"]];
function spending(f,today,period){
 const days={"7d":7,"30d":30,"90d":90}[period]||30;
 const start=dateShift(today,1-days),end=today;
 const raw=f.transactions.filter(t=>displayedDate(t)>=start&&displayedDate(t)<=end);
 const expense=raw.filter(t=>t.kind==="expense"),income=raw.filter(t=>t.kind==="income");
 const total=expense.reduce((n,t)=>n+t.amountCents,0),earned=income.reduce((n,t)=>n+t.amountCents,0);
 const groups=categorize(f.transactions,start,end).groups;
 const merchMap=new Map();
 for(const t of expense){const name=t.merchant||t.description;const key=name.toLocaleLowerCase();
   if(!merchMap.has(key))merchMap.set(key,{name,amountCents:0,count:0});
   const item=merchMap.get(key);item.amountCents+=t.amountCents;item.count++;
 }
 const merchants=[...merchMap.values()].sort((a,b)=>b.amountCents-a.amountCents).slice(0,5);
 const prevStart=dateShift(start,-days),prevEnd=dateShift(start,-1);
 const earlier=categorize(f.transactions,prevStart,prevEnd).groups;
 const prevByKey=new Map(earlier.map(x=>[x.name.toLowerCase(),x.amountCents]));
 const patterns=groups.filter(g=>prevByKey.get(g.name.toLowerCase())>0)
   .map(g=>({...g,old:prevByKey.get(g.name.toLowerCase()),growth:Math.round(
      100*(g.amountCents/prevByKey.get(g.name.toLowerCase())-1))}))
   .filter(x=>Math.abs(x.growth)>=15).sort((a,b)=>Math.abs(b.growth)-Math.abs(a.growth)).slice(0,2);
 const filters='<div class="moneys-segments">'+breakdownOptions.map(([id,label])=>
   '<button data-money-action="simple-period" data-period="'+id+'" class="'+(period===id?'active':'')+'">'+label+'</button>').join("")+'</div>';
 return filters+'<div class="moneys-kpis">'+summaryCard("Spent",USD(total),"")+
   summaryCard("Income",USD(earned),"")+
   summaryCard("Net",USD(earned-total),"")+'</div>'+
   '<section class="moneys-surface">'+cardTitle("Top categories","history","See all")+
     categoryBars(groups,5)+'</section>'+
   '<section class="moneys-surface">'+cardTitle("Top merchants","history","See all")+
     '<div class="moneys-merchant-ranking">'+(merchants.length?merchants.map((m,i)=>
       '<div><span class="moneys-rank">'+(i+1)+'</span><strong>'+E(m.name)+'</strong><b>'+USD(m.amountCents)+'</b></div>').join("") :
       nothing("No merchants in this period."))+'</div></section>'+
   (patterns.length?'<section class="moneys-surface">'+cardTitle("Patterns")+
     patterns.map(g=>'<div class="moneys-pattern"><strong>'+E(g.name)+(g.growth>0?" increased":" decreased")+
     '</strong><small>'+USD(g.amountCents)+' · '+Math.abs(g.growth)+'% '+(g.growth>0?"higher":"lower")+
     ' than the previous '+days+' days</small></div>').join("")+'</section>':'')+
   needReview(reviewCount(f.transactions));
}
const typeOptions=[["all","All"],["expense","Expenses"],["income","Income"],["transfer","Transfers"]];
function transactions(f,flags,editCard,rows){
 const months=[...new Set(f.transactions.map(t=>displayedDate(t).slice(0,7)))].sort().reverse();
 const categoryOptions=[...new Set(f.transactions.map(t=>t.category).filter(Boolean))].sort();
 return (editCard||"")+
   '<div class="moneys-segments moneys-type-tabs">'+typeOptions.map(([id,label])=>
     '<button data-money-action="simple-kind" data-kind="'+id+'" class="'+(flags.kind===id?'active':'')+'">'+label+'</button>').join("")+'</div>'+
   '<div class="moneys-tx-filters">'+
   '<button data-money-action="simple-review" class="'+(flags.review==="needs-review"?'active':'')+'">Needs review</button>'+
   '<button data-money-action="simple-uncategorized" class="'+(flags.review==="uncategorized"?'active':'')+'">Uncategorized</button>'+
   '<select id="money-month" aria-label="Month"><option value="all">All dates</option>'+
   months.map(m=>'<option value="'+E(m)+'"'+(flags.month===m?' selected':'')+'>'+E(m)+'</option>').join("")+'</select></div>'+
   '<div class="moneys-find"><input id="money-search" type="search" placeholder="Search transactions" value="'+E(flags.search)+'" autocomplete="off">'+
   '<details><summary>Filters</summary><div><label>Category <select id="money-category"><option value="all">All</option>'+
     categoryOptions.map(m=>'<option value="'+E(m)+'"'+(flags.category===m?' selected':'')+'>'+E(m)+'</option>').join("")+
     '</select></label><button data-money-action="toggle-archived">'+(flags.archived?'Show active':'Archived ('+(f.archivedTransactions?.length||0)+')')+'</button></div></details></div>'+
   '<div class="moneys-transaction-results" id="money-history-results">'+rows+'</div>'+
   '<button class="moneys-primary-action" data-money-action="simple-add">＋ Add transaction</button>';
}
function bills(f,today,index,whatIf){
 const windows=window.CommandMoneyPaychecks.paycheckWindows(f.budgetPlan,f.transactions,today,2);
 const periods=windows.periods||[];
 const current=periods[index]||null;
 const checkTabs='<div class="moneys-segments">'+
   '<button data-money-action="simple-check" data-index="0" class="'+(index===0?"active":"")+'">This check</button>'+
   '<button data-money-action="simple-check" data-index="1" class="'+(index===1?"active":"")+'">Next check</button></div>';
 const stat=current?'<section class="moneys-bills-hero"><div><span>Starting paycheck</span><strong>'+USD(current.incomeCents)+'</strong></div>'+
   '<div><span>Bills assigned</span><strong>−'+USD(current.billCents)+'</strong></div>'+
   '<div><span>Spent so far</span><strong>−'+USD(current.otherCents)+'</strong></div>'+
   '<div class="moneys-total"><span>Left from this check</span><strong>'+USD(current.leftCents)+'</strong></div></section>':
   '<div class="moneys-surface">'+nothing("No paycheck for this period. Set up a recurring payday.","paycheck-setup","Add payday")+'</div>';
 const planning=window.CommandMoneyPlanning;
 const due=planning.occurrences(f.budgetPlan,today,dateShift(today,35),f.transactions).filter(x=>x.kind==="expense"&&!x.settled).slice(0,4);
 const list='<section class="moneys-surface">'+cardTitle("Upcoming bills","bills-detail","See all")+
   (due.length?'<div class="moneys-due">'+due.map(x=>'<button data-money-action="subview" data-subview="bills-detail">'+
     '<span><strong>'+E(x.name)+'</strong><small>Due '+DATE(x.date)+'</small></span><b>−'+USD(x.amountCents)+'</b></button>').join("")+'</div>':
     nothing("No unpaid scheduled bills in the next 35 days."))+'</section>';
 const whatIfInput=whatIf?.amountCents!=null?'<div class="moneys-whatif-result">'+
   'After that purchase: <strong>'+USD((current?.leftCents||0)-whatIf.amountCents)+'</strong> left. Nothing was recorded.</div>':"";
 return checkTabs+stat+list+
  (current?'<section class="moneys-surface">'+cardTitle("Paycheck plan")+
     '<form id="money-what-if-form" class="moneys-whatif"><label>What if I spend<input type="text" name="amount" inputmode="decimal" placeholder="150.00" value="'+E(whatIf?.input||"")+'" required></label>'+
     '<button class="button" type="submit">Calculate</button></form>'+whatIfInput+'</section>':"")+
  '<div class="moneys-quick">'+
   btn("simple-add","<span>＋</span> Add expense")+
   btn("simple-transfer","↔ Transfer")+
   btn("subview","Manage bills",'data-subview="bills-detail"')+'</div>';
}
function shell(title,view,body){
 const tab=[["overview","Overview"],["insights","Spending"],["history","Transactions"],["bills","Bills"]].map(([id,label])=>
  '<button data-money-action="subview" data-subview="'+id+'" class="'+(view===id?'active':'')+'">'+label+'</button>').join("");
 return '<div class="moneys-shell">'+titleBar(title)+
   '<nav class="moneys-nav" aria-label="Money sections">'+tab+'</nav>'+body+'</div>';
}
function advancedHeader(name,detail=""){
 return '<div class="moneys-advanced-head"><button data-money-action="subview" data-subview="overview">‹ Money</button>'+
   '<h1>'+name+'</h1>'+(detail?'<p>'+detail+'</p>':"")+'</div>';
}
function management(f,sections){
 return advancedHeader("Manage Money","Tools for setup, backups, importing, and occasional maintenance.")+
   '<div class="moneys-manage-menu">'+
   '<button data-money-action="subview" data-subview="bills-detail">'+icon("calendar")+
     '<span><strong>Recurring bills and paychecks</strong><small>Schedules, due dates, and paycheck assignments</small></span>›</button>'+
   '<button data-money-action="subview" data-subview="budgets">'+icon("check")+
     '<span><strong>Spending limits and classification</strong><small>Category caps, review rules, and manual cash balance</small></span>›</button>'+
   '<button data-money-action="subview" data-subview="import">'+icon("folder")+
     '<span><strong>Import bank or receipt files</strong><small>CSV statements and reconciliation tools</small></span>›</button>'+
   '</div>'+
   '<section class="moneys-surface">'+cardTitle("Your data and backups")+
   '<div class="moneys-manage-actions">'+
   btn("export-finance","Export Money JSON")+btn("cloud-backup","Back up to Firebase")+
   btn("cloud-check","Check cloud backup")+btn("export-audit","Download audit report")+
   btn("pick-file","Import Everyday finance JSON")+
   '<input id="money-import-input" type="file" accept=".json,application/json" hidden></div>'+
   sections.preview+
   '<div id="money-sync-panel">'+sections.sync+'</div>'+
   '<p class="moneys-fineprint">'+E(sections.integrity)+'</p></section>';
}
window.CommandMoneySimpleUI={overview,spending,transactions,bills,shell,advancedHeader,management,scheduleWindow,
 categorize,reviewCount,USD};
})();
