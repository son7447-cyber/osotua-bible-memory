const client = window.supabase.createClient(
  OSOTUA_CONFIG.supabaseUrl,
  OSOTUA_CONFIG.supabaseKey
);

const $ = (id) => document.getElementById(id);
const now = () => new Date().toLocaleTimeString();

function log(message, error = false) {
  $("log").textContent += `\n[${now()}] ${error ? "ERROR: " : ""}${message}`;
}

function status(id, text, type) {
  const el = $(id);
  el.textContent = text;
  el.className = type || "";
}

async function runTests() {
  $("log").textContent = "Starting diagnostics...";
  status("apiStatus", "Testing...", "working");
  status("participantsStatus", "Waiting", "");
  status("storageStatus", "Waiting", "");
  status("databaseStatus", "Waiting", "");
  $("participantsList").textContent = "Loading...";

  try {
    log("Testing Supabase API connection.");
    const { data, error } = await client
      .from("participants")
      .select("id,name,active")
      .order("name");

    if (error) throw error;
    status("apiStatus", "Connected", "pass");
    status("participantsStatus", `${data.length} loaded`, "pass");
    $("participantsList").innerHTML = data
      .map(p => `<div class="person">${p.name} ${p.active ? "✓" : "(inactive)"}</div>`)
      .join("");
    log(`${data.length} participants loaded.`);
  } catch (error) {
    status("apiStatus", "Failed", "fail");
    status("participantsStatus", "Failed", "fail");
    $("participantsList").textContent = "Participants could not be loaded.";
    log(error.message || String(error), true);
  }

  try {
    status("storageStatus", "Testing...", "working");
    log("Checking recordings bucket.");
    const { data, error } = await client.storage
      .from(OSOTUA_CONFIG.bucket)
      .list("", { limit: 10 });

    if (error) throw error;
    status("storageStatus", "Accessible", "pass");
    log(`Storage accessible. ${data.length} top-level item(s) found.`);
  } catch (error) {
    status("storageStatus", "Failed", "fail");
    log(error.message || String(error), true);
  }

  try {
    status("databaseStatus", "Testing...", "working");
    log("Reading memory_submissions table.");
    const { count, error } = await client
      .from("memory_submissions")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    status("databaseStatus", `Accessible (${count || 0})`, "pass");
    log(`memory_submissions table accessible. ${count || 0} row(s).`);
  } catch (error) {
    status("databaseStatus", "Failed", "fail");
    log(error.message || String(error), true);
  }

  log("Diagnostics finished.");
}

$("runTests").addEventListener("click", runTests);
$("clearLog").addEventListener("click", () => $("log").textContent = "Ready.");
