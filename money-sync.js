(function(){
"use strict";
// Account-scoped, opt-in Money synchronization. Unresolved concurrent edits
// are never merged or overwritten. Original manual Firebase backups remain.
const PREF="command.finance.autosync.v1.",BASE="command.finance.syncBase.v1.",KEY="command.finance.v1";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let uid="",status="off",message="",busy=false,unsubscribe=null,timer=null,deferred=false;
const cloud=()=>window.CommandCloud;
const money=()=>window.CommandMoney;
const authUid=()=>cloud()?.ready?cloud()?.user?.uid||"":"";
const enabled=()=>!!uid&&localStorage.getItem(PREF+uid)==="on";
const base=()=>{
 try{const b=JSON.parse(localStorage.getItem(BASE+uid)||"null");
   return b?.uid===uid&&typeof b.revision==="string"&&typeof b.sha256==="string"?b:null;
 }catch{return null;}
};
const local=()=>money()?.getRecord?.()||null;
function notify(next,detail=""){
 if(status===next&&message===detail)return;
 status=next;message=detail;
 window.dispatchEvent(new CustomEvent("command-money-sync-status"));
}
function stop(){if(timer){clearTimeout(timer);timer=null;}if(unsubscribe){unsubscribe();unsubscribe=null;}}
function stamp(remote){
 if(!uid||authUid()!==uid)throw Error("Money sync account changed.");
 localStorage.setItem(BASE+uid,JSON.stringify({uid,revision:remote.revision,sha256:remote.sha256,verifiedAt:new Date().toISOString()}));
}
function isCurrent(hash){
 const b=base();return enabled()&&status==="current"&&b?.sha256===hash&&local()?.sha256===hash;
}
function accountChanged(){
 const id=authUid();if(id===uid)return;
 stop();deferred=false;uid=id;
 if(!uid){notify("signed-out","Sign in through Settings to sync Money.");return;}
 if(!enabled()){notify("off","Automatic Money sync is off. Manual backups remain available.");return;}
 void reconcile();
}
function watch(){
 if(unsubscribe||!enabled())return;
 const account=uid;
 try{
  unsubscribe=cloud().watchFinanceSync((manifest,error)=>{
   if(account!==uid||!enabled())return;
   if(error){notify("error","Connection: "+(error.message||String(error)));return;}
   if(busy){deferred=true;return;}
   if(!manifest){notify("conflict","The cloud Money sync manifest is missing. No data was changed.");return;}
   if(base()?.revision!==manifest.revision)void reconcile(manifest);
  });
 }catch(error){notify("error",error.message||String(error));}
}
function queue(){
 if(!enabled()||status==="conflict"||!base())return;
 if(timer)clearTimeout(timer);
 notify("pending","Local Money changes are waiting to sync.");
 timer=setTimeout(()=>{timer=null;void push();},3500);
}
async function reconcile(announced){
 if(busy||!enabled())return;
 const account=uid,b=base(),r=local();
 if(!b){notify("needs-setup","No trusted sync starting point on this device.");return;}
 if(!r||!money()?.verified?.()){notify("needs-restore","Restore a verified cloud Money copy or import a backup.");return;}
 busy=true;notify("checking","Comparing local and cloud Money revisions…");
 try{
  const remote=announced||await cloud().getFinanceSyncManifest();
  if(account!==uid)return;
  if(!remote){notify("conflict","Cloud sync data is missing. Local Money is intact.");return;}
  if(remote.revision===b.revision){
   if(remote.sha256!==b.sha256){notify("conflict","Unexpected cloud revision metadata.");return;}
   if(r.sha256===b.sha256){notify("current","Local and cloud Money revisions match.");watch();}
   else{watch();queue();}
   return;
  }
  // Verify the entire remote copy before applying anything.
  const download=await cloud().getFinanceSyncSnapshot(remote);
  if(account!==uid)return;
  const now=local();
  if(now?.sha256!==r.sha256){notify("conflict","Local Money changed during download. Review both copies.");return;}
  if(now.sha256!==b.sha256&&now.sha256!==download.sha256){
   notify("conflict","Both devices have different unsynced Money changes. Neither copy was overwritten.");return;
  }
  if(now.sha256!==download.sha256){
   if(money().isSyncEditing()){notify("waiting","Close your Money editor to receive the cloud changes.");return;}
   await money().applySyncedData(download,now.sha256);
  }
  stamp(remote);notify("current","Verified cloud Money is up to date.");watch();
 }catch(error){
  if(account===uid)notify(error?.code==="money-sync/conflict"?"conflict":
    navigator.onLine===false?"offline":"error",error.message||String(error));
 }finally{
  busy=false;
  if(deferred&&account===uid){deferred=false;queueMicrotask(()=>void reconcile());}
 }
}
async function push(){
 if(!enabled()||busy||status==="conflict")return;
 const account=uid,b=base(),r=local();
 if(!b||!r||!money()?.verified?.()){notify("error","Money or sync base is not verified.");return;}
 if(r.sha256===b.sha256){notify("current","All local Money edits are synced.");return;}
 if(money().isSyncEditing()){notify("waiting","Close the editor to finish syncing.");return;}
 busy=true;notify("uploading","Uploading changed months and budget settings…");
 const hash=r.sha256,copy=structuredClone(r.data);
 try{
  const remote=await cloud().getFinanceSyncManifest();
  if(account!==uid)return;
  if(!remote||remote.revision!==b.revision||remote.sha256!==b.sha256){
   if(remote?.sha256===hash){
    const valid=await cloud().getFinanceSyncSnapshot(remote);
    if(JSON.stringify(valid.data)!==JSON.stringify(copy))throw Error("Cloud and local fields differ.");
    stamp(remote);notify("current","These changes were already synced.");return;
   }
   notify("conflict","Another device changed Money first. Local records are preserved; review the conflict.");return;
  }
  const published=await cloud().publishFinanceSync(copy,hash,b.revision);
  const checked=await cloud().getFinanceSyncSnapshot(published);
  if(checked.sha256!==hash||JSON.stringify(checked.data)!==JSON.stringify(copy))
   throw Error("Cloud Money read-back did not match the upload.");
  if(account!==uid)return;
  stamp(published);
  if(!enabled()){notify("off","Automatic sync is turned off.");return;}
  if(local()?.sha256!==hash)notify("pending","Further local Money edits need uploading.");
  else notify("current","All local Money edits are synced.");
  watch();
 }catch(error){
  if(account===uid)notify(error?.code==="money-sync/conflict"?"conflict":
    navigator.onLine===false?"offline":"error",error.message||String(error));
 }finally{
  busy=false;
  if(account===uid&&enabled()){
   if(status==="pending")queue();
   if(deferred){deferred=false;queueMicrotask(()=>void reconcile());}
  }
 }
}
async function enable(){
 accountChanged();
 if(busy)throw Error("Money sync is busy.");
 if(!uid)throw Error("Sign in through Command Settings first.");
 const account=uid,r=local();
 if(!r||!money()?.verified?.())throw Error("Verify the Money ledger before enabling sync.");
 if(money().isSyncEditing())throw Error("Close the Money editor first.");
 busy=true;notify("checking","Verifying your existing cloud recovery copy…");
 try{
  let remote=await cloud().getFinanceSyncManifest();
  if(!remote){
   const legacy=await cloud().getFinanceBackup();
   if(!legacy||legacy.sha256!==r.sha256||JSON.stringify(legacy.data)!==JSON.stringify(r.data))
    throw Error("Manual Firebase Money backup must match this device before first-time sync. Back up Money, check the cloud copy, and retry.");
   remote=await cloud().publishFinanceSync(structuredClone(r.data),r.sha256,null);
  }
  const checked=await cloud().getFinanceSyncSnapshot(remote);
  if(account!==uid||local()?.sha256!==r.sha256)throw Error("Account or local Money changed during setup.");
  if(checked.sha256!==r.sha256||JSON.stringify(checked.data)!==JSON.stringify(r.data))
   throw Error("Existing cloud sync differs from this device. Restore or review the other copy first.");
  stamp(remote);localStorage.setItem(PREF+uid,"on");
  notify("current","Automatic Money sync is enabled. Local and cloud data match.");
  watch();
 }catch(error){if(account===uid)notify("needs-setup",error.message||String(error));throw error;}
 finally{busy=false;}
}
async function restore(){
 accountChanged();
 if(busy)throw Error("Money sync is busy.");
 if(!uid)throw Error("Sign in through Settings first.");
 if(money()?.isSyncEditing?.())throw Error("Close Money editing forms before restoring.");
 const account=uid;
 busy=true;notify("checking","Downloading and validating all synced Money months…");
 try{
  const manifest=await cloud().getFinanceSyncManifest();
  if(!manifest)throw Error("No automatic Money sync snapshot exists for this account.");
  const snap=await cloud().getFinanceSyncSnapshot(manifest);
  if(account!==uid)throw Error("Google account changed.");
  const current=local();
  if(current?.sha256!==snap.sha256){
   const word=current?"REPLACE":"RESTORE";
   if(prompt("The verified cloud copy has "+snap.data.transactions.length+" transactions. "+
     (current?"A local recovery copy will be saved before replacement.":"It will be restored on this device.")+
     " Type "+word+" to continue.")!==word){
    notify(enabled()?"conflict":"off","Cloud restore cancelled; nothing was replaced.");return;
   }
   await money().applySyncedData(snap,current?.sha256??null);
  }
  stamp(manifest);localStorage.setItem(PREF+uid,"on");
  notify("current","Cloud Money restored and verified. Sync is enabled.");watch();
 }catch(error){if(account===uid)notify("error",error.message||String(error));throw error;}
 finally{busy=false;}
}
function disable(){
 if(!uid)return;
 localStorage.setItem(PREF+uid,"off");stop();
 notify("off","Automatic sync paused. Local and manual backups remain unchanged.");
}
function renderControls(){
 const user=cloud()?.user,r=local(),on=enabled();
 const labels={"off":"Off","signed-out":"Sign in needed","needs-setup":"Setup needed",
 "needs-restore":"Restore needed","checking":"Checking","current":"Up to date",
 "pending":"Local edits pending","uploading":"Syncing","waiting":"Waiting for editor",
 "offline":"Offline","error":"Attention needed","conflict":"Conflict — paused"};
 const detail=message||(user?"Enable syncing when your cloud backup and this device match.":
   "Sign in through Settings to sync Money between devices.");
 const actions=[];
 if(user&&r&&!on)actions.push('<button class="button secondary" data-money-sync-action="enable">Enable automatic sync</button>');
 if(user&&on)actions.push('<button class="button secondary" data-money-sync-action="disable">Turn sync off</button>');
 if(user&&on&&["error","offline","waiting","needs-setup","needs-restore"].includes(status))
  actions.push('<button class="button secondary" data-money-sync-action="retry">Retry</button>');
 if(user&&(!r||["conflict","needs-setup","error","needs-restore"].includes(status)))
  actions.push('<button class="button secondary" data-money-sync-action="restore">Restore synced copy</button>');
 if(user&&status==="conflict"&&r)
  actions.push('<button class="button secondary" data-money-sync-action="export">Export local copy</button>');
 return '<section class="money-sync-card'+(status==="conflict"?" conflicted":"")+
   '"><div class="money-sync-head"><strong>Money sync</strong><span>'+esc(labels[status]||"Off")+'</span></div>'+
   '<p>'+esc(detail)+'</p><div class="money-sync-actions">'+actions.join("")+'</div>'+
   '<small>Per-month updates; conflicts pause syncing. Sync works while Command is open. Manual backups stay separate.</small></section>';
}
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-money-sync-action]");if(!button)return;
 const action=button.dataset.moneySyncAction;
 if(action==="disable"){disable();return;}
 if(action==="export"){money()?.download?.();return;}
 if(action==="enable")void enable().catch(error=>alert("Money sync: "+error.message));
 if(action==="restore")void restore().catch(error=>alert("Money restore: "+error.message));
 if(action==="retry")void reconcile();
});
window.addEventListener("command-cloud-changed",accountChanged);
window.addEventListener("command-money-updated",()=>{
 if(!enabled()||busy||status==="conflict")return;
 if(status==="waiting"||status==="error"){void reconcile();return;}
 if(local()?.sha256!==base()?.sha256)queue();
});
window.addEventListener("online",()=>{if(enabled())void reconcile();});
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible"&&enabled())void reconcile();
});
window.addEventListener("storage",event=>{
 if(event.key===PREF+uid){
  if(enabled())void reconcile();else{stop();notify("off","Sync turned off in another tab.");}
  return;
 }
 if(event.key!==KEY||!enabled())return;
 if(money()?.isSyncEditing?.()){
  notify("waiting","Money was updated in another tab. Close the editor and review changes.");return;
 }
 money()?.reload?.();
});
accountChanged();
window.CommandMoneySync={renderControls,isCurrent,enable,disable,restore,retry:reconcile,
 getStatus:()=>({status,message,enabled:enabled(),base:base()})};
})();