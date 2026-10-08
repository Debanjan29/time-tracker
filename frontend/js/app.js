// Personal Time Tracker - Intuitive & Calm Client Application

// Application State
const state = {
  currentUser: null,
  activeTimer: null,
  timerInterval: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth() + 1, // 1-12
  selectedDate: null,
  todayDateStr: null,
  isFutureSelected: false,
  completedSecondsToday: 0,
};

// SVG Icon Templates
const ICONS = {
  edit: `<svg viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
};

// --- Time Formatting Helpers ---
function formatSecondsHMS(seconds) {
  if (!seconds || seconds <= 0) return "00:00:00";
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

function formatSecondsHuman(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

// --- Toast Notifications ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// --- Interactive Confirmation Modal ---
function askConfirmation({ title, message, onConfirm }) {
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-modal-title").innerText = title || "Are you sure?";
  document.getElementById("confirm-modal-message").innerText = message || "This action cannot be undone.";
  modal.classList.add("open");

  const proceedBtn = document.getElementById("confirm-modal-proceed");
  const cancelBtn = document.getElementById("confirm-modal-cancel");

  const cleanup = () => {
    modal.classList.remove("open");
    proceedBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;
  proceedBtn.onclick = async () => {
    cleanup();
    await onConfirm();
  };
}

// --- API Client ---
async function api(endpoint, options = {}) {
  const defaultHeaders = { "Content-Type": "application/json" };
  const config = {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  };

  try {
    const response = await fetch(endpoint, config);
    if (response.status === 401) {
      if (endpoint === "/auth/me") {
        return null; // Guest user on initial check, not an error
      }
      if (!endpoint.includes("/auth/")) {
        handleUnauthenticated();
        return null;
      }
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = data.detail || data.message || "An error occurred";
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    if (endpoint !== "/auth/me") {
      showToast(err.message, "error");
    }
    throw err;
  }
}

// --- Timezone Dropdown Population ---
function populateTimezones() {
  const select = document.getElementById("register-tz");
  if (!select) return;

  let timezones = [];
  try {
    if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
      timezones = Intl.supportedValuesOf("timeZone");
    }
  } catch (e) {}

  if (!timezones || timezones.length === 0) {
    timezones = [
      "UTC", "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
      "Asia/Tokyo", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney"
    ];
  }

  const userTz = (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";

  select.innerHTML = '<option value="">Select timezone...</option>';
  timezones.forEach((tz) => {
    const opt = document.createElement("option");
    opt.value = tz;
    opt.textContent = tz.replace(/_/g, " ");
    if (tz === userTz) opt.selected = true;
    select.appendChild(opt);
  });
}

// --- Authentication Flow ---
async function checkAuth() {
  try {
    const user = await api("/auth/me");
    if (user) {
      handleAuthenticated(user);
    } else {
      handleUnauthenticated();
    }
  } catch {
    handleUnauthenticated();
  }
}

function handleAuthenticated(user) {
  state.currentUser = user;
  const nameDisplay = document.getElementById("user-name-display");
  if (nameDisplay) {
    nameDisplay.innerText = user.name || user.username;
  }

  document.getElementById("auth-view").style.display = "none";
  document.getElementById("app-view").style.display = "block";
  document.getElementById("user-pill").style.display = "flex";

  initDashboard();
}

function handleUnauthenticated() {
  state.currentUser = null;
  clearInterval(state.timerInterval);
  document.getElementById("auth-view").style.display = "block";
  document.getElementById("app-view").style.display = "none";
  document.getElementById("user-pill").style.display = "none";
}

// --- Live Client-Side Timer & Continuous Updates ---
function updateLiveTimerDisplay() {
  const digitsEl = document.getElementById("today-total-time");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("timer-status-text");
  const startTimeEl = document.getElementById("timer-start-time");
  const sessionDiffEl = document.getElementById("timer-session-diff");
  const startBtn = document.getElementById("start-timer-btn");
  const stopBtn = document.getElementById("stop-timer-btn");
  const noteInput = document.getElementById("timer-note-input");

  if (!state.activeTimer) {
    if (digitsEl) digitsEl.innerText = formatSecondsHMS(state.completedSecondsToday);
    if (statusDot) statusDot.classList.remove("active");
    if (statusText) {
      statusText.innerText = "Ready to track";
      statusText.removeAttribute("title");
    }
    if (startTimeEl) startTimeEl.style.display = "none";
    if (sessionDiffEl) sessionDiffEl.style.display = "none";
    if (startBtn) startBtn.style.display = "inline-flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (noteInput) noteInput.disabled = false;
    return;
  }

  // Calculate elapsed seconds from authoritative start_time
  const startTime = new Date(state.activeTimer.start_time);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now - startTime) / 1000));
  const totalSecondsToday = state.completedSecondsToday + diffSec;

  if (digitsEl) digitsEl.innerText = formatSecondsHMS(totalSecondsToday);
  if (statusDot) statusDot.classList.add("active");
  if (statusText) {
    statusText.innerText = state.activeTimer.note
      ? `Tracking: "${state.activeTimer.note}"`
      : "Tracking active session";
    statusText.title = state.activeTimer.note
      ? `Tracking: ${state.activeTimer.note}`
      : "Tracking active session";
  }

  if (startTimeEl) {
    const formattedStartTime = startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    startTimeEl.innerText = `Started ${formattedStartTime}`;
    startTimeEl.title = `Session started at ${startTime.toLocaleTimeString()}`;
    startTimeEl.style.display = "inline-flex";
  }

  if (sessionDiffEl) {
    sessionDiffEl.innerText = `+${formatSecondsHMS(diffSec)}`;
    sessionDiffEl.title = `Active session elapsed: ${formatSecondsHMS(diffSec)}`;
    sessionDiffEl.style.display = "inline-flex";
  }

  if (startBtn) startBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "inline-flex";
  if (noteInput) {
    noteInput.disabled = true;
    noteInput.value = state.activeTimer.note || "";
  }
}

function startTimerTick() {
  clearInterval(state.timerInterval);
  updateLiveTimerDisplay();
  state.timerInterval = setInterval(updateLiveTimerDisplay, 1000);
}

async function refreshTodaySummary() {
  const todaySummary = await api("/time/today");
  if (todaySummary) {
    state.todayDateStr = todaySummary.date;
    state.activeTimer = todaySummary.active_entry;

    // Sum completed duration
    const completedSecs = todaySummary.entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
    state.completedSecondsToday = completedSecs;

    startTimerTick();
  }
}

// --- Dashboard & Calendar Initialization ---
async function initDashboard() {
  await refreshTodaySummary();

  state.selectedDate = state.todayDateStr;

  const todayDate = new Date(state.todayDateStr || new Date());
  state.calendarYear = todayDate.getFullYear();
  state.calendarMonth = todayDate.getMonth() + 1;

  await loadCalendar(state.calendarYear, state.calendarMonth);
  await selectDate(state.selectedDate || state.todayDateStr);
}

// --- Monthly Calendar Rendering ---
async function loadCalendar(year, month) {
  state.calendarYear = year;
  state.calendarMonth = month;

  const data = await api(`/calendar/month/${year}/${month}`);
  if (!data) return;

  document.getElementById("calendar-month-title").innerText = `${data.month_name} ${data.year}`;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  // Monday = 0 in Python weekday, 6 = Sunday. Add blank slots
  for (let i = 0; i < data.first_weekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty";
    grid.appendChild(emptyCell);
  }

  data.days.forEach((day) => {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    if (day.is_today) dayEl.classList.add("today");
    if (day.date === state.selectedDate) dayEl.classList.add("selected");

    let hoursHtml = "";
    if (day.total_duration_seconds > 0) {
      hoursHtml = `<span class="day-hours">${formatSecondsHuman(day.total_duration_seconds)}</span>`;
    }

    const indicatorsHtml = `
      <div class="day-indicators">
        ${day.has_entries ? '<span class="indicator-dot indicator-time" title="Tracked time"></span>' : ""}
        ${day.has_notes ? '<span class="indicator-dot indicator-note" title="Planning notes"></span>' : ""}
      </div>
    `;

    dayEl.innerHTML = `
      <span class="day-number">${day.day_number}</span>
      ${hoursHtml}
      ${indicatorsHtml}
    `;

    dayEl.addEventListener("click", () => selectDate(day.date));
    grid.appendChild(dayEl);
  });
}

// --- Date Selection & Contextual Detail Panel ---
async function selectDate(dateStr) {
  state.selectedDate = dateStr;

  // Highlight selected cell on calendar
  document.querySelectorAll(".calendar-day").forEach((el) => {
    el.classList.remove("selected");
  });
  const allDays = document.querySelectorAll(".calendar-day:not(.empty)");
  const dayNum = parseInt(dateStr.split("-")[2], 10);
  if (allDays[dayNum - 1]) allDays[dayNum - 1].classList.add("selected");

  const isToday = (dateStr === state.todayDateStr);
  const isFuture = (dateStr > state.todayDateStr);
  state.isFutureSelected = isFuture;

  // Format title header
  const dateObj = new Date(dateStr + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  document.getElementById("selected-date-title").innerText = formattedDate;

  // Badge status
  const badgeEl = document.getElementById("selected-date-badge");
  if (isToday) {
    badgeEl.className = "date-badge badge-today";
    badgeEl.innerText = "Today";
  } else if (isFuture) {
    badgeEl.className = "date-badge badge-future";
    badgeEl.innerText = "Future Date";
  } else {
    badgeEl.className = "date-badge badge-past";
    badgeEl.innerText = "Past Date";
  }

  // Toggle Contextual Panel: Entries vs Notes
  const addEntryBtn = document.getElementById("add-entry-btn");
  const addNoteBtn = document.getElementById("add-note-btn");
  const totalBar = document.getElementById("total-bar");
  const entriesSection = document.getElementById("entries-section");
  const notesSection = document.getElementById("notes-section");

  if (isFuture) {
    // Future date: only planning notes
    if (addEntryBtn) addEntryBtn.style.display = "none";
    if (totalBar) totalBar.style.display = "none";
    if (entriesSection) entriesSection.style.display = "none";

    if (addNoteBtn) addNoteBtn.style.display = "inline-flex";
    if (notesSection) notesSection.style.display = "block";

    await loadPlanningNotesForDate(dateStr);
  } else {
    // Past date or Today: time entries
    if (addEntryBtn) addEntryBtn.style.display = "inline-flex";
    if (totalBar) totalBar.style.display = "flex";
    if (entriesSection) entriesSection.style.display = "block";

    if (addNoteBtn) addNoteBtn.style.display = "none";
    if (notesSection) notesSection.style.display = "none";

    await loadTimeEntriesForDate(dateStr);
  }
}

// --- Load Time Entries for Date ---
async function loadTimeEntriesForDate(dateStr) {
  const listEl = document.getElementById("entries-list");
  const totalValEl = document.getElementById("daily-total-display");

  const summary = await api(`/time/date/${dateStr}`);

  if (!summary || summary.entries.length === 0) {
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>No time logged for this day.</p>
        </div>
      `;
    }
    if (totalValEl) totalValEl.innerText = "0m";
    return;
  }

  if (totalValEl) totalValEl.innerText = summary.total_duration_formatted;
  if (!listEl) return;
  listEl.innerHTML = "";

  summary.entries.forEach((entry) => {
    const startFmt = new Date(entry.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endFmt = entry.end_time
      ? new Date(entry.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "Running";

    const item = document.createElement("div");
    item.className = "entry-item";
    item.innerHTML = `
      <div class="entry-info">
        <div class="entry-time">
          <span>${startFmt} → ${endFmt}</span>
          <span class="duration-badge">${entry.duration_formatted}</span>
        </div>
        ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ""}
      </div>
      <div class="entry-actions">
        <button class="action-btn edit-btn edit-entry-btn" title="Edit entry" aria-label="Edit entry">
          ${ICONS.edit}
        </button>
        <button class="action-btn delete-btn delete-entry-btn" title="Delete entry" aria-label="Delete entry">
          ${ICONS.delete}
        </button>
      </div>
    `;

    item.querySelector(".edit-entry-btn").addEventListener("click", () => openEditEntryModal(entry));
    item.querySelector(".delete-entry-btn").addEventListener("click", () => handleDeleteEntry(entry.id));

    listEl.appendChild(item);
  });
}

// --- Load Planning Notes for Date ---
async function loadPlanningNotesForDate(dateStr) {
  const notes = await api(`/calendar-notes/date/${dateStr}`);
  const listEl = document.getElementById("notes-list");
  if (!listEl) return;

  if (!notes || notes.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No planning notes for this date yet.<br>Click "+ Add Note" to plan ahead.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = "";
  notes.forEach((note) => {
    const item = document.createElement("div");
    item.className = "note-item";
    item.innerHTML = `
      <div class="note-info">
        <div class="note-text">${escapeHtml(note.note)}</div>
      </div>
      <div class="entry-actions">
        <button class="action-btn edit-btn edit-note-btn" title="Edit note" aria-label="Edit note">
          ${ICONS.edit}
        </button>
        <button class="action-btn delete-btn delete-note-btn" title="Delete note" aria-label="Delete note">
          ${ICONS.delete}
        </button>
      </div>
    `;

    item.querySelector(".edit-note-btn").addEventListener("click", () => openEditNoteModal(note));
    item.querySelector(".delete-note-btn").addEventListener("click", () => handleDeleteNote(note.id));

    listEl.appendChild(item);
  });
}

// --- Timer Actions ---
const startTimerBtn = document.getElementById("start-timer-btn");
if (startTimerBtn) {
  startTimerBtn.addEventListener("click", async () => {
    const note = document.getElementById("timer-note-input").value;
    try {
      const entry = await api("/time/start", {
        method: "POST",
        body: JSON.stringify({ note: note || null }),
      });
      if (entry) {
        state.activeTimer = entry;
        showToast("Live timer started");
        await refreshTodaySummary();
        await loadCalendar(state.calendarYear, state.calendarMonth);
      }
    } catch {}
  });
}

const stopTimerBtn = document.getElementById("stop-timer-btn");
if (stopTimerBtn) {
  stopTimerBtn.addEventListener("click", async () => {
    try {
      const entry = await api("/time/stop", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (entry) {
        state.activeTimer = null;
        document.getElementById("timer-note-input").value = "";
        showToast("Session recorded");
        await refreshTodaySummary();
        await selectDate(state.selectedDate);
        await loadCalendar(state.calendarYear, state.calendarMonth);
      }
    } catch {}
  });
}

// --- Modals: Time Entry ---
const entryModal = document.getElementById("entry-modal");
let editingEntryId = null;

const addEntryBtn = document.getElementById("add-entry-btn");
if (addEntryBtn) {
  addEntryBtn.addEventListener("click", () => {
    editingEntryId = null;
    document.getElementById("entry-modal-title").innerText = "Add Time Entry";
    document.getElementById("entry-start-input").value = `${state.selectedDate}T09:00`;
    document.getElementById("entry-end-input").value = `${state.selectedDate}T10:00`;
    document.getElementById("entry-note-modal-input").value = "";
    entryModal.classList.add("open");
  });
}

const closeEntryModalBtn = document.getElementById("close-entry-modal");
if (closeEntryModalBtn) {
  closeEntryModalBtn.addEventListener("click", () => entryModal.classList.remove("open"));
}

const cancelEntryModalBtn = document.getElementById("cancel-entry-modal");
if (cancelEntryModalBtn) {
  cancelEntryModalBtn.addEventListener("click", () => entryModal.classList.remove("open"));
}

function openEditEntryModal(entry) {
  editingEntryId = entry.id;
  document.getElementById("entry-modal-title").innerText = "Edit Time Entry";

  const toLocalIso = (dStr) => {
    const d = new Date(dStr);
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  document.getElementById("entry-start-input").value = toLocalIso(entry.start_time);
  document.getElementById("entry-end-input").value = entry.end_time ? toLocalIso(entry.end_time) : "";
  document.getElementById("entry-note-modal-input").value = entry.note || "";
  entryModal.classList.add("open");
}

const saveEntryForm = document.getElementById("save-entry-form");
if (saveEntryForm) {
  saveEntryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const startVal = document.getElementById("entry-start-input").value;
    const endVal = document.getElementById("entry-end-input").value;
    const noteVal = document.getElementById("entry-note-modal-input").value;

    if (!startVal || !endVal) {
      showToast("Please provide both start and end times.", "error");
      return;
    }

    const payload = {
      start_time: new Date(startVal).toISOString(),
      end_time: new Date(endVal).toISOString(),
      note: noteVal || null,
    };

    try {
      if (editingEntryId) {
        await api(`/time/${editingEntryId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Entry updated");
      } else {
        await api("/time/manual", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Entry added");
      }

      entryModal.classList.remove("open");
      await refreshTodaySummary();
      await selectDate(state.selectedDate);
      await loadCalendar(state.calendarYear, state.calendarMonth);
    } catch {}
  });
}

function handleDeleteEntry(id) {
  askConfirmation({
    title: "Delete Time Entry",
    message: "Are you sure you want to delete this recorded session?",
    onConfirm: async () => {
      try {
        await api(`/time/${id}`, { method: "DELETE" });
        showToast("Entry deleted");
        await refreshTodaySummary();
        await selectDate(state.selectedDate);
        await loadCalendar(state.calendarYear, state.calendarMonth);
      } catch {}
    },
  });
}

// --- Modals: Planning Notes ---
const noteModal = document.getElementById("note-modal");
let editingNoteId = null;

const addNoteBtn = document.getElementById("add-note-btn");
if (addNoteBtn) {
  addNoteBtn.addEventListener("click", () => {
    editingNoteId = null;
    document.getElementById("note-modal-title").innerText = `Add Note for ${state.selectedDate}`;
    document.getElementById("note-text-input").value = "";
    noteModal.classList.add("open");
  });
}

const closeNoteModalBtn = document.getElementById("close-note-modal");
if (closeNoteModalBtn) {
  closeNoteModalBtn.addEventListener("click", () => noteModal.classList.remove("open"));
}

const cancelNoteModalBtn = document.getElementById("cancel-note-modal");
if (cancelNoteModalBtn) {
  cancelNoteModalBtn.addEventListener("click", () => noteModal.classList.remove("open"));
}

function openEditNoteModal(note) {
  editingNoteId = note.id;
  document.getElementById("note-modal-title").innerText = "Edit Planning Note";
  document.getElementById("note-text-input").value = note.note;
  noteModal.classList.add("open");
}

const saveNoteForm = document.getElementById("save-note-form");
if (saveNoteForm) {
  saveNoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("note-text-input").value.trim();
    if (!text) return;

    try {
      if (editingNoteId) {
        await api(`/calendar-notes/${editingNoteId}`, {
          method: "PATCH",
          body: JSON.stringify({ note: text }),
        });
        showToast("Note updated");
      } else {
        await api("/calendar-notes", {
          method: "POST",
          body: JSON.stringify({ date: state.selectedDate, note: text }),
        });
        showToast("Note added");
      }

      noteModal.classList.remove("open");
      await loadPlanningNotesForDate(state.selectedDate);
      await loadCalendar(state.calendarYear, state.calendarMonth);
    } catch {}
  });
}

function handleDeleteNote(id) {
  askConfirmation({
    title: "Delete Planning Note",
    message: "Are you sure you want to remove this planning note?",
    onConfirm: async () => {
      try {
        await api(`/calendar-notes/${id}`, { method: "DELETE" });
        showToast("Note removed");
        await loadPlanningNotesForDate(state.selectedDate);
        await loadCalendar(state.calendarYear, state.calendarMonth);
      } catch {}
    },
  });
}

// --- Calendar Navigation ---
const prevMonthBtn = document.getElementById("prev-month-btn");
if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    state.calendarMonth -= 1;
    if (state.calendarMonth < 1) {
      state.calendarMonth = 12;
      state.calendarYear -= 1;
    }
    loadCalendar(state.calendarYear, state.calendarMonth);
  });
}

const nextMonthBtn = document.getElementById("next-month-btn");
if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    state.calendarMonth += 1;
    if (state.calendarMonth > 12) {
      state.calendarMonth = 1;
      state.calendarYear += 1;
    }
    loadCalendar(state.calendarYear, state.calendarMonth);
  });
}

const todayMonthBtn = document.getElementById("today-month-btn");
if (todayMonthBtn) {
  todayMonthBtn.addEventListener("click", () => {
    const today = new Date(state.todayDateStr || new Date());
    loadCalendar(today.getFullYear(), today.getMonth() + 1);
    selectDate(state.todayDateStr);
  });
}

// --- Auth UI Helpers (Alert Banner & Password Toggles) ---
function showAuthAlert(msg) {
  const alertEl = document.getElementById("auth-alert");
  const textEl = document.getElementById("auth-alert-text");
  if (alertEl && textEl) {
    textEl.innerText = msg;
    alertEl.style.display = "flex";
  }
}

function hideAuthAlert() {
  const alertEl = document.getElementById("auth-alert");
  if (alertEl) alertEl.style.display = "none";
}

function setupPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.innerHTML = isPassword
      ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });
}

// --- Auth Tabs & Forms ---
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

if (tabLogin) {
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    if (tabRegister) tabRegister.classList.remove("active");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
    const sub = document.getElementById("auth-subtitle");
    if (sub) sub.innerText = "Sign in to track your time and view your calendar.";
  });
}

if (tabRegister) {
  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    if (tabLogin) tabLogin.classList.remove("active");
    if (registerForm) registerForm.style.display = "block";
    if (loginForm) loginForm.style.display = "none";
    const sub = document.getElementById("auth-subtitle");
    if (sub) sub.innerText = "Create an account in seconds to get started.";
    populateTimezones();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifierInput = document.getElementById("login-identifier");
    const passwordInput = document.getElementById("login-password");
    const submitBtn = document.getElementById("login-submit-btn");

    const identifier = identifierInput ? identifierInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!identifier || !password) {
      showToast("Please enter your email or username and password.", "error");
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Signing in...";
      }

      const user = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      if (user) {
        showToast(`Welcome back, ${user.name || user.email}!`);
        handleAuthenticated(user);
      }
    } catch {
      // Error toast already displayed by api()
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Sign In";
      }
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("register-name");
    const emailInput = document.getElementById("register-email");
    const passwordInput = document.getElementById("register-password");
    const tzInput = document.getElementById("register-tz");
    const submitBtn = document.getElementById("register-submit-btn");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    const timezone = tzInput ? tzInput.value : "UTC";

    if (!name || !email || !password) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    if (password.length < 8) {
      showToast("Password must be at least 8 characters long.", "error");
      return;
    }

    const payload = {
      name,
      email,
      password,
      timezone: timezone || "UTC",
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Creating account...";
      }

      const user = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (user) {
        showToast(`Account created! Welcome, ${user.name}!`);
        handleAuthenticated(user);
      }
    } catch {
      // Error toast already displayed by api()
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Create Account";
      }
    }
  });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      showToast("Logged out");
      handleUnauthenticated();
    } catch {}
  });
}

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem("timelog_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const newTheme = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("timelog_theme", newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) {
    icon.innerText = theme === "dark" ? "🌙" : "☀️";
  }
}

const themeBtn = document.getElementById("theme-toggle-btn");
if (themeBtn) {
  themeBtn.addEventListener("click", toggleTheme);
}

// Close modals on Escape key
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
  }
});

// Initial Boot
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  populateTimezones();
  checkAuth();
});
