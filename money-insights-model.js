(function(){
"use strict";
const financeReviewFlags=tx=>window.CommandMoneyBankImport.financeReviewFlags(tx);
// v97 — read-only Finance Insights. Never updates source records or infers transfers.
// Expenses reflect saved classifications, not necessarily itemized consumption.

const DAY=86400000;
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(value+'T00:00:00Z'));
function dayNumber(value){
 if(!validDay(value))throw Error('Finance Insights needs a valid YYYY-MM-DD date.');
 return Date.parse(value+'T00:00:00Z')/DAY;
}
const money=(list,key)=>list.reduce((sum,record)=>sum+record[key],0);
function grouped(rows,keyFor){
 const groups=new Map();
 for(const tx of rows){
  const label=String(keyFor(tx)||'Uncategorized').trim()||'Uncategorized';
  const normalized=label.toLocaleLowerCase().replace(/\s+/g,' ');
  if(!groups.has(normalized))groups.set(normalized,{name:label,amountCents:0,count:0});
  const group=groups.get(normalized);
  group.amountCents+=tx.amountCents;group.count++;
 }
 return [...groups.values()].sort((a,b)=>b.amountCents-a.amountCents||a.name.localeCompare(b.name));
}
function financeInsightPeriods(transactions){
 const months=[...new Set(transactions.map(tx=>String(tx.date||'').slice(0,7)).filter(m=>/^\d{4}-\d{2}$/.test(m)))].sort().reverse();
 return [{value:'all',label:'All recorded dates'},{value:'30d',label:'Last 30 days'},
  {value:'90d',label:'Last 90 days'},
  ...months.map(month=>({value:'month:'+month,label:new Date(month+'-01T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'})}))];
}
function summarizeFinanceInsights(transactions,period='all',today='2026-10-28'){
 if(!Array.isArray(transactions))throw Error('Finance Insights requires a list of transactions.');
 const currentDay=dayNumber(today);
 const all=period==='all',trailing=period==='30d'?30:period==='90d'?90:null;
 if(!all&&!trailing&&!/^month:\d{4}-(0[1-9]|1[0-2])$/.test(period))
  throw Error('Unknown Finance Insights date range.');
 const filtered=transactions.filter(tx=>{
  if(all)return true;
  if(trailing){const day=dayNumber(tx.date);return day<=currentDay&&day>currentDay-trailing;}
  return tx.date.startsWith(period.slice(6));
 });
 const expenses=filtered.filter(tx=>tx.kind==='expense');
 const income=filtered.filter(tx=>tx.kind==='income');
 const transfers=filtered.filter(tx=>tx.kind==='transfer');
 const transferOut=transfers.filter(tx=>tx.bankDirection==='debit');
 const transferIn=transfers.filter(tx=>tx.bankDirection==='credit');
 const unknownTransfers=transfers.filter(tx=>!tx.bankDirection);
 const flagged=filtered.filter(tx=>financeReviewFlags(tx).length>0);
 const uncategorized=expenses.filter(tx=>!tx.category||tx.category.trim().toLowerCase()==='uncategorized');
 const categories=grouped(expenses,tx=>tx.category);
 const merchants=grouped(expenses,tx=>tx.merchant||tx.bankDescription||tx.description);
 return {
  recordCount:filtered.length,expenseCount:expenses.length,
  expenseCents:money(expenses,'amountCents'),incomeCents:money(income,'amountCents'),
  transferOutCents:money(transferOut,'amountCents'),
  transferInCents:money(transferIn,'amountCents'),
  unknownTransferCents:money(unknownTransfers,'amountCents'),
  unknownTransferCount:unknownTransfers.length,
  reviewCount:flagged.length,uncategorizedCount:uncategorized.length,
  uncategorizedCents:money(uncategorized,'amountCents'),
  convenienceCents:expenses.filter(tx=>String(tx.category||'').trim().toLowerCase()==='convenience food')
   .reduce((n,tx)=>n+tx.amountCents,0),
  categories,merchants
 };
}

window.CommandMoneyInsightsModel={financeInsightPeriods,summarizeFinanceInsights};
})();