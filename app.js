(function app(){
  "use strict";
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
  const defaults = () => ({
    schemaVersion:2,
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
      return {id,title:cleanText(p.title)||"Untitled project",category:cleanText(p.category),status:["active","waiting","blocked","parked","done"].includes(p.status)?p.status:"active",description:cleanText(p.description),next:cleanText(p.next),reviewDate:cleanText(p.reviewDate),updatedAt:cleanText(p.updatedAt)};
    });
    const tasks=obj.tasks.slice(0,2500).map((t)=>({id:cleanText(t.id)||uid(),title:cleanText(t.title)||"Untitled task",projectId:projectIds.has(t.projectId)?t.projectId:"",status:["open","in_progress","waiting","blocked","done"].includes(t.status)?t.status:"open",priority:["high","medium","low"].includes(t.priority)?t.priority:"medium",dueDate:cleanText(t.dueDate),notes:cleanText(t.notes)}));
    const ideas=obj.ideas.slice(0,1000).map((i)=>({id:cleanText(i.id)||uid(),title:cleanText(i.title)||"Untitled idea",description:cleanText(i.description),createdAt:cleanText(i.createdAt)}));
    const events=(Array.isArray(obj.events)?obj.events:[]).slice(0,4000).filter(e=>e&&typeof e==="object").map(e=>window.CommandSchedule.validate(e)).filter(e=>e.date);
    return {schemaVersion:2,projects,tasks,ideas,events};
  };
  let data;
  try { const stored=localStorage.getItem(KEY); data=stored?normalize(JSON.parse(stored)):defaults(); } catch(err){console.warn("Stored data could not be loaded.",err);data=defaults();}
  const state={view:"home",projectId:null,taskFilter:"open",query:""};
  const schedule=window.CommandSchedule.create({getEvents:()=>data.events,updateEvents:(next)=>{data.events=next;save();render();},showSheet:(body)=>showSheet(body),closeSheet:()=>closeSheet(),toast:(message)=>toast(message),openSchedule:(scroll=true)=>{state.view="schedule";state.projectId=null;render();if(scroll)window.scrollTo({top:0,behavior:"instant"});}});
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(data));return true;}
    catch(err){alert("Could not save on this device. Export a backup before continuing.");console.error(err);return false;}
  }
  if(!localStorage.getItem(KEY))save();
  let toastTimer;
  function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500);}
  function badge(status){
    const names={active:"Active",waiting:"Waiting",blocked:"Blocked",parked:"Parked",done:"Done",open:"Open",in_progress:"In progress"};
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
    return '<div class="task-item"><button type="button" class="task-check '+(done?"checked":"")+'" data-action="toggle-task" data-id="'+escapeHtml(t.id)+'" aria-label="'+(done?"Mark incomplete":"Mark complete")+'">'+(done?icon("check"):"")+'</button><div class="task-body"><p class="task-name '+(done?"finished":"")+'">'+escapeHtml(t.title)+'</p><div class="task-info"><span>'+escapeHtml(projectName(t.projectId))+'</span>'+(t.dueDate?'<span>'+dueText(t.dueDate)+'</span>':"")+(t.priority==="high"&&!done?'<span class="priority-high">High priority</span>':"")+(t.status==="waiting"?'<span>Waiting</span>':"")+(t.status==="blocked"?'<span class="priority-high">Blocked</span>':"")+'</div></div><button type="button" class="task-edit" data-action="edit" data-kind="task" data-id="'+escapeHtml(t.id)+'" aria-label="Edit '+escapeHtml(t.title)+'">'+icon("more")+'</button></div>';
  }
  function projectCard(p){
    const open=data.tasks.filter(t=>t.projectId===p.id&&t.status!=="done").length;
    const symbol={Software:"⌘",Education:"◈",Home:"⌂",Finance:"$",Health:"♡",Personal:"•"}[p.category]||"◈";
    return '<button type="button" class="project-card click-card" data-action="project-detail" data-id="'+escapeHtml(p.id)+'"><div class="project-top"><span class="project-emoji">'+escapeHtml(symbol)+'</span>'+badge(p.status)+'</div><h3>'+escapeHtml(p.title)+'</h3><p>'+escapeHtml(p.description||p.category||"No description yet")+'</p><div class="project-next"><strong>Next</strong> · '+escapeHtml(p.next||"Add a next action")+'</div><div class="card-meta">'+open+' open task'+(open===1?"":"s")+'</div></button>';
  }
  function home(){
    const remaining=data.tasks.filter(t=>t.status!=="done").sort(taskSort);
    const active=data.projects.filter(p=>p.status==="active");
    const todayHeader=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    return '<p class="eyebrow">'+escapeHtml(todayHeader)+'</p><h1 class="page-title">Overview</h1>'+
      schedule.homeSummary()+
      '<section class="section"><div class="section-head"><h2>Needs attention</h2><button class="subtle-link" data-action="tab" data-view="tasks">All tasks '+icon("arrow","tiny")+'</button></div>'+
      (remaining.length?'<div class="task-list">'+remaining.slice(0,3).map(taskRow).join("")+'</div>':empty("All caught up","No open tasks."))+'</section>'+
      '<section class="section"><div class="section-head"><h2>Projects</h2><button class="subtle-link" data-action="tab" data-view="projects">All projects '+icon("arrow","tiny")+'</button></div>'+
      (active.length?'<div class="project-summary-list">'+active.slice(0,4).map(p=>'<button data-action="project-detail" data-id="'+escapeHtml(p.id)+'" class="project-summary-row"><span class="project-summary-name">'+escapeHtml(p.title)+'</span><span class="project-summary-next">'+escapeHtml(p.next||"No next step yet")+'</span>'+icon("chevron-right","tiny")+'</button>').join("")+'</div>':empty("No active projects","Add a project when there's something to track."))+'</section>';
  }
  function empty(title,detail){return '<div class="empty"><strong>'+escapeHtml(title)+'</strong><p>'+escapeHtml(detail)+'</p></div>';}
  function projects(){
    return '<div class="page-heading"><div><h1 class="page-title">Projects</h1></div><div class="action-row"><button class="button secondary" data-action="open-ideas">'+icon("bulb")+' Ideas</button><button class="button" data-action="edit" data-kind="project">'+icon("plus")+' Add</button></div></div>'+
    (data.projects.length?'<div class="project-grid">'+[...data.projects].sort((a,b)=>({active:0,waiting:1,blocked:2,parked:3,done:4}[a.status]-{active:0,waiting:1,blocked:2,parked:3,done:4}[b.status])).map(projectCard).join("")+'</div>':empty("No projects","Add your first project."));
  }
  function projectDetail(){
    const p=data.projects.find(q=>q.id===state.projectId);if(!p){state.projectId=null;return projects();}
    const tasks=data.tasks.filter(t=>t.projectId===p.id).sort(taskSort);
    return '<button class="back" data-action="close-project">'+icon("chevron-left","tiny")+' Projects</button>'+
      '<div class="detail-panel"><div class="card-row"><span class="small-label">'+escapeHtml(p.category||"Project")+'</span>'+badge(p.status)+'</div><h1 class="detail-title">'+escapeHtml(p.title)+'</h1>'+
      (p.description?'<p class="card-desc">'+escapeHtml(p.description)+'</p>':"")+
      '<div class="detail-section"><div class="next-banner"><div class="small-label">NEXT STEP</div><p>'+escapeHtml(p.next||"No next step yet.")+'</p></div></div>'+
      (p.reviewDate?'<div class="detail-section"><h3>Review date</h3><p>'+escapeHtml(niceDate(p.reviewDate))+'</p></div>':"")+
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
    return '<button class="back" data-action="tab" data-view="projects">'+icon("chevron-left","tiny")+' Projects</button><div class="page-heading"><div><h1 class="page-title">Ideas</h1></div><button class="button" data-action="edit" data-kind="idea">'+icon("plus")+' Add</button></div>'+
      (data.ideas.length?data.ideas.map(i=>'<div class="card"><div class="idea-card"><div class="idea-symbol">'+icon("bulb")+'</div><div style="flex:1;min-width:0"><div class="card-row"><h2 class="card-title">'+escapeHtml(i.title)+'</h2><button class="task-edit" data-action="edit" data-kind="idea" data-id="'+escapeHtml(i.id)+'" aria-label="Edit idea">'+icon("more")+'</button></div><p class="card-desc">'+escapeHtml(i.description||"No details yet.")+'</p><button class="subtle-link" style="margin-top:10px" data-action="promote-idea" data-id="'+escapeHtml(i.id)+'">Turn into project '+icon("arrow","tiny")+'</button></div></div></div>').join(""):empty("No saved ideas","Save an idea here when it's not a priority yet."));
  }
  function render(){
    $(".tabbar").querySelectorAll(".tab").forEach(btn=>{const selected=btn.dataset.view===(state.view==="ideas"?"projects":state.view);btn.classList.toggle("active",selected);btn.setAttribute("aria-current",selected?"page":"false");});
    screen.innerHTML=state.view==="home"?home():state.view==="schedule"?schedule.render():state.view==="projects"?(state.projectId?projectDetail():projects()):state.view==="tasks"?tasks():ideas();
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
      '<div class="form-grid">'+selectField("Status","status",[["active","Active"],["waiting","Waiting"],["blocked","Blocked"],["parked","Parked"],["done","Done"]],item.status||"active")+
      selectField("Category","category",[["Software","Software"],["Education","Education"],["Home","Home"],["Finance","Finance"],["Health","Health"],["Personal","Personal"],["Other","Other"]],item.category||"Personal")+'</div>'+
      areaField("What is this project?","description",item.description)+areaField("Next concrete step","next",item.next)+textField("Review on (optional)","reviewDate",item.reviewDate,false,"date");
    } else if(kind==="task"){
      body=textField("What needs to be done?","title",item.title,true)+
      selectField("Project","projectId",[["","General / no project"],...data.projects.map(p=>[p.id,p.title])],item.projectId||contextProject)+
      '<div class="form-grid">'+selectField("Status","status",[["open","Open"],["in_progress","In progress"],["waiting","Waiting"],["blocked","Blocked"],["done","Done"]],item.status||"open")+
      selectField("Priority","priority",[["high","High"],["medium","Medium"],["low","Low"]],item.priority||"medium")+'</div>'+
      textField("Due date (optional)","dueDate",item.dueDate,false,"date")+areaField("Notes","notes",item.notes);
    } else {
      body=textField("Idea name","title",item.title,true)+areaField("Notes","description",item.description);
    }
    const label=kind.charAt(0).toUpperCase()+kind.slice(1);
    showSheet('<div class="sheet-head"><h2 class="sheet-title">'+(id?"Edit ":"New ")+label.toLowerCase()+'</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+icon("x")+'</button></div>'+
      '<form id="editor-form" data-kind="'+kind+'" data-id="'+escapeHtml(id||"")+'">'+body+
      '<div class="sheet-actions">'+(id?'<button type="button" class="button danger" data-action="delete" data-kind="'+kind+'" data-id="'+escapeHtml(id)+'">'+icon("trash")+' Delete</button>':'<span></span>')+
      '<button type="submit" class="button">'+icon("check")+' Save '+label.toLowerCase()+'</button></div></form>');
    setTimeout(()=>{$("#field-title")?.focus();},30);
  }
  function showSheet(content){overlay.innerHTML='<div class="overlay" data-action="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="Command editor">'+content+'</div></div>';document.body.style.overflow="hidden";}
  function closeSheet(){overlay.innerHTML="";document.body.style.overflow="";}
  function settings(){
    showSheet('<div class="sheet-head"><h2 class="sheet-title">Settings & backup</h2><button class="icon-button" data-action="close-modal" aria-label="Close">'+icon("x")+'</button></div>'+
      '<div class="settings-group"><h3>Saved on this device</h3><p>Everything is stored in this browser. There is no account or cloud synchronization yet. Clearing browser website data can erase your changes.</p></div>'+
      '<div class="settings-group"><h3>Back up your data</h3><p>Export a JSON file before switching phones, clearing browser data, or making significant changes.</p><button class="button" data-action="export">'+icon("download")+' Export backup</button><button class="button secondary" data-action="import">'+icon("upload")+' Import backup</button></div>'+
      '<div class="settings-group"><h3>Reset starter data</h3><p>Replace your local data with the original starter projects. Export first if you want to keep your current work.</p><button class="button danger" data-action="reset">'+icon("trash")+' Reset data</button></div>'+
      '<div class="settings-group"><h3>About</h3><p>Command v2 · Projects and calendar. Local storage only; no account sync. Screenshot recognition happens in your browser.</p></div>');
  }
  function exportData(){
    const text=JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);
    const blob=new Blob([text],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="command-backup-"+today()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Backup file created");
  }
  function switchTab(view){state.view=view;state.projectId=null;render();window.scrollTo({top:0,behavior:"instant"});}
  document.addEventListener("click",(event)=>{
    const button=event.target.closest("[data-action]");if(!button)return;
    const action=button.dataset.action,id=button.dataset.id,kind=button.dataset.kind;
    if(schedule.handleAction(button))return;
    if(action==="open-ideas"){switchTab("ideas");return;}
    if(action==="backdrop"){if(event.target===button)closeSheet();return;}
    if(action==="tab"){closeSheet();switchTab(button.dataset.view);return;}
    if(action==="settings"){settings();return;}
    if(action==="close-modal"){closeSheet();return;}
    if(action==="edit"){openEditor(kind,id,button.dataset.project||"");return;}
    if(action==="project-detail"){state.projectId=id;state.view="projects";render();window.scrollTo({top:0,behavior:"instant"});return;}
    if(action==="close-project"){state.projectId=null;render();return;}
    if(action==="task-filter"){state.taskFilter=button.dataset.filter;render();return;}
    if(action==="toggle-task"){const task=data.tasks.find(t=>t.id===id);if(task){task.status=task.status==="done"?"open":"done";save();render();toast(task.status==="done"?"Task completed":"Task reopened");}return;}
    if(action==="promote-idea"){
      const idea=data.ideas.find(i=>i.id===id);if(!idea)return;
      data.projects.unshift({id:uid(),title:idea.title,category:"Personal",status:"active",description:idea.description,next:"Choose the first concrete step.",reviewDate:"",updatedAt:today()});
      data.ideas=data.ideas.filter(i=>i.id!==id);save();switchTab("projects");toast("Idea moved to projects");return;
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
    if(action==="reset"){if(confirm("Reset ALL data on this device to the starter list? Export a backup first. This cannot be undone.")){data=defaults();save();closeSheet();switchTab("home");toast("Starter data restored");}return;}
  });
  document.addEventListener("change",(event)=>{schedule.handleInput(event.target);});
  document.addEventListener("input",(event)=>{
    if(event.target.id==="task-search"){state.query=event.target.value;const results=$("#task-results");if(results)results.innerHTML=taskResults();}
  });
  document.addEventListener("submit",(event)=>{
    if(event.target.id==="schedule-event-form"||event.target.id==="schedule-import-form"){event.preventDefault();schedule.handleSubmit(event.target);return;}
    if(event.target.id!=="editor-form")return;event.preventDefault();
    const form=event.target,kind=form.dataset.kind,id=form.dataset.id;
    const values=Object.fromEntries(new FormData(form).entries());
    const title=(values.title||"").trim();if(!title){alert("Please enter a title.");return;}
    const collection={task:"tasks",project:"projects",idea:"ideas"}[kind];
    const previous=data[collection].find(v=>v.id===id);
    let item;
    if(kind==="project")item={id:id||uid(),title,category:values.category,status:values.status,description:(values.description||"").trim(),next:(values.next||"").trim(),reviewDate:values.reviewDate,updatedAt:today()};
    if(kind==="task")item={id:id||uid(),title,projectId:values.projectId,status:values.status,priority:values.priority,dueDate:values.dueDate,notes:(values.notes||"").trim()};
    if(kind==="idea")item={id:id||uid(),title,description:(values.description||"").trim(),createdAt:previous?.createdAt||today()};
    if(previous)data[collection]=data[collection].map(v=>v.id===id?item:v);
    else data[collection].unshift(item);
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
      data=restored;if(save()){closeSheet();switchTab("home");toast("Backup imported");}
    }catch(err){alert("Could not import: "+err.message);}
    finally{event.target.value="";}
  });
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&overlay.firstChild)closeSheet();});
  render();
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch((err)=>console.warn("Offline cache unavailable",err)));
})();