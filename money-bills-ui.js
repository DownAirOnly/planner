(function(){
 "use strict";
 const model=()=>window.CommandMoneyPlanning;
 const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const usd=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
 const amount=n=>(Math.max(0,n)/100).toFixed(2);
 const options=(set,chosen)=>set.map(([key,label])=>'<option value="'+e(key)+'"'+(key===chosen?' selected':'')+'>'+e(label)+'</option>').join("");
 const field=(name,label,value,type="text",attrs="")=>'<label class="money-plan-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(value??"")+'" '+attrs+'></label>';
 const row=(event)=>{
   const key=event.id+"|"+event.date;
   const status=event.status==="skipped"?"Skipped":event.status==="paid"?(event.kind==="income"?"Received":"Paid"):event.linkedPurchase?"Linked purchase":"Pending";
   const sign=event.kind==="income"?"+":"−";
   const actions=event.status==="pending"&&!event.linkedPurchase?
     '<button data-money-action="plan-mark-paid" data-id="'+e(event.id)+'" data-date="'+e(event.date)+'">'+(event.kind==="income"?"Received":"Paid")+'</button>'+
     '<button data-money-action="plan-mark-skipped" data-id="'+e(event.id)+'" data-date="'+e(event.date)+'">Skip</button>':
     (event.linkedPurchase&&event.status==="pending"?
       '<span class="money-plan-linked">Linked transaction</span>':
       '<button data-money-action="plan-mark-pending" data-id="'+e(event.id)+'" data-date="'+e(event.date)+'">Undo</button>');
   return '<div class="money-plan-occurrence'+(event.settled?" settled":"")+'"><div class="money-plan-occurrence-copy"><small>'+e(event.date)+' · '+e(status)+'</small>'+
     '<strong>'+e(event.name)+'</strong><span class="'+e(event.kind)+'">'+sign+usd(event.amountCents)+'</span></div>'+
     '<div class="money-plan-occurrence-actions">'+actions+
     (event.kind==="income"?'<button data-money-action="plan-adjust-paycheck" data-id="'+e(event.id)+'" data-date="'+e(event.date)+'">Amount</button>':"")+'</div></div>';
 };
 const section=(title,action,content)=>'<section class="money-section"><div class="section-head"><h2>'+title+'</h2>'+(action||"")+'</div>'+content+'</section>';
 function scheduleEditor(plan,editing){
   if(!editing||editing.kind!=="schedule")return "";
   const r=plan.schedules.find(x=>x.id===editing.id);
   const f=r||{name:"",kind:editing.defaultKind||"expense",amountCents:0,startDate:(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")})(),frequency:editing.defaultKind==="income"?"biweekly":"monthly",endDate:"",occurrences:{}};
   const frequency=[["once","Once"],["weekly","Weekly"],["biweekly","Every 2 weeks"],["monthly","Monthly"]];
   return '<section class="money-plan-editor" id="money-plan-editor"><div class="section-head"><h2>'+(r?"Edit schedule":"New schedule")+'</h2>'+
     '<button data-money-action="plan-cancel">Cancel</button></div><form id="money-plan-form" data-plan-kind="schedule"><input name="id" type="hidden" value="'+e(r?.id||"")+'">'+
     '<div class="money-plan-form-grid">'+field("name","Name",f.name,"text",'maxlength="120" required placeholder="Car payment"')+
     '<label class="money-plan-field"><span>Type</span><select name="kind">'+options([["expense","Bill / expense"],["income","Paycheck / income"]],f.kind)+'</select></label>'+
     field("amount","Amount (USD)",r?amount(f.amountCents):"","text",'inputmode="decimal" placeholder="0.00" required')+
     field("startDate","First due / payday",f.startDate,"date","required")+
     '<label class="money-plan-field"><span>Repeats</span><select name="frequency">'+options(frequency,f.frequency)+'</select></label>'+
     field("endDate","End date (optional)",f.endDate||"","date")+'</div>'+
     (r?'<p class="money-help">Existing paid/skipped markers and payday adjustments are preserved. Changing the repeat pattern may leave markers on old dates.</p>':
       '<p class="money-help">Monthly payments repeat on the matching day, or the final day of shorter months.</p>')+
     '<button class="button" type="submit">Save schedule</button></form></section>';
 }
 function limitEditor(plan,editing){
   if(!editing||editing.kind!=="limit")return "";
   const found=plan.categoryLimits.find(x=>x.category===editing.id);
   return '<section class="money-plan-editor" id="money-plan-editor"><div class="section-head"><h2>'+(found?"Edit monthly limit":"New monthly limit")+
     '</h2><button data-money-action="plan-cancel">Cancel</button></div>'+
     '<form id="money-plan-form" data-plan-kind="limit">'+
     field("originalCategory","",editing.id||"","hidden")+
     '<div class="money-plan-form-grid">'+field("category","Category",found?.category||"","text",'maxlength="80" required')+
     field("amount","Monthly cap",found?amount(found.amountCents):"","text",'inputmode="decimal" placeholder="0.00" required')+'</div>'+
     '<p class="money-help">A monthly limit does not change transaction categories or bank records.</p>'+
     '<button class="button" type="submit">Save budget</button>'+
     (found?'<button class="button secondary" type="button" data-money-action="plan-delete-limit" data-id="'+e(found.category)+'">Remove cap</button>':"")+'</form></section>';
 }
 function balanceEditor(plan,editing){
   if(!editing||editing.kind!=="balance")return "";
   const today=(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")})();
   return '<section class="money-plan-editor" id="money-plan-editor"><div class="section-head"><h2>Available cash</h2>'+
     '<button data-money-action="plan-cancel">Cancel</button></div><form id="money-plan-form" data-plan-kind="balance">'+
     '<div class="money-plan-form-grid">'+field("balance","Cash available (USD)",plan.balanceCents==null?"":(plan.balanceCents/100).toFixed(2),"text",'inputmode="decimal" placeholder="0.00" required')+
     field("asOf","As of (end of day)",plan.balanceAsOf||today,"date","required")+'</div>'+
     '<p class="money-help">Enter the amount you have, not anticipated paychecks. Forecasts add only future unpaid scheduled events; they do not add bank transactions again.</p>'+
     '<button class="button" type="submit">Save cash balance</button></form></section>';
 }
 function paycheckEditor(finance,editing){
   if(!editing||editing.kind!=="override")return "";
   const plan=finance.budgetPlan,r=plan.schedules.find(x=>x.id===editing.id);
   if(!r)return "";
   const k=editing.id+"|"+editing.date,override=plan.paycheckAmounts[k],original=override??r.amountCents;
   return '<section class="money-plan-editor" id="money-plan-editor"><div class="section-head"><h2>Paycheck amount</h2>'+
     '<button data-money-action="plan-cancel">Cancel</button></div><p class="money-help">'+e(r.name)+' · '+e(editing.date)+'</p>'+
     '<form id="money-plan-form" data-plan-kind="override"><input type="hidden" name="id" value="'+e(editing.id)+'"><input type="hidden" name="date" value="'+e(editing.date)+'">'+
     field("amount","Expected take-home pay",amount(original),"text",'inputmode="decimal" required')+
     '<div class="money-plan-editor-actions"><button class="button" type="submit">Save amount</button>'+
     (override!=null?'<button class="button secondary" type="button" data-money-action="plan-reset-paycheck" data-id="'+e(editing.id)+'" data-date="'+e(editing.date)+'">Use regular amount</button>':"")+'</div></form></section>';
 }
 function editor(finance,editing){
   return scheduleEditor(finance.budgetPlan,editing)+limitEditor(finance.budgetPlan,editing)+
     balanceEditor(finance.budgetPlan,editing)+paycheckEditor(finance,editing);
 }
 function bills(finance,editing,today){
   const plan=finance.budgetPlan,start=model().dateShift(today,-14),end=model().dateShift(today,35);
   const all=model().occurrences(plan,start,end,finance.transactions);
   const pending=all.filter(x=>!x.settled);
   const dueSoon=pending.filter(x=>x.date<=model().dateShift(today,14));
   const later=pending.filter(x=>x.date>model().dateShift(today,14));
   const finished=all.filter(x=>x.settled);
   const scheduleRows=plan.schedules.map(rule=>'<div class="money-plan-schedule"><div><strong>'+e(rule.name)+'</strong>'+
     '<small>'+e(rule.kind==="income"?"Paycheck":"Bill")+' · '+e(rule.frequency)+' · '+e(rule.startDate)+(rule.endDate?" to "+e(rule.endDate):"")+'</small></div>'+
     '<b>'+usd(rule.amountCents)+'</b><button data-money-action="plan-edit-schedule" data-id="'+e(rule.id)+'">Edit</button></div>').join("");
   return editor(finance,editing)+
     section("Upcoming payments & paychecks",'<button class="button" data-money-action="plan-add-schedule">+ Add</button>',
       '<p class="money-help">Past unmarked events and the next 14 days. Marking Paid or Received does not create a second transaction.</p>'+
       (dueSoon.length?'<div class="money-plan-occurrences">'+dueSoon.map(row).join("")+'</div>':
       '<p class="money-help">Nothing unmarked in this window.</p>')+
       (later.length?'<details class="money-plan-drawer"><summary>Later dates · '+later.length+' through '+e(end)+'</summary>'+
       '<div class="money-plan-occurrences">'+later.map(row).join("")+'</div></details>':"")+
       (finished.length?'<details class="money-plan-drawer"><summary>Marked or linked · '+finished.length+'</summary>'+
       '<div class="money-plan-occurrences">'+finished.map(row).join("")+'</div></details>':""))+
     section("Recurring plans",'<span class="muted">'+plan.schedules.length+' saved</span>',
       '<div class="money-plan-schedules">'+(scheduleRows||'<p class="money-help">No bills or paydays yet.</p>')+'</div>')+
     section("Existing assignments","",'<p class="money-help">Preserving '+Object.keys(plan.billAssignments).length+
       ' saved bill/paycheck assignments and '+Object.keys(plan.paycheckAmounts).length+
       ' paycheck overrides from Everyday. These records remain part of your cloud backup.</p>');
 }
 function budgets(finance,editing,today){
   const plan=finance.budgetPlan,month=today.slice(0,7);
   const spent=model().monthSpending(plan,finance.transactions,month);
   const list=spent.map(x=>'<div class="money-budget-row"><div><strong>'+e(x.category)+'</strong>'+
     '<span>'+usd(x.actualCents)+' / '+usd(x.limitCents)+'</span></div>'+
     '<progress max="100" value="'+Math.max(0,Math.min(100,x.percent))+'"></progress>'+
     '<div class="money-budget-actions"><small>'+(x.remainingCents>=0?usd(x.remainingCents)+' remaining':usd(-x.remainingCents)+' over limit')+'</small>'+
     '<button data-money-action="plan-edit-limit" data-id="'+e(x.category)+'">Edit</button></div></div>').join("");
   const forecast=model().forecast(finance,today,35);
   const cash='<div class="money-plan-cash"><div><span>Manually entered cash</span><strong>'+
     (plan.balanceCents==null?"Not set":usd(plan.balanceCents))+'</strong>'+
     (plan.balanceAsOf?'<small>End of day '+e(plan.balanceAsOf)+'</small>':"")+'</div>'+
     '<button class="button secondary" data-money-action="plan-edit-balance">'+(plan.balanceCents==null?"Enter balance":"Update")+'</button></div>'+
     (forecast.configured?'<div class="money-plan-cash-forecast">'+
       '<div><small>Lowest projected cash</small><strong>'+usd(forecast.minimumCents)+'</strong></div>'+
       '<div><small>Projected after 35 days</small><strong>'+usd(forecast.endCents)+'</strong></div></div>'+
       (forecast.stale?'<p class="money-plan-warning">The cash figure is from an earlier day. Update it before trusting this forecast.</p>':"")+
       (forecast.shortfall?'<p class="money-plan-warning">Your planned events project a shortfall.</p>':""):
       '<p class="money-help">'+e(forecast.reason||"Enter available cash to enable a 35-day forecast.")+'</p>')+
       '<p class="money-help">Forecasts use your manual balance plus future unmarked scheduled events. They are not a bank balance or a bank feed.</p>';
   return editor(finance,editing)+section("Cash position","",cash)+
     section("Monthly limits",'<button class="button" data-money-action="plan-add-limit">+ Limit</button>',
       '<p class="money-help">Spending in '+e(month)+'. Receipt items are allocated to their categories; receipt adjustments are accounted for separately.</p>'+
       '<div class="money-budget-list">'+(list||'<p class="money-help">No limits configured.</p>')+'</div>');
 }
 window.CommandMoneyBillsUI={bills,budgets,editor};
})();
