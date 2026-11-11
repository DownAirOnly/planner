(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fields=["category","subcategory","merchant"],matchFields=["any","merchant","bankDescription"];
function validateRule(r){
 if(!r||typeof r.id!=="string"||!r.id.trim()||r.id.length>160||
    typeof r.name!=="string"||!r.name.trim()||r.name.length>100||
    typeof r.matchText!=="string"||r.matchText.trim().length<2||r.matchText.length>120||
    !matchFields.includes(r.matchField||"any")||typeof r.category!=="string"||
    !r.category.trim()||r.category.length>80||String(r.subcategory||"").length>80||
    String(r.merchant||"").length>160||
    r.amountCents!=null&&(!Number.isSafeInteger(r.amountCents)||r.amountCents<=0))
    throw Error("Invalid classification rule.");
 return r;
}
function matches(tx,rule){
 validateRule(rule);
 if(rule.enabled===false||(rule.amountCents!=null&&rule.amountCents!==tx.amountCents))return false;
 const values=rule.matchField==="bankDescription"?[tx.bankDescription]:
   rule.matchField==="merchant"?[tx.merchant||(!tx.bankDescription?tx.description:"")]:
   [tx.merchant,tx.bankDescription,tx.description];
 return values.some(v=>String(v||"").toLowerCase().includes(rule.matchText.trim().toLowerCase()));
}
function proposals(transactions,rules){
 return transactions.map(tx=>{
   const matching=rules.filter(r=>matches(tx,r));
   if(!matching.length)return null;
   const changes={},conflicts=[];
   for(const k of fields){
     const choices=[...new Set(matching.map(r=>r[k]).filter(Boolean))];
     if(choices.length>1){conflicts.push(k);continue;}
     const before=String(tx[k]||"");
     if(choices.length===1&&choices[0]!==before)changes[k]={before,after:choices[0]};
   }
   return {id:tx.id,ruleNames:matching.map(r=>r.name),changes:conflicts.length?{}:changes,conflicts};
 }).filter(Boolean);
}
function apply(finance,preview,selected){
 const chosen=new Set(selected),byId=new Map(preview.map(p=>[p.id,p]));
 const result=structuredClone(finance);
 for(const tx of result.transactions){
   if(!chosen.has(tx.id))continue;
   const p=byId.get(tx.id);
   if(!p||p.conflicts.length||!Object.keys(p.changes).length)
     throw Error("Refresh rule review; an item is no longer applicable.");
   for(const [field,change] of Object.entries(p.changes)){
     if(!fields.includes(field)||String(tx[field]||"")!==change.before)
       throw Error("Transaction changed since preview. Review again.");
     tx[field]=change.after;
   }
   chosen.delete(tx.id);
 }
 if(chosen.size)throw Error("Some selected transaction IDs no longer exist.");
 return result;
}
function options(values,selected){
 return values.map(([key,name])=>'<option value="'+esc(key)+'"'+(selected===key?' selected':'')+'>'+esc(name)+'</option>').join("");
}
function editor(finance,editing){
 if(editing===null)return "";
 const r=editing==="new"?null:finance.classificationRules.find(x=>x.id===editing);
 if(editing!=="new"&&!r)return '<p class="money-warning">This rule was removed.</p>';
 const rule=r||{name:"",matchText:"",matchField:"any",category:"Uncategorized",subcategory:"",merchant:"",enabled:true};
 const field=(name,label,value,attr="")=>'<label class="money-plan-field"><span>'+label+'</span><input name="'+name+'" value="'+esc(value||"")+'" '+attr+'></label>';
 return '<section class="money-plan-editor" id="money-classification-editor"><div class="section-head"><h2>'+(r?"Edit classification rule":"New classification rule")+'</h2>'+
   '<button data-money-action="class-cancel">Cancel</button></div><form id="money-class-form">'+
   '<input type="hidden" name="id" value="'+esc(r?.id||"")+'"><div class="money-plan-form-grid">'+
   field("name","Rule name",rule.name,'maxlength="100" required')+
   field("matchText","Contains text",rule.matchText,'maxlength="120" minlength="2" required')+
   '<label class="money-plan-field"><span>Match field</span><select name="matchField">'+options([["any","Any description or merchant"],["merchant","Merchant only"],["bankDescription","Original bank text"]],rule.matchField||"any")+'</select></label>'+
   field("category","Suggested category",rule.category,'maxlength="80" required')+
   field("subcategory","Subcategory (optional)",rule.subcategory,'maxlength="80"')+
   field("merchant","Merchant name (optional)",rule.merchant,'maxlength="160"')+
   field("amount","Exact amount (optional)",rule.amountCents==null?"":(rule.amountCents/100).toFixed(2),'inputmode="decimal" placeholder="Any amount"')+
   '<label class="money-plan-field"><span>Status</span><select name="enabled">'+options([["yes","Enabled"],["no","Disabled"]],rule.enabled===false?"no":"yes")+'</select></label>'+
   '</div><p class="money-help">Rules only suggest category, subcategory and merchant changes. Nothing is applied until reviewed and selected.</p>'+
   '<div class="money-tx-actions"><button class="button" type="submit">Save rule</button>'+
   (r?'<button class="button secondary" data-money-action="class-delete" data-id="'+esc(r.id)+'" type="button">Remove rule</button>':"")+
   '</div></form></section>';
}
function render(finance,editing,reviewOpen,review){
 const applicable=review.filter(p=>!p.conflicts.length&&Object.keys(p.changes).length);
 const ambiguous=review.filter(p=>p.conflicts.length);
 const list=finance.classificationRules.map(r=>
   '<div class="money-detail-row"><strong>'+esc(r.name)+(r.enabled===false?" (disabled)":"")+'</strong>'+
   '<small>'+esc(r.matchText)+' · '+esc(r.matchField||"any")+' → '+esc(r.category)+'</small>'+
   '<button data-money-action="class-edit" data-id="'+esc(r.id)+'">Edit</button></div>').join("");
 const preview=reviewOpen?'<section class="money-class-review"><h3>Review classification suggestions</h3>'+
   '<p class="money-help">'+applicable.length+' proposed updates; '+ambiguous.length+' conflicting matches. Check the individual transactions you want to change.</p>'+
   '<div class="money-class-results">'+applicable.slice(0,120).map(p=>{
     const tx=finance.transactions.find(t=>t.id===p.id);
     return '<label class="money-class-proposal"><input type="checkbox" data-class-selected value="'+esc(p.id)+'"><span>'+
       '<strong>'+esc(tx?.merchant||tx?.description||p.id)+'</strong>'+
       '<small>'+esc(tx?.date)+' · '+esc(p.ruleNames.join(", "))+'</small>'+
       '<small>'+Object.entries(p.changes).map(([k,x])=>esc(k)+": "+esc(x.before||"—")+" → "+esc(x.after)).join(" · ")+'</small>'+
       '</span></label>';
   }).join("")+
   (applicable.length>120?'<p class="money-help">First 120 suggestions shown. Apply and review again for the remainder.</p>':"")+
   ambiguous.slice(0,10).map(p=>'<p class="money-warning">Conflicting suggestions for transaction '+esc(p.id)+'. Resolve the overlapping rules before applying.</p>').join("")+
   '</div><div class="money-tx-actions"><button class="button" data-money-action="class-apply"'+(!applicable.length?" disabled":"")+
   '>Apply selected</button><button class="button secondary" data-money-action="class-hide">Close</button></div></section>':"";
 return '<section class="money-section money-classification"><div class="section-head"><h2>Classification rules</h2><span class="muted">'+finance.classificationRules.length+' saved</span></div>'+
   '<div class="money-class-actions"><button class="button secondary" data-money-action="class-new">+ Rule</button>'+
   '<button class="button secondary" data-money-action="class-review">Review suggestions</button></div>'+
   editor(finance,editing)+preview+
   '<div class="money-summary-list">'+(list||'<p class="money-help">No classification rules saved.</p>')+'</div></section>';
}
window.CommandMoneyClassification={validateRule,matches,proposals,apply,render};
})();