import {firebaseConfig} from "./firebase-config.js?v=18";

const cloud={
  configured:!!(firebaseConfig&&firebaseConfig.apiKey&&firebaseConfig.authDomain&&firebaseConfig.projectId&&firebaseConfig.appId),
  ready:false,user:null,status:"initializing",error:"",
  signIn:()=>Promise.reject(Error("Account not initialized.")),
  signOut:()=>Promise.reject(Error("Account not initialized.")),
  getBackup:()=>Promise.reject(Error("Account not initialized.")),
  saveBackup:()=>Promise.reject(Error("Account not initialized."))
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
    authApi.onAuthStateChanged(auth,user=>{
      cloud.ready=true;cloud.status="ready";cloud.error="";
      cloud.user=user?{uid:user.uid,email:user.email||"",displayName:user.displayName||""}:null;
      notify();
    },fail);
  }catch(error){fail(error);}
}
init();
