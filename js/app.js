const sb=window.supabase.createClient(OSOTUA_CONFIG.supabaseUrl,OSOTUA_CONFIG.supabaseKey);
const $=id=>document.getElementById(id);

let participants=[],participantMap=new Map();
let settings=null,currentDay=1,adminDay=1,currentContent=null,selectedDay=1,selectedContent=null,currentLanguage="maa";
let currentMode="study",practiceMaskLevel="full",practiceOverrides=new Map();
let currentCoach=null,coachVerse=null,coachDay=1,coachTimerId=null,coachSeconds=30;
let practiceRecorder=null,practiceStream=null,practiceChunks=[],practiceBlob=null;
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


function selectedVerseText(language=currentLanguage){
  if(!selectedContent)return "";
  const key={maa:"maa_text",en:"english_text",ko:"korean_text"}[language]||"maa_text";
  return selectedContent[key]||"Content not added yet.";
}
function setMode(mode,{save=true}={}){
  if(!["study","practice","recite"].includes(mode))mode="study";
  if(currentMode==="recite" && mode!=="recite" && mediaRecorder?.state==="recording")stopRecording();
  currentMode=mode;
  ["study","practice","recite"].forEach(name=>{
    $(`${name}View`).classList.toggle("hidden",name!==mode);
  });
  document.querySelectorAll(".mode-tab").forEach(button=>{
    const active=button.dataset.mode===mode;
    button.classList.toggle("active",active);
    button.classList.toggle("secondary",!active);
    button.setAttribute("aria-selected",String(active));
  });
  if(mode==="practice")renderPracticeText();
  if(mode==="recite"){
    $("reciteAnswer").textContent="";
    $("reciteAnswer").classList.add("hidden");
  }
  if(save)localStorage.setItem("osotua_memory_mode",mode);
}
function maskWord(word,initialOnly=false){
  let firstKept=false;
  return Array.from(word).map(char=>{
    if(/[\p{L}\p{N}]/u.test(char)){
      if(initialOnly&&!firstKept){firstKept=true;return char;}
      return "_";
    }
    return char;
  }).join("");
}
function defaultWordMasked(index){
  const score=(index*37+selectedDay*19+currentLanguage.length*11)%100;
  if(practiceMaskLevel==="light")return score<25;
  if(practiceMaskLevel==="half")return score<50;
  if(practiceMaskLevel==="heavy")return score<75;
  if(practiceMaskLevel==="initials")return true;
  return false;
}
function wordIsMasked(index){
  return practiceOverrides.has(index)?practiceOverrides.get(index):defaultWordMasked(index);
}
function renderPracticeText(){
  const box=$("practiceVerse");
  if(!box)return;
  const words=selectedVerseText().trim().split(/\s+/).filter(Boolean);
  box.innerHTML="";
  let maskedCount=0;
  words.forEach((word,index)=>{
    const masked=wordIsMasked(index);
    if(masked)maskedCount++;
    const button=document.createElement("button");
    button.type="button";
    button.className=`practice-word ${masked?"masked":""}`;
    button.dataset.practiceIndex=String(index);
    button.dataset.masked=String(masked);
    button.textContent=masked?maskWord(word,practiceMaskLevel==="initials"):word;
    button.title=masked?"Tap to reveal":"Tap to hide";
    box.appendChild(button);
  });
  const labels={
    full:"Full verse",
    light:"A little hidden",
    half:"Half hidden",
    heavy:"Most words hidden",
    initials:"First letters only"
  };
  $("practiceMaskStatus").textContent=`${labels[practiceMaskLevel]} · ${maskedCount} of ${words.length} words hidden`;
}
function setPracticeMask(level){
  if(!["full","light","half","heavy","initials"].includes(level))level="full";
  practiceMaskLevel=level;
  practiceOverrides.clear();
  document.querySelectorAll(".mask-button").forEach(button=>{
    const active=button.dataset.mask===level;
    button.classList.toggle("active",active);
    button.classList.toggle("secondary",!active);
  });
  renderPracticeText();
}
function revealFirstWordHints(){
  const words=selectedVerseText().trim().split(/\s+/).filter(Boolean);
  words.forEach((word,index)=>{
    if(index===0 || /[.!?;:]$/.test(words[index-1]||""))practiceOverrides.set(index,false);
  });
  renderPracticeText();
}
function resetPracticeWords(){
  practiceOverrides.clear();
  renderPracticeText();
}

function splitLines(text){
  return (text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);
}
function parseWordLine(line){
  const parts=line.split(/\s*=\s*/);
  return {word:(parts.shift()||"").trim(),meaning:parts.join(" = ").trim()};
}
function populateCoachDays(){
  $("coachDaySelect").innerHTML=Array.from({length:OSOTUA_CONFIG.totalDays},(_,i)=>i+1)
    .map(day=>`<option value="${day}">Day ${day}</option>`).join("");
}
function populatePracticeDays(){
  $("practiceDaySelect").innerHTML=Array.from({length:OSOTUA_CONFIG.totalDays},(_,i)=>i+1)
    .map(day=>`<option value="${day}">Day ${day}</option>`).join("");
}
function resetMainRecording(){
  if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();
  if(stream)stream.getTracks().forEach(track=>track.stop());
  clearInterval(timerId);
  audioBlob=null;chunks=[];seconds=0;
  $("timer").textContent="00:00";
  $("audioPreview").removeAttribute("src");
  $("audioPreview").hidden=true;
  $("startRecording").disabled=false;
  $("stopRecording").disabled=true;
  $("playRecording").disabled=true;
  $("submitRecording").disabled=true;
  $("submitStatus").className="muted";
  $("submitStatus").textContent="No recording yet.";
  $("reciteAnswer").textContent="";
  $("reciteAnswer").classList.add("hidden");
  $("revealAfterRecording").disabled=true;
}
async function selectPracticeDay(day){
  selectedDay=Math.min(OSOTUA_CONFIG.totalDays,Math.max(1,Number(day)||currentDay));
  localStorage.setItem("osotua_selected_day",String(selectedDay));
  $("practiceDaySelect").value=String(selectedDay);
  practiceOverrides.clear();
  resetMainRecording();
  await loadSelectedContent();
  await Promise.all([loadMyProgress(),loadCommunity()]);
}
function updateCoachVisibility(){
  const pid=$("participantSelect").value;
  const name=participantMap.get(pid);
  const visible=name==="SON";
  $("coachCard").classList.toggle("hidden",!visible);
  if(visible && !$("coachDaySelect").value){
    coachDay=Math.min(currentDay,OSOTUA_CONFIG.totalDays);
    $("coachDaySelect").value=String(coachDay);
    loadCoachDay(coachDay);
  }
}
async function loadCoachDay(day){
  coachDay=Number(day);
  $("coachContent").classList.add("hidden");
  $("coachAvailability").textContent="Loading coach content…";
  try{
    const [coachResult,verseResult]=await Promise.all([
      sb.from("memory_coach").select("*").eq("day",coachDay).maybeSingle(),
      sb.from("memory_content").select("day,reference,maa_text,reference_audio_path,reference_speaker").eq("day",coachDay).maybeSingle()
    ]);
    if(coachResult.error)throw coachResult.error;
    if(verseResult.error)throw verseResult.error;
    currentCoach=coachResult.data;
    coachVerse=verseResult.data;
    if(currentCoach)cacheSet(`coach_${coachDay}`,currentCoach);
    if(coachVerse)cacheSet(`coach_verse_${coachDay}`,coachVerse);
  }catch(error){
    currentCoach=cacheGet(`coach_${coachDay}`);
    coachVerse=cacheGet(`coach_verse_${coachDay}`);
    if(!currentCoach && navigator.onLine)console.error(error);
  }
  await renderCoach();
}
async function renderCoach(){
  await renderCoachAudio();
  if(!currentCoach || !coachVerse){
    $("coachAvailability").textContent=`Coach content for Day ${coachDay} is not prepared yet.`;
    $("coachContent").classList.add("hidden");
    return;
  }
  $("coachAvailability").textContent=`Day ${coachDay} · ${coachVerse.reference}`;
  $("coachOriginal").textContent=coachVerse.maa_text||"";
  $("coachPronunciation").textContent=currentCoach.pronunciation||"";
  $("coachTranslation").textContent=currentCoach.direct_translation||"";
  $("coachChunks").innerHTML=splitLines(currentCoach.meaning_chunks)
    .map(line=>`<div class="coach-line">${line}</div>`).join("");
  $("coachWords").innerHTML=splitLines(currentCoach.word_study)
    .map(line=>{const x=parseWordLine(line);return `<div class="word-row"><strong>${x.word}</strong><span>${x.meaning}</span></div>`;}).join("");
  $("coachImage").textContent=currentCoach.memory_image||"";
  $("coachConnection").textContent=currentCoach.previous_connection||"";
  $("coachRhythm").textContent=currentCoach.rhythm||"";
  $("coachSong").textContent=currentCoach.song||"";
  $("coachTestPrompt").textContent=currentCoach.test_prompt||"";
  $("coachAnswer").textContent=coachVerse.maa_text||"";
  $("coachAnswer").classList.add("hidden");
  $("coachCountdown").textContent="30";
  $("coachTestPanel").classList.add("hidden");
  $("coachContent").classList.remove("hidden");
}
async function referenceSigned(path){
  const{data,error}=await sb.storage.from(OSOTUA_CONFIG.referenceBucket).createSignedUrl(path,3600);
  if(error)throw error;
  return data.signedUrl;
}
async function renderCoachAudio(){
  $("coachAudioPanel").classList.remove("hidden");
  const refAudio=$("coachReferenceAudio");
  if(coachVerse?.reference_audio_path && navigator.onLine){
    try{
      refAudio.src=await referenceSigned(coachVerse.reference_audio_path);
      refAudio.hidden=false;
      $("coachReferenceStatus").textContent=coachVerse.reference_speaker
        ?`Speaker: ${coachVerse.reference_speaker}`
        :"Reference recording ready.";
    }catch(error){
      refAudio.hidden=true;
      $("coachReferenceStatus").textContent=`Reference audio unavailable: ${error.message}`;
    }
  }else{
    refAudio.removeAttribute("src");
    refAudio.hidden=true;
    $("coachReferenceStatus").textContent=coachVerse?.reference_audio_path
      ?"Connect to the internet to play the reference audio."
      :"Reference audio has not been uploaded for this Day.";
  }
  resetPracticeRecorder();
}
function resetPracticeRecorder(){
  practiceBlob=null;
  $("coachPracticeAudio").removeAttribute("src");
  $("coachPracticeAudio").hidden=true;
  $("coachStartPractice").disabled=false;
  $("coachStopPractice").disabled=true;
  $("coachPlayPractice").disabled=true;
  $("coachPracticeStatus").textContent="Record yourself, then compare.";
}
async function startPracticeRecording(){
  try{
    practiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
    practiceChunks=[];
    practiceRecorder=new MediaRecorder(practiceStream);
    practiceRecorder.ondataavailable=e=>{if(e.data.size)practiceChunks.push(e.data)};
    practiceRecorder.onstop=()=>{
      practiceBlob=new Blob(practiceChunks,{type:practiceRecorder.mimeType||"audio/webm"});
      $("coachPracticeAudio").src=URL.createObjectURL(practiceBlob);
      $("coachPracticeAudio").hidden=false;
      $("coachPlayPractice").disabled=false;
      $("coachPracticeStatus").textContent="Practice recording ready. Compare it with the Maa model.";
    };
    practiceRecorder.start();
    $("coachStartPractice").disabled=true;
    $("coachStopPractice").disabled=false;
    $("coachPracticeStatus").textContent="Practice recording…";
  }catch(error){
    $("coachPracticeStatus").textContent=`Microphone error: ${error.message}`;
  }
}
function stopPracticeRecording(){
  if(practiceRecorder&&practiceRecorder.state!=="inactive")practiceRecorder.stop();
  if(practiceStream)practiceStream.getTracks().forEach(track=>track.stop());
  $("coachStartPractice").disabled=false;
  $("coachStopPractice").disabled=true;
}

function startCoachTest(){
  if(!currentCoach || !coachVerse)return;
  clearInterval(coachTimerId);
  coachSeconds=30;
  $("coachCountdown").textContent=coachSeconds;
  $("coachAnswer").classList.add("hidden");
  $("coachTestPanel").classList.remove("hidden");
  coachTimerId=setInterval(()=>{
    coachSeconds--;
    $("coachCountdown").textContent=coachSeconds;
    if(coachSeconds<=0){
      clearInterval(coachTimerId);
      $("coachCountdown").textContent="Time";
    }
  },1000);
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
}
async function loadContent(){
  try{
    const{data,error}=await sb.from("memory_content").select("*").eq("day",adminDay).single();
    if(error)throw error;
    currentContent=data;
    cacheSet(`content_${adminDay}`,data);
  }catch(error){
    currentContent=cacheGet(`content_${adminDay}`);
    if(!currentContent)throw error;
  }
}
async function loadSelectedContent(){
  try{
    const{data,error}=await sb.from("memory_content").select("*").eq("day",selectedDay).single();
    if(error)throw error;
    selectedContent=data;
    cacheSet(`content_${selectedDay}`,data);
  }catch(error){
    selectedContent=cacheGet(`content_${selectedDay}`);
    if(!selectedContent)throw error;
  }
  renderContent();
}
function renderContent(){
  if(!selectedContent)return;
  $("dayTitle").textContent=`Day ${selectedDay} · ${selectedContent.reference}`;
  $("verseText").textContent=selectedVerseText();
  $("reciteReference").textContent=selectedContent.reference||`Romans 8:${selectedDay}`;
  $("reciteAnswer").textContent="";
  $("reciteAnswer").classList.add("hidden");
  $("revealAfterRecording").disabled=true;
  practiceOverrides.clear();
  renderPracticeText();
  $("dayModeBadge").textContent=`Official Day ${currentDay}`;
  $("dayModeBadge").className=`mode-badge ${settings?.auto_advance?"auto":""}`;
  const relation=selectedDay===currentDay
    ?"This is today’s official challenge Day."
    :selectedDay>currentDay
      ?`Early practice: this is ${selectedDay-currentDay} Day(s) ahead of the official schedule.`
      :`Review: this is ${currentDay-selectedDay} Day(s) before the official schedule.`;
  $("practiceDayHelp").textContent=relation+" You may learn, practice, record, and submit this Day now.";
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
  populateCoachDays();
  populatePracticeDays();
  try{
    await loadSettings();
    adminDay=currentDay;
    const savedDay=Number(localStorage.getItem("osotua_selected_day"));
    selectedDay=savedDay>=1&&savedDay<=OSOTUA_CONFIG.totalDays?savedDay:currentDay;
    $("practiceDaySelect").value=String(selectedDay);
    await Promise.all([loadContent(),loadSelectedContent(),loadParticipants()]);
    const savedMode=localStorage.getItem("osotua_memory_mode")||"study";
    setMode(savedMode,{save:false});
    const saved=localStorage.getItem("osotua_participant");
    if(saved&&participantMap.has(saved)){
      $("participantSelect").value=saved;
      await Promise.all([loadMyProgress(),loadCommunity(),loadLeaderboard()]);
    }else{
      $("communityCard").classList.add("hidden");
      $("leaderboardCard").classList.add("hidden");
    }
    updateCoachVisibility();
    await updatePendingUI();
  }catch(e){
    console.error(e);
    $("dayTitle").textContent="Setup error";
    $("verseText").textContent=e.message;
  }
}

async function loadMyProgress(){
  const pid=$("participantSelect").value;
  if(!pid){
    $("myProgress").classList.add("hidden");
    $("communityCard").classList.add("hidden");
    $("leaderboardCard").classList.add("hidden");
    return;
  }
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
    .map(d=>`<button type="button" data-day="${d}" title="Practice Day ${d}" class="day ${set.has(d)?"done":""} ${d===currentDay?"today":""} ${d===selectedDay?"selected":""}">${d}</button>`).join("");
  $("myProgress").classList.remove("hidden");
  $("communityCard").classList.remove("hidden");
  $("leaderboardCard").classList.remove("hidden");
}

async function startRecording(){
  try{
    setMode("recite");
    $("reciteAnswer").textContent="";
    $("reciteAnswer").classList.add("hidden");
    $("revealAfterRecording").disabled=true;
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
      $("revealAfterRecording").disabled=false;
      $("submitStatus").textContent="Recording ready. Listen first, then check the Maa verse if needed.";
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
    day:selectedDay,
    verseNumber:selectedContent.verse_number,
    reference:selectedContent.reference,
    blob:audioBlob,
    mimeType:audioBlob.type||"audio/webm",
    path:`${name.replace(/[^a-zA-Z0-9_-]/g,"_")}/day-${selectedDay}-${timestamp}.webm`,
    submittedAt:new Date().toISOString(),
    uploaded:false,
    queuedReason:reason||"offline"
  };
  await OSOTUA_QUEUE.add(item);
  $("submitStatus").textContent=`Day ${selectedDay} saved on this device. It will sync when internet is available.`;
  $("submitStatus").className="warn";
  await Promise.all([updatePendingUI(),loadMyProgress(),loadCommunity(),loadLeaderboard()]);
}
async function submitRecording(){
  const pid=$("participantSelect").value;
  if(!pid)return alert("Select your name.");
  if(!audioBlob)return alert("Record first.");
  if(!selectedContent)return alert("Select a valid Practice Day.");

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
    day:selectedDay,
    verseNumber:selectedContent.verse_number,
    reference:selectedContent.reference,
    blob:audioBlob,
    mimeType:audioBlob.type||"audio/webm",
    path:`${name.replace(/[^a-zA-Z0-9_-]/g,"_")}/day-${selectedDay}-${timestamp}.webm`,
    submittedAt:new Date().toISOString(),
    uploaded:false
  };

  try{
    $("submitStatus").className="muted";
    $("submitStatus").textContent=`Uploading Day ${selectedDay}…`;
    await OSOTUA_QUEUE.add(item);
    await uploadAndSave(item);
    await OSOTUA_QUEUE.remove(item.id);
    $("submitStatus").textContent=`✓ Day ${selectedDay} submitted successfully`;
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
  const pid=$("participantSelect").value;
  if(!pid){
    $("communityCard").classList.add("hidden");
    return;
  }
  $("communityCard").classList.remove("hidden");
  const name=participantMap.get(pid);
  $("communitySummary").textContent=`${name} · Day ${selectedDay}`;
  if(!navigator.onLine){
    const pending=await OSOTUA_QUEUE.all();
    const waiting=pending.find(x=>x.participantId===pid&&x.day===selectedDay);
    $("communityList").innerHTML=waiting
      ?'<p class="warn"><strong>Saved offline and waiting to sync.</strong></p>'
      :'<p class="muted">Connect to the internet to check your submitted recording.</p>';
    return;
  }
  const{data:r,error}=await sb.from("memory_submissions")
    .select("recording_path,submitted_at")
    .eq("participant_id",pid).eq("day",selectedDay).maybeSingle();
  if(error)throw error;
  if(!r){
    $("communityList").innerHTML='<p><strong>○ You have not submitted this Day yet.</strong></p>';
    return;
  }
  let player='<span class="fail">Audio unavailable</span>';
  try{player=`<audio controls src="${await signed(r.recording_path)}"></audio>`;}catch{}
  $("communityList").innerHTML=`<div class="person-row"><span><strong>${name}</strong><br>
    <span class="pass">✓ Day ${selectedDay} submitted</span><br>
    <small>${new Date(r.submitted_at).toLocaleString()}</small></span>${player}</div>`;
}
async function loadLeaderboard(){
  const pid=$("participantSelect").value;
  if(!pid){
    $("leaderboardCard").classList.add("hidden");
    return;
  }
  $("leaderboardCard").classList.remove("hidden");
  let rows=[];
  try{
    const{data,error}=await sb.from("memory_submissions").select("day").eq("participant_id",pid);
    if(error)throw error;
    rows=data;
  }catch{
    rows=cacheGet(`progress_${pid}`)||[];
  }
  const pending=await OSOTUA_QUEUE.all();
  pending.filter(x=>x.participantId===pid).forEach(x=>rows.push({day:x.day}));
  const completed=[...new Set(rows.map(x=>x.day))].sort((a,b)=>a-b);
  const pct=Math.round(completed.length/OSOTUA_CONFIG.totalDays*100);
  $("leaderboard").innerHTML=`
    <div class="private-overall">
      <div><span>Participant</span><strong>${participantMap.get(pid)}</strong></div>
      <div><span>Completed</span><strong>${completed.length} / ${OSOTUA_CONFIG.totalDays}</strong></div>
      <div><span>Progress</span><strong>${pct}%</strong></div>
    </div>
    <p class="muted">Completed Days: ${completed.length?completed.join(", "):"None yet"}</p>`;
}

async function loadAdminReferencePreview(){
  const audio=$("adminReferencePreview");
  $("referenceSpeaker").value=currentContent?.reference_speaker||"";
  if(currentContent?.reference_audio_path && navigator.onLine){
    try{
      audio.src=await referenceSigned(currentContent.reference_audio_path);
      audio.hidden=false;
      $("referenceAudioAdminStatus").textContent="Reference audio is available for this Day.";
    }catch(error){
      audio.hidden=true;
      $("referenceAudioAdminStatus").textContent=error.message;
    }
  }else{
    audio.removeAttribute("src");
    audio.hidden=true;
    $("referenceAudioAdminStatus").textContent=currentContent?.reference_audio_path
      ?"Connect to the internet to preview the audio."
      :"No reference audio uploaded for this Day.";
  }
}
async function uploadReferenceAudio(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const file=$("referenceAudioFile").files[0];
  if(!file){$("referenceAudioAdminStatus").textContent="Choose an audio file first.";return;}
  if(file.size>10*1024*1024){$("referenceAudioAdminStatus").textContent="The file must be smaller than 10 MB.";return;}
  const ext=(file.name.split(".").pop()||"webm").replace(/[^a-zA-Z0-9]/g,"");
  const path=`day-${adminDay}/reference-${Date.now()}.${ext}`;
  $("referenceAudioAdminStatus").textContent="Uploading reference audio…";
  const{error:uploadError}=await sb.storage.from(OSOTUA_CONFIG.referenceBucket).upload(path,file,{contentType:file.type||"audio/webm"});
  if(uploadError){$("referenceAudioAdminStatus").textContent=uploadError.message;return;}
  const oldPath=currentContent.reference_audio_path;
  const payload={
    reference_audio_path:path,
    reference_speaker:$("referenceSpeaker").value.trim(),
    updated_at:new Date().toISOString()
  };
  const{error:updateError}=await sb.from("memory_content").update(payload).eq("day",adminDay);
  if(updateError){$("referenceAudioAdminStatus").textContent=updateError.message;return;}
  if(oldPath && oldPath!==path){
    await sb.storage.from(OSOTUA_CONFIG.referenceBucket).remove([oldPath]);
  }
  $("referenceAudioFile").value="";
  $("referenceAudioAdminStatus").textContent="Reference audio uploaded.";
  await loadContent();
  if(selectedDay===adminDay)await loadSelectedContent();
  await loadAdminReferencePreview();
  if(coachDay===adminDay)await loadCoachDay(coachDay);
}
async function removeReferenceAudio(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const path=currentContent?.reference_audio_path;
  if(!path){$("referenceAudioAdminStatus").textContent="There is no reference audio to remove.";return;}
  if(!confirm("Remove the reference audio for this Day?"))return;
  const{error:updateError}=await sb.from("memory_content")
    .update({reference_audio_path:"",reference_speaker:"",updated_at:new Date().toISOString()})
    .eq("day",adminDay);
  if(updateError){$("referenceAudioAdminStatus").textContent=updateError.message;return;}
  await sb.storage.from(OSOTUA_CONFIG.referenceBucket).remove([path]);
  $("referenceAudioAdminStatus").textContent="Reference audio removed.";
  await loadContent();
  if(selectedDay===adminDay)await loadSelectedContent();
  await loadAdminReferencePreview();
  if(coachDay===adminDay)await loadCoachDay(coachDay);
}

async function changeAdminDay(day){
  adminDay=Math.min(OSOTUA_CONFIG.totalDays,Math.max(1,Number(day)||adminDay));
  await loadContent();
  await renderAdmin();
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
  $("adminCurrentDay").textContent=`Day ${adminDay}`;
  $("autoAdvance").checked=!!settings.auto_advance;
  $("startDate").value=settings.start_date||localDateString();

  $("editReference").value=currentContent.reference||"";
  $("editMaa").value=currentContent.maa_text||"";
  $("editEnglish").value=currentContent.english_text||"";
  $("editKorean").value=currentContent.korean_text||"";
  await loadAdminReferencePreview();

  if(!navigator.onLine){
    $("adminStats").innerHTML='<div><span>Status</span><strong>Offline</strong></div>';
    $("missingParticipants").innerHTML='<span class="muted">Admin changes need internet.</span>';
    $("adminDayList").innerHTML='';
    $("adminOverallProgress").innerHTML='';
    return;
  }

  const{data,error:participantError}=await sb.from("participants").select("id,name,active").order("name");
  if(participantError)throw participantError;
  $("adminParticipants").innerHTML=data.map(p=>`
    <div class="admin-person">
      <span>${p.name} ${p.active?"":"(inactive)"}</span>
      <button class="secondary" onclick="toggleParticipant('${p.id}',${!p.active})">${p.active?"Disable":"Enable"}</button>
    </div>`).join("");

  const{data:dayRows,error:dayError}=await sb.from("memory_submissions")
    .select("participant_id,recording_path,submitted_at").eq("day",adminDay);
  if(dayError)throw dayError;
  const submittedMap=new Map((dayRows||[]).map(x=>[x.participant_id,x]));
  const active=data.filter(x=>x.active);
  const missing=active.filter(x=>!submittedMap.has(x.id));

  $("adminStats").innerHTML=`
    <div><span>Submitted</span><strong>${submittedMap.size}</strong></div>
    <div><span>Participants</span><strong>${active.length}</strong></div>
    <div><span>Admin Day</span><strong>${adminDay}</strong></div>`;

  $("missingParticipants").innerHTML=missing.length
    ?missing.map(x=>`<span class="missing-name">${x.name}</span>`).join("")
    :'<span class="pass"><strong>Everyone submitted.</strong></span>';

  let dayHtml="";
  for(const p of active){
    const row=submittedMap.get(p.id);
    if(!row){
      dayHtml+=`<div class="person-row"><span>${p.name}</span><strong>○ Not submitted</strong></div>`;
      continue;
    }
    let player='<span class="fail">Audio unavailable</span>';
    try{player=`<audio controls src="${await signed(row.recording_path)}"></audio>`;}catch{}
    dayHtml+=`<div class="person-row"><span><strong>${p.name}</strong><br><span class="pass">✓ Submitted</span><br><small>${new Date(row.submitted_at).toLocaleString()}</small></span>${player}</div>`;
  }
  $("adminDayList").innerHTML=dayHtml;

  const{data:allRows,error:allError}=await sb.from("memory_submissions").select("participant_id,day");
  if(allError)throw allError;
  const sets=new Map();
  (allRows||[]).forEach(row=>{
    if(!sets.has(row.participant_id))sets.set(row.participant_id,new Set());
    sets.get(row.participant_id).add(row.day);
  });
  $("adminOverallProgress").innerHTML=active
    .map(p=>{
      const count=sets.get(p.id)?.size||0;
      return `<div class="rank-row"><span><strong>${p.name}</strong></span><span>${count} / ${OSOTUA_CONFIG.totalDays} · ${Math.round(count/OSOTUA_CONFIG.totalDays*100)}%</span></div>`;
    }).join("");
}
async function saveSchedule(){
  if(!navigator.onLine)return alert("Internet connection is required.");
  const auto=$("autoAdvance").checked;
  const start=$("startDate").value||localDateString();
  const payload={current_day:adminDay,auto_advance:auto,start_date:start,updated_at:new Date().toISOString()};
  const{error}=await sb.from("project_settings").update(payload).eq("id",1);
  $("scheduleSaveStatus").textContent=error?error.message:"Schedule saved.";
  if(!error){
    await loadSettings();
    adminDay=currentDay;
    await Promise.all([loadContent(),loadSelectedContent()]);
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
  const{error}=await sb.from("memory_content").update(payload).eq("day",adminDay);
  $("contentSaveStatus").textContent=error?error.message:"Content saved.";
  if(!error){
    await loadContent();
    if(selectedDay===adminDay)await loadSelectedContent();
  }
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
    practiceOverrides.clear();
    document.querySelectorAll(".lang").forEach(x=>{
      const active=x.dataset.lang===currentLanguage;
      x.classList.toggle("active",active);
      x.classList.toggle("secondary",!active);
    });
    renderContent();
  };
});

document.querySelectorAll(".mode-tab").forEach(button=>{
  button.onclick=()=>setMode(button.dataset.mode);
});
document.querySelectorAll("[data-go-mode]").forEach(button=>{
  button.onclick=()=>{
    setMode(button.dataset.goMode);
    window.scrollTo({top:document.querySelector(`#${button.dataset.goMode}View`).offsetTop-90,behavior:"smooth"});
  };
});
document.querySelectorAll(".mask-button").forEach(button=>{
  button.onclick=()=>setPracticeMask(button.dataset.mask);
});
$("practiceVerse").onclick=event=>{
  const button=event.target.closest("[data-practice-index]");
  if(!button)return;
  const index=Number(button.dataset.practiceIndex);
  const currentlyMasked=button.dataset.masked==="true";
  practiceOverrides.set(index,!currentlyMasked);
  renderPracticeText();
};
$("practiceHint").onclick=revealFirstWordHints;
$("practiceReset").onclick=resetPracticeWords;
$("revealAfterRecording").onclick=()=>{
  if(mediaRecorder?.state==="recording")return;
  $("reciteAnswer").textContent=selectedContent?.maa_text||"Maa content not added yet.";
  $("reciteAnswer").classList.remove("hidden");
};

$("participantSelect").onchange=async()=>{
  localStorage.setItem("osotua_participant",$("participantSelect").value);
  await Promise.all([loadMyProgress(),loadCommunity(),loadLeaderboard()]);
  updateCoachVisibility();
};
$("practiceDaySelect").onchange=()=>selectPracticeDay($("practiceDaySelect").value);
$("dayGrid").onclick=event=>{
  const button=event.target.closest("[data-day]");
  if(button)selectPracticeDay(button.dataset.day);
};
$("startRecording").onclick=startRecording;
$("stopRecording").onclick=stopRecording;
$("playRecording").onclick=()=>$("audioPreview").play();
$("submitRecording").onclick=submitRecording;
$("refreshCommunity").onclick=loadCommunity;
$("syncPending").onclick=syncPendingQueue;
$("syncPendingLarge").onclick=syncPendingQueue;
$("toggleCoach").onclick=()=>{
  $("coachBody").classList.toggle("hidden");
  $("toggleCoach").textContent=$("coachBody").classList.contains("hidden")?"Open Coach":"Close Coach";
  if(!$("coachBody").classList.contains("hidden")){
    const requested=Number($("coachDaySelect").value||selectedDay);
    $("coachDaySelect").value=String(requested);
    loadCoachDay(requested);
  }
};
$("coachDaySelect").onchange=()=>loadCoachDay($("coachDaySelect").value);
$("coachStartPractice").onclick=startPracticeRecording;
$("coachStopPractice").onclick=stopPracticeRecording;
$("coachPlayPractice").onclick=()=>$("coachPracticeAudio").play();
$("startCoachTest").onclick=startCoachTest;
$("revealCoachAnswer").onclick=()=>{
  clearInterval(coachTimerId);
  $("coachAnswer").classList.remove("hidden");
};


$("openAdmin").onclick=openAdmin;
$("closeAdmin").onclick=closeAdmin;
$("adminLoginButton").onclick=adminLogin;
$("previousDay").onclick=()=>changeAdminDay(adminDay-1);
$("nextDay").onclick=()=>changeAdminDay(adminDay+1);
$("saveSchedule").onclick=saveSchedule;
$("saveContent").onclick=saveContent;
$("uploadReferenceAudio").onclick=uploadReferenceAudio;
$("removeReferenceAudio").onclick=removeReferenceAudio;
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
