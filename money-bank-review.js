(function(){
"use strict";
// Bank reconciliation port from Everyday: receipt-first matching with an
// explicit review plan. Keep unknown transactions in persistent review.
const normalizeData=finance=>{
 const validator=window.CommandMoney?.validateFile;
 if(!validator)throw Error("Money validation is not loaded.");
 validator({format:"everyday-section-v1",section:"finances",data:finance});
 return finance;
};
// v111: receipt-first bank reconciliation. A confirmed match upgrades the
// original purchase, never adds a second charge. Ambiguous rows stay in a
// persistent review queue without blocking the rest of the statement.
const day=date=>Date.parse(date+'T00:00:00Z')/86400000;
const clean=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const merchantMatch=(bank,receipt)=>{
 const m=clean(receipt.merchant||receipt.description),b=clean(bank.bankDescription);
 const parts=m.split(' ').filter(t=>t.length>=4&&!['store','purchase','market','online','restaurant','payment'].includes(t));
 return Boolean(parts.length&&parts.some(token=>b.includes(token)));
};
const isReceipt=tx=>tx.kind==='expense'&&!tx.bankDescription&&!tx.matchedBankId;
function bankReceiptCandidates(bank,transactions,sort='amount',search=''){
 const q=clean(search);
 return transactions.filter(isReceipt).filter(tx=>!q||clean(tx.merchant+' '+tx.description).includes(q))
  .map(tx=>{
   const purchaseDate=tx.purchaseDate||tx.date,days=Math.abs(day(bank.date)-day(purchaseDate));
   const differenceCents=bank.amountCents-tx.amountCents;
   const account=Boolean(tx.accountLabel)&&clean(tx.accountLabel)===clean(bank.accountLabel);
   const merchant=merchantMatch(bank,tx);
   const receiptMerchant=clean(tx.merchant||tx.description),bankMerchant=clean(bank.bankDescription);
   const plausibleMerchant=merchant||(receiptMerchant.length>=4&&bankMerchant.includes(receiptMerchant));
   return{tx,differenceCents,days,account,merchant,plausibleMerchant,
    auto:account&&merchant&&days<=7&&Math.abs(differenceCents)===0&&tx.kind==='expense'};
  }).sort((a,b)=>sort==='date'?
    a.days-b.days||Math.abs(a.differenceCents)-Math.abs(b.differenceCents):
    Math.abs(a.differenceCents)-Math.abs(b.differenceCents)||a.days-b.days);
}
function existingBank(tx,record){
 const bankId=tx.matchedBankId||tx.id;
 if(bankId!==record.id)return false;
 if(tx.bankDescription!==record.bankDescription||
    (tx.postedDate||tx.date)!==record.date||
    tx.amountCents!==record.amountCents||
    clean(tx.accountLabel)!==clean(record.accountLabel)||
    tx.bankDirection&&tx.bankDirection!==record.bankDirection)
  throw Error('Previously imported bank identity '+record.id+' has different bank facts.');
 return true;
}
function rebuildBankReconciliation(plan,current){
 const decisions=plan.bankDecisions||{};
 const candidate=structuredClone(current);
 const existingIds=new Set(current.transactions.map(tx=>tx.id));
 const activeUnresolved=new Map((candidate.budgetPlan.unresolvedBankRows||[]).map(tx=>[tx.id,tx]));
 const originalRows=plan.bankRecords||[];
 const matched=[],needsReview=[],newRows=[],usedReceipts=new Set(),errors=[...(plan.bankParseErrors||[])];
 let unchanged=plan.bankUnchanged||0;
 for(const record of originalRows){
  const choice=decisions[record.id]||{action:'defer'};
  const candidates=record.kind==='expense'&&record.bankDirection==='debit'?bankReceiptCandidates(record,current.transactions):[]
  let action=choice.action;
  if(action==='match'){
   const receipt=current.transactions.find(tx=>tx.id===choice.receiptId);
   if(!receipt||!isReceipt(receipt)||usedReceipts.has(receipt.id)){
    errors.push('Bank row '+record.id+' cannot match the selected receipt (missing or already used).');continue;
   }
   usedReceipts.add(receipt.id);
   const differenceCents=record.amountCents-receipt.amountCents;
   const originalCents=receipt.receiptAmountCents||receipt.amountCents;
   const adjusted={...receipt,amountCents:record.amountCents,
    receiptAmountCents:originalCents,purchaseDate:receipt.purchaseDate||receipt.date,
    postedDate:record.date,matchedBankId:record.id,bankDescription:record.bankDescription,
    bankDirection:record.bankDirection,accountLabel:record.accountLabel,
    statementLabel:record.statementLabel,source:receipt.source||'manual'};
   if(differenceCents){
    adjusted.adjustmentCategory=choice.adjustmentCategory||'Uncategorized';
    if(choice.adjustmentNote)adjusted.bankDifferenceNote=choice.adjustmentNote;
   }else{delete adjusted.adjustmentCategory;delete adjusted.bankDifferenceNote;}
   const index=candidate.transactions.findIndex(tx=>tx.id===receipt.id);
   candidate.transactions[index]=adjusted;
   activeUnresolved.delete(record.id);
   matched.push({record,receipt,changed:adjusted,differenceCents,automatic:choice.automatic===true,candidates});
  }else if(action==='new'){
   if(existingIds.has(record.id)){errors.push('Bank transaction ID is already used.');continue;}
   candidate.transactions.push({...record});
   activeUnresolved.delete(record.id);
   newRows.push({record,candidates});
  }else{
   activeUnresolved.set(record.id,{...record});
   needsReview.push({record,candidates});
  }
 }
 candidate.budgetPlan.unresolvedBankRows=[...activeUnresolved.values()];
 let normalized=null;
 if(!errors.length)try{normalized=normalizeData(candidate);}catch(error){errors.push(error.message);}
 const similar=new Map(plan.similarBankRows||[]);
 for(const row of [...matched,...needsReview,...newRows]){
  const match=similar.get(row.record.id);
  if(match)row.badges=['Possible duplicate',...(match.differentLabel?['Different account label']:[])];
 }
  plan.bankReview={matched,needsReview,newRows};
 plan.groups=[{key:'transactions',label:'Bank transactions',
  rows:[...matched.map(row=>({record:row.changed,previous:row.receipt,badges:['Matched existing purchase',...(row.badges||[])]})),
   ...newRows.map(row=>({record:row.record,badges:['New bank record',...(row.badges||[])]}))],
  removedRows:[],total:matched.length+newRows.length,unchangedCount:unchanged}];
 plan.errors=errors;
 plan.candidate=errors.length?null:normalized;
 plan.changeCount=matched.length+needsReview.length+newRows.length;
 plan.added=newRows.length;plan.replaced=matched.length;plan.unchanged=unchanged;
 plan.display={count:plan.changeCount,transactions:plan.changeCount,
  label:matched.length+' matched · '+needsReview.length+' needs review · '+newRows.length+' new'};
 return plan;
}
function prepareReconciliation(records,current,{errors=[],warnings=[],details=null,filename='Bank of America CSV'}={}){
 const active=[],seen=new Set(),bankUnchanged=[];
 for(const row of records){
  const {__sourceRow,...record}=row;
  if(seen.has(record.id))throw Error('Repeated bank identity in the same review.');
  seen.add(record.id);
  const prior=current.transactions.find(tx=>tx.id===record.id||tx.matchedBankId===record.id);
  if(prior){existingBank(prior,record);bankUnchanged.push(record.id);continue;}
  active.push(record);
 }
 const similarBankRows=new Map();
 for(const record of active){
  const similar=current.transactions.filter(tx=>{
   if((tx.postedDate||tx.date)!==record.date||tx.amountCents!==record.amountCents)return false;
   if(clean(tx.bankDescription||tx.description)!==clean(record.bankDescription))return false;
   const direction=tx.bankDirection||(tx.kind==='income'?'credit':tx.kind==='expense'?'debit':null);
   return !direction||direction===record.bankDirection;
  });
  if(similar.length)similarBankRows.set(record.id,{
   differentLabel:similar.some(tx=>Boolean(tx.bankDescription)&&clean(tx.accountLabel)!==clean(record.accountLabel))
  });
 }
 const crossLabel=[...similarBankRows.values()].filter(r=>r.differentLabel).length;
 const others=similarBankRows.size-crossLabel;
 if(crossLabel)warnings.push(crossLabel+' bank row(s) resemble a transaction under a different account label. Confirm account identity; never merge automatically.');
 if(others)warnings.push(others+' bank row(s) are similar to an already logged transaction. Review before importing.');
  const priorUnresolved=new Set((current.budgetPlan?.unresolvedBankRows||[]).map(row=>row.id));
 const decisions={},claimedAutoReceipts=new Set();
 for(const record of active){
  const candidates=record.kind==='expense'&&record.bankDirection==='debit'?bankReceiptCandidates(record,current.transactions):[]
  const strong=candidates.filter(c=>c.auto);
  if(priorUnresolved.has(record.id))decisions[record.id]={action:'defer'};
  else if(strong.length===1&&!claimedAutoReceipts.has(strong[0].tx.id)&&
   candidates.filter(c=>c.merchant&&c.days<=7&&c.differenceCents===0&&
    (!c.tx.accountLabel||c.account)).length===1){
   claimedAutoReceipts.add(strong[0].tx.id);
   decisions[record.id]={action:'match',receiptId:strong[0].tx.id,automatic:true};
  }
  else if(strong.length||candidates.some(c=>((c.plausibleMerchant&&c.days<=10&&Math.abs(c.differenceCents)<=2000)||
    (c.days<=3&&c.differenceCents===0&&(!c.tx.accountLabel||c.account)))))
   decisions[record.id]={action:'defer'};
  else decisions[record.id]={action:'new'};
 }
 const plan={kind:'bank',base:JSON.stringify(current),bankRecords:active,bankDecisions:decisions,
  bankParseErrors:errors,bankUnchanged:bankUnchanged.length,warnings,bankDetails:details,
  filename,source:'bank',settingChanges:[],otherChanges:[],promptChanged:false,
  promptDate:current.promptDate||'',currentPromptDate:current.promptDate||'',
  settings:structuredClone(current.settings),currentSettings:structuredClone(current.settings),
  duplicates:similarBankRows.size,similarBankRows:[...similarBankRows.entries()],removed:0};
 return rebuildBankReconciliation(plan,current);
}
function bankChoose(plan,current,id,action,receiptId='',adjustmentCategory='',adjustmentNote=''){
 if(!plan.bankRecords?.some(row=>row.id===id))throw Error('Bank row is no longer in this preview.');
 if(!['match','new','defer'].includes(action))throw Error('Invalid bank review choice.');
 if(action==='match'&&(!plan.bankRecords.some(row=>row.id===id&&row.kind==='expense'&&row.bankDirection==='debit')||!current.transactions.some(tx=>tx.id===receiptId&&isReceipt(tx))))
  throw Error('Select an existing unmatched purchase.');
 if(adjustmentCategory.length>80||adjustmentNote.length>500)throw Error('Difference details are too long.');
 plan.bankDecisions[id]={action,receiptId,adjustmentCategory,adjustmentNote,automatic:false};
 return rebuildBankReconciliation(plan,current);
}


window.CommandMoneyBankReview={
 prepareReconciliation,rebuildBankReconciliation,bankChoose,bankReceiptCandidates
};
})();