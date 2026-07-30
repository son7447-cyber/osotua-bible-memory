const sb=window.supabase.createClient(OSOTUA_CONFIG.supabaseUrl,OSOTUA_CONFIG.supabaseKey);
const $=id=>document.getElementById(id);

let participants=[],participantMap=new Map();
let settings=null,currentDay=1,currentContent=null,currentLanguage="maa";
let mediaRecorder=null,stream=null,chunks=[],audioBlob=null,timerId=null,seconds=0;
let deferredInstallPrompt=null;

function cacheSet(key,value){
  localStorage.setItem(`osotua_${OSOTUA_CONFIG.cacheVersion}_${key}`,JSON.stringify(value));
}
function cacheGet(key){
  try{return JSON.parse(localStorage.getItem(`osotua_${OSOTUA_CONFIG.cacheVersion}_${key}`));}
  catch{return null;}
}
function network(){
  const on=navigator.onLine;
  $("networkBadge").textContent=on?"Online":"Offline";
  $("networkBadge").className=`badge ${on?"online":"offline"}`;
  $("offlineNotice").classList.toggle("hidden",on);
}
function fmt(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
function localDateString(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function calculatedDay(startDate){
  if(!startDate)return 1;
  const start=new Date(`${startDate}T00:00:00`);
  const today=new Date(`${localDateString()}T00:00:00`);
  return Math.min(50,Math.max(1,Math.floor((today-start)/86400000)+1));
}
function newId(){
  return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadSettings(){
  try{
    const{data,error}=await sb.from("project_settings")
      .select("current_day,auto_advance,start_date").eq("id",1).single();
    if(error)throw error;
    settings=data;
    cacheSet("settings",data);
  }catch(error){
    settings=cacheGet("settings");
    if(!settings)throw error;
  }
  currentDay=settings.auto_advance?calculatedDay(settings.start_date):settings.current_day;
  $("dayModeBadge").textContent=settings.auto_advance?"Automatic":"Manual";
  $("dayModeBadge").className=`mode-badge ${settings.auto_advance?"auto":""}`;
}
async function loadContent(){
  try{
    const{data,error}=await sb.from("memory_content").select("*").eq("day",currentDay).single();
    if(error)throw error;
    currentContent=data;
    cacheSet(`content_${currentDay}`,data);
  }catch(error){
    currentContent=cacheGet(`content_${currentDay}`);
    if(!currentContent)throw error;
  }
  renderContent();
}
function renderContent(){
  if(!currentContent)return;
  $("dayTitle").textContent=`Day ${currentDay} · ${currentContent.reference}`;
  const key={maa:"maa_text",en:"english_text",ko:"korean_text"}[currentLanguage];
  $("verseText").textContent=currentContent[key]||"Content not added yet.";
  $("adminCurrentDay").textContent=`Day ${currentDay}`;
}
async function loadParticipants(){
  try{
    const{data,error}=await sb.from("participants").select("id,name,active").eq("active",true).order("name");
    if(error)throw error;
    participants=data;
    cacheSet("participants",data);
  }catch(error){
    participants=cacheGet("participants")||[];
    if(!participants.length)throw error;
  }
  participantMap=new Map(participants.map(x=>[x.id,x.name]));
  $("participantSelect").innerHTML='<option value="">Select your name</option>'+
    participants.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
}
async function initialize(){
  try{
    await loadSettings();
    await Promise.all([loadContent(),loadParticipants()]);
    const saved=localStorage.getItem("osotua_participant");
    if(saved&&participantMap.has(saved)){
      $("participantSelect").value=saved;
      await loadMyProgress();
    }
    if(navigator.onLine){
      await Promise.all([loadCommunity(),loadLeaderboard()]);
    }else{
      $("communitySummary").textContent="Community status needs internet.";
      $("communityList").innerHTML='<p class="muted">Your offline recording can still be saved and synced later.</p>';
      $("leaderboard").innerHTML='<p class="muted">Leaderboard needs internet.</p>';
    }
    await updatePendingUI();
  }catch(e){
    console.error(e);
    $("dayTitle").textContent="Setup error";
    $("verseText").textContent=e.message;
  }
}

async function loadMyProgress(){
  const pid=$("participantSelect").value;
  if(!pid){$("myProgress").classList.add("hidden");return;}
  let data;
  try{
    const result=await sb.from("memory_submissions").select("day").eq("participant_id",pid);
    if(result.error)throw result.error;
    data=result.data;
    cacheSet(`progress_${pid}`,data);
  }catch{
    data=cacheGet(`progress_${pid}`)||[];
  }
  const pending=await OSOTUA_QUEUE.all();
  pending.filter(x=>x.participantId===pid).forEach(x=>data.push({day:x.day}));

  const done=[...new Set(data.map(x=>x.day))],set=new Set(done),pct=Math.round(done.length/50*100);
  let streak=0;
  for(let d=currentDay;d>=1;d--){if(set.has(d))streak++;else break;}
  $("progressName").textContent=participantMap.get(pid);
  $("progressText").textContent=`${done.length} / 50`;
  $("progressFill").style.width=`${pct}%`;
  $("completedDays").textContent=done.length;
  $("progressPercent").textContent=`${pct}%`;
  $("streakCount").textContent=streak;
  $("dayGrid").innerHTML=Array.from({length:50},(_,i)=>i+1)
    .map(d=>`<div class="day ${set.has(d)?"done":""} ${d===currentDay?"today":""}">${d}</div>`).join("");
  $("myProgress").classList.remove("hidden");
}

async function startRecording(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];seconds=0;audioBlob=null;$("timer").textContent="00:00";
    mediaRecorder=new MediaRecorder(stream);
    mediaRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    mediaRecorder.onstop=()=>{
      audioBlob=new Blob(chunks,{type:mediaRecorder.mimeType||"audio/webm"});
      $("audioPreview").src=URL.createObjectURL(audioBlob);
      $("audioPreview").hidden=false;
      $("playRecording").disabled=false;
      $("submitRecording").disabled=false;
      $("submitStatus").textContent="Recording ready.";
    };
    mediaRecorder.start();
    timerId=setInterval(()=>{
      seconds++;
      $("timer").textContent=fmt(seconds);
      if(seconds>=180)stopRecording();
    },1000);
    $("startRecording").disabled=true;
    $("stopRecording").disabled=false;
    $("submitStatus").className="muted";
    $("submitStatus").textContent="Recording…";
  }catch(e){
    $("submitStatus").textContent=`Microphone error: ${e.message}`;
  }
}
function stopRecording(){
  if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();
  if(stream)stream.getTracks().forEach(t=>t.stop());
  clearInterval(timerId);
  $("startRecording").disabled=false;
  $("stopRecording").disabled=true;
}
async function uploadAndSave(item){
  let uploaded=item.uploaded||false;
  if(!uploaded){
    const{error}=await sb.storage.from(OSOTUA_CONFIG.bucket).upload(
      item.path,item.blob,{contentType:item.mimeType||"audio/webm"}
    );
    if(error)throw error;
    item.uploaded=true;
    await OSOTUA_QUEUE.update(item);
  }

  const{data:existing,error:q}=await sb.from("memory_submissions")
    .select("id").eq("participant_id",item.participantId).eq("day",item.day).maybeSingle();
  if(q)throw q;

  const payload={
    verse:item.verseNumber,
    recording_path:item.path,
    submitted_at:item.submittedAt
  };
  const result=existing
    ? await sb.from("memory_submissions").update(payload).eq("id",existing.id)
    : await sb.from("memory_submissions").insert({
        ...payload,participant_id:item.participantId,day:item.day
      });
  if(result.error)throw result.error;
}
async function queueCurrentRecording(reason){
  const pid=$("participantSelect").value;
  const name=participantMap.get(pid);
  const timestamp=Date.now();
  const item={
    id:newId(),
    participantId:pid,
    participantName:name,
    day:currentDay,
    verseNumber:currentContent.verse_number,
    reference:currentContent.reference,
    blob:audioBlob,
    mimeType:audioBlob.type||"audio/webm",
    path:`${name.replace(/[^a-zA-Z0-9_-]/g,"_")}/day-${currentDay}-${timestamp}.webm`,
    submittedAt:new Date().toISOString(),
    uploaded:false,
    queuedReason:reason||"offline"
  };
  await OSOTUA_QUEUE.add(item);
  $("submitStatus").textContent="Saved on this device. It will sync when internet is available.";
  $("submitStatus").className="warn";
  await Promise.all([updatePendingUI(),loadMyProgress()]);
}
async function submitRecording(){
  const pid=$("participantSelect").value;
  if(!pid)return alert("Select your name.");
  if(!audioBlob)return alert("Record first.");

  $("submitRecording").disabled=true;

  if(!navigator.onLine){
    await queueCurrentRecording("offline");
    $("submitRecording").disabled=false;
    return;
  }

  const name=participantMap.get(pid);
  const timestamp=Date.now();
  const item={
    id:newId(),
    participantId:pid,
    participantName:name,
    day:currentDay,
    verseNumber:currentContent.verse_number,
    reference:currentContent.reference,
    blob:audioBlob,
    mimeType:audioBlob.type||"audio/webm",
    path:`${name.replace(/[^a-zA-Z0-9_-]/g,"_")}/day-${currentDay}-${timestamp}.webm`,
    submittedAt:new Date().toISOString(),
    uploaded:false
  };

  try{
    $("submitStatus").className="muted";
    $("submitStatus").textContent="Uploading…";
    await OSOTUA_QUEUE.add(item);
    await uploadAndSave(item);
    await OSOTUA_QUEUE.remove(item.id);
    $("submitStatus").textContent="✓ Submitted successfully";
    $("submitStatus").className="pass";
    await Promise.all([updatePendingUI(),loadCommunity(),loadMyProgress(),loadLeaderboard()]);
  }catch(e){
    $("submitStatus").textContent=`Saved for retry: ${e.message}`;
    $("submitStatus").className="warn";
    await updatePendingUI();
  }finally{
    $("submitRecording").disabled=false;
  }
}
async function syncPendingQueue(){
  if(!navigator.onLine){
    alert("Internet connection is required to sync.");
    return;
  }
  const items=await OSOTUA_QUEUE.all();
  if(!items.length){
    await updatePendingUI();
    return;
  }

  $("syncPending").disabled=true;
  $("syncPendingLarge").disabled=true;
  let success=0,failed=0;

  for(const item of items){
    try{
      await uploadAndSave(item);
      await OSOTUA_QUEUE.remove(item.id);
      success++;
    }catch(e){
      failed++;
      console.error("Pending sync failed",item,e);
    }
  }

  await updatePendingUI();
  $("syncPending").disabled=false;
  $("syncPendingLarge").disabled=false;

  if(success){
    await Promise.all([loadCommunity(),loadMyProgress(),loadLeaderboard()]);
  }
  alert(`${success} synced${failed?`, ${failed} still waiting`:""}.`);
}
async function updatePendingUI(){
  const items=await OSOTUA_QUEUE.all();
  $("pendingCount").textContent=items.length;
  $("pendingCard").classList.toggle("hidden",items.length===0);
  $("pendingSummary").textContent=items.length===1
    ?"1 recording is waiting on this device."
    :`${items.length} recordings are waiting on this device.`;
  $("pendingList").innerHTML=items.map(item=>`
    <div class="pending-row">
      <span><strong>${item.participantName}</strong><br>
      Day ${item.day} · ${item.reference}</span>
      <span class="pending-pill">${item.uploaded?"Saving record":"Waiting"}</span>
    </div>`).join("");
}
async function signed(path){
  const{data,error}=await sb.storage.from(OSOTUA_CONFIG.bucket).createSignedUrl(path,3600);
  if(error)throw error;
  return data.signedUrl;
}
async function loadCommunity(){
  if(!navigator.onLine){
    $("communitySummary").textContent="Community status needs internet.";
    return;
  }
  const{data:rows,error}=await sb.from("memory_submissions")
    .select("participant_id,recording_path,submitted_at").eq("day",currentDay);
  if(error)throw error;

  const m=new Map(rows.map(r=>[r.participant_id,r]));
  $("communitySummary").textContent=`${rows.length} / ${participants.length} submitted`;
  let html="";
  for(const p of participants){
    const r=m.get(p.id);
    if(!r){
      html+=`<div class="person-row"><span>${p.name}</span><strong>○ Not submitted</strong></div>`;
      continue;
    }
    let player;
    try{player=`<audio controls src="${await signed(r.recording_path)}"></audio>`;}
    catch{player='<span class="fail">Audio unavailable</span>';}
    html+=`<div class="person-row"><span><strong>${p.name}</strong><br>
      <span class="pass">✓ Submitted</span><br>
      <small>${new Date(r.submitted_at).toLocaleString()}</small></span>${player}</div>`;
  }
  $("communityList").innerHTML=html;
}
async function loadLeaderboard(){
  if(!navigator.onLine)return;
  const{data,error}=await sb.from("memory_submissions").select("participant_id,day");
  if(error)return;
  const sets=new Map();
  data.forEach(r=>{
    if(!sets.has(r.participant_id))sets.set(r.participant_id,new Set());
    sets.get(r.participant_id).add(r.day);
  });
  const ranked=participants.map(p=>({name:p.name,count:sets.get(p.id)?.size||0}))
    .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  $("leaderboard").innerHTML=ranked
    .map((r,i)=>`<div class="rank-row"><span><strong>${i+1}. ${r.name}</strong></span><span>${r.count} / 50</span></div>`).join("");
}

function openAdmin(){$("adminModal").classList.remove("hidden");}
function closeAdmin(){$("adminModal").classList.add("hidden");}
function adminLogin(){
  if($("adminPin").value!==OSOTUA_CONFIG.adminPin){
    $("adminLoginStatus").textContent="Incorrect PIN.";
    return;
  }
  $("adminLogin").classList.add("hidden");
  $("adminPanel").classList.remove("hidden");
  renderAdmin();
}
async function renderAdmin(){
  $("adminCurrentDay").textContent=`Day ${currentDay}`;
  $("autoAdvance").checked=!!settings.auto_advance;
  $("startDate").value=settings.start_date||localDateString();

  $("editReference").value=currentContent.reference||"";
  $("editMaa").value=currentContent.maa_text||"";
  $("editEnglish").value=currentContent.english_text||"";
  $("editKorean").value=currentContent.korean_text||"";

  if(!navigator.onLine){
    $("adminStats").innerHTML='<div><span>Status</span><strong>Offline</strong></div>';
    $("missingParticipants").innerHTML='<span class="muted">Admin changes need internet.</span>';
    return;
  }

  const{data}=await sb.from("participants").select("id,name,active").order("name");
  $("adminParticipants").innerHTML=data.map(p=>`
    <div class="admin-person">
      <span>${p.name} ${p.active?"":"(inactive)"}</span>
      <button class="secondary" onclick="toggleParticipant('${p.id}',${!p.active})">${p.active?"Disable":"Enable"}</button>
    </div>`).join("");

  const{data:todayRows}=await sb.from("memory_submissions").select("participant_id").eq("day",currentDay);
  const submitted=new Set((todayRows||[]).map(x=>x.participant_id));
  const active=data.filter(x=>x.active);
  const missing=active.filter(x=>!submitted.has(x.id));

  $("adminStats").innerHTML=`
    <div><span>Submitted Today</span><strong>${submitted.size}</strong></div>
    <div><span>Participants</span><strong>${active.length}</strong></div>
    <div><span>Current Day</span><strong>${currentDay}</strong></div>`;

  $("missingParticipants").innerHTML=missing.length
    ? missing.map(x=>`<span class="missing-name">${x.name}</span>`).join("")
    : '<span class="pass"><strong>Everyone submitted.</strong></span>';
}
async function saveSchedule(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const auto=$("autoAdvance").checked;
  const start=$("startDate").value||localDateString();
  const payload={current_day:currentDay,auto_advance:auto,start_date:start,updated_at:new Date().toISOString()};
  const{error}=await sb.from("project_settings").update(payload).eq("id",1);
  $("scheduleSaveStatus").textContent=error?error.message:"Schedule saved.";
  if(!error){
    await loadSettings();await loadContent();
    await Promise.all([loadCommunity(),loadMyProgress(),loadLeaderboard()]);
    renderAdmin();
  }
}
async function saveContent(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const payload={
    reference:$("editReference").value.trim(),
    maa_text:$("editMaa").value.trim(),
    english_text:$("editEnglish").value.trim(),
    korean_text:$("editKorean").value.trim(),
    updated_at:new Date().toISOString()
  };
  const{error}=await sb.from("memory_content").update(payload).eq("day",currentDay);
  $("contentSaveStatus").textContent=error?error.message:"Content saved.";
  if(!error)await loadContent();
}
async function addParticipant(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const name=$("newParticipantName").value.trim();
  if(!name)return;
  const{error}=await sb.from("participants").insert({name,active:true});
  $("participantAdminStatus").textContent=error?error.message:"Participant added.";
  $("newParticipantName").value="";
  await loadParticipants();await renderAdmin();await loadLeaderboard();
}
window.toggleParticipant=async(id,active)=>{
  if(!navigator.onLine)return alert("Internet connection is required.");
  const{error}=await sb.from("participants").update({active}).eq("id",id);
  if(error)alert(error.message);
  await loadParticipants();await renderAdmin();await loadCommunity();await loadLeaderboard();
};

document.querySelectorAll(".lang").forEach(btn=>{
  btn.onclick=()=>{
    currentLanguage=btn.dataset.lang;
    document.querySelectorAll(".lang").forEach(x=>{
      x.classList.remove("active");x.classList.add("secondary");
    });
    btn.classList.remove("secondary");btn.classList.add("active");
    renderContent();
  };
});

$("participantSelect").onchange=()=>{
  localStorage.setItem("osotua_participant",$("participantSelect").value);
  loadMyProgress();
};
$("startRecording").onclick=startRecording;
$("stopRecording").onclick=stopRecording;
$("playRecording").onclick=()=>$("audioPreview").play();
$("submitRecording").onclick=submitRecording;
$("refreshCommunity").onclick=loadCommunity;
$("syncPending").onclick=syncPendingQueue;
$("syncPendingLarge").onclick=syncPendingQueue;

$("openAdmin").onclick=openAdmin;
$("closeAdmin").onclick=closeAdmin;
$("adminLoginButton").onclick=adminLogin;
$("previousDay").onclick=()=>{currentDay=Math.max(1,currentDay-1);$("adminCurrentDay").textContent=`Day ${currentDay}`;};
$("nextDay").onclick=()=>{currentDay=Math.min(50,currentDay+1);$("adminCurrentDay").textContent=`Day ${currentDay}`;};
$("saveSchedule").onclick=saveSchedule;
$("saveContent").onclick=saveContent;
$("addParticipant").onclick=addParticipant;

window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  $("installApp").classList.remove("hidden");
});
$("installApp").onclick=async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  $("installApp").classList.add("hidden");
};
window.addEventListener("appinstalled",()=>$("installApp").classList.add("hidden"));

window.addEventListener("online",async()=>{
  network();
  await syncPendingQueue();
});
window.addEventListener("offline",network);

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

network();
initialize();
