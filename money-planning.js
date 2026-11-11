(function(){
 "use strict";
 const DAY=86400000;
 const epoch=d=>Date.parse(d+"T12:00:00Z");
 const dateShift=(d,n)=>new Date(epoch(d)+n*DAY).toISOString().slice(0,10);
 const dayDiff=(a,b)=>Math.round((epoch(a)-epoch(b))/DAY);
 const occurs=(rule,date)=>{
   if(date<rule.startDate||(rule.endDate&&date>rule.endDate))return false;
   const diff=dayDiff(date,rule.startDate);
   if(diff<0)return false;
   if(rule.frequency==="once")return diff===0;
   if(rule.frequency==="weekly")return diff%7===0;
   if(rule.frequency==="biweekly")return diff%14===0;
   const year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
   const last=new Date(Date.UTC(year,month,0)).getUTCDate();
   return Number(date.slice(-2))===Math.min(Number(rule.startDate.slice(-2)),last);
 };
 const key=(event)=>event.id+"|"+event.date;
 function occurrences(plan,start,end,transactions=[]){
   if(dayDiff(end,start)<0||dayDiff(end,start)>370)throw Error("Invalid planning date range.");
   const linked=new Set(transactions.filter(t=>t.kind==="expense"&&t.billKey).map(t=>t.billKey));
   const rows=[];
   for(let date=start;date<=end;date=dateShift(date,1)){
     for(const r of plan.schedules)if(occurs(r,date)){
       const id=r.id+"|"+date;
       const status=r.occurrences[date]||"pending";
       const linkedPurchase=r.kind==="expense"&&linked.has(id);
       rows.push({id:r.id,date,name:r.name,kind:r.kind,amountCents:
         r.kind==="income"?(plan.paycheckAmounts[id]??r.amountCents):r.amountCents,
         status,linkedPurchase,settled:status!=="pending"||linkedPurchase,key:id});
     }
   }
   return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 }
 function cashFlow(finance,start,days){
   const end=dateShift(start,days-1);
   const all=occurrences(finance.budgetPlan,start,end,finance.transactions);
   const pending=all.filter(x=>!x.settled);
   const income=pending.filter(x=>x.kind==="income").reduce((n,x)=>n+x.amountCents,0);
   const bills=pending.filter(x=>x.kind==="expense").reduce((n,x)=>n+x.amountCents,0);
   // A bank/purchase transaction explicitly linked to a scheduled bill is not
   // counted as another "purchase". Pending linked bills are excluded above.
   // Other bank transactions remain purchases until the user links a bill.
   const purchases=finance.transactions.filter(t=>t.kind==="expense"&&!t.billKey&&
     (t.purchaseDate||t.date)>=start&&(t.purchaseDate||t.date)<=end)
     .reduce((n,t)=>n+t.amountCents,0);
   const unlinked=finance.transactions.filter(t=>t.kind==="expense"&&!t.billKey&&
     (t.purchaseDate||t.date)>=start&&(t.purchaseDate||t.date)<=end).length;
   return {start,end,income,bills,purchases,available:income-bills-purchases,events:all,pending,
     linked:all.filter(x=>x.linkedPurchase).length,unlinked};
 }
 function monthSpending(plan,transactions,month){
   const expenses=transactions.filter(tx=>tx.kind==="expense"&&(tx.purchaseDate||tx.date).slice(0,7)===month);
   return plan.categoryLimits.map(limit=>{
     const category=limit.category.toLocaleLowerCase();
     const spent=expenses.reduce((sum,tx)=>{
       if(Array.isArray(tx.items)&&tx.items.length){
         const itemTotal=tx.items.reduce((n,item)=>n+item.amountCents,0);
         const itemSpend=tx.items.filter(item=>item.category.toLocaleLowerCase()===category)
           .reduce((n,item)=>n+item.amountCents,0);
         const difference=tx.amountCents-itemTotal;
         return sum+itemSpend+((tx.adjustmentCategory||"Uncategorized").toLocaleLowerCase()===category?difference:0);
       }
       const receiptBase=tx.receiptAmountCents??tx.amountCents;
       const difference=tx.amountCents-receiptBase;
       return sum+(String(tx.category||"").trim().toLocaleLowerCase()===category?receiptBase:0)+
         ((tx.adjustmentCategory||"Uncategorized").toLocaleLowerCase()===category?difference:0);
     },0);
     return {category:limit.category,limitCents:limit.amountCents,actualCents:spent,
       remainingCents:limit.amountCents-spent,percent:100*spent/limit.amountCents};
   }).sort((a,b)=>b.percent-a.percent||a.category.localeCompare(b.category));
 }
 function forecast(finance,today,horizon=35){
   const plan=finance.budgetPlan;
   if(plan.balanceCents===null)return {configured:false,stale:false};
   const asOf=plan.balanceAsOf;
   const start=dateShift(asOf,1);
   const end=dateShift(today>asOf?today:asOf,horizon);
   if(dayDiff(end,start)>370)return {configured:false,stale:true,reason:"Balance date is too old. Update it before forecasting."};
   // The manual balance is the user's EOD balance. Never apply recorded bank
   // transactions again. Only scheduled, still-unsettled future events count.
   const all=occurrences(plan,start,end,finance.transactions);
   let balance=plan.balanceCents,min=balance;
   const rows=[];
   for(let d=start;d<=end;d=dateShift(d,1)){
     const events=all.filter(x=>x.date===d);
     for(const event of events){
       if(event.settled)continue;
       balance+=event.kind==="income"?event.amountCents:-event.amountCents;
     }
     min=Math.min(min,balance);
     rows.push({date:d,balanceCents:balance});
   }
   return {configured:true,asOf,openingCents:plan.balanceCents,endCents:balance,
     minimumCents:min,shortfall:min<0,stale:asOf!==today,days:rows,pendingCount:all.filter(x=>!x.settled).length};
 }
 window.CommandMoneyPlanning={occurs,occurrences,cashFlow,monthSpending,forecast,dateShift,dayDiff};
})();
