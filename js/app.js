const sb=window.supabase.createClient(OSOTUA_CONFIG.supabaseUrl,OSOTUA_CONFIG.supabaseKey);
const $=id=>document.getElementById(id);
let mediaRecorder=null,stream=null,chunks=[],audioBlob=null,timerId=null,seconds=0;
let participants=[],participantMap=new Map();

const verseText="Metii naa taata enkiguana te lelo ootii atua Kristo Yesu.";

function log(message,error=false){$("log").textContent+=`\n[${new Date().toLocaleTimeString()}] ${error?"ERROR: ":""}${message}`;$("log").scrollTop=$("log").scrollHeight;}
function setStatus(id,text,cls=""){$(id).textContent=text;$(id).className=cls;}
function setNetwork(){const on=navigator.onLine;$("networkBadge").textContent=on?"Online":"Offline";$("networkBadge").className=`badge ${on?"online":"offline"}`;}
function fmt(sec){return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}

async function loadParticipants(){
  const {data,error}=await sb.from("participants").select("id,name,active").eq("active",true).order("name");
  if(error)throw error;
  participants=data;participantMap=new Map(data.map(x=>[x.id,x.name]));
  $("participantSelect").innerHTML='<option value="">Select your name</option>'+data.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
  return data;
}

async function loadMyProgress(){
  const pid=$("participantSelect").value;
  if(!pid){$("myProgress").classList.add("hidden");return;}
  const {data,error}=await sb.from("memory_submissions").select("day,submitted_at").eq("participant_id",pid).order("day");
  if(error){log(error.message,true);return;}
  const doneDays=[...new Set(data.map(x=>x.day))].sort((a,b)=>a-b);
  const doneSet=new Set(doneDays);
  const completed=doneDays.length;
  const percent=Math.round((completed/OSOTUA_CONFIG.totalDays)*100);
  let streak=0;
  for(let d=OSOTUA_CONFIG.currentDay;d>=1;d--){if(doneSet.has(d))streak++;else break;}

  $("progressName").textContent=participantMap.get(pid)||"Participant";
  $("progressText").textContent=`${completed} / ${OSOTUA_CONFIG.totalDays}`;
  $("progressFill").style.width=`${percent}%`;
  $("completedDays").textContent=completed;
  $("progressPercent").textContent=`${percent}%`;
  $("streakCount").textContent=streak;
  $("dayGrid").innerHTML=Array.from({length:OSOTUA_CONFIG.totalDays},(_,i)=>i+1).map(d=>`<div class="day ${doneSet.has(d)?"done":""} ${d===OSOTUA_CONFIG.currentDay?"today":""}">${d}</div>`).join("");
  $("myProgress").classList.remove("hidden");
}

async function diagnostics(){
  $("log").textContent="Starting diagnostics...";
  try{const p=await loadParticipants();setStatus("apiStatus","Connected","pass");setStatus("participantsStatus",`${p.length} loaded`,"pass");log(`Participants loaded: ${p.length}`);}catch(e){setStatus("apiStatus","Failed","fail");setStatus("participantsStatus","Failed","fail");log(e.message,true);}
  try{const{data,error}=await sb.storage.from(OSOTUA_CONFIG.bucket).list("",{limit:5});if(error)throw error;setStatus("storageStatus","Accessible","pass");log(`Storage accessible: ${data.length} item(s)`);}catch(e){setStatus("storageStatus","Failed","fail");log(e.message,true);}
  try{const{count,error}=await sb.from("memory_submissions").select("*",{count:"exact",head:true});if(error)throw error;setStatus("databaseStatus",`Accessible (${count||0})`,"pass");log(`Database accessible: ${count||0} row(s)`);}catch(e){setStatus("databaseStatus","Failed","fail");log(e.message,true);}
}

async function startRecording(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];audioBlob=null;seconds=0;$("timer").textContent="00:00";
    const opts=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?{mimeType:"audio/webm;codecs=opus"}:undefined;
    mediaRecorder=new MediaRecorder(stream,opts);
    mediaRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    mediaRecorder.onstop=()=>{audioBlob=new Blob(chunks,{type:mediaRecorder.mimeType||"audio/webm"});$("audioPreview").src=URL.createObjectURL(audioBlob);$("audioPreview").hidden=false;$("playRecording").disabled=false;$("submitRecording").disabled=false;$("submitStatus").textContent=`Recording ready (${Math.ceil(audioBlob.size/1024)} KB)`;log("Recording ready");};
    mediaRecorder.start();
    timerId=setInterval(()=>{seconds++;$("timer").textContent=fmt(seconds);if(seconds>=120)stopRecording();},1000);
    $("startRecording").disabled=true;$("stopRecording").disabled=false;$("submitStatus").textContent="Recording…";log("Recording started");
  }catch(e){$("submitStatus").textContent=`Microphone error: ${e.message}`;log(e.message,true);}
}

function stopRecording(){if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();if(stream)stream.getTracks().forEach(t=>t.stop());clearInterval(timerId);$("startRecording").disabled=false;$("stopRecording").disabled=true;}
function playRecording(){$("audioPreview").play();}

async function submitRecording(){
  const pid=$("participantSelect").value;if(!pid)return alert("Select your name.");if(!audioBlob)return alert("Record first.");
  const name=participantMap.get(pid)||"participant";
  const path=`${name.replace(/[^a-zA-Z0-9_-]/g,"_")}/day-${OSOTUA_CONFIG.currentDay}-${Date.now()}.webm`;
  $("submitRecording").disabled=true;
  try{
    $("submitStatus").textContent="Uploading audio…";
    const{error:uerr}=await sb.storage.from(OSOTUA_CONFIG.bucket).upload(path,audioBlob,{contentType:audioBlob.type||"audio/webm"});
    if(uerr)throw uerr;
    log("Audio uploaded");
    $("submitStatus").textContent="Saving submission…";
    const{data:existing,error:qerr}=await sb.from("memory_submissions").select("id,recording_path").eq("participant_id",pid).eq("day",OSOTUA_CONFIG.currentDay).maybeSingle();
    if(qerr)throw qerr;
    let derr=null;
    if(existing){
      const result=await sb.from("memory_submissions").update({verse:OSOTUA_CONFIG.currentVerse,recording_path:path,submitted_at:new Date().toISOString()}).eq("id",existing.id);
      derr=result.error;
    }else{
      const result=await sb.from("memory_submissions").insert({participant_id:pid,day:OSOTUA_CONFIG.currentDay,verse:OSOTUA_CONFIG.currentVerse,recording_path:path,submitted_at:new Date().toISOString()});
      derr=result.error;
    }
    if(derr)throw derr;
    $("submitStatus").textContent="✓ Submitted successfully";$("submitStatus").className="pass";log("Submission saved");
    await Promise.all([loadCommunity(),loadMyProgress()]);
    setTimeout(()=>{$("submitRecording").disabled=false;},1000);
  }catch(e){$("submitStatus").textContent=`Submit failed: ${e.message}`;$("submitStatus").className="fail";$("submitRecording").disabled=false;log(e.message,true);}
}

async function signedUrl(path){const{data,error}=await sb.storage.from(OSOTUA_CONFIG.bucket).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}

async function loadCommunity(){
  try{
    if(!participants.length)await loadParticipants();
    const{data:rows,error}=await sb.from("memory_submissions").select("participant_id,recording_path,submitted_at").eq("day",OSOTUA_CONFIG.currentDay);
    if(error)throw error;
    const map=new Map(rows.map(r=>[r.participant_id,r]));
    $("communitySummary").textContent=`${rows.length} / ${participants.length} submitted`;
    let html="";
    for(const p of participants){
      const r=map.get(p.id);
      if(!r){html+=`<div class="person-row"><span>${p.name}</span><strong>○ Not submitted</strong></div>`;continue;}
      let player="";
      try{player=`<audio controls src="${await signedUrl(r.recording_path)}"></audio>`;}catch(e){player=`<span class="fail">Audio unavailable</span>`;}
      const time=new Date(r.submitted_at).toLocaleString();
      html+=`<div class="person-row"><span><strong>${p.name}</strong><br><span class="pass">✓ Submitted</span><br><small>${time}</small></span>${player}</div>`;
    }
    $("communityList").innerHTML=html;
  }catch(e){$("communitySummary").textContent="Failed to load";log(e.message,true);}
}

$("runDiagnostics").onclick=diagnostics;
$("startRecording").onclick=startRecording;
$("stopRecording").onclick=stopRecording;
$("playRecording").onclick=playRecording;
$("submitRecording").onclick=submitRecording;
$("refreshCommunity").onclick=loadCommunity;
$("participantSelect").onchange=()=>{localStorage.setItem("osotua_participant",$("participantSelect").value);loadMyProgress();};

window.addEventListener("online",setNetwork);window.addEventListener("offline",setNetwork);
$("verseText").textContent=verseText;
setNetwork();
loadParticipants().then(()=>{
  const saved=localStorage.getItem("osotua_participant");
  if(saved&&participantMap.has(saved)){$("participantSelect").value=saved;loadMyProgress();}
  loadCommunity();
}).catch(e=>log(e.message,true));
