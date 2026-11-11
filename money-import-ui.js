(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd=n=>(n<0?"−":"")+(Math.abs(n)/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const opts=(arr,value)=>arr.map(([k,title])=>'<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(title)+'</option>').join("");
const csvSample='recordType,date,description,kind,amount,purchaseId,itemName,itemCategory,itemAmount\n'+
 'purchase,2026-11-11,Grocery receipt,expense,8.00,receipt-1,,,\n'+
 'receiptItem,,,,,receipt-1,Rice,Groceries,5.00\n'+
 'receiptItem,,,,,receipt-1,Milk,Groceries,3.00';
function entry(mode){
 const menu=[["bank","Bank of America"],["receipt","Receipt / transactions"],["enrichment","Transaction clarifications"]];
 const descriptions={
  bank:"Import a Bank of America checking, savings or card statement. Confirm the account and statement dates. Existing bank IDs are skipped, and ambiguous purchases can stay in the review queue.",
  receipt:"Paste a prepared Everyday purchase CSV with transaction/purchase and receiptItem rows. Receipt totals must match. Existing transaction IDs are preserved.",
  enrichment:"Paste an Everyday transaction-clarification CSV. Changes are matched by original ID; bank amounts, bank dates, and raw descriptions are protected."
 };
 return '<section class="money-section money-csv"><div class="section-head"><h2>Import finance records</h2></div>'+
 '<p class="money-help">All CSV imports are previewed and need confirmation. Your existing transactions are never replaced by a statement import.</p>'+
 '<div class="money-csv-tabs">'+menu.map(([key,label])=>'<button class="'+(key===mode?"active":"")+'" data-money-action="csv-mode" data-csv-mode="'+key+'">'+esc(label)+'</button>').join("")+'</div>'+
 '<p class="money-help">'+esc(descriptions[mode])+'</p>'+
 '<form id="money-csv-form" class="money-csv-form" data-csv-mode="'+esc(mode)+'">'+
 (mode==="bank"?'<div class="money-plan-form-grid">'+
 '<label class="money-plan-field"><span>Account name</span><input name="accountLabel" maxlength="120" value="BofA Checking" placeholder="BofA Checking" required></label>'+
 '<label class="money-plan-field"><span>Statement / batch label</span><input name="statementLabel" maxlength="160" placeholder="Suggested from statement dates" id="money-csv-statement-label"></label></div>':"")+
 '<label class="money-plan-field"><span>Choose a CSV file (optional if pasting)</span>'+
 '<input name="file" type="file" accept=".csv,text/csv"></label>'+
 '<label class="money-plan-field"><span>Or paste CSV text</span>'+
 '<textarea name="text" rows="5" spellcheck="false" placeholder="Paste CSV header and rows here…"></textarea></label>'+
 '<div class="money-csv-actions"><button class="button" type="submit">Preview CSV</button>'+
 (mode==="receipt"?'<button class="button secondary" type="button" data-money-action="csv-template">Copy receipt template</button>':"")+
 (mode==="enrichment"?'<button class="button secondary" type="button" data-money-action="csv-enrichment-export">Export clarification template</button>':"")+
 '</div></form></section>';
}
function bankRows(preview){
 const plan=preview.plan,decisions=plan.bankDecisions||{},rows=plan.bankRecords||[];
 const byRecord=new Map(rows.map(r=>[r.id,r]));
 const duplicates=new Map(plan.similarBankRows||[]);
 const list=rows.map(r=>{
  const d=decisions[r.id]||{action:"defer"},receiptOptions=window.CommandMoneyBankReview.bankReceiptCandidates(r,preview.sourceTransactions);
  const receiptList=receiptOptions.slice(0,20).map(x=>[x.tx.id,
    (x.tx.merchant||x.tx.description)+" · "+(x.tx.purchaseDate||x.tx.date)+" · "+usd(x.tx.amountCents)+
    " · difference "+usd(x.differenceCents)]);
  if(d.receiptId&&!receiptList.some(([id])=>id===d.receiptId))receiptList.unshift([d.receiptId,"Previously selected receipt"]);
  const duplicate=duplicates.get(r.id);
  const diff=receiptOptions.find(c=>c.tx.id===d.receiptId)?.differenceCents;
  return '<div class="money-bank-row"><div class="money-bank-info"><strong>'+esc(r.bankDescription)+'</strong>'+
    '<small>'+esc(r.date)+' · '+esc(r.accountLabel)+' · '+esc(r.bankDirection)+' · '+usd(r.amountCents)+'</small>'+
    (duplicate?'<span class="money-bank-warning">Resembles an existing bank record'+(duplicate.differentLabel?" on another account":"")+'</span>':"")+
    (d.automatic?'<small>Suggested match — review before importing</small>':"")+'</div>'+
    '<label class="money-plan-field"><span>Action</span><select data-money-bank-choice="'+esc(r.id)+'">'+
    opts([["new","Add as bank transaction"],["defer","Review later"],["match","Match existing receipt"]],d.action||"defer")+
    '</select></label>'+
    (d.action==="match"?'<div class="money-bank-match">'+
      '<label class="money-plan-field"><span>Existing receipt</span><select data-money-bank-receipt="'+esc(r.id)+'">'+
      opts([["","Choose a receipt"],...receiptList],d.receiptId||"")+'</select></label>'+
      (diff?'<p class="money-bank-warning">Bank minus receipt: '+usd(diff)+'. The difference is recorded separately for budgeting, not added to receipt items.</p>':"")+
      '<label class="money-plan-field"><span>Adjustment category (if amounts differ)</span>'+
      '<input data-money-bank-adjustment="'+esc(r.id)+'" maxlength="80" value="'+esc(d.adjustmentCategory||"Uncategorized")+'"></label>'+
      '<label class="money-plan-field"><span>Adjustment note (optional)</span>'+
      '<input data-money-bank-note="'+esc(r.id)+'" maxlength="500" value="'+esc(d.adjustmentNote||"")+'"></label></div>':"")+
    '</div>';
 }).join("");
 return '<div class="money-import-bank-review"><p class="money-help">Review all '+rows.length+' new bank rows. Existing bank IDs: '+plan.bankUnchanged+
   '. Matched: '+plan.bankReview.matched.length+'. New: '+plan.bankReview.newRows.length+
   '. Set aside: '+plan.bankReview.needsReview.length+'.</p>'+
   '<p class="money-help">Set aside keeps the bank row in the saved review queue without adding it to spending. A matched receipt keeps its original purchase ID.</p>'+
   '<div class="money-bank-list">'+(list||'<p class="money-help">No new bank IDs in this statement.</p>')+'</div></div>';
}
function preview(p){
 if(!p)return "";
 const errors=p.kind==="bank"?(p.plan?.errors||[]):(p.errors||[]),warnings=[...(p.warnings||[]),...(p.plan?.warnings||[])];
 const blocked=errors.length>0;
 const heading={bank:"Bank statement preview",receipt:"Receipt / transaction preview",enrichment:"Clarification preview"}[p.kind];
 let counts="";
 if(p.kind==="bank"){
  const plan=p.plan;
  counts='<div class="money-import-metrics"><span>'+plan.bankUnchanged+' already imported</span>'+
   '<span>'+plan.bankReview.newRows.length+' new</span>'+
   '<span>'+plan.bankReview.matched.length+' receipt matches</span>'+
   '<span>'+plan.bankReview.needsReview.length+' for later review</span></div>';
 }else{
  counts='<div class="money-import-metrics"><span>'+p.total+' records checked</span>'+
    '<span>'+p.rows.length+' '+(p.kind==="enrichment"?"updates":"new records")+'</span>'+
    (p.kind==="receipt"?'<span>'+p.duplicates.length+' duplicates skipped</span><span>'+p.receiptItems+' itemized receipt rows</span>':
      '<span>'+p.unchanged+' unchanged</span>')+'</div>';
 }
 return '<section class="money-import-preview" id="money-import-preview" role="status">'+
  '<div class="section-head"><h2>'+heading+'</h2><button data-money-action="csv-cancel">Cancel</button></div>'+
  '<p class="money-help">'+esc(p.filename||"Pasted CSV")+' · This preview has not changed your saved Money data.</p>'+
  counts+
  (warnings.length?'<div class="money-warning">'+[...new Set(warnings)].map(w=>'<p>'+esc(w)+'</p>').join("")+'</div>':"")+
  (errors.length?'<div class="money-warning"><strong>'+errors.length+' errors; nothing can be imported until corrected.</strong>'+
    errors.slice(0,25).map(e=>'<p>'+esc(e)+'</p>').join("")+'</div>':"")+
  (p.kind==="bank"?bankRows(p):
    '<div class="money-import-row-list">'+p.rows.slice(0,100).map(row=>{
      const tx=row.record||row;
      return '<div class="money-import-row"><strong>'+esc(tx.merchant||tx.description)+'</strong>'+
        '<small>'+esc(tx.date)+' · '+esc(tx.category||"Uncategorized")+' · '+usd(tx.amountCents)+'</small></div>';
    }).join("")+(p.rows.length>100?'<p class="money-help">First 100 displayed; all '+p.rows.length+' records are included in the review totals.</p>':"")+'</div>')+
  '<div class="money-csv-actions"><button class="button" data-money-action="csv-commit"'+(blocked?" disabled":"")+
     '>Confirm '+(p.kind==="bank"?"statement review":p.kind==="receipt"?"new transactions":"selected clarifications")+'</button>'+
   '<button class="button secondary" data-money-action="csv-cancel">Discard preview</button></div></section>';
}
window.CommandMoneyImportUI={entry,preview,csvSample};
})();