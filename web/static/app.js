"use strict";
// ------------------------------------------------------------------ helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (path, opts) => {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
};
const post = (path, body, signal) =>
  api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal });

const SRC_ICON = {
  meeting: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8"/>',
  slack: '<path d="M4 4h16v12H7l-3 3z"/>',
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
  pr: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6"/><path d="M18 9a6 6 0 0 1-6 6"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  org: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
};
const svg = (paths, cls = "icon sm") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths || SRC_ICON.doc}</svg>`;

const SUGGESTIONS = [
  { t: "Explain my assigned issue, PAY-482", tile: ["var(--accent-tint)", "var(--accent-dark)"], ic: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>' },
  { t: "What did the team decide about retries?", tile: ["var(--green-tint)", "var(--green)"], ic: '<rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>' },
  { t: "Who should I ask about the ledger?", tile: ["var(--amber-tint)", "var(--amber)"], ic: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><line x1="19" y1="7" x2="19" y2="13"/><line x1="16" y1="10" x2="22" y2="10"/>' },
  { t: "Catch me up on this week's standups", tile: ["#E6F0FF", "#1D4FA8"], ic: '<rect x="2" y="5" width="15" height="14" rx="2"/><polygon points="17 9 22 6 22 18 17 15"/>' },
  { t: "How does this team review pull requests?", tile: ["var(--accent-tint)", "var(--accent-dark)"], ic: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { t: "What changed after the September reorg?", tile: ["#F2EDE6", "#6B4A1E"], ic: '<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 8 8 8"/>' },
];

// ------------------------------------------------------------------ state
const state = { actingAs: null, userId: null, questions: {}, activeQ: null, lastAnswer: null };

// ------------------------------------------------------------------ init
async function init() {
  renderSuggestions();
  await loadActingAs();
  await loadSources();
  wireNav();
  wireComposer();
  wireQuestions();
  wireDemo();
}

// ------------------------------------------------------------------ acting-as
async function loadActingAs() {
  const d = await api("/api/acting-as");
  state.actingAs = d.name; state.userId = d.user_id;
  const sel = $("#acting-as");
  sel.innerHTML = d.options.map(o => `<option value="${o.name}">${o.name}</option>`).join("");
  sel.value = d.name;
  paintUser(d);
  sel.onchange = async () => {
    const r = await post("/api/acting-as", { user: sel.value });
    state.actingAs = r.name; state.userId = r.user_id;
    paintUser(r);
    state.questions = {}; state.activeQ = null; renderQuestionList();
    showEmpty();
  };
}
function paintUser(d) {
  $("#user-name").textContent = d.name;
  $("#user-sub").textContent = (d.meta && d.meta.subtitle) || "";
  $("#user-avatar").textContent = (d.meta && d.meta.initials) || d.name.split(" ").map(x => x[0]).join("");
}

// ------------------------------------------------------------------ sources
async function loadSources() {
  try {
    const s = await api("/api/sources");
    $("#c-meetings").textContent = s.meetings;
    $("#c-slack").textContent = s.slack;
    $("#c-issues").textContent = s.issues_prs;
    $("#c-docs").textContent = s.docs;
    $("#live-dot").hidden = !s.live;
  } catch (e) { /* leave dashes */ }
}

// ------------------------------------------------------------------ nav / views
function wireNav() {
  $$(".nav-item").forEach(b => b.onclick = () => switchView(b.dataset.view));
}
function switchView(view) {
  $$(".nav-item").forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  $("#view-ask").hidden = view !== "ask";
  $("#view-memory").hidden = view !== "memory";
  if (view === "memory") { $("#topbar-title").textContent = "Team memory"; startMemory(); }
  else { $("#topbar-title").textContent = state.activeQ ? trunc(state.activeQ) : "New question"; stopMemory(); }
}
const trunc = s => s.length > 54 ? s.slice(0, 54) + "…" : s;

// ------------------------------------------------------------------ suggestions
function renderSuggestions() {
  $("#suggestions").innerHTML = SUGGESTIONS.map(s => `
    <button class="suggest-card" data-q="${s.t.replace(/"/g, "&quot;")}">
      <span class="suggest-tile" style="background:${s.tile[0]};color:${s.tile[1]}">${svg(s.ic, "icon")}</span>
      <span class="suggest-text">${s.t}</span>
    </button>`).join("");
  $$(".suggest-card").forEach(b => b.onclick = () => ask(b.dataset.q));
}

// ------------------------------------------------------------------ composer
function wireComposer() {
  const ta = $("#composer-input"), send = $("#send-btn");
  ta.oninput = () => send.disabled = !ta.value.trim();
  ta.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (ta.value.trim()) ask(ta.value.trim()); }
  };
  $("#composer").onsubmit = e => { e.preventDefault(); if (ta.value.trim()) ask(ta.value.trim()); };
}

// ------------------------------------------------------------------ questions list
function wireQuestions() {
  $("#new-question").onclick = () => { state.activeQ = null; renderQuestionList(); showEmpty(); $("#topbar-title").textContent = "New question"; };
  $("#q-search-input").oninput = e => {
    const q = e.target.value.toLowerCase();
    $$("#q-list .q-item").forEach(li => li.hidden = !li.dataset.text.includes(q));
  };
}
function tagFor(q) {
  const l = q.toLowerCase();
  if (/pay-\d+/i.test(q)) return (q.match(/pay-\d+/i)[0].toUpperCase()) + " · issue";
  if (l.includes("vendor") || l.includes("pricing") || l.includes("restricted")) return "Privacy";
  if (l.includes("who") || l.includes("ask")) return "People";
  if (l.includes("decide") || l.includes("decision") || l.includes("retr")) return "Decision";
  return "Question";
}
function renderQuestionList() {
  const items = Object.values(state.questions);
  $("#q-list").innerHTML = items.map(q => `
    <li class="q-item ${state.activeQ === q.text ? "active" : ""}" data-text="${q.text.toLowerCase()}" data-q="${q.text.replace(/"/g, "&quot;")}">
      <div class="q-tag">${tagFor(q.text)}</div>
      <div class="q-text">${q.text}</div>
    </li>`).join("");
  $$("#q-list .q-item").forEach(li => li.onclick = () => openQuestion(li.dataset.q));
}
function openQuestion(text) {
  state.activeQ = text; renderQuestionList();
  $("#topbar-title").textContent = trunc(text);
  const q = state.questions[text];
  if (q && q.answer) renderAnswer(text, q.answer);
  else ask(text);
}

// ------------------------------------------------------------------ ask flow
function showEmpty() { $("#empty-state").hidden = false; $("#answer-wrap").hidden = true; }
function showAnswerArea() { $("#empty-state").hidden = true; $("#answer-wrap").hidden = false; }

async function ask(question) {
  switchView("ask");
  state.activeQ = question;
  if (!state.questions[question]) state.questions[question] = { text: question, answer: null };
  renderQuestionList();
  $("#topbar-title").textContent = trunc(question);
  $("#composer-input").value = ""; $("#send-btn").disabled = true;
  showAnswerArea();
  renderThinking(question);
  try {
    const ans = await post("/api/ask", { user_id: state.userId, question }, AbortSignal.timeout(120_000));
    state.questions[question].answer = ans;
    state.lastAnswer = ans;
    renderAnswer(question, ans);
  } catch (e) {
    $("#answer-wrap").innerHTML = `<div class="error-banner">Something went wrong. <button class="btn-secondary" onclick="location.reload()">Retry</button></div>`;
  }
}

function renderThinking(question) {
  const steps = ["Searching team memory", "Checking what you can access", "Reading sources", "Finding who to ask"];
  $("#answer-wrap").innerHTML = `
    <div class="answer-layout"><div class="conversation">
      <div class="q-bubble">${esc(question)}</div>
      <div class="thinking"><div class="thinking-head">${markSvg()}Shadow is thinking…</div>
        ${steps.map((s, i) => `<div class="tstep" id="ts${i}"><span class="tick"></span>${s}</div>`).join("")}
      </div></div></div>`;
  steps.forEach((_, i) => setTimeout(() => { const el = $("#ts" + i); if (el) el.classList.add("done"); }, 300 + i * 450));
}

function markSvg(size = 24) { return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#shadow-mark"/></svg>`; }
const esc = s => (s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function mdToHtml(md, cites) {
  let h = esc(md);
  h = h.replace(/\[(\d+)\]/g, (_, n) => `<span class="cite" data-n="${n}">[${n}]</span>`);
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  // bullets + paragraphs
  const lines = h.split("\n"); let out = ""; let inUl = false;
  for (let ln of lines) {
    if (/^\s*[-*]\s+/.test(ln)) { if (!inUl) { out += "<ul>"; inUl = true; } out += "<li>" + ln.replace(/^\s*[-*]\s+/, "") + "</li>"; }
    else { if (inUl) { out += "</ul>"; inUl = false; } if (ln.trim()) out += "<p>" + ln + "</p>"; }
  }
  if (inUl) out += "</ul>";
  return out;
}

function chipFor(ds) {
  if (!ds) return "";
  if (ds.status === "paused") return `<span class="chip paused">Paused · ${fmtDate(ds.decidedOn)}</span>`;
  if (ds.status === "decided" && ds.confirmed === "pending") return `<span class="chip pending">Decided · awaiting confirmation</span>`;
  if (ds.status === "decided") return `<span class="chip decided">Decided · ${fmtDate(ds.decidedOn)}</span>`;
  return `<span class="chip paused">${ds.status}</span>`;
}
function fmtDate(d) { if (!d) return ""; const [y, m, day] = d.split("-"); return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1] + " " + (+day); }

function renderAnswer(question, a) {
  showAnswerArea();
  const cites = a.citations || [];
  const refused = Boolean(a.restricted_note) && cites.length === 0;
  let left = `<div class="q-bubble">${esc(question)}</div>
    <div class="answer-block"><div class="answer-by">${markSvg(24)} Shadow</div>
    ${refused ? "" : `<div class="answer-md">${mdToHtml(a.answer_markdown, cites)}</div>`}`;

  if (a.decision_status)
    left += `<div class="decision-row"><span class="lbl">Decision</span>
      <span class="txt">${esc(a.decision_status.decision)}</span>${chipFor(a.decision_status)}</div>`;

  if (cites.length) {
    left += `<div class="sources"><h4>Where this was discussed</h4>` +
      cites.map((c, i) => `<div class="source-row" data-n="${i + 1}">
        <span class="num">${i + 1}</span>${svg(SRC_ICON[c.source_type])}
        <a class="nm" href="${c.box_url}" target="_blank" rel="noopener">${esc(c.name)}</a>
        <span class="meta">${esc(c.source_type || "")} · ${esc(c.date || "")}</span></div>`).join("") + `</div>`;
  }

  if (a.who_to_ask) {
    const w = a.who_to_ask;
    left += `<div class="who-card"><span class="wavatar">${(w.name || "").split(" ").map(x => x[0]).join("")}</span>
      <div><div class="wname">${esc(w.name)}</div><div class="wrole">${esc(w.role || "")}</div>
      <div class="wreason">${esc(w.reason || "")}</div>
      ${w.moved_note ? `<div class="wmoved">${esc(w.moved_note)}</div>` : ""}</div></div>`;
  }

  if (a.restricted_note) {
    left += `<div class="restricted">${svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}
      <div><div class="rtitle">I can't use that source for you</div><div class="rbody">${esc(a.restricted_note)}</div></div></div>`;
  }
  left += `</div>`;

  const right = cites.length ? `<div class="preview"><div class="preview-card" id="preview-card"></div></div>` : "";
  $("#answer-wrap").innerHTML = `<div class="answer-layout"><div class="conversation">${left}</div>${right}</div>`;

  $$("#answer-wrap .cite, #answer-wrap .source-row").forEach(el =>
    el.onclick = () => selectCitation(cites, +el.dataset.n - 1));
  if (cites.length) selectCitation(cites, 0);
}

async function selectCitation(cites, idx) {
  const c = cites[idx]; if (!c) return;
  const card = $("#preview-card"); if (!card) return;
  card.innerHTML = `<div class="preview-head">${svg(SRC_ICON[c.source_type])}
    <span class="pnm">${esc(c.name)}</span><span class="pdate">${esc(c.date || "")}</span>
    <a class="open-box" href="${c.box_url}" target="_blank" rel="noopener">Open in Box
      ${svg('<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>')}</a></div>
    <div class="ph">Loading preview…</div>`;
  try {
    const { url } = await api("/api/embed?file_id=" + encodeURIComponent(c.file_id));
    const body = card.querySelector(".ph");
    if (url) body.outerHTML = `<iframe src="${url}" title="${esc(c.name)}"></iframe>`;
    else body.textContent = "Preview unavailable — open in Box.";
  } catch { const b = card.querySelector(".ph"); if (b) b.textContent = "Preview unavailable — open in Box."; }
}

// ------------------------------------------------------------------ memory view
let memTimer = null;
function startMemory() { loadActivity(); loadDecisions(); memTimer = setInterval(loadActivity, 2000); }
function stopMemory() { if (memTimer) clearInterval(memTimer); memTimer = null; }

let lastActTs = null;
async function loadActivity() {
  try {
    const { rows } = await api("/api/activity");
    const list = $("#activity-list");
    const newest = rows[0] && rows[0].ts;
    list.innerHTML = rows.map(r => `
      <li class="activity-row ${r.ts !== lastActTs && r.ts === newest ? "enter" : ""}">
        <span class="badge ${r.agent}">${r.agent}</span>
        <span class="act">${esc(r.action)}</span>
        <span class="time">${rel(r.ts)}</span></li>`).join("");
    lastActTs = newest;
    const running = rows[0] && ({ Webhook: "observe", Librarian: "remember", Scribe: "remember", Cartographer: "remember", Answer: "answer" }[rows[0].agent]);
    $$(".pstep").forEach(s => s.classList.toggle("running", running === s.dataset.step));
  } catch { }
}
function rel(ts) {
  const s = Math.max(0, (Date.now() / 1000) - parseFloat(ts));
  if (s < 60) return Math.floor(s) + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
}
async function loadDecisions() {
  try {
    const { rows } = await api("/api/decisions");
    $("#decisions-body").innerHTML = rows.map(d => `
      <tr data-url="${d.box_url}">
        <td>${esc(d.decision || d.name)}</td>
        <td>${chipFor({ status: d.status, confirmed: d.confirmed, decidedOn: "" })}</td>
        <td>${esc((d.owners || "").split("@")[0])}</td>
        <td>${d.confirmed === "pending" ? '<span class="wait-pill">Waiting on Dana</span>' : (d.confirmed || "")}</td>
      </tr>`).join("");
    $$("#decisions-body tr").forEach(tr => tr.onclick = () => window.open(tr.dataset.url, "_blank"));
  } catch { }
}

// ------------------------------------------------------------------ demo controls
function wireDemo() {
  $("#btn-ingest").onclick = () => runDemo($("#btn-ingest"), "/api/ingest", "Ingestion started");
  $("#btn-confirm").onclick = () => runDemo($("#btn-confirm"), "/api/simulate/confirm-task", "Task completed");
}
async function runDemo(btn, path, okMsg) {
  const orig = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>${orig}`;
  $("#demo-result").textContent = "";
  try {
    const r = await post(path, {});
    $("#demo-result").textContent = r.ok === false ? ("Failed: " + (r.error || r.reason || "")) : okMsg;
    await loadActivity(); await loadDecisions();
  } catch (e) { $("#demo-result").textContent = "Failed"; }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}

init();
