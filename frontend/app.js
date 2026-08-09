/**
 * app.js — InterviewAI Frontend v4
 *
 * All features:
 *  1. View All -> Candidate Directory view with search, filters & Retake buttons
 *  2. Live interview timer (MM:SS) in header, recorded in report & prompt.md
 *  3. Reports sorted by score DESC, then time_taken_seconds ASC
 *  4. Performance Scatter Plot (Time Taken vs Marks) + Avg Score & Avg Time stats
 *  5. Dynamic active interview count
 *  6. Interviewed candidate badges (✓ 85/100) + "Retake Interview →" option
 */

const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? (window.location.port === "8000" ? "" : "http://localhost:8000")
  : "";

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  phase: "IDLE",          // IDLE | STARTING | INTERVIEWING | COMPLETED
  sessionId: null,
  candidate: null,
  questionCount: 0,
  topicsCount: 0,
  allCandidates: [],
  currentTab: "candidates",
  interviewStartTime: null,
  timerInterval: null,
  activeInterviewCount: 0,
  cdFilter: "all",
  cdSearch: "",
};

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const $landingPage       = document.getElementById("landing-page");
const $dashboard         = document.getElementById("dashboard");
const $candidateDirectory= document.getElementById("candidate-directory");
const $reportViewer      = document.getElementById("report-viewer");
const $chatArea          = document.getElementById("chat-area");
const $messageInput      = document.getElementById("message-input");
const $sendBtn           = document.getElementById("send-btn");
const $typingIndicator   = document.getElementById("typing-indicator");
const $inputArea         = document.getElementById("input-area");
const $searchInput       = document.getElementById("search-input");
const $charCount         = document.getElementById("char-count");
const $candidateList     = document.getElementById("candidate-list");
const $reportList        = document.getElementById("report-list");
const $compBars          = document.getElementById("comparison-bars");
const $cdGrid            = document.getElementById("cd-grid");
const $cdSearch          = document.getElementById("cd-search");

const $headerAvatar      = document.getElementById("header-avatar");
const $headerName        = document.getElementById("header-name");
const $headerRole        = document.getElementById("header-role");
const $statQVal          = document.getElementById("stat-q-val");
const $statTVal          = document.getElementById("stat-t-val");
const $statusBadge       = document.getElementById("status-badge");

const $modalOverlay      = document.getElementById("modal-overlay");
const $modalCandName     = document.getElementById("modal-candidate-name");
const $modalCandRole     = document.getElementById("modal-candidate-role");
const $modalSummary      = document.getElementById("modal-summary");
const $fbStrengths       = document.getElementById("feedback-strengths");
const $fbGaps            = document.getElementById("feedback-gaps");
const $fbNext            = document.getElementById("feedback-next");
const $scoreNumber       = document.getElementById("score-number");
const $scoreGrade        = document.getElementById("score-grade");
const $scoreRingFill     = document.getElementById("score-ring-fill");
const $btnCloseModal     = document.getElementById("btn-close-modal");
const $btnNewInterview   = document.getElementById("btn-new-interview");
const $timerDisplay      = document.getElementById("timer-display");
const $timerChip         = document.getElementById("timer-chip");

// ── Utilities ─────────────────────────────────────────────────────────────────

function genSessionId() {
  return "sess-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now();
}

function getInitials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmt(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
       + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

function fmtTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function startTimer() {
  stopTimer();
  state.interviewStartTime = Date.now();
  $timerDisplay.textContent = "00:00";
  $timerChip.classList.add("timer-active");
  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.interviewStartTime) / 1000);
    $timerDisplay.textContent = fmtTimer(elapsed);
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  $timerChip.classList.remove("timer-active");
}

function getElapsedSeconds() {
  if (!state.interviewStartTime) return 0;
  return Math.floor((Date.now() - state.interviewStartTime) / 1000);
}

function getGrade(score) {
  if (score >= 90) return { label: "Excellent 🌟", cls: "grade-excellent" };
  if (score >= 75) return { label: "Good 👍",      cls: "grade-good" };
  if (score >= 60) return { label: "Average 📈",   cls: "grade-average" };
  if (score >= 40) return { label: "Below Avg ⚠️", cls: "grade-average" };
  return               { label: "Needs Work 🔧",   cls: "grade-poor" };
}

function getScoreCls(score) {
  if (score >= 90) return "score-excellent";
  if (score >= 75) return "score-good";
  if (score >= 60) return "score-average";
  return "score-poor";
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem("interview-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("interview-theme", next);
});

// ── View Switching ────────────────────────────────────────────────────────────

function showView(view) {
  if ($landingPage) $landingPage.style.display = view === "landing" ? "flex" : "none";
  $dashboard.style.display          = view === "dashboard"  ? "flex" : "none";
  $candidateDirectory.style.display = view === "directory"  ? "flex" : "none";
  $interviewPanel.style.display     = view === "interview"  ? "flex" : "none";
  $reportViewer.style.display       = view === "report"     ? "flex" : "none";
}

function goHome() {
  if (state.phase === "INTERVIEWING") {
    if (!confirm("Leave this interview? Progress will be lost.")) return;
  }
  stopTimer();
  state.phase     = "IDLE";
  state.candidate = null;
  state.sessionId = null;
  document.querySelectorAll(".candidate-card").forEach(el => el.classList.remove("active"));
  switchTab("home");
  refreshDashboardStats();
}

function openCandidateDirectory() {
  switchTab("candidates");
  showView("directory");
  renderCandidateDirectory();
}

// ── Tab Switching ─────────────────────────────────────────────────────────────

function switchTab(tab) {
  state.currentTab = tab;
  const $tabHome = document.getElementById("tab-home");
  if ($tabHome) $tabHome.classList.toggle("active", tab === "home");
  document.getElementById("tab-candidates").classList.toggle("active", tab === "candidates");
  document.getElementById("tab-reports").classList.toggle("active",    tab === "reports");

  if (tab === "home") {
    showView("landing");
    document.getElementById("panel-candidates").classList.remove("hidden");
    document.getElementById("panel-reports").classList.add("hidden");
  } else if (tab === "candidates") {
    document.getElementById("panel-candidates").classList.remove("hidden");
    document.getElementById("panel-reports").classList.add("hidden");
    if ($interviewPanel.style.display === "none" && $reportViewer.style.display === "none") {
      showView("dashboard");
    }
  } else if (tab === "reports") {
    document.getElementById("panel-candidates").classList.add("hidden");
    document.getElementById("panel-reports").classList.remove("hidden");
    loadReports();
    if ($interviewPanel.style.display === "none" && $reportViewer.style.display === "none") {
      showView("dashboard");
    }
  }
}

// ── Status Check + Candidate Load ─────────────────────────────────────────────

async function init() {
  initTheme();
  showView("landing");

  try {
    const res = await fetch(`${API_BASE}/api/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const status = await res.json();
    if (!status.api_key_configured) {
      showSetupBanner(
        "🔑 Groq API Key Required",
        `The backend is running but no API key is set.<br/>
         1. Get a free key at <a href="https://console.groq.com" target="_blank">console.groq.com</a><br/>
         2. Edit <code>backend\\.env</code> and replace <code>your_groq_api_key_here</code><br/>
         3. Restart the backend server`,
        "warning"
      );
    }
  } catch (err) {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    showSetupBanner(
      "⚠️ Backend Service Unavailable",
      isLocal
        ? `Cannot connect to <strong>http://localhost:8000</strong><br/>Run <code>start.bat</code> or: <code>cd backend</code> → <code>python -m uvicorn main:app --port 8000 --reload</code>`
        : `Backend API request failed (${err.message}). Make sure environment variable <code>GROQ_API_KEY</code> is set in Vercel Settings.`,
      "error"
    );
    $candidateList.innerHTML = `<div class="sidebar-error">Backend offline</div>`;
    renderEmptyStats();
    return;
  }

  await loadCandidates();
}

function showSetupBanner(title, html, type) {
  document.getElementById("dash-setup-banner")?.querySelector(".setup-banner")?.remove();
  const b = document.createElement("div");
  b.className = `setup-banner setup-banner-${type}`;
  b.innerHTML = `
    <div class="setup-banner-inner">
      <strong class="setup-banner-title">${title}</strong>
      <div class="setup-banner-body">${html}</div>
      <button class="setup-banner-close" onclick="this.closest('.setup-banner').remove()">✕ Dismiss</button>
    </div>`;
  document.getElementById("dash-setup-banner").appendChild(b);
}

function renderEmptyStats() {
  document.getElementById("stat-total").textContent     = "—";
  document.getElementById("stat-active").textContent    = "—";
  document.getElementById("stat-avg-score").textContent = "—";
  document.getElementById("stat-avg-time").textContent  = "—";
}

async function loadCandidates() {
  try {
    const res  = await fetch(`${API_BASE}/api/candidates`);
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    state.allCandidates = data.candidates || [];
    renderCandidateList(state.allCandidates);
    renderDashboard(state.allCandidates);
    if ($candidateDirectory.style.display !== "none") {
      renderCandidateDirectory();
    }
  } catch (err) {
    $candidateList.innerHTML = `<div class="sidebar-error">⚠️ Cannot connect to backend.</div>`;
    renderEmptyStats();
  }
}

// ── Dashboard Rendering ───────────────────────────────────────────────────────

function renderDashboard(candidates) {
  const total = candidates.length;
  document.getElementById("stat-total").textContent = total;

  const top2 = [...candidates].sort((a, b) => b.commitDays - a.commitDays).slice(0, 2);
  renderPriorityCandidates(top2);

  refreshDashboardStats();
}

async function refreshDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const data = await res.json();

    state.activeInterviewCount = data.active_interviews || 0;
    document.getElementById("stat-active").textContent = state.activeInterviewCount;

    const reports = data.reports || [];
    renderScatterChart(reports);
    renderDashboardAverages(reports);
  } catch {
    // defaults
  }
}

function renderDashboardAverages(reports) {
  const $avgScore    = document.getElementById("stat-avg-score");
  const $avgScoreSub = document.getElementById("stat-avg-score-sub");
  const $avgTime     = document.getElementById("stat-avg-time");
  const $avgTimeSub  = document.getElementById("stat-avg-time-sub");

  if (!reports.length) {
    $avgScore.textContent    = "—";
    $avgScoreSub.textContent = "";
    $avgTime.textContent     = "—";
    $avgTimeSub.textContent  = "";
    return;
  }

  const avgScore   = Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length);
  const avgTimeSec = Math.round(reports.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / reports.length);
  const avgMin     = Math.floor(avgTimeSec / 60);
  const avgSec     = avgTimeSec % 60;

  $avgScore.textContent    = avgScore;
  $avgScoreSub.textContent = `out of 100 · ${reports.length} interview${reports.length > 1 ? "s" : ""}`;
  $avgTime.textContent     = avgMin > 0 ? `${avgMin}m ${avgSec}s` : `${avgSec}s`;
  $avgTimeSub.textContent  = `avg per interview`;
}

function renderScatterChart(reports) {
  const svg = document.getElementById("scatter-chart");
  const emptyEl = document.getElementById("scatter-empty");
  if (!svg) return;

  if (!reports.length) {
    svg.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "flex";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";

  const W = 700, H = 220;
  const pad = { t: 20, r: 30, b: 40, l: 50 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const maxTime = Math.max(...reports.map(r => r.time_taken_seconds || 0), 60);
  const maxScore = 100;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  let svgContent = `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="${pad.l}" y="${pad.t}" width="${innerW}" height="${innerH}" fill="url(#sg)" rx="4"/>
  `;

  // Horizontal grid lines (Score 0-100)
  for (let sc = 0; sc <= 100; sc += 25) {
    const y = pad.t + innerH - (sc / maxScore) * innerH;
    svgContent += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,3"/>`;
    svgContent += `<text x="${pad.l - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--font-sans)" fill="var(--text-muted)">${sc}</text>`;
  }

  // Vertical grid lines (Time)
  const timeStep = maxTime <= 120 ? 30 : maxTime <= 300 ? 60 : 120;
  for (let t = 0; t <= maxTime; t += timeStep) {
    const x = pad.l + (t / maxTime) * innerW;
    svgContent += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,3"/>`;
    const label = t < 60 ? `${t}s` : `${Math.floor(t / 60)}m`;
    svgContent += `<text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" font-size="10" font-family="var(--font-sans)" fill="var(--text-muted)">${label}</text>`;
  }

  // Axis labels
  svgContent += `<text x="${pad.l + innerW / 2}" y="${H - 4}" text-anchor="middle" font-size="10.5" font-family="var(--font-sans)" fill="var(--text-muted)" font-weight="600">Time Taken</text>`;
  svgContent += `<text x="12" y="${pad.t + innerH / 2}" text-anchor="middle" font-size="10.5" font-family="var(--font-sans)" fill="var(--text-muted)" font-weight="600" transform="rotate(-90, 12, ${pad.t + innerH / 2})">Score</text>`;

  // Scatter dots
  reports.forEach((r) => {
    const timeSec = r.time_taken_seconds || 0;
    const x = pad.l + (timeSec / maxTime) * innerW;
    const y = pad.t + innerH - (r.score / maxScore) * innerH;
    const color = r.score >= 90 ? "var(--green)"
                : r.score >= 75 ? "var(--blue)"
                : r.score >= 60 ? "var(--amber)"
                : "var(--red)";

    svgContent += `<circle cx="${x}" cy="${y}" r="10" fill="${color}" opacity="0.15"/>`;
    svgContent += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="var(--bg-card)" stroke-width="1.5" style="cursor:pointer;"><title>${esc(r.candidate_name)} — Score: ${r.score}, Time: ${fmtTimer(timeSec)}</title></circle>`;
    const firstName = (r.candidate_name || "").split(" ")[0];
    svgContent += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="9" font-family="var(--font-sans)" fill="var(--text-secondary)" font-weight="600">${esc(firstName)}</text>`;
  });

  svg.innerHTML = svgContent;
}

function renderPriorityCandidates(candidates) {
  const grid = document.getElementById("priority-grid");
  if (!candidates.length) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px;">No candidates loaded.</div>`;
    return;
  }

  grid.innerHTML = "";
  candidates.forEach(c => {
    const initials   = getInitials(c.name);
    const commitPct  = Math.round((c.commitDays / 31) * 100);

    const missions = (c.raw?.missions || []).filter(m => m.passed).slice(0, 4);
    const tags = missions.map(m => (m.title || "").split(" ").slice(0, 2).join(" "));
    const tagHtml = tags.slice(0, 4).map(t => `<span class="skill-tag">${esc(t)}</span>`).join("")
                 || `<span class="skill-tag">${esc(c.jobRole)}</span>`;

    const badgeHtml = c.has_report
      ? `<div class="interviewed-badge">✓ Interviewed · ${c.last_score}/100</div>`
      : `<div class="best-match-badge">Best Match</div>`;

    const btnText  = c.has_report ? "Retake Interview →" : "Start Interview →";
    const btnClass = c.has_report ? "start-btn retake-btn" : "start-btn";

    const card = document.createElement("div");
    card.className = "priority-card";
    card.innerHTML = `
      <div class="priority-card-header">
        <div class="priority-card-info">
          <div class="priority-avatar">${esc(initials)}</div>
          <div>
            <div class="priority-name">${esc(c.name)}</div>
            <div class="priority-role">${esc(c.jobRole)}</div>
          </div>
        </div>
        ${badgeHtml}
      </div>
      <div class="priority-tags">${tagHtml}</div>
      <div class="priority-progress-row">
        <div class="priority-progress-label">
          <span>Commit Rate</span><span>${commitPct}%</span>
        </div>
        <div class="priority-progress-track">
          <div class="priority-progress-fill" style="width:${commitPct}%"></div>
        </div>
      </div>
      <button class="${btnClass}" data-id="${esc(c.id)}">${btnText}</button>
    `;

    card.querySelector(".start-btn").addEventListener("click", () => selectCandidate(c));
    grid.appendChild(card);
  });
}

// ── Candidate Directory Grid (Main Content Area) ──────────────────────────────

function filterDirectory(filter) {
  state.cdFilter = filter;
  document.querySelectorAll(".cd-filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderCandidateDirectory();
}

$cdSearch?.addEventListener("input", () => {
  state.cdSearch = $cdSearch.value.toLowerCase().trim();
  renderCandidateDirectory();
});

function renderCandidateDirectory() {
  if (!$cdGrid) return;
  $cdGrid.innerHTML = "";

  let list = state.allCandidates;

  // Filter
  if (state.cdFilter === "interviewed") {
    list = list.filter(c => c.has_report);
  } else if (state.cdFilter === "pending") {
    list = list.filter(c => !c.has_report);
  }

  // Search
  if (state.cdSearch) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(state.cdSearch) ||
      c.jobRole.toLowerCase().includes(state.cdSearch)
    );
  }

  if (!list.length) {
    $cdGrid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted);font-size:14px;">No candidates match your search filter.</div>`;
    return;
  }

  list.forEach(c => {
    const initials  = getInitials(c.name);
    const commitPct = Math.round((c.commitDays / 31) * 100);

    const badgeHtml = c.has_report
      ? `<div class="interviewed-badge">✓ Interviewed · ${c.last_score}/100</div>`
      : `<div class="best-match-badge">Available</div>`;

    const btnText  = c.has_report ? "Retake Interview →" : "Start Interview →";
    const btnClass = c.has_report ? "start-btn retake-btn" : "start-btn";

    const card = document.createElement("div");
    card.className = "cd-card";
    card.innerHTML = `
      <div class="priority-card-header">
        <div class="priority-card-info">
          <div class="cd-avatar">${esc(initials)}</div>
          <div>
            <div class="cd-name">${esc(c.name)}</div>
            <div class="cd-role">${esc(c.jobRole)} · ${c.yearsExperience}y exp</div>
          </div>
        </div>
        ${badgeHtml}
      </div>
      <div class="cd-meta-row">
        <span>Commit Days: <strong>${c.commitDays}/31</strong> (${commitPct}%)</span>
        <span>Missions: <strong>${c.missionsCompleted}</strong></span>
      </div>
      <button class="${btnClass}">${btnText}</button>
    `;

    card.querySelector(".start-btn").addEventListener("click", () => selectCandidate(c));
    $cdGrid.appendChild(card);
  });
}

// ── Candidate Sidebar List ────────────────────────────────────────────────────

function renderCandidateList(candidates) {
  $candidateList.innerHTML = "";
  if (!candidates.length) {
    $candidateList.innerHTML = `<div style="padding:14px;text-align:center;color:var(--sidebar-muted);font-size:12px;">No candidates found.</div>`;
    return;
  }
  candidates.forEach(c => $candidateList.appendChild(makeCandidateCard(c)));
}

function makeCandidateCard(c) {
  const card = document.createElement("div");
  card.className = "candidate-card";
  card.dataset.id = c.id;

  const st     = (c.status || "").toLowerCase();
  const dotCls = st === "completed"  ? "completed"
               : st === "in-progress" ? "active"
               : "other";
  const dotLabel = st === "completed" ? "Completed" : st === "in-progress" ? "In-Progress" : c.missionsCompleted + " Missions";

  const interviewBadge = c.has_report
    ? `<div class="candidate-interviewed-badge">
         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
         <span>${c.last_score}/100</span>
       </div>`
    : "";

  card.innerHTML = `
    <div class="candidate-avatar">${esc(getInitials(c.name))}</div>
    <div class="candidate-meta">
      <div class="candidate-name">${esc(c.name)}</div>
      <div class="candidate-role-sm">${esc(c.jobRole)} · ${c.yearsExperience}y exp</div>
      <div class="candidate-status">
        <div class="status-dot-sm ${dotCls}"></div>
        <span style="color:var(--sidebar-muted);font-size:10.5px;">${esc(dotLabel)}</span>
      </div>
    </div>
    ${interviewBadge}`;

  card.addEventListener("click", () => selectCandidate(c));
  return card;
}

// ── Sidebar Search ────────────────────────────────────────────────────────────
$searchInput.addEventListener("input", () => {
  const q = $searchInput.value.toLowerCase().trim();
  renderCandidateList(
    state.allCandidates.filter(c =>
      c.name.toLowerCase().includes(q) || c.jobRole.toLowerCase().includes(q)
    )
  );
});

// ── Reports (Sorted: Score DESC, Time ASC) ────────────────────────────────────

async function loadReports() {
  $reportList.innerHTML = `<div class="reports-empty">Loading…</div>`;
  $compBars.innerHTML   = `<div class="reports-empty-sm">Loading…</div>`;
  try {
    const res  = await fetch(`${API_BASE}/api/reports`);
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    const reports = data.reports || [];
    renderComparisonBars(reports);
    renderReportList(reports);
  } catch {
    $reportList.innerHTML = `<div class="reports-empty">Could not load reports.</div>`;
    $compBars.innerHTML   = `<div class="reports-empty-sm">Error loading</div>`;
  }
}

function renderComparisonBars(reports) {
  if (!reports.length) {
    $compBars.innerHTML = `<div class="reports-empty-sm">No reports yet</div>`;
    return;
  }
  // Sort: score DESC, time ASC
  const sorted = [...reports].sort((a, b) => b.score - a.score || (a.time_taken_seconds || 0) - (b.time_taken_seconds || 0));
  $compBars.innerHTML = sorted.map((r, i) => `
    <div class="comp-row">
      <div class="comp-rank">#${i + 1}</div>
      <div class="comp-name" title="${esc(r.candidate_name)}">${esc(r.candidate_name.split(" ")[0])}</div>
      <div class="comp-track">
        <div class="comp-fill ${getScoreCls(r.score)}" style="width:${r.score}%"></div>
      </div>
      <div class="comp-score-val">${r.score}</div>
    </div>`).join("");
}

function renderReportList(reports) {
  if (!reports.length) {
    $reportList.innerHTML = `<div class="reports-empty">No completed interviews yet.<br/>Complete an interview to save a report.</div>`;
    return;
  }
  // Backend already sorts: score DESC, time ASC
  $reportList.innerHTML = "";
  reports.forEach((r, i) => {
    const timeSec = r.time_taken_seconds || 0;
    const timeStr = fmtTimer(timeSec);
    const card = document.createElement("div");
    card.className = "report-card";
    card.innerHTML = `
      <div class="report-card-top">
        <div class="report-rank">#${i + 1}</div>
        <div class="report-name">${esc(r.candidate_name)}</div>
        <div class="report-score-badge ${getScoreCls(r.score)}">${r.score}/100</div>
      </div>
      <div class="report-role">${esc(r.job_role)}</div>
      <div class="report-meta-row">
        <span class="report-time">⏱ ${timeStr}</span>
        <span class="report-date">${fmtDate(r.completed_at)}</span>
        <button class="report-delete-btn" title="Delete Report" onclick="event.stopPropagation(); deleteReport('${esc(r.filename)}')">🗑️</button>
      </div>`;
    card.addEventListener("click", () => openReport(r.filename, r));
    $reportList.appendChild(card);
  });
}

async function openReport(filename, meta) {
  showView("report");
  document.getElementById("rv-title").textContent = `${meta.candidate_name}`;

  const deleteBtn = document.getElementById("rv-delete-btn");
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteReport(filename);
  }

  const $body = document.getElementById("rv-body");
  $body.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Loading…</div>`;

  try {
    const res  = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderReportBody($body, data);
  } catch {
    $body.innerHTML = `<div style="color:var(--red);font-size:13px;">Failed to load report.</div>`;
  }
}

function renderReportBody($body, data) {
  const grade   = getGrade(data.score || 0);
  const fb      = data.feedback || {};
  const timeSec = data.time_taken_seconds || 0;
  const timeStr = fmtTimer(timeSec);

  const listHtml = arr => (arr || []).length
    ? arr.map(x => `<li>${esc(x)}</li>`).join("")
    : "<li>None identified.</li>";

  const transcript = (data.transcript || [])
    .filter(m => m.role !== "system")
    .map(m => {
      const isAI = m.role === "assistant";
      return `
        <div class="rv-transcript-entry">
          <div class="rv-speaker ${isAI ? "ai" : "user"}">${esc(isAI ? "Interviewer (AI)" : data.candidate_name)}</div>
          <div class="rv-text">${esc(m.content)}</div>
        </div>`;
    }).join("");

  $body.innerHTML = `
    <div class="rv-score-banner">
      <div style="display:flex;align-items:baseline;gap:5px;">
        <div class="rv-score-num">${data.score}</div>
        <div class="rv-score-slash">/100</div>
      </div>
      <div style="flex:1;">
        <div class="rv-cname">${esc(data.candidate_name)}</div>
        <div class="rv-crole">${esc(data.job_role)}</div>
        <div class="rv-date">${fmtDate(data.completed_at)} &nbsp;·&nbsp; ⏱ <strong>${timeStr}</strong> &nbsp;·&nbsp; <strong class="${grade.cls}">${grade.label}</strong></div>
      </div>
    </div>

    <div class="rv-section">
      <div class="rv-section-header">📝 Summary</div>
      <div class="rv-section-body" style="font-size:13.5px;line-height:1.7;font-style:italic;color:var(--text-secondary);">${esc(fb.summary || "")}</div>
    </div>

    <div class="rv-section">
      <div class="rv-section-header">✅ Strengths</div>
      <div class="rv-section-body"><ul style="list-style:disc;padding-left:18px;font-size:13.5px;line-height:1.8;">${listHtml(fb.strengths)}</ul></div>
    </div>

    <div class="rv-section">
      <div class="rv-section-header">⚠️ Areas to Improve</div>
      <div class="rv-section-body"><ul style="list-style:disc;padding-left:18px;font-size:13.5px;line-height:1.8;">${listHtml(fb.gaps)}</ul></div>
    </div>

    <div class="rv-section">
      <div class="rv-section-header">🚀 Next Steps</div>
      <div class="rv-section-body"><ul style="list-style:disc;padding-left:18px;font-size:13.5px;line-height:1.8;">${listHtml(fb.next)}</ul></div>
    </div>

    <div class="rv-section">
      <div class="rv-section-header">💬 Full Transcript</div>
      <div class="rv-section-body">${transcript || '<div style="color:var(--text-muted);font-size:13px;">No transcript.</div>'}</div>
    </div>`;
}

function closeReportViewer() {
  switchTab("reports");
  showView("dashboard");
}

async function deleteReport(filename) {
  if (!confirm("Are you sure you want to delete this interview report? This action cannot be undone.")) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(filename)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete report.");
    closeReportViewer();
    await loadReports();
    await loadCandidates();
  } catch (err) {
    alert(`Could not delete report: ${err.message}`);
  }
}

// ── Interview Flow ────────────────────────────────────────────────────────────

async function selectCandidate(candidate) {
  if (state.phase === "STARTING" || state.phase === "INTERVIEWING") {
    if (!confirm(`Start a new interview with ${candidate.name}? Current session will be lost.`)) return;
  }

  // Highlight sidebar card
  document.querySelectorAll(".candidate-card").forEach(el => el.classList.remove("active"));
  document.querySelector(`[data-id="${candidate.id}"]`)?.classList.add("active");

  // Reset state
  state.candidate     = candidate;
  state.sessionId     = genSessionId();
  state.questionCount = 0;
  state.topicsCount   = 0;
  state.phase         = "STARTING";

  // Show interview panel
  showView("interview");

  // Populate header
  $headerAvatar.textContent = getInitials(candidate.name);
  $headerName.textContent   = candidate.name;
  $headerRole.textContent   = `${candidate.jobRole} · ${candidate.yearsExperience} yrs exp`;
  $statusBadge.innerHTML    = `<span class="status-dot"></span> In Progress`;
  $statusBadge.classList.remove("done");
  updateStats();

  clearChat();
  addSystemMsg("Interview session started");
  setInput(false);
  showTyping(true);

  try {
    const res = await fetch(`${API_BASE}/api/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, candidate: candidate.raw }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    showTyping(false);
    appendMsg("assistant", data.reply);
    state.phase = "INTERVIEWING";
    startTimer();
    setInput(true);
    $messageInput.focus();

    // Refresh active count
    refreshDashboardStats();

  } catch (err) {
    showTyping(false);
    appendMsg("assistant", `⚠️ Failed to start: ${err.message}`);
    state.phase = "IDLE";
    stopTimer();
    setInput(false);
  }
}

async function sendMessage() {
  const text = $messageInput.value.trim();
  if (!text || state.phase !== "INTERVIEWING") return;

  appendMsg("user", text);
  $messageInput.value = "";
  autoResize($messageInput);
  $charCount.textContent = "0";
  $sendBtn.disabled = true;
  showTyping(true);
  setInput(false);
  state.questionCount++;
  updateStats();

  try {
    const res = await fetch(`${API_BASE}/api/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    showTyping(false);
    appendMsg("assistant", data.reply);

    if (data.done) {
      state.phase = "COMPLETED";
      stopTimer();
      const elapsed = getElapsedSeconds();
      setInput(false);
      $statusBadge.innerHTML = `<span class="status-dot"></span> Completed`;
      $statusBadge.classList.add("done");
      addSystemMsg(`Interview complete — Duration: ${fmtTimer(elapsed)} — report saved`);
      loadCandidates();
      setTimeout(() => { if (data.feedback) showModal(data.feedback); }, 1000);
    } else {
      state.topicsCount = countTopics();
      updateStats();
      setInput(true);
      $messageInput.focus();
    }

  } catch (err) {
    showTyping(false);
    appendMsg("assistant", `⚠️ Error: ${err.message}`);
    setInput(true);
  }
}

// ── Chat Helpers ──────────────────────────────────────────────────────────────

function clearChat()     { $chatArea.innerHTML = ""; }

function appendMsg(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;
  const initials = role === "assistant" ? "AI" : getInitials(state.candidate?.name || "You");
  wrap.innerHTML = `
    <div class="msg-avatar">${esc(initials)}</div>
    <div class="msg-content">
      <div class="msg-bubble">${esc(text)}</div>
      <div class="msg-time">${fmt()}</div>
    </div>`;
  $chatArea.appendChild(wrap);
  scrollChat();
}

function addSystemMsg(text) {
  const d = document.createElement("div");
  d.className = "system-msg";
  d.textContent = text;
  $chatArea.appendChild(d);
  scrollChat();
}

function scrollChat() {
  requestAnimationFrame(() => { $chatArea.scrollTop = $chatArea.scrollHeight; });
}

function showTyping(v) {
  $typingIndicator.style.display = v ? "flex" : "none";
  if (v) scrollChat();
}

function setInput(enabled) {
  $messageInput.disabled  = !enabled;
  $sendBtn.disabled       = !enabled || !$messageInput.value.trim();
  $inputArea.style.opacity       = enabled ? "1" : "0.5";
  $inputArea.style.pointerEvents = enabled ? "auto" : "none";
}

function updateStats() {
  $statQVal.textContent = state.questionCount;
  $statTVal.textContent = state.topicsCount;
}

function countTopics() {
  const msgs = $chatArea.querySelectorAll(".message.assistant .msg-bubble");
  const topics = new Set();
  const kws = ["embeddings","vector","retrieval","rag","prompt","fine-tun","agent","mcp",
    "docker","kubernetes","streaming","langchain","chatbot","deployment","security",
    "monitoring","function calling","llm"];
  msgs.forEach(el => {
    const t = el.textContent.toLowerCase();
    let m; const re = /\bday\s*(\d+)\b/gi;
    while ((m = re.exec(t)) !== null) topics.add("day-" + m[1]);
    kws.forEach(k => { if (t.includes(k)) topics.add(k); });
  });
  return topics.size;
}

// ── Feedback Modal ────────────────────────────────────────────────────────────

function showModal(feedback) {
  const c = state.candidate;
  $modalCandName.textContent = c.name;
  $modalCandRole.textContent = `${c.jobRole} · ${c.yearsExperience} yrs`;
  $modalSummary.textContent  = feedback.summary || "No summary available.";

  renderList($fbStrengths, feedback.strengths);
  renderList($fbGaps,      feedback.gaps);
  renderList($fbNext,      feedback.next);

  const score       = Math.max(0, Math.min(100, feedback.score || 0));
  const circumf     = 2 * Math.PI * 52; // ≈ 326.7
  const offset      = circumf * (1 - score / 100);
  const grade       = getGrade(score);

  $scoreGrade.textContent = grade.label;
  $scoreGrade.className   = `score-grade ${grade.cls}`;
  $scoreRingFill.style.strokeDashoffset = circumf;
  $scoreNumber.textContent = "0";
  $modalOverlay.style.display = "flex";

  requestAnimationFrame(() => {
    setTimeout(() => {
      $scoreRingFill.style.strokeDashoffset = offset;
      animCount($scoreNumber, 0, score, 1200);
    }, 80);
  });
}

function animCount(el, from, to, dur) {
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

function renderList(ul, items) {
  ul.innerHTML = "";
  (items || []).forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    ul.appendChild(li);
  });
  if (!items || !items.length) {
    const li = document.createElement("li");
    li.style.color = "var(--text-muted)";
    li.textContent = "None identified.";
    ul.appendChild(li);
  }
}

function closeModal() { $modalOverlay.style.display = "none"; }

$btnCloseModal.addEventListener("click", closeModal);
$modalOverlay.addEventListener("click", e => { if (e.target === $modalOverlay) closeModal(); });
$btnNewInterview.addEventListener("click", () => { closeModal(); goHome(); });

// ── Input Listeners ───────────────────────────────────────────────────────────

$messageInput.addEventListener("input", () => {
  autoResize($messageInput);
  $charCount.textContent = $messageInput.value.length;
  $sendBtn.disabled = !$messageInput.value.trim() || state.phase !== "INTERVIEWING";
});

$messageInput.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!$sendBtn.disabled) sendMessage();
  }
});

$sendBtn.addEventListener("click", sendMessage);

// ── Init ──────────────────────────────────────────────────────────────────────
init();
