(function(){
"use strict";
// Finance-only CSV import; follows Everyday's transaction/receiptItem schema.
// Never accepts or writes food/lifting records.
const bank=()=>window.CommandMoneyBankImport;
const validDate=s=>typeof s==="string"&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)&&new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
const cents=value=>{
 const v=String(value??"").trim().replace(/^\$/,"");
 if(!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(v))
  throw Error("Use a positive dollar amount (7.19).");
 const [whole,fraction=""]=v.replaceAll(",","").split(".");
 const n=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(n)||n<=0)throw Error("Invalid positive amount.");
 return n;
};
const csvId=(t,occurrence=1)=>{
 const key=[t.date,t.time||"",t.kind,String(t.amountCents),
   t.description.trim().toLowerCase().replace(/\s+/g," "),
   (t.merchant||"").trim().toLowerCase().replace(/\s+/g," "),
   (t.externalId||"").trim().toLowerCase()].join("\x1f");
 return "finance-csv-"+bank().bankHash(key)+"-"+occurrence;
};
function parseReceiptCSV(text){
 const rows=bank().parseCSV(String(text||"").replace(/^\uFEFF/,""));
 if(!rows.length)throw Error("CSV is empty.");
 const headers=rows.shift().map(s=>String(s).trim().toLowerCase());
 const map=new Map(headers.map((n,i)=>[n,i]));
 if(!map.has("recordtype"))throw Error("A finance CSV requires a recordType column.");
 const get=(row,...keys)=>{for(const k of keys){const ix=map.get(k.toLowerCase());if(ix!=null)return String(row[ix]??"").trim();}return "";};
 const errors=[],transactions=[],items=[],ids=new Map(),purchaseIds=new Map();
 for(let i=0;i<rows.length;i++){
  const line=i+2,row=rows[i],type=get(row,"recordType").replace(/[ _-]+/g,"").toLowerCase();
  try{
   if(type==="receiptitem"){
    const purchaseId=get(row,"purchaseId"),name=get(row,"itemName","name"),
      category=get(row,"itemCategory","category")||"Uncategorized";
    const amountCents=cents(get(row,"itemAmount","amount"));
    if(!purchaseId||!name||name.length>120||category.length>80)
      throw Error("receiptItem requires purchaseId, itemName and itemCategory.");
    items.push({purchaseId,item:{name,category,amountCents},line});
    continue;
   }
   if(!["transaction","purchase","receipt","finance","expense","income","transfer"].includes(type))
    throw Error("Only transaction/purchase/receipt/expense/income/transfer and receiptItem rows are allowed in Money.");
   const date=get(row,"date"),kind=(get(row,"kind")||(["expense","income","transfer"].includes(type)?type:"")).toLowerCase();
   const description=get(row,"description","name"),category=get(row,"category")||"Uncategorized";
   const amountText=get(row,"amount"),centsText=get(row,"amountCents");
   const amountCents=amountText?cents(amountText):Number(centsText);
   if(!validDate(date)||!["expense","income","transfer"].includes(kind)||
      !description||description.length>240||!Number.isSafeInteger(amountCents)||amountCents<=0||
      (centsText&&Number(centsText)!==amountCents)||String(get(row,"currency")||"USD").toUpperCase()!=="USD")
     throw Error("Invalid date, type, description, amount, or currency.");
   const t={date,kind,amountCents,description,category,currency:"USD",source:"import"};
   for(const k of ["time","merchant","note","externalId","accountLabel","purchaseDate","paycheckDate","subcategory","itemization"]){
     const v=get(row,k,k==="note"?"notes":k);
     if(v)t[k]=v;
   }
   if(t.time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time)||
      t.purchaseDate&&!validDate(t.purchaseDate)||
      t.paycheckDate&&!validDate(t.paycheckDate))throw Error("Invalid time, purchase date, or payday date.");
   const base=csvId(t),number=(ids.get(base)||0)+1;ids.set(base,number);
   t.id=get(row,"id")||csvId(t,number);
   const purchaseId=get(row,"purchaseId");
   if(purchaseId){
     if(purchaseIds.has(purchaseId))throw Error("purchaseId is repeated within this file.");
     purchaseIds.set(purchaseId,t);
   }
   transactions.push(t);
  }catch(e){errors.push("Row "+line+": "+e.message);}
 }
 for(const r of items){
   const t=purchaseIds.get(r.purchaseId);
   if(!t){errors.push("Row "+r.line+": purchaseId is not attached to a purchase.");continue;}
   if(t.kind!=="expense"){errors.push("Row "+r.line+": receipt items must belong to expenses.");continue;}
   (t.items??=[]).push(r.item);
 }
 for(const t of transactions)if(t.items?.length){
   const total=t.items.reduce((n,item)=>n+item.amountCents,0);
   if(total!==t.amountCents)errors.push("Receipt "+t.description+": itemized "+total+" cents does not equal "+t.amountCents+" cents.");
 }
 const distinct=new Set();
 for(const t of transactions){
   if(distinct.has(t.id))errors.push("Repeated transaction ID in CSV: "+t.id);
   distinct.add(t.id);
 }
 if(!transactions.length&&!errors.length)errors.push("No finance transactions were found.");
 return {transactions,errors,warnings:[],receiptItems:items.length};
}
function receiptPreview(text,finance){
 const parsed=parseReceiptCSV(text);
 const ids=new Map(finance.transactions.map(t=>[t.id,t])),byBank=new Map(finance.transactions.filter(t=>t.externalId).map(t=>[t.externalId,t]));
 const archived=new Set((finance.archivedTransactions||[]).map(t=>t.id));
 const incoming=[],duplicates=[],conflicts=[],similar=[];
 for(const tx of parsed.transactions){
   if(archived.has(tx.id)){conflicts.push("Transaction "+tx.id+" was archived. Restore it before importing.");continue;}
   const known=ids.get(tx.id);
   if(known){
     if(JSON.stringify(known)===JSON.stringify(tx))duplicates.push(tx.id);
     else conflicts.push("Transaction "+tx.id+" already exists with different details.");
     continue;
   }
   if(tx.externalId&&byBank.has(tx.externalId)){
     conflicts.push("External ID "+tx.externalId+" belongs to an existing transaction.");continue;
   }
   const matches=finance.transactions.filter(x=>x.date===tx.date&&x.amountCents===tx.amountCents&&x.kind===tx.kind&&
      String(x.description).trim().toLowerCase()===tx.description.trim().toLowerCase());
   if(matches.length)similar.push(tx.id);
   incoming.push(tx);
 }
 const errors=[...parsed.errors,...conflicts];
 return {kind:"receipt",rows:incoming,errors,warnings:similar.length?[similar.length+" new records resemble existing transactions. Review before confirming."]:[],
   duplicates,similar,receiptItems:parsed.receiptItems,total:parsed.transactions.length};
}
function enrichmentPreview(text,finance){
 const result=bank().readEnrichmentCSV(text,finance);
 const ids=new Set(result.updates.map(x=>x.record.id));
 const conflicted=new Set((finance.archivedTransactions||[]).map(x=>x.id));
 if([...ids].some(id=>conflicted.has(id)))throw Error("Enrichment attempts to update an archived transaction.");
 return {kind:"enrichment",rows:result.updates,errors:result.errors,warnings:result.warnings,
   unchanged:result.unchanged,total:result.updates.length+result.unchanged};
}
window.CommandMoneyCsvModel={parseReceiptCSV,receiptPreview,enrichmentPreview};
})();