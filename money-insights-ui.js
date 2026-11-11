(function(){
 "use strict";
 const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const usd=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
 const metric=(label,value,detail)=>'<div class="money-stat"><span>'+e(label)+'</span><strong>'+usd(value)+'</strong>'+
   (detail?'<small>'+e(detail)+'</small>':"")+'</div>';
 function ranking(title,items,total){
   const shown=items.slice(0,12),max=Math.max(...shown.map(x=>x.amountCents),1);
   return '<section class="money-section"><div class="section-head"><h2>'+title+'</h2><span class="muted">'+items.length+' groups</span></div>'+
     '<div class="money-insights-ranking">'+(shown.length?shown.map(x=>
       '<div class="money-insight-row"><div><strong>'+e(x.name)+'</strong>'+
       '<small>'+x.count+' purchase'+(x.count===1?"":"s")+' · '+usd(x.amountCents)+
       (total?' · '+(100*x.amountCents/total).toFixed(1)+'%':"")+'</small></div>'+
       '<progress max="100" value="'+(100*x.amountCents/max)+'"></progress></div>'
     ).join(""):'<p class="money-help">No expenses recorded for this period.</p>')+'</div></section>';
 }
 function render(finance,period,today){
   const model=window.CommandMoneyInsightsModel;
   const periods=model.financeInsightPeriods(finance.transactions);
   if(!periods.some(p=>p.value===period))period="all";
   const report=model.summarizeFinanceInsights(finance.transactions,period,today);
   const picker='<label class="money-plan-field money-insights-filter"><span>Reporting period</span><select id="money-insights-period">'+
     periods.map(p=>'<option value="'+e(p.value)+'"'+(p.value===period?' selected':'')+'>'+e(p.label)+'</option>').join("")+'</select></label>';
   const net=report.incomeCents-report.expenseCents;
   return '<section class="money-section money-insights-intro"><div class="section-head"><h2>Spending insights</h2></div>'+
     '<p class="money-help">Only recorded finance transactions are included. Transfers are tracked separately from income and consumption.</p>'+picker+
     '<div class="money-stats">'+metric("Recorded expenses",report.expenseCents,report.expenseCount+" purchases")+
     metric("Recorded income",report.incomeCents,"Excludes transfers")+
     metric("Net recorded flow",net,"Income minus expenses")+
     metric("Uncategorized spending",report.uncategorizedCents,report.uncategorizedCount+" transactions")+'</div>'+
     '<div class="money-insights-warnings">'+
     (report.reviewCount?'<button class="button secondary" data-money-action="insights-needs-review">'+report.reviewCount+' transactions need review</button>':"")+
     (report.uncategorizedCount?'<button class="button secondary" data-money-action="insights-uncategorized">Review uncategorized</button>':"")+'</div></section>'+
     '<section class="money-section"><div class="section-head"><h2>Transfers</h2></div>'+
     '<div class="money-stats">'+metric("Transfers out",report.transferOutCents,"Bank debits")+
     metric("Transfers in",report.transferInCents,"Bank credits")+'</div>'+
     (report.unknownTransferCount?'<p class="money-warning">'+report.unknownTransferCount+
        ' transfers have no bank debit/credit direction; '+usd(report.unknownTransferCents)+' is excluded from directional totals.</p>':"")+'</section>'+
     ranking("Spending by category",report.categories,report.expenseCents)+
     ranking("Spending by merchant",report.merchants,report.expenseCents)+
     '<p class="money-help">Category totals follow the transaction categories saved in Money. They do not pretend to represent each item in an itemized receipt.</p>';
 }
 window.CommandMoneyInsightsUI={render};
})();