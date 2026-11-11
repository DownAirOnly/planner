(function(){
 "use strict";
 // Money Sync v1: preserve exact top-level finance keys, record ordering, and
 // every source field; group transactions only for efficient cloud storage.
 const month=tx=>{
   const date=tx.purchaseDate||tx.date;
   if(typeof date!=="string"||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date))
     throw Error("A transaction has no valid month.");
   return date.slice(0,7);
 };
 function partition(finance){
   if(!finance||!Array.isArray(finance.transactions)||!Array.isArray(finance.classificationRules)||!finance.budgetPlan)
     throw Error("The finance ledger is incomplete.");
   const hasArchived=Object.prototype.hasOwnProperty.call(finance,"archivedTransactions");
   const archived=hasArchived?finance.archivedTransactions:[];
   if(!Array.isArray(archived))throw Error("Invalid finance archive.");
   const keys=Object.keys(finance);
   const other={};
   for(const k of keys)if(k!=="transactions"&&k!=="archivedTransactions")other[k]=structuredClone(finance[k]);
   const groups={};
   for(const [field,rows] of [["transactions",finance.transactions],["archivedTransactions",archived]]){
     for(const record of rows){
       const k=month(record);
       if(!groups[k])groups[k]={transactions:[],archivedTransactions:[]};
       groups[k][field].push(structuredClone(record));
     }
   }
   const months=Object.fromEntries(Object.keys(groups).sort().map(key=>[key,groups[key]]));
   return {
     meta:{format:"command-money-sync-meta-v1",keys,other,
       transactionOrder:finance.transactions.map(t=>t.id),
       archivedOrder:archived.map(t=>t.id)},
     months
   };
 }
 function assemble(meta,months){
   if(meta?.format!=="command-money-sync-meta-v1"||!Array.isArray(meta.keys)||
      !meta.other||typeof meta.other!=="object"||!Array.isArray(meta.transactionOrder)||
      !Array.isArray(meta.archivedOrder)||!months||typeof months!=="object")
     throw Error("Invalid synced Money metadata.");
   const transactions=new Map(),archived=new Map();
   for(const [k,block] of Object.entries(months)){
     if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)||!Array.isArray(block?.transactions)||!Array.isArray(block?.archivedTransactions))
       throw Error("Cloud Money month is invalid.");
     for(const [field,map] of [["transactions",transactions],["archivedTransactions",archived]]){
       for(const row of block[field]){
         if(!row||typeof row.id!=="string"||map.has(row.id)||month(row)!==k)
           throw Error("Duplicate or incorrectly dated cloud transaction.");
         map.set(row.id,row);
       }
     }
   }
   const order=(ids,byId)=>{
     const seen=new Set();
     return ids.map(id=>{
       if(typeof id!=="string"||seen.has(id)||!byId.has(id))throw Error("Cloud Money order index is incomplete.");
       seen.add(id);return byId.get(id);
     });
   };
   if(transactions.size!==meta.transactionOrder.length||archived.size!==meta.archivedOrder.length)
     throw Error("Cloud Money order index has missing transactions.");
   const ledger=order(meta.transactionOrder,transactions),archive=order(meta.archivedOrder,archived);
   const result={};
   const keys=new Set();
   for(const key of meta.keys){
     if(typeof key!=="string"||keys.has(key)||key==="__proto__"||key==="constructor")
       throw Error("Invalid finance property in cloud metadata.");
     keys.add(key);
     if(key==="transactions")result[key]=ledger;
     else if(key==="archivedTransactions")result[key]=archive;
     else if(Object.prototype.hasOwnProperty.call(meta.other,key))result[key]=meta.other[key];
     else throw Error("Cloud Money settings are missing "+key+".");
   }
   if(!keys.has("transactions")||(meta.archivedOrder.length>0&&!keys.has("archivedTransactions")))
     throw Error("Cloud Money transaction fields are missing.");
   if(Object.keys(meta.other).some(key=>!keys.has(key)||key==="transactions"||key==="archivedTransactions"))
     throw Error("Unexpected cloud Money settings.");
   return result;
 }
 window.CommandMoneySyncModel={partition,assemble};
})();