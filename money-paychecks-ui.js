(function(){
"use strict";
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const date=d=>new Date(d+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
function periodCard(p){
 const title=p.periodCount>1?p.periodCount+" paychecks":"Paycheck";
 const dateRange=date(p.start)+" – "+date(p.endInclusive);
 const list=(items,fn)=>items.length?items.map(fn).join(""):'<p class="money-help">None in this paycheck period.</p>';
 return '<section class="money-paycheck-card"><div class="money-paycheck-head"><div><small>'+title+' · '+e(dateRange)+'</small>'+
   '<strong>'+money(p.incomeCents)+'</strong><span>'+(p.received?"Marked received":"Expected paychecks; not necessarily deposited")+
   (p.expectedCents!==p.incomeCents?" · Regular amount "+money(p.expectedCents):"")+'</span></div>'+
   '<div class="money-paycheck-available"><small>Left from this check</small><strong>'+money(p.leftCents)+'</strong></div></div>'+
   '<div class="money-paycheck-columns"><div><span>Scheduled bills</span><strong>−'+money(p.billCents)+'</strong></div>'+
   '<div><span>Other purchases</span><strong>−'+money(p.otherCents)+'</strong></div></div>'+
   '<details class="money-paycheck-detail"><summary>Bills allocated to this check · '+p.bills.length+'</summary>'+
     '<div class="money-paycheck-list">'+list(p.bills,b=>
       '<div><span>'+e(b.name)+' · '+e(date(b.date))+
       (b.status==="paid"?" · Paid":"")+(b.bankLinked?" · Linked to purchase":"")+
       (b.status==="skipped"?" · Skipped":"")+'</span>'+
       '<strong>'+(b.status==="skipped"?"—":"−"+money(b.amountCents))+'</strong></div>')+'</div></details>'+
   '<details class="money-paycheck-detail"><summary>Other recorded purchases · '+p.spending.length+'</summary>'+
     '<div class="money-paycheck-list">'+list(p.spending,tx=>
       '<div><span>'+e(tx.merchant||tx.description)+' · '+e(date(tx.purchaseDate||tx.date))+'</span>'+
       '<strong>−'+money(tx.amountCents)+'</strong></div>')+'</div></details></section>';
}
function render(finance,today,count,whatIf){
 const model=window.CommandMoneyPaychecks;
 const windows=model.paycheckWindows(finance.budgetPlan,finance.transactions,today,count);
 const buttons='<div class="money-period">'+
   '<button data-money-action="checks" data-checks="1" class="'+(count===1?"active":"")+'">1 check</button>'+
   '<button data-money-action="checks" data-checks="2" class="'+(count===2?"active":"")+'">2 checks</button></div>';
 if(!windows.configured)return '<section class="money-section"><div class="section-head"><h2>Paycheck periods</h2></div>'+
   '<p class="money-help">Add a scheduled payday to see the bills and purchases assigned to each paycheck.</p>'+
   '<button class="button secondary" data-money-action="paycheck-setup">Set up a payday</button></section>';
 const periods=count===2?[model.combinePaycheckPeriods(windows.periods)].filter(Boolean):windows.periods;
 const p=periods[0],report=(whatIf?.amountCents!=null&&p)?money(model.paycheckWhatIf(p,whatIf.amountCents)):"";
 return '<section class="money-section money-paycheck-view">'+
   '<div class="section-head"><h2>By paycheck</h2>'+buttons+'</div>'+
   '<p class="money-help">Ledger view by actual payday schedules, not fixed calendar weeks. Bills stay on their assigned checks even if paid earlier or posted later.</p>'+
   periods.map(periodCard).join("")+
   (windows.heldBackCents!=null?'<p class="money-paycheck-held">Previous check ('+e(date(windows.heldBackPeriod))+') had '+money(windows.heldBackCents)+
     ' remaining. This is a historical estimate and is not added to the current paycheck.</p>':"")+
   (p?'<form id="money-what-if-form" class="money-what-if"><label class="money-plan-field"><span>What if I spent…?</span>'+
     '<input name="amount" type="text" inputmode="decimal" placeholder="25.00" required value="'+e(whatIf?.input||"")+'"></label>'+
     '<button class="button secondary" type="submit">Calculate</button></form>'+
     (report?'<p class="money-paycheck-what-if">After that purchase: <strong>'+report+
       '</strong> left from the selected check. No transaction was created.</p>':""):"")+
   '</section>';
}
window.CommandMoneyPaychecksUI={render};
})();