import {firebaseConfig} from "./firebase-config.js?v=31";

const cloud={
  configured:!!(firebaseConfig&&firebaseConfig.apiKey&&firebaseConfig.authDomain&&firebaseConfig.projectId&&firebaseConfig.appId),
  ready:false,user:null,status:"initializing",error:"",
  signIn:()=>Promise.reject(Error("Account not initialized.")),
  signOut:()=>Promise.reject(Error("Account not initialized.")),
  getBackup:()=>Promise.reject(Error("Account not initialized.")),
  saveBackup:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceManifest:()=>Promise.reject(Error("Account not initialized.")),
  saveFinanceBackup:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceBackup:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceSyncManifest:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceSyncSnapshot:()=>Promise.reject(Error("Account not initialized.")),
  publishFinanceSync:()=>Promise.reject(Error("Account not initialized.")),
  watchFinanceSync:()=>{throw Error("Account not initialized.");}
};
window.CommandCloud=cloud;
const notify=()=>window.dispatchEvent(new CustomEvent("command-cloud-changed"));
function fail(error){cloud.status="error";cloud.error=error?.message||String(error);console.warn("Firebase unavailable",error);notify();}
async function init(){
  if(!cloud.configured){cloud.status="setup-required";notify();return;}
  try{
    const [core,authApi,storeApi]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js")
    ]);
    const firebaseApp=core.initializeApp(firebaseConfig);
    const auth=authApi.getAuth(firebaseApp);
    const db=storeApi.getFirestore(firebaseApp);
    await authApi.setPersistence(auth,authApi.browserLocalPersistence);
    const backupRef=()=>{
      if(!auth.currentUser)throw Error("Sign in first.");
      return storeApi.doc(db,"users",auth.currentUser.uid,"backups","current");
    };
    cloud.signIn=()=>authApi.signInWithPopup(auth,new authApi.GoogleAuthProvider());
    cloud.signOut=()=>authApi.signOut(auth);
    cloud.getBackup=async()=>{
      const snap=await storeApi.getDocFromServer(backupRef());
      if(!snap.exists())return null;
      const value=snap.data();
      if(!value?.backup||!Array.isArray(value.backup.projects)||!Array.isArray(value.backup.events))throw Error("Unrecognized backup format.");
      return {backup:value.backup,revision:value.revision,savedAt:value.clientSavedAt||""};
    };
    cloud.saveBackup=async(backup,expectedRevision)=>{
      const contents=JSON.stringify(backup);
      if(new TextEncoder().encode(contents).length>850000)throw Error("Data exceeds the initial cloud backup size limit. Export a JSON backup.");
      const ref=backupRef(),revision=crypto.randomUUID?.()||Date.now().toString(36);
      await storeApi.runTransaction(db,async tx=>{
        const prior=await tx.get(ref),actual=prior.exists()?prior.data().revision:null;
        if(actual!==(expectedRevision??null))throw Error("Cloud backup changed since it was checked. Review it again.");
        tx.set(ref,{revision,schemaVersion:5,clientSavedAt:new Date().toISOString(),savedAt:storeApi.serverTimestamp(),backup:JSON.parse(contents)});
      });
      return revision;
    };

    // Finance snapshots are immutable, versioned Firestore chunks. The active
    // manifest moves only after EVERY chunk has been written. Interrupted
    // uploads never replace the previously complete snapshot.
    const financeManifestRef=()=>{
      if(!auth.currentUser)throw Error("Sign in to Google first.");
      return storeApi.doc(db,"users",auth.currentUser.uid,"finance","manifest");
    };
    const financeChunkRef=id=>{
      if(!auth.currentUser)throw Error("Sign in to Google first.");
      return storeApi.doc(db,"users",auth.currentUser.uid,"financeChunks",id);
    };
    const digest=async text=>{
      const bytes=new TextEncoder().encode(text),h=await crypto.subtle.digest("SHA-256",bytes);
      return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("");
    };
    cloud.getFinanceManifest=async()=>{
      const doc=await storeApi.getDocFromServer(financeManifestRef());
      return doc.exists()?doc.data():null;
    };
    cloud.saveFinanceBackup=async(data,expectedHash,expectedRevision)=>{
      const serialized=JSON.stringify(data);
      const hash=await digest(serialized);
      if(hash!==expectedHash)throw Error("Finance data changed since local verification.");
      const codepoints=Array.from(serialized),pieceSize=100000,parts=[];
      for(let i=0;i<codepoints.length;i+=pieceSize)parts.push(codepoints.slice(i,i+pieceSize).join(""));
      if(!parts.length||parts.length>200)throw Error("Finance export exceeds the chunked backup limit.");
      const revision=crypto.randomUUID?.()||String(Date.now());
      const chunkIds=parts.map((_,i)=>revision+"-"+i);
      // Commit no more than 20 immutable docs in each Firestore batch.
      for(let i=0;i<parts.length;i+=20){
        const batch=storeApi.writeBatch(db);
        for(let j=i;j<Math.min(i+20,parts.length);j++){
          batch.set(financeChunkRef(chunkIds[j]),{revision,index:j,text:parts[j]});
        }
        await batch.commit();
      }
      await storeApi.runTransaction(db,async tx=>{
        const ref=financeManifestRef(),prior=await tx.get(ref);
        const actual=prior.exists()?prior.data().revision:null;
        if(actual!==(expectedRevision??null))throw Error("Cloud finance was updated on another device. Refresh before replacing it.");
        tx.set(ref,{revision,chunks:chunkIds,sha256:hash,
          transactions:data.transactions.length,
          rules:data.classificationRules.length,
          schedules:data.budgetPlan.schedules.length,
          clientSavedAt:new Date().toISOString(),savedAt:storeApi.serverTimestamp()},{merge:true});
      });
      return revision;
    };
    cloud.getFinanceBackup=async()=>{
      const manifest=await cloud.getFinanceManifest();
      if(!manifest)return null;
      const ids=manifest.chunks;
      if(!Array.isArray(ids)||!ids.length||ids.length>200||
         ids.some((id,i)=>typeof id!=="string"||id!==manifest.revision+"-"+i))
        throw Error("Cloud finance manifest has an invalid chunk list.");
      const parts=[];
      for(let i=0;i<ids.length;i+=10){
        const blocks=await Promise.all(ids.slice(i,i+10).map(id=>storeApi.getDocFromServer(financeChunkRef(id))));
        for(let j=0;j<blocks.length;j++){
          const d=blocks[j];
          if(!d.exists())throw Error("Cloud finance is missing a backup chunk.");
          const value=d.data();
          if(value.revision!==manifest.revision||value.index!==i+j||typeof value.text!=="string")
            throw Error("Cloud finance chunk does not match its manifest.");
          parts.push(value.text);
        }
      }
      const serialized=parts.join("");
      if(await digest(serialized)!==manifest.sha256)throw Error("Cloud finance checksum mismatch. No local records were changed.");
      const data=JSON.parse(serialized);
      if(!Array.isArray(data.transactions)||!Array.isArray(data.classificationRules)||!data.budgetPlan||
        data.transactions.length!==manifest.transactions||data.classificationRules.length!==manifest.rules||
        data.budgetPlan.schedules?.length!==manifest.schedules)
        throw Error("Cloud finance counts differ from the saved manifest.");
      return {data,sha256:manifest.sha256,revision:manifest.revision,savedAt:manifest.clientSavedAt};
    };

    // The existing /finance/manifest and /financeChunks permissions also cover
    // monthly sync. Its independent 'syncManifest' property means previous full
    // manual recovery snapshots remain intact and readable.
    const syncModel=()=>window.CommandMoneySyncModel;
    const financeSyncError=message=>{
      const error=new Error(message);
      error.code="money-sync/conflict";
      return error;
    };
    cloud.getFinanceSyncManifest=async()=>{
      const raw=await cloud.getFinanceManifest();
      const value=raw?.syncManifest||null;
      if(value&&(!value.revision||value.format!=="command-money-sync-v1"||
          !value.parts||!value.sha256))
        throw Error("Unrecognized cloud Money sync format. Existing backups were not changed.");
      return value;
    };
    const readSyncPart=async part=>{
      if(!part||typeof part.rev!=="string"||!Array.isArray(part.ids)||
         !part.ids.length||part.ids.length>200||typeof part.hash!=="string")
        throw Error("Cloud Money part descriptor is invalid.");
      const segments=[];
      for(let i=0;i<part.ids.length;i+=10){
        const requests=part.ids.slice(i,i+10).map(id=>{
          if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,180}$/.test(id))
            throw Error("Cloud Money chunk ID is invalid.");
          return storeApi.getDocFromServer(financeChunkRef(id));
        });
        const docs=await Promise.all(requests);
        for(let j=0;j<docs.length;j++){
          const snap=docs[j];
          if(!snap.exists())throw Error("A required cloud Money chunk is missing.");
          const v=snap.data();
          if(v.revision!==part.rev||v.index!==i+j||typeof v.text!=="string")
            throw Error("A cloud Money chunk did not match its manifest.");
          segments.push(v.text);
        }
      }
      const raw=segments.join("");
      if(await digest(raw)!==part.hash)throw Error("Cloud Money part checksum mismatch.");
      return JSON.parse(raw);
    };
    cloud.getFinanceSyncSnapshot=async(manifest)=>{
      const snapshot=manifest||await cloud.getFinanceSyncManifest();
      if(!snapshot)return null;
      if(snapshot.format!=="command-money-sync-v1"||!snapshot.parts||
         !snapshot.parts.meta||!snapshot.parts.months||typeof snapshot.parts.months!=="object")
        throw Error("Cloud Money sync snapshot is invalid.");
      const keys=Object.keys(snapshot.parts.months);
      if(keys.length>400||keys.some(k=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)))
        throw Error("Cloud Money month index is invalid.");
      const meta=await readSyncPart(snapshot.parts.meta);
      const months={};
      for(let i=0;i<keys.length;i+=6){
        const batch=keys.slice(i,i+6);
        const values=await Promise.all(batch.map(k=>readSyncPart(snapshot.parts.months[k])));
        batch.forEach((k,j)=>{months[k]=values[j];});
      }
      const data=syncModel().assemble(meta,months);
      const wholeHash=await digest(JSON.stringify(data));
      if(wholeHash!==snapshot.sha256||
         data.transactions.length!==snapshot.transactions||
         (data.archivedTransactions||[]).length!==snapshot.archived||
         data.classificationRules.length!==snapshot.rules||
         data.budgetPlan.schedules.length!==snapshot.schedules)
        throw Error("Cloud Money sync verification failed; no local data was changed.");
      return {data,sha256:wholeHash,revision:snapshot.revision,savedAt:snapshot.clientSavedAt};
    };
    cloud.publishFinanceSync=async(data,expectedHash,expectedRevision)=>{
      const uid=auth.currentUser?.uid;
      if(!uid)throw Error("Sign in before syncing Money.");
      const serialized=JSON.stringify(data),fullHash=await digest(serialized);
      if(fullHash!==expectedHash)throw Error("Local Money changed during synchronization.");
      const ref=financeManifestRef();
      const snap=await storeApi.getDocFromServer(ref);
      const prev=snap.exists()?snap.data().syncManifest||null:null;
      const actual=prev?.revision??null;
      if(actual!==(expectedRevision??null))
        throw financeSyncError("Money changed on another device. Automatic upload has stopped; review the conflict.");
      if(prev?.sha256===fullHash)return prev;
      const pieces=syncModel().partition(data);
      const revision=crypto.randomUUID?.()||Date.now().toString(36);
      const writes=[];
      let pieceNumber=0;
      const addPart=async(value,old)=>{
        const raw=JSON.stringify(value),hash=await digest(raw);
        if(old?.hash===hash&&old?.ids?.length)return old;
        const chunks=Array.from(raw),size=24000,ids=[];
        for(let i=0;i<chunks.length;i+=size){
          const body=chunks.slice(i,i+size).join("");
          if(new TextEncoder().encode(body).length>110000)
            throw Error("Finance month contains an oversized chunk.");
          const id="sync-"+revision+"-"+pieceNumber++;
          ids.push(id);writes.push({id,index:ids.length-1,revision,text:body});
        }
        if(!ids.length||ids.length>200)throw Error("Money part exceeds the sync size limit.");
        return {rev:revision,ids,hash};
      };
      const meta=await addPart(pieces.meta,prev?.parts?.meta);
      const months={};
      for(const [month,content] of Object.entries(pieces.months)){
        months[month]=await addPart(content,prev?.parts?.months?.[month]);
      }
      if(writes.length>300)throw Error("Too many new finance chunks for one sync.");
      // Immutable chunks written first. Their creation never changes which
      // revision another device reads. The final manifest CAS is atomic.
      for(let i=0;i<writes.length;i+=20){
        const batch=storeApi.writeBatch(db);
        for(const w of writes.slice(i,i+20)){
          batch.set(financeChunkRef(w.id),{revision:w.revision,index:w.index,text:w.text});
        }
        await batch.commit();
      }
      if(auth.currentUser?.uid!==uid)throw Error("Signed-in account changed during Money sync.");
      const manifest={format:"command-money-sync-v1",revision,sha256:fullHash,
        parts:{meta,months},transactions:data.transactions.length,
        archived:(data.archivedTransactions||[]).length,
        rules:data.classificationRules.length,schedules:data.budgetPlan.schedules.length,
        clientSavedAt:new Date().toISOString()};
      await storeApi.runTransaction(db,async tx=>{
        const old=await tx.get(ref),current=old.exists()?old.data().syncManifest||null:null;
        if((current?.revision??null)!==(expectedRevision??null))
          throw financeSyncError("Money was updated on another device. No changes were overwritten.");
        // Replace the entire sync manifest, including deleted month keys, while
        // retaining the separate manual-backup fields on this document.
        tx.set(ref,{syncManifest:manifest},{mergeFields:["syncManifest"]});
      });
      return manifest;
    };
    cloud.watchFinanceSync=(callback)=>{
      if(typeof callback!=="function")throw Error("Missing Money listener.");
      return storeApi.onSnapshot(financeManifestRef(),{includeMetadataChanges:true},snap=>{
        if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
        callback(snap.exists()?snap.data().syncManifest||null:null,null);
      },error=>callback(null,error));
    };
    authApi.onAuthStateChanged(auth,user=>{
      cloud.ready=true;cloud.status="ready";cloud.error="";
      cloud.user=user?{uid:user.uid,email:user.email||"",displayName:user.displayName||""}:null;
      notify();
    },fail);
  }catch(error){fail(error);}
}
init();
