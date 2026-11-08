(function app(){
  "use strict";
  const APP_VERSION = 14;
  const KEY = "command.v1";
  const $ = (sel) => document.querySelector(sel);
  const screen = $("#screen");
  const overlay = $("#overlay");
  const importInput = $("#import-file");
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const icon = (name, extra="") => '<svg class="icon '+extra+'" aria-hidden="true"><use href="./icons.svg#'+name+'"></use></svg>';
  const uid = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "id-"+Date.now()+"-"+Math.floor(Math.random()*99999));
  const today = () => { const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  const niceDate = (s) => { if(!s)return ""; const d=new Date(s+"T12:00:00"); return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()===new Date().getFullYear()?undefined:"numeric"});};
  const AREAS=[['home','Home'],['school','School'],['work','Work & career'],['health','Health & fitness'],['personal','Personal'],['apps','Apps & projects']];
  const inferArea=(category)=>({Software:'apps',Education:'school',Home:'home',Health:'health',Personal:'personal'}[category]||'');
  const validArea=(v)=>AREAS.some(a=>a[0]===v)?v:'';
  const areaName=(id)=>AREAS.find(a=>a[0]===id)?.[1]||'Inbox';
  const itemKinds=[['task','Task'],['decision','Decision'],['followup','Follow-up']];
  const defaults = () => ({
    schemaVersion:5,
    schedulePrefs:{usualWorkdays:[5,6,0,1,2]},
    events:[],
    projects:[
      {id:"everyday",title:"Everyday",category:"Software",status:"active",description:"Fitness, nutrition, and finance PWA.",next:"Finalize Workout Buddy's approved exercise swaps.",reviewDate:"",updatedAt:"2026-11-06"},
      {id:"botanica",title:"Botanica",category:"Software",status:"active",description:"Herbal inventory and order management.",next:"Run an end-to-end inventory workflow audit.",reviewDate:"",updatedAt:"2026-11-06"},
      {id:"college",title:"College plan",category:"Education",status:"active",description:"Confirm the next course and explore program prerequisites.",next:"Verify Biology course and registration requirements.",reviewDate:"",updatedAt:"2026-11-06"},
      {id:"backups",title:"PC backups",category:"Home",status:"waiting",description:"Reliable automatic backups for a Windows computer.",next:"Set up a versioned backup and test restoring a file.",reviewDate:"",updatedAt:"2026-11-06"},
      {id:"portfolio",title:"Portfolio",category:"Software",status:"active",description:"Publish accurate project screenshots and working links.",next:"Review every project link and screenshot.",reviewDate:"",updatedAt:"2026-11-06"},
      {id:"edc",title:"EDC Planner",category:"Software",status:"active",description:"Event planning PWA.",next:"Verify the deployed site's mobile experience.",reviewDate:"",updatedAt:"2026-11-06"}
    ],
    tasks:[
      {id:"task-1",title:"Test Botanica from restock through production",projectId:"botanica",status:"open",priority:"high",dueDate:"",notes:"Record friction, unexpected behavior, and whether the updated stock remains correct after refresh."},
      {id:"task-2",title:"Finalize Workout Buddy exercise swap behavior",projectId:"everyday",status:"open",priority:"medium",dueDate:"",notes:"Keep completed sets associated with their original exercises."},
      {id:"task-3",title:"Verify Everyday backup and recovery",projectId:"everyday",status:"open",priority:"medium",dueDate:"",notes:"Test export, import, and synchronization without risking production records."},
      {id:"task-4",title:"Check Biology enrollment requirements",projectId:"college",status:"open",priority:"high",dueDate:"",notes:"Confirm lab, prerequisites, term availability, and aid."},
      {id:"task-5",title:"Test restoring a backed-up Windows file",projectId:"backups",status:"open",priority:"medium",dueDate:"",notes:"An actual restore is the acceptance test."},
      {id:"task-6",title:"Audit portfolio links and screenshots",projectId:"portfolio",status:"open",priority:"medium",dueDate:"",notes:"Replace mock-looking images with accurate captures using dummy data."},
      {id:"task-7",title:"Check the EDC Planner on iPhone",projectId:"edc",status:"open",priority:"low",dueDate:"",notes:"Review navigation, installation, and core event flows."}
    ],
    ideas:[
      {id:"idea-1",title:"Pokémon Mystery Universe iOS client",description:"Research official server protocol compatibility and a native iOS client.",createdAt:"2026-11-06"},
      {id:"idea-2",title:"Multi-model LLM council",description:"Compare multiple model responses and summarize areas of agreement and disagreement.",createdAt:"2026-11-06"}
    ]
  });
  const normalize = (obj) => {
    if(!obj || typeof obj!=="object" || !Array.isArray(obj.projects) || !Array.isArray(obj.tasks) || !Array.isArray(obj.ideas)) throw new Error("This is not a Command backup.");
    const cleanText=(v)=>typeof v==="string"?v.slice(0,5000):"";
    const projectIds=new Set();
    const projects=obj.projects.slice(0,500).map((p)=>{
      const id=cleanText(p.id)||uid(); projectIds.add(id);
      return {areaId:typeof p.areaId==='string'?validArea(p.areaId):inferArea(p.category),blocker:cleanText(p.blocker),needsReview:(!obj.schemaVersion||obj.schemaVersion<5)||!!p.needsReview,id,title:cleanText(p.title)||"Untitled project",category:cleanText(p.category),status:["active","waiting","blocked","parked","done"].includes(p.status)?p.status:"active",description:cleanText(p.description),next:cleanText(p.next),reviewDate:cleanText(p.reviewDate),updatedAt:cleanText(p.updatedAt)};
    });
    const tasks=obj.tasks.slice(0,2500).map((t)=>({areaId:validArea(t.areaId),kind:['task','decision','followup'].includes(t.kind)?t.kind:'task',needsReview:(!obj.schemaVersion||obj.schemaVersion<5)||!!t.needsReview,id:cleanText(t.id)||uid(),title:cleanText(t.title)||"Untitled task",projectId:projectIds.has(t.projectId)?t.projectId:"",status:["open","in_progress","waiting","blocked","done"].includes(t.status)?t.status:"open",priority:["high","medium","low"].includes(t.priority)?t.priority:"medium",dueDate:cleanText(t.dueDate),notes:cleanText(t.notes)}));
    const ideas=obj.ideas.slice(0,1000).map((i)=>({areaId:validArea(i.areaId),id:cleanText(i.id)||uid(),title:cleanText(i.title)||"Untitled idea",description:cleanText(i.description),createdAt:cleanText(i.createdAt)}));
    const events=(Array.isArray(obj.events)?obj.events:[]).slice(0,4000).filter(e=>e&&typeof e==="object").map(e=>window.CommandSchedule.validate(e)).filter(e=>e.date);
    const usual=Array.isArray(obj.schedulePrefs?.usualWorkdays)?obj.schedulePrefs.usualWorkdays:[5,6,0,1,2];
    const usualWorkdays=[...new Set(usual.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))];
    const schedulePrefs={usualWorkdays:usualWorkdays.length?usualWorkdays:[5,6,0,1,2]};
    return {schemaVersion:5,projects,tasks,ideas,events,schedulePrefs,focus:Array.isArray(obj.focus)?obj.focus.filter(id=>tasks.some(t=>t.id===id)):[],dismissed:Array.isArray(obj.dismissed)?obj.dismissed.filter(id=>tasks.some(t=>t.id===id)):[]};
  };
  let data, loadFailed=false;
  try { const stored=localStorage.getItem(KEY); data=stored?normalize(JSON.parse(stored)):normalize({...defaults(),schemaVersion:4}); } catch(err){loadFailed=true;console.warn("Stored data could not be loaded.",err);data=normalize({...defaults(),schemaVersion:4});}
  const state={view:"home",projectId:null,areaId:null,taskFilter:"open",query:""};
  const schedule=window.CommandSchedule.create({getEvents:()=>data.events,updateEvents:(next)=>{data.events=next;save();render();},getSchedulePrefs:()=>data.schedulePrefs,setSchedulePrefs:(value)=>{data.schedulePrefs=value;save();render();},showSheet:(body)=>showSheet(body),closeSheet:()=>closeSheet(),toast:(message)=>toast(message),openSchedule:(scroll=true)=>{state.view="schedule";state.projectId=null;render();if(scroll){screen.scrollTop=0;window.scrollTo({top:0,behavior:"instant"});}}});
  function save(){
    if(loadFailed){alert("Saving is paused to protect unreadable existing data. Import a valid backup to recover.");return false;}
    try{localStorage.setItem(KEY,JSON.stringify(data));return true;}
    catch(err){alert("Could not save on this device. Export a backup before continuing.");console.error(err);return false;}
  }
  // Preserve the exact pre-migration record for recovery, then persist the additive migration.
  const original=localStorage.getItem(KEY);
  if(original){try{if(JSON.parse(original).schemaVersion<5&&!localStorage.getItem('command.pre-v8'))localStorage.setItem('command.pre-v8',original);}catch(err){console.warn('Migration backup unavailable',err);}}
  if(!loadFailed)save();
  else alert("Your saved data could not be read. It has not been replaced. Export or recover your existing data before making changes.");
  let toastTimer;
  function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500);}
  function badge(status){
    const names={active:"Active",waiting:"Waiting",blocked:"Blocked",parked:"Later",done:"Done",open:"Open",in_progress:"In progress"};
    return '<span class="chip '+escapeHtml(status)+'">'+escapeHtml(names[status]||status)+'</span>';
  }
  function projectName(id){return (data.projects.find((p)=>p.id===id)||{}).title||"General";}
  function taskSort(a,b){
    if(a.status==="done" && b.status!=="done")return 1;
    if(b.status==="done" && a.status!=="done")return -1;
    if(a.dueDate && b.dueDate && a.dueDate!==b.dueDate)return a.dueDate.localeCompare(b.dueDate);
    if(a.dueDate && !b.dueDate)return -1;
    if(!a.dueDate && b.dueDate)return 1;
    const order={high:0,medium:1,low:2};return order[a.priority]-order[b.priority];
  }
  function dueText(d){
    if(!d)return "";
    const label=niceDate(d);
    return d<today()?'<span class="priority-high">Overdue · '+escapeHtml(label)+'</span>':"Due "+escapeHtml(label);
  }
  function taskRow(t){
    const done=t.status==="done";
    return '<div class="task-item"><button type="button" class="task-check '+(done?"checked":"")+'" data-action="toggle-task" data-id="'+escapeHtml(t.id)+'" aria-label="'+(done?"Mark incomplete":"Mark complete")+'">'+(done?icon("check"):"")+'</button><div class="task-body"><p class="task-name '+(done?"finished":"")+'">'+escapeHtml(t.title)+'</p><div class="task-info"><span>'+escapeHtml(t.projectId?projectName(t.projectId):areaName(t.areaId))+'</span>'+(t.dueDate?'<span>'+dueText(t.dueDate)+'</span>':"")+(t.priority==="high"&&!done?'<span class="priority-high">High priority</span>':"")+(t.status==="waiting"?'<span>Waiting</span>':"")+(t.status==="blocked"?'<span class="priority-high">Blocked</span>':"")+(t.kind!=="task"?'<span>'+escapeHtml(itemKinds.find(k=>k[0]===t.kind)?.[1]||'Task')+'</span>':'')+(t.needsReview?'<span>Review status</span>':'')+'</div></div><button type="button" class="task-edit" data-action="edit" data-kind="task" data-id="'+escapeHtml(t.id)+'" aria-label="Edit '+escapeHtml(t.title)+'">'+icon("more")+'</button></div>';
  }
  function projectCard(p){
    const open=data.tasks.filter(t=>t.projectId===p.id&&t.status!=="done").length;
    const symbol={Software:"⌘",Education:"◈",Home:"⌂",Finance:"$",Health:"♡",Personal:"•"}[p.category]||"◈";
    return '<button type="button" class="project-card click-card" data-action="project-detail" data-id="'+escapeHtml(p.id)+'"><div class="project-top"><span class="project-emoji">'+escapeHtml(symbol)+'</span>'+badge(p.status)+(p.blocker?' <span class="chip blocked">Blocker</span>':'')+'</div><h3>'+escapeHtml(p.title)+'</h3><p>'+escapeHtml(areaName(p.areaId))+'</p><div class="project-next"><strong>Next</strong> · '+escapeHtml(p.blocker?'Resolve blocker':p.next||'Add a next action')+'</div><div class="card-meta">'+(p.needsReview?'Review status · ':'')+open+' open task'+(open===1?"":"s")+'</div></button>';
  }
  function focusControls(t,index){return '<div class="focus-controls"><button class="button quiet" data-action="unpin" data-id="'+escapeHtml(t.id)+'">Unpin</button>'+(index>0?'<button class="button quiet" data-action="move-pin" data-id="'+escapeHtml(t.id)+'">Move up</button>':'')+'</div>';}
  function home(){
    const pinned=data.focus.map(id=>data.tasks.find(t=>t.id===id)).filter(t=>t&&t.status!=='done');
    const suggested=data.tasks.filter(t=>!t.needsReview&&['open','in_progress'].includes(t.status)&&!data.focus.includes(t.id)&&!data.dismissed.includes(t.id)&&(!t.projectId||data.projects.some(p=>p.id===t.projectId&&!p.needsReview&&p.status==='active'&&!p.blocker))).sort(taskSort).slice(0,3);
    const moving=data.projects.filter(p=>!p.needsReview&&['active','waiting','blocked'].includes(p.status)).slice(0,3);
    return '<div class="page-heading page-heading-actions-only"><button class="button" data-action="quick-add">'+icon('plus')+' Capture</button></div>'+schedule.homeWorkShifts()+
      '<section class="section"><div class="section-head"><h2>Up next</h2><button class="subtle-link" data-action="tab" data-view="tasks">Choose items</button></div>'+ (pinned.length?pinned.map((t,i)=>'<div class="focus-item">'+taskRow(t)+focusControls(t,i)+'</div>').join(''):empty('Your priorities, in your order','Pin an item from an area or accept a suggestion.'))+'</section>'+
      (suggested.length?'<section class="section"><div class="section-head"><h2>Suggestions</h2><span class="muted">Due dates, then priority</span></div>'+suggested.map(t=>'<div class="focus-item">'+taskRow(t)+'<div class="focus-controls"><button class="button secondary" data-action="pin" data-id="'+escapeHtml(t.id)+'">Add to Up next</button><button class="button quiet" data-action="dismiss" data-id="'+escapeHtml(t.id)+'">Dismiss</button></div></div>').join('')+'</section>':'')+
      (moving.length?'<section class="section"><div class="section-head"><h2>Moving forward</h2></div><div class="project-summary-list">'+moving.map(p=>'<button class="project-summary-row" data-action="project-detail" data-id="'+escapeHtml(p.id)+'"><span class="project-summary-name">'+escapeHtml(p.title)+'</span><span class="project-summary-next">'+(p.blocker?'<span class="chip blocked">Blocker</span>':escapeHtml(p.next||'Choose a next step'))+'</span>'+icon('chevron-right','tiny')+'</button>').join('')+'</div></section>':'')+
      '<section class="section coming-up">'+schedule.homeSummary()+data.tasks.filter(t=>t.kind==='followup'&&!t.needsReview&&t.status!=='done'&&t.dueDate&&t.dueDate<=today()).sort(taskSort).slice(0,3).map(taskRow).join('')+'</section>';
  }
  function areas(){
    if(state.areaId)return areaDetail();
    return '<div class="page-heading page-heading-actions-only"><button class="button secondary" data-action="tab" data-view="tasks">All items</button></div><div class="project-grid">'+AREAS.map(([id,name])=>{
      const count=data.projects.filter(p=>p.areaId===id&&p.status!=='done').length;
      const tasks=data.tasks.filter(t=>itemArea(t)===id&&t.status!=='done').length;
      return '<button class="project-card area-card" data-action="area-detail" data-id="'+id+'"><h3>'+escapeHtml(name)+'</h3><p>'+count+' projects · '+tasks+' items</p></button>';
    }).join('')+'</div>';
  }
  function itemArea(t){return data.projects.find(p=>p.id===t.projectId)?.areaId||t.areaId||'';}
  function areaDetail(){
    const ps=data.projects.filter(p=>p.areaId===state.areaId);
    const ts=data.tasks.filter(t=>!t.projectId&&t.areaId===state.areaId).sort(taskSort);
    const items=data.ideas.filter(i=>i.areaId===state.areaId);
    return '<button class="back" data-action="tab" data-view="areas">'+icon('chevron-left')+' Areas</button><div class="page-heading"><h1 class="page-title">'+escapeHtml(areaName(state.areaId))+'</h1><div class="action-row"><button class="button" data-action="edit" data-kind="task">Add item</button><button class="button secondary" data-action="edit" data-kind="project">Add project</button></div></div>'+
    (ps.length?'<section class="section"><h2>Projects</h2><div class="project-grid">'+ps.map(projectCard).join('')+'</div></section>':'')+
    '<section class="section"><h2>Items</h2>'+(ts.length?ts.map(taskRow).join(''):empty('No direct items','Add a task without needing a project.'))+'</section>'+
    '<section class="section"><div class="section-head"><h2>Ideas</h2><button class="subtle-link" data-action="edit" data-kind="idea">Add idea</button></div>'+items.map(i=>'<button class="project-summary-row" data-action="edit" data-kind="idea" data-id="'+escapeHtml(i.id)+'">'+escapeHtml(i.title)+'</button>').join('')+'</section>';
  }
  function inbox(){
    const loose=data.tasks.filter(t=>!t.projectId&&!t.areaId&&t.status!=='done');
    const review=data.tasks.filter(t=>t.needsReview&&t.status!=='done'&&!loose.includes(t));
    const ps=data.projects.filter(p=>p.needsReview||!p.areaId);
    return '<div class="page-heading page-heading-actions-only"><button class="button" data-action="quick-add">'+icon('plus')+' Capture</button></div><section class="section">'+(loose.length?loose.map(taskRow).join(''):empty('Nothing to organize','New captures appear here.'))+'</section>'+
    ((review.length||ps.length)?'<section class="section"><h2>Review existing entries</h2><p class="page-description">Older entries are preserved. Open each one and confirm its status before it becomes a suggestion.</p><div class="project-grid">'+ps.map(projectCard).join('')+'</div>'+review.map(taskRow).join('')+'</section>':'')+
    '<section class="section"><div class="section-head"><h2>Ideas</h2><button class="subtle-link" data-action="open-ideas">All ideas</button></div>'+data.ideas.filter(i=>!i.areaId).map(i=>'<button class="project-summary-row" data-action="edit" data-kind="idea" data-id="'+escapeHtml(i.id)+'">'+escapeHtml(i.title)+'</button>').join('')+'</section>'+
    '<button class="button quiet" data-action="restore-suggestions">Restore dismissed suggestions</button>';
  }
  function quickAdd(){showSheet('<div class="sheet-head"><h2 class="sheet-title">Capture</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+icon('x')+'</button></div><form id="capture-form">'+textField('What’s on your mind?','title','',true)+'<button class="button" type="submit">Add to Inbox</button></form>');$('#field-title')?.focus();}
  function empty(title,detail){return '<div class="empty"><strong>'+escapeHtml(title)+'</strong><p>'+escapeHtml(detail)+'</p></div>';}
  function projects(){
    return '<div class="page-heading"><div><h1 class="page-title">Projects</h1></div><div class="action-row"><button class="button secondary" data-action="open-ideas">'+icon("bulb")+' Ideas</button><button class="button" data-action="edit" data-kind="project">'+icon("plus")+' Add</button></div></div>'+
    (data.projects.length?'<div class="project-grid">'+[...data.projects].sort((a,b)=>({active:0,waiting:1,blocked:2,parked:3,done:4}[a.status]-{active:0,waiting:1,blocked:2,parked:3,done:4}[b.status])).map(projectCard).join("")+'</div>':empty("No projects","Add your first project."));
  }
  function projectDetail(){
    const p=data.projects.find(q=>q.id===state.projectId);if(!p){state.projectId=null;return projects();}
    const tasks=data.tasks.filter(t=>t.projectId===p.id).sort(taskSort);
    return '<button class="back" data-action="close-project">'+icon("chevron-left","tiny")+' Areas</button>'+
      '<div class="detail-panel"><div class="card-row"><span class="small-label">'+escapeHtml(p.category||"Project")+'</span>'+badge(p.status)+'</div><h1 class="detail-title">'+escapeHtml(p.title)+'</h1>'+
      (p.description?'<p class="card-desc">'+escapeHtml(p.description)+'</p>':"")+
      '<div class="detail-section"><div class="next-banner"><div class="small-label">NEXT STEP</div><p>'+escapeHtml(p.next||"No next step yet.")+'</p></div></div>'+
      (p.blocker?'<div class="detail-section blocker-detail"><h3>Blocker</h3><p>'+escapeHtml(p.blocker)+'</p></div>':'')+(p.needsReview?'<div class="detail-section"><p>Review this project’s status before adding it to Home.</p><button class="button secondary" data-action="review-project" data-id="'+escapeHtml(p.id)+'">Confirm current status</button></div>':'')+(p.reviewDate?'<div class="detail-section"><h3>Review date</h3><p>'+escapeHtml(niceDate(p.reviewDate))+'</p></div>':"")+
      '<div class="detail-section action-row"><button class="button secondary" data-action="edit" data-kind="project" data-id="'+escapeHtml(p.id)+'">'+icon("edit")+' Edit project</button><button class="button" data-action="edit" data-kind="task" data-project="'+escapeHtml(p.id)+'">'+icon("plus")+' New task</button></div></div>'+
      '<section class="section"><div class="section-head"><h2>Project tasks</h2><span class="muted">'+tasks.filter(t=>t.status!=="done").length+' remaining</span></div>'+
      (tasks.length?'<div class="task-list">'+tasks.map(taskRow).join("")+'</div>':empty("No tasks yet","Add concrete actions to move this project forward."))+'</section>';
  }
  function filteredTasks(){
    return data.tasks.filter((t)=>{
      if(state.taskFilter==="open"&&t.status==="done")return false;
      if(state.taskFilter==="done"&&t.status!=="done")return false;
      const q=state.query.trim().toLowerCase();
      return !q || (t.title+" "+t.notes+" "+projectName(t.projectId)).toLowerCase().includes(q);
    }).sort(taskSort);
  }
  function tasks(){
    return '<div class="page-heading"><div><p class="eyebrow">Things to finish</p><h1 class="page-title">Tasks</h1><p class="description">Small steps across every project.</p></div><button class="button" data-action="edit" data-kind="task">'+icon("plus")+' Add</button></div>'+
      '<input class="search" id="task-search" type="search" placeholder="Search tasks" value="'+escapeHtml(state.query)+'" aria-label="Search tasks">'+
      '<div class="filter-bar">'+["open","all","done"].map(f=>'<button class="filter '+(state.taskFilter===f?"selected":"")+'" data-action="task-filter" data-filter="'+f+'">'+({open:"Open",all:"All",done:"Done"}[f])+'</button>').join("")+'</div>'+
      '<div id="task-results">'+taskResults()+'</div>';
  }
  function taskResults(){const all=filteredTasks();return all.length?'<div class="task-list">'+all.map(taskRow).join("")+'</div>':empty("No matching tasks","Try a different filter or add something new.");}
  function ideas(){
    return '<button class="back" data-action="tab" data-view="areas">'+icon("chevron-left","tiny")+' Projects</button><div class="page-heading"><div><h1 class="page-title">Ideas</h1></div><button class="button" data-action="edit" data-kind="idea">'+icon("plus")+' Add</button></div>'+
      (data.ideas.length?data.ideas.map(i=>'<div class="card"><div class="idea-card"><div class="idea-symbol">'+icon("bulb")+'</div><div style="flex:1;min-width:0"><div class="card-row"><h2 class="card-title">'+escapeHtml(i.title)+'</h2><button class="task-edit" data-action="edit" data-kind="idea" data-id="'+escapeHtml(i.id)+'" aria-label="Edit idea">'+icon("more")+'</button></div><p class="card-desc">'+escapeHtml(i.description||"No details yet.")+'</p><button class="subtle-link" style="margin-top:10px" data-action="promote-idea" data-id="'+escapeHtml(i.id)+'">Turn into project '+icon("arrow","tiny")+'</button></div></div></div>').join(""):empty("No saved ideas","Save an idea here when it's not a priority yet."));
  }
  function render(){
    $(".tabbar").querySelectorAll(".tab").forEach(btn=>{const selected=btn.dataset.view===(['ideas','tasks','projects'].includes(state.view)?'areas':state.view);btn.classList.toggle("active",selected);btn.setAttribute("aria-current",selected?"page":"false");});
    screen.innerHTML=state.projectId?projectDetail():state.view==='areas'?areas():state.view==='inbox'?inbox():state.view==="home"?home():state.view==="schedule"?schedule.render():state.view==="projects"?(state.projectId?projectDetail():projects()):state.view==="tasks"?tasks():ideas();
  }
  const opt=(value,label,selected)=>'<option value="'+escapeHtml(value)+'" '+(value===selected?"selected":"")+'>'+escapeHtml(label)+'</option>';
  function textField(label,name,value,required=false,type="text"){
    return '<div class="field"><label for="field-'+name+'">'+label+'</label><input id="field-'+name+'" name="'+name+'" type="'+type+'" value="'+escapeHtml(value||"")+'" '+(required?"required":"")+'></div>';
  }
  function selectField(label,name,values,selected){
    return '<div class="field"><label for="field-'+name+'">'+label+'</label><select id="field-'+name+'" name="'+name+'">'+values.map(v=>opt(v[0],v[1],selected)).join("")+'</select></div>';
  }
  function areaField(label,name,value){
    return '<div class="field"><label for="field-'+name+'">'+label+'</label><textarea id="field-'+name+'" name="'+name+'" rows="3">'+escapeHtml(value||"")+'</textarea></div>';
  }
  function openEditor(kind,id,contextProject=""){
    const collection=kind==="project"?"projects":kind==="task"?"tasks":"ideas";
    const item=data[collection].find(v=>v.id===id)||{};
    let body="";
    if(kind==="project"){
      body=textField("Project name","title",item.title,true)+
      '<div class="form-grid">'+selectField("Status","status",[["active","Active"],["waiting","Waiting"],["blocked","Blocked"],["parked","Later"],["done","Done"]],item.status||"active")+
      selectField("Area","areaId",[["","Inbox"],...AREAS],item.areaId||state.areaId||"")+'</div>'+
      areaField("What is this project?","description",item.description)+areaField("Next concrete step","next",item.next)+areaField("Blocker (optional; shown only inside project)","blocker",item.blocker)+textField("Review on (optional)","reviewDate",item.reviewDate,false,"date");
    } else if(kind==="task"){
      body=textField("What needs to be done?","title",item.title,true)+
      selectField("Kind","itemKind",itemKinds,item.kind||"task")+selectField("Area (when no project)","areaId",[["","Inbox"],...AREAS],item.areaId||state.areaId||"")+selectField("Project","projectId",[["","General / no project"],...data.projects.map(p=>[p.id,p.title])],item.projectId||contextProject)+
      '<div class="form-grid">'+selectField("Status","status",[["open","Open"],["in_progress","In progress"],["waiting","Waiting"],["blocked","Blocked"],["done","Done"]],item.status||"open")+
      selectField("Priority","priority",[["high","High"],["medium","Medium"],["low","Low"]],item.priority||"medium")+'</div>'+
      textField("Due / follow-up date (optional)","dueDate",item.dueDate,false,"date")+areaField("Notes","notes",item.notes)+selectField("Show in Up next","pinned",[["no","Not pinned"],["yes","Pinned"]],data.focus.includes(id)?"yes":"no");
    } else {
      body=textField("Idea name","title",item.title,true)+areaField("Notes","description",item.description)+selectField("Area","areaId",[["","Inbox"],...AREAS],item.areaId||state.areaId||"");
    }
    const label=kind.charAt(0).toUpperCase()+kind.slice(1);
    showSheet('<div class="sheet-head"><h2 class="sheet-title">'+(id?"Edit ":"New ")+label.toLowerCase()+'</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+icon("x")+'</button></div>'+
      '<form id="editor-form" data-kind="'+kind+'" data-id="'+escapeHtml(id||"")+'">'+body+
      '<div class="sheet-actions">'+(id?'<button type="button" class="button danger" data-action="delete" data-kind="'+kind+'" data-id="'+escapeHtml(id)+'">'+icon("trash")+' Delete</button>':'<span></span>')+
      '<button type="submit" class="button">'+icon("check")+' Save '+label.toLowerCase()+'</button></div></form>');
    setTimeout(()=>{$("#field-title")?.focus();},30);
  }
  function showSheet(content){overlay.innerHTML='<div class="overlay" data-action="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="Command editor">'+content+'</div></div>';document.body.style.overflow="hidden";}
  function closeSheet(){overlay.innerHTML="";document.body.style.overflow="";if(window.__commandUpdatePending){window.__commandUpdatePending=false;window.location.reload();}}
  function settings(){
    showSheet('<div class="sheet-head"><h2 class="sheet-title">Settings & backup</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+icon("x")+'</button></div>'+
      '<div class="settings-group"><h3>Storage</h3><p>Command currently saves locally. Google sign-in and synchronization are planned but are not active yet. Export a backup before clearing app data.</p></div>'+
      '<div class="settings-group"><h3>Back up your data</h3><p>Export a JSON file before switching phones, clearing browser data, or making significant changes.</p><button class="button" data-action="export">'+icon("download")+' Export backup</button><button class="button secondary" data-action="import">'+icon("upload")+' Import backup</button></div>'+
      '<div class="settings-group"><h3>Reset starter data</h3><p>Replace your local data with the original starter projects. Export first if you want to keep your current work.</p><button class="button danger" data-action="reset">'+icon("trash")+' Reset data</button></div>'+
      '<details class="settings-group"><summary>Display diagnostics</summary><p>For troubleshooting the iPhone Home Screen layout.</p><button class="button secondary" data-action="display-diagnostics">Copy display details</button></details>'+ 
      '<div class="settings-group"><h3>About</h3><p>Command v'+APP_VERSION+' · Local storage with backup export; account sync not configured.</p></div>');
  }
  function exportData(){
    const text=JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);
    const blob=new Blob([text],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="command-backup-"+today()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Backup file created");
  }
  function resetPageScroll(){
    if(screen.scrollTo)screen.scrollTo({top:0,behavior:"instant"});
    else screen.scrollTop=0;
    window.scrollTo({top:0,behavior:"instant"});
  }
  function switchTab(view){state.view=view;state.projectId=null;state.areaId=null;render();resetPageScroll();}
  document.addEventListener("click",(event)=>{
    const button=event.target.closest("[data-action]");if(!button)return;
    const action=button.dataset.action,id=button.dataset.id,kind=button.dataset.kind;
    if(schedule.handleAction(button))return;
    if(action==='display-diagnostics'){
      const bar=document.querySelector(".tabbar"),shell=document.querySelector(".app-shell");
      const rect=bar?.getBoundingClientRect();
      const details={
        version:APP_VERSION,standalone:navigator.standalone===true||matchMedia("(display-mode: standalone)").matches,
        screenHeight:window.screen.height,innerHeight:window.innerHeight,
        documentHeight:document.documentElement.clientHeight,
        visualHeight:window.visualViewport?.height??null,
        visualTop:window.visualViewport?.offsetTop??null,
        visualScale:window.visualViewport?.scale??null,
        shellHeight:shell?getComputedStyle(shell).height:null,
        navPosition:bar?getComputedStyle(bar).position:null,
        navTop:rect?Math.round(rect.top):null,navBottom:rect?Math.round(rect.bottom):null,
        safeTop:getComputedStyle(document.documentElement).getPropertyValue("--safe-top-debug").trim(),
        safeBottom:getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom-debug").trim()
      };
      const report=JSON.stringify(details,null,2);
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(report).then(()=>toast("Display details copied")).catch(()=>alert(report));
      else alert(report);
      return;
    }
    if(action==='quick-add'){quickAdd();return;}
    if(action==='area-detail'){state.areaId=id;state.projectId=null;state.view='areas';render();resetPageScroll();return;}
    if(action==='review-project'){const p=data.projects.find(p=>p.id===id);if(p)p.needsReview=false;save();render();return;}
    if(['pin','unpin','dismiss','move-pin','restore-suggestions'].includes(action)){
      if(action==='pin'){if(!data.focus.includes(id))data.focus.push(id);data.dismissed=data.dismissed.filter(x=>x!==id);}
      if(action==='unpin')data.focus=data.focus.filter(x=>x!==id);
      if(action==='dismiss'&&!data.dismissed.includes(id))data.dismissed.push(id);
      if(action==='move-pin'){const i=data.focus.indexOf(id);if(i>0)[data.focus[i-1],data.focus[i]]=[data.focus[i],data.focus[i-1]];}
      if(action==='restore-suggestions')data.dismissed=[];
      save();closeSheet();render();toast(action==='pin'?'Added to Up next':'Updated');return;
    }
    if(action==="open-ideas"){switchTab("ideas");return;}
    if(action==="backdrop"){if(event.target===button)closeSheet();return;}
    if(action==="tab"){closeSheet();switchTab(button.dataset.view);return;}
    if(action==="settings"){settings();return;}
    if(action==="close-modal"){closeSheet();return;}
    if(action==="edit"){openEditor(kind,id,button.dataset.project||"");return;}
    if(action==="project-detail"){state.projectId=id;state.view="areas";render();resetPageScroll();return;}
    if(action==="close-project"){state.projectId=null;state.view="areas";render();return;}
    if(action==="task-filter"){state.taskFilter=button.dataset.filter;render();return;}
    if(action==="toggle-task"){const task=data.tasks.find(t=>t.id===id);if(task){task.status=task.status==="done"?"open":"done";save();render();toast(task.status==="done"?"Task completed":"Task reopened");}return;}
    if(action==="promote-idea"){
      const idea=data.ideas.find(i=>i.id===id);if(!idea)return;
      data.projects.unshift({id:uid(),title:idea.title,category:"Personal",areaId:idea.areaId||"personal",blocker:"",needsReview:false,status:"active",description:idea.description,next:"Choose the first concrete step.",reviewDate:"",updatedAt:today()});
      data.ideas=data.ideas.filter(i=>i.id!==id);save();switchTab("areas");toast("Idea moved to projects");return;
    }
    if(action==="delete"){
      const names={task:"task",project:"project",idea:"idea"};if(!confirm("Delete this "+names[kind]+"? This cannot be undone."))return;
      const collection={task:"tasks",project:"projects",idea:"ideas"}[kind];
      if(kind==="project"){data.tasks=data.tasks.map(t=>t.projectId===id?{...t,projectId:""}:t);state.projectId=null;}
      data[collection]=data[collection].filter(x=>x.id!==id);
      save();closeSheet();render();toast("Deleted");return;
    }
    if(action==="export"){exportData();return;}
    if(action==="import"){importInput.click();return;}
    if(action==="reset"){if(confirm("Reset ALL data on this device to the starter list? Export a backup first. This cannot be undone.")){data=normalize({...defaults(),schemaVersion:4});save();closeSheet();switchTab("home");toast("Starter data restored");}return;}
  });
  document.addEventListener("change",(event)=>{schedule.handleInput(event.target);});
  document.addEventListener("input",(event)=>{
    if(event.target.id==="task-search"){state.query=event.target.value;const results=$("#task-results");if(results)results.innerHTML=taskResults();}
  });
  document.addEventListener("submit",(event)=>{
    if(event.target.id==='capture-form'){event.preventDefault();const title=new FormData(event.target).get('title')?.trim();if(!title)return;data.tasks.unshift({id:uid(),title,projectId:'',areaId:'',kind:'task',status:'open',priority:'medium',dueDate:'',notes:'',needsReview:false});if(save()){closeSheet();render();toast('Added to Inbox');}return;}
    if(event.target.id==="schedule-event-form"||event.target.id==="schedule-import-form"){event.preventDefault();schedule.handleSubmit(event.target);return;}
    if(event.target.id!=="editor-form")return;event.preventDefault();
    const form=event.target,kind=form.dataset.kind,id=form.dataset.id;
    const values=Object.fromEntries(new FormData(form).entries());
    const title=(values.title||"").trim();if(!title){alert("Please enter a title.");return;}
    const collection={task:"tasks",project:"projects",idea:"ideas"}[kind];
    const previous=data[collection].find(v=>v.id===id);
    let item;
    if(kind==="project")item={...previous,id:id||uid(),title,areaId:validArea(values.areaId),blocker:(values.blocker||"").trim(),needsReview:false,category:previous?.category||"",status:values.status,description:(values.description||"").trim(),next:(values.next||"").trim(),reviewDate:values.reviewDate,updatedAt:today()};
    if(kind==="task")item={...previous,id:id||uid(),title,areaId:validArea(values.areaId),kind:values.itemKind,needsReview:false,projectId:values.projectId,status:values.status,priority:values.priority,dueDate:values.dueDate,notes:(values.notes||"").trim()};
    if(kind==="idea")item={...previous,id:id||uid(),title,areaId:validArea(values.areaId),description:(values.description||"").trim(),createdAt:previous?.createdAt||today()};
    if(previous)data[collection]=data[collection].map(v=>v.id===id?item:v);
    else data[collection].unshift(item);
    if(kind==='task'){if(values.pinned==='yes'){if(!data.focus.includes(item.id))data.focus.push(item.id);}else data.focus=data.focus.filter(x=>x!==item.id);}
    if(save()){closeSheet();render();toast(previous?"Changes saved":"Added successfully");}
  });
  importInput.addEventListener("change",async(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error("File is too large (5 MB maximum).");
      const incoming=JSON.parse(await file.text());
      const restored=normalize(incoming);
      if(!Array.isArray(incoming.events) && data.events.length){
        if(confirm("This older backup has no calendar events. Keep your "+data.events.length+" existing events?")){
          restored.events=data.events;
        }
      }
      if(!confirm("Replace ALL other current data with this backup? It includes "+restored.projects.length+" projects, "+restored.tasks.length+" tasks, "+restored.ideas.length+" ideas, and "+restored.events.length+" calendar events. Export a backup first."))return;
      data=restored;loadFailed=false;if(save()){closeSheet();switchTab("home");toast("Backup imported");}
    }catch(err){alert("Could not import: "+err.message);}
    finally{event.target.value="";}
  });
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&overlay.firstChild)closeSheet();});
  render();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(overlay.firstElementChild){window.__commandUpdatePending=true;toast("App update ready — finish editing to reload");}
      else window.location.reload();
    });
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"})
      .then(registration=>registration.update().catch(()=>{}))
      .catch(err=>console.warn("Offline cache unavailable",err)));
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible")navigator.serviceWorker.getRegistration()
        .then(registration=>registration?.update()).catch(()=>{});
    });
  }
})();