import {firebaseConfig} from "./firebase-config.js?v=24";

const cloud={
  configured:!!(firebaseConfig&&firebaseConfig.apiKey&&firebaseConfig.authDomain&&firebaseConfig.projectId&&firebaseConfig.appId),
  ready:false,user:null,status:"initializing",error:"",
  signIn:()=>Promise.reject(Error("Account not initialized.")),
  signOut:()=>Promise.reject(Error("Account not initialized.")),
  getBackup:()=>Promise.reject(Error("Account not initialized.")),
  saveBackup:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceManifest:()=>Promise.reject(Error("Account not initialized.")),
  saveFinanceBackup:()=>Promise.reject(Error("Account not initialized.")),
  getFinanceBackup:()=>Promise.reject(Error("Account not initialized."))
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
          clientSavedAt:new Date().toISOString(),savedAt:storeApi.serverTimestamp()});
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
    authApi.onAuthStateChanged(auth,user=>{
      cloud.ready=true;cloud.status="ready";cloud.error="";
      cloud.user=user?{uid:user.uid,email:user.email||"",displayName:user.displayName||""}:null;
      notify();
    },fail);
  }catch(error){fail(error);}
}
init();
