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
  calendarView: "days", // 'days' | 'months' | 'years'
  calendarDecadeStart: Math.floor(new Date().getFullYear() / 10) * 10,
  previousCalendarView: "days",
  todos: [],
  todayTodos: [],
  todoFilter: "all",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_ABBRS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

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
  const regSelect = document.getElementById("register-tz");
  const acctSelect = document.getElementById("account-tz-select");

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

  [regSelect, acctSelect].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Select timezone...</option>';
    timezones.forEach((tz) => {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz.replace(/_/g, " ");
      sel.appendChild(opt);
    });
    if (sel === regSelect) {
      sel.value = userTz;
    }
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

  updateActiveSoundDisplay();
  updateDigitalClock();
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
  state.calendarDecadeStart = Math.floor(state.calendarYear / 10) * 10;
  state.calendarView = "days";

  await setCalendarView("days");
  await selectDate(state.selectedDate || state.todayDateStr);
}

// --- Multi-Level Calendar Drill-Down Views (Days, Months, Years) ---
async function setCalendarView(view) {
  state.previousCalendarView = state.calendarView;
  state.calendarView = view;

  const daysView = document.getElementById("calendar-days-view");
  const monthsView = document.getElementById("calendar-months-view");
  const yearsView = document.getElementById("calendar-years-view");

  const monthBtn = document.getElementById("cal-month-btn");
  const yearBtn = document.getElementById("cal-year-btn");
  const monthText = document.getElementById("cal-month-text");
  const yearText = document.getElementById("cal-year-text");
  const monthCaret = document.getElementById("cal-month-caret");
  const yearCaret = document.getElementById("cal-year-caret");

  const prevBtn = document.getElementById("prev-month-btn");
  const nextBtn = document.getElementById("next-month-btn");

  if (!monthBtn || !yearBtn) return;

  monthBtn.classList.remove("active");
  yearBtn.classList.remove("active");

  if (view === "days") {
    if (daysView) daysView.style.display = "block";
    if (monthsView) monthsView.style.display = "none";
    if (yearsView) yearsView.style.display = "none";

    monthBtn.style.display = "inline-flex";
    yearBtn.style.display = "inline-flex";

    if (monthText) monthText.innerText = MONTH_NAMES[state.calendarMonth - 1] || "Month";
    if (yearText) yearText.innerText = state.calendarYear;
    if (monthCaret) monthCaret.style.display = "inline-block";
    if (yearCaret) yearCaret.style.display = "inline-block";

    monthBtn.title = "View all months";
    yearBtn.title = "Choose year";

    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "Previous month");
      prevBtn.title = "Previous month";
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "Next month");
      nextBtn.title = "Next month";
    }

    await loadCalendar(state.calendarYear, state.calendarMonth);

  } else if (view === "months") {
    if (daysView) daysView.style.display = "none";
    if (monthsView) monthsView.style.display = "block";
    if (yearsView) yearsView.style.display = "none";

    monthBtn.classList.add("active");
    monthBtn.style.display = "inline-flex";
    yearBtn.style.display = "inline-flex";

    if (monthText) monthText.innerText = "‹ Days";
    if (yearText) yearText.innerText = state.calendarYear;
    if (monthCaret) monthCaret.style.display = "none";
    if (yearCaret) yearCaret.style.display = "inline-block";

    monthBtn.title = "Back to days";
    yearBtn.title = "Choose year";

    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "Previous year");
      prevBtn.title = "Previous year";
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "Next year");
      nextBtn.title = "Next year";
    }

    renderMonthsGrid();

  } else if (view === "years") {
    if (daysView) daysView.style.display = "none";
    if (monthsView) monthsView.style.display = "none";
    if (yearsView) yearsView.style.display = "block";

    yearBtn.classList.add("active");
    monthBtn.style.display = "inline-flex";
    yearBtn.style.display = "inline-flex";

    const backLabel = state.previousCalendarView === "months" ? "‹ Months" : "‹ Days";
    if (monthText) monthText.innerText = backLabel;
    if (monthCaret) monthCaret.style.display = "none";
    if (yearCaret) yearCaret.style.display = "none";

    if (!state.calendarDecadeStart) {
      state.calendarDecadeStart = Math.floor(state.calendarYear / 10) * 10;
    }
    const decade = state.calendarDecadeStart;
    if (yearText) yearText.innerText = `${decade} – ${decade + 9}`;

    monthBtn.title = "Back to " + (state.previousCalendarView === "months" ? "months" : "days");
    yearBtn.title = "Decade view";

    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "Previous decade");
      prevBtn.title = "Previous decade";
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "Next decade");
      nextBtn.title = "Next decade";
    }

    renderYearsGrid();
  }
}

function renderMonthsGrid() {
  const grid = document.getElementById("calendar-months-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const today = new Date(state.todayDateStr || new Date());
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;

  MONTH_NAMES.forEach((name, idx) => {
    const monthNum = idx + 1;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "picker-cell";

    if (state.calendarYear === todayYear && monthNum === todayMonth) {
      cell.classList.add("current");
    }
    if (monthNum === state.calendarMonth) {
      cell.classList.add("selected");
    }

    cell.innerHTML = `
      <span class="picker-main">${MONTH_ABBRS[idx]}</span>
      <span class="picker-sub">${name}</span>
    `;

    cell.addEventListener("click", () => {
      state.calendarMonth = monthNum;
      setCalendarView("days");
    });

    grid.appendChild(cell);
  });
}

function renderYearsGrid() {
  const grid = document.getElementById("calendar-years-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!state.calendarDecadeStart) {
    state.calendarDecadeStart = Math.floor(state.calendarYear / 10) * 10;
  }
  const decade = state.calendarDecadeStart;

  const yearText = document.getElementById("cal-year-text");
  if (yearText) {
    yearText.innerText = `${decade} – ${decade + 9}`;
  }

  const today = new Date(state.todayDateStr || new Date());
  const todayYear = today.getFullYear();

  for (let yr = decade - 1; yr <= decade + 10; yr++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "picker-cell";

    if (yr < decade || yr > decade + 9) {
      cell.classList.add("muted");
    }
    if (yr === todayYear) {
      cell.classList.add("current");
    }
    if (yr === state.calendarYear) {
      cell.classList.add("selected");
    }

    cell.innerHTML = `<span class="picker-main">${yr}</span>`;

    cell.addEventListener("click", () => {
      state.calendarYear = yr;
      state.calendarDecadeStart = Math.floor(yr / 10) * 10;
      setCalendarView("months");
    });

    grid.appendChild(cell);
  }
}

// --- Monthly Calendar Rendering ---
async function loadCalendar(year, month) {
  state.calendarYear = year;
  state.calendarMonth = month;

  const data = await api(`/calendar/month/${year}/${month}`);
  if (!data) return;

  const titleEl = document.getElementById("calendar-month-title");
  if (titleEl) titleEl.innerText = `${data.month_name} ${data.year}`;

  const monthText = document.getElementById("cal-month-text");
  if (monthText && state.calendarView === "days") {
    monthText.innerText = data.month_name;
  }

  const yearText = document.getElementById("cal-year-text");
  if (yearText && state.calendarView === "days") {
    yearText.innerText = data.year;
  }

  const grid = document.getElementById("calendar-grid");
  if (!grid) return;
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

  // Load Daily To-Do tasks for the selected date
  await loadTodosForDate(dateStr);
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

// --- Time Formatting Helper for Reminders ---
function formatTimeHHMM(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getUserCurrentTimeHHMM() {
  const tz = (state.currentUser && state.currentUser.timezone) ||
             (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
             "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

function getUserCurrentDateStr() {
  const tz = (state.currentUser && state.currentUser.timezone) ||
             (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
             "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// --- Digital Clock System ---
function updateDigitalClock() {
  const tz = (state.currentUser && state.currentUser.timezone) ||
             (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
             "UTC";

  const now = new Date();
  try {
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(now);

    let h = "00", m = "00", s = "00", dayPeriod = "AM";
    timeParts.forEach((p) => {
      if (p.type === "hour") h = p.value;
      if (p.type === "minute") m = p.value;
      if (p.type === "second") s = p.value;
      if (p.type === "dayPeriod") dayPeriod = p.value.toUpperCase();
    });

    const timeEl = document.getElementById("digital-clock-time");
    const secEl = document.getElementById("digital-clock-sec");
    const ampmEl = document.getElementById("digital-clock-ampm");
    const tzEl = document.getElementById("digital-clock-tz");
    const dateEl = document.getElementById("digital-clock-date");

    if (timeEl) timeEl.innerText = `${h}:${m}`;
    if (secEl) secEl.innerText = `:${s}`;
    if (ampmEl) ampmEl.innerText = dayPeriod;
    if (tzEl) tzEl.innerText = tz;

    if (dateEl) {
      const dateFormatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(now);
      dateEl.innerText = dateFormatted;
    }
  } catch {
    const h = String(now.getHours() % 12 || 12).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    const timeEl = document.getElementById("digital-clock-time");
    const secEl = document.getElementById("digital-clock-sec");
    const ampmEl = document.getElementById("digital-clock-ampm");
    if (timeEl) timeEl.innerText = `${h}:${m}`;
    if (secEl) secEl.innerText = `:${s}`;
    if (ampmEl) ampmEl.innerText = ampm;
  }
}

// --- Sound Options & Web Audio API Synthesis ---
const SOUND_OPTIONS = [
  {
    id: "crystal",
    name: "Crystal Chime",
    icon: "💎",
    tagline: "Harmonious Bell",
    desc: "4-note ascending bell chime arpeggio",
  },
  {
    id: "zen",
    name: "Zen Singing Bowl",
    icon: "🧘",
    tagline: "Deep & Calming",
    desc: "Resonant acoustic bowl with gentle decay",
  },
  {
    id: "marimba",
    name: "Warm Marimba",
    icon: "🪵",
    tagline: "Playful & Upbeat",
    desc: "4-note wooden melodic percussive chime",
  },
  {
    id: "harp",
    name: "Celestial Harp",
    icon: "✨",
    tagline: "Shimmering Strum",
    desc: "5-note rapid angelic harp chord",
  },
  {
    id: "digital",
    name: "Digital Pulse",
    icon: "⚡",
    tagline: "Modern & Crisp",
    desc: "Two-tone snappy electronic alert",
  },
];

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
window.addEventListener("click", unlockAudioContext, { once: true });
window.addEventListener("keydown", unlockAudioContext, { once: true });
window.addEventListener("touchstart", unlockAudioContext, { once: true });

function getActiveSoundId() {
  return localStorage.getItem("timelog_reminder_sound") || "crystal";
}

function setActiveSoundId(soundId) {
  localStorage.setItem("timelog_reminder_sound", soundId);
  updateActiveSoundDisplay();
}

function updateActiveSoundDisplay() {
  const activeId = getActiveSoundId();
  const opt = SOUND_OPTIONS.find((s) => s.id === activeId) || SOUND_OPTIONS[0];
  const iconEl = document.getElementById("active-sound-icon");
  const nameEl = document.getElementById("active-sound-name");
  if (iconEl) iconEl.innerText = opt.icon;
  if (nameEl) nameEl.innerText = opt.name.split(" ")[0];
}

function playNotificationSound(soundId) {
  const chosenSound = soundId || getActiveSoundId();
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (chosenSound === "zen") {
      // Warm singing bowl: 220Hz fundamental + 440Hz + 880Hz harmonics
      const freqs = [
        { f: 220, gain: 0.28, dur: 1.8 },
        { f: 440, gain: 0.16, dur: 1.5 },
        { f: 660, gain: 0.08, dur: 1.2 },
        { f: 880, gain: 0.04, dur: 0.9 },
      ];
      freqs.forEach((item) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(item.f, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(item.gain, now + 0.06);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + item.dur);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + item.dur + 0.05);
      });
    } else if (chosenSound === "marimba") {
      // 4-note upbeat marimba (F4 -> A4 -> C5 -> F5)
      const notes = [
        { freq: 349.23, time: 0.00, dur: 0.28, gain: 0.25 },
        { freq: 440.00, time: 0.11, dur: 0.28, gain: 0.26 },
        { freq: 523.25, time: 0.22, dur: 0.32, gain: 0.28 },
        { freq: 698.46, time: 0.33, dur: 0.45, gain: 0.30 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        const startTime = now + n.time;
        const endTime = startTime + n.dur;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, startTime + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(endTime + 0.05);
      });
    } else if (chosenSound === "harp") {
      // 5-note rapid upward strum
      const notes = [
        { freq: 659.25, time: 0.00, dur: 0.50, gain: 0.22 }, // E5
        { freq: 783.99, time: 0.07, dur: 0.55, gain: 0.24 }, // G5
        { freq: 987.77, time: 0.14, dur: 0.60, gain: 0.26 }, // B5
        { freq: 1174.66, time: 0.21, dur: 0.70, gain: 0.28 }, // D6
        { freq: 1567.98, time: 0.28, dur: 0.90, gain: 0.30 }, // G6
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        const startTime = now + n.time;
        const endTime = startTime + n.dur;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(endTime + 0.05);
      });
    } else if (chosenSound === "digital") {
      // Modern snappy electronic alert
      const notes = [
        { freq: 880, time: 0.00, dur: 0.12, gain: 0.24 },
        { freq: 1320, time: 0.12, dur: 0.25, gain: 0.28 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        const startTime = now + n.time;
        const endTime = startTime + n.dur;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(endTime + 0.05);
      });
    } else {
      // Default: "crystal"
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.35, gain: 0.22 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.35, gain: 0.25 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.40, gain: 0.28 }, // G5
        { freq: 1046.5, time: 0.38, dur: 0.85, gain: 0.32 }, // C6
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        const startTime = now + n.time;
        const endTime = startTime + n.dur;
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(n.gain, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(endTime + 0.05);
      });
    }
  } catch (err) {
    console.warn("Could not play notification sound:", err);
  }
}

// Backward-compatible alias
function playNotificationChime() {
  playNotificationSound();
}

// --- Dynamic Favicon & Tab Blinking Alert ---
let originalDocumentTitle = document.title || "Personal Time Tracker";
let isTabBlinking = false;
let tabBlinkInterval = null;
let baseFaviconDataUrl = null;
let alertFaviconDataUrl = null;
let currentBlinkingTodo = null;

function createFaviconUrls() {
  if (baseFaviconDataUrl && alertFaviconDataUrl) return;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");

  // 1. Base icon (Stopwatch icon)
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#4f46e5";
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(16, 17, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16, 17);
  ctx.lineTo(16, 11);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16, 17);
  ctx.lineTo(21, 17);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(13, 3);
  ctx.lineTo(19, 3);
  ctx.stroke();

  baseFaviconDataUrl = canvas.toDataURL("image/png");

  // 2. Glowing Red Dot Favicon
  ctx.clearRect(0, 0, 32, 32);
  const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 14);
  grad.addColorStop(0, "#ff6b6b");
  grad.addColorStop(0.6, "#ef4444");
  grad.addColorStop(1, "#b91c1c");

  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 8;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.arc(12, 12, 3.5, 0, Math.PI * 2);
  ctx.fill();

  alertFaviconDataUrl = canvas.toDataURL("image/png");
}

function setFavicon(url) {
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "shortcut icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

function startTabBlinking(todo) {
  createFaviconUrls();
  currentBlinkingTodo = todo;
  if (isTabBlinking) return;
  isTabBlinking = true;

  let toggle = false;
  const taskSnippet = todo && todo.text ? todo.text.slice(0, 20) : "Daily Task";

  tabBlinkInterval = setInterval(() => {
    toggle = !toggle;
    if (toggle) {
      setFavicon(alertFaviconDataUrl);
      document.title = `🔴 Reminder: ${taskSnippet}!`;
    } else {
      setFavicon(baseFaviconDataUrl);
      document.title = `🔔 Reminder: ${taskSnippet}`;
    }
  }, 600);
}

function stopTabBlinking() {
  if (!isTabBlinking) return;
  clearInterval(tabBlinkInterval);
  tabBlinkInterval = null;
  isTabBlinking = false;
  currentBlinkingTodo = null;
  if (baseFaviconDataUrl) setFavicon(baseFaviconDataUrl);
  document.title = originalDocumentTitle;
}

// User returns / visits the site -> stop blinking red dot
window.addEventListener("focus", stopTabBlinking);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    stopTabBlinking();
  }
});
window.addEventListener("click", stopTabBlinking);
window.addEventListener("keydown", stopTabBlinking);

// In-App Alert Banner
function showReminderAlertBanner(todo) {
  const banner = document.getElementById("reminder-alert-banner");
  const textEl = document.getElementById("reminder-alert-text");
  const doneBtn = document.getElementById("reminder-alert-done-btn");
  const dismissBtn = document.getElementById("reminder-alert-dismiss-btn");

  if (!banner || !textEl) return;

  textEl.innerText = `${todo.text} (scheduled for ${formatTimeHHMM(todo.reminder_time)})`;
  banner.style.display = "flex";

  if (doneBtn) {
    doneBtn.onclick = async () => {
      banner.style.display = "none";
      stopTabBlinking();
      await toggleTodo(todo.id);
      showToast("Task completed!");
    };
  }

  if (dismissBtn) {
    dismissBtn.onclick = () => {
      banner.style.display = "none";
      stopTabBlinking();
    };
  }
}

// Check reminders every second & update digital clock
function checkDailyReminders() {
  updateDigitalClock();

  if (!state.currentUser) return;
  const todayStr = state.todayDateStr || getUserCurrentDateStr();
  const currentHHMM = getUserCurrentTimeHHMM();

  const todosToCheck = (state.todayTodos && state.todayTodos.length > 0)
    ? state.todayTodos
    : (state.selectedDate === todayStr ? state.todos : []);

  if (!todosToCheck || todosToCheck.length === 0) return;

  todosToCheck.forEach((todo) => {
    if (!todo.reminder_time) return;
    if (todo.completed) return;

    const reminderHHMM = String(todo.reminder_time).slice(0, 5);
    if (reminderHHMM !== currentHHMM) return;

    const firedKey = `reminder_fired_${todo.id}_${todayStr}_${reminderHHMM}`;
    if (localStorage.getItem(firedKey)) return;

    try {
      localStorage.setItem(firedKey, "true");
    } catch {}

    // Play notification music
    playNotificationSound();

    // Show floating alert banner
    showReminderAlertBanner(todo);

    // If user is not focused on tab, start blinking red dot until they visit
    const isVisiting = !document.hidden && document.hasFocus && document.hasFocus();
    if (!isVisiting) {
      startTabBlinking(todo);
    }
  });
}

// Start global periodic reminder & clock ticker
setInterval(checkDailyReminders, 1000);

// --- Sound Options Gallery Modal Logic ---
let selectedGallerySound = getActiveSoundId();

function renderSoundGallery() {
  const listEl = document.getElementById("sound-gallery-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  SOUND_OPTIONS.forEach((opt) => {
    const isSelected = opt.id === selectedGallerySound;
    const card = document.createElement("div");
    card.className = `sound-card ${isSelected ? "selected" : ""}`;
    card.dataset.id = opt.id;

    card.innerHTML = `
      <div class="sound-card-left">
        <div class="sound-card-icon">${opt.icon}</div>
        <div class="sound-card-meta">
          <div class="sound-card-name-row">
            <span class="sound-card-name">${escapeHtml(opt.name)}</span>
            <span class="sound-card-tag">${escapeHtml(opt.tagline)}</span>
          </div>
          <span class="sound-card-desc">${escapeHtml(opt.desc)}</span>
        </div>
      </div>
      <div class="sound-card-right">
        <button type="button" class="btn-sound-preview" data-id="${opt.id}" title="Preview sound">
          <span>▶</span>
          <div class="sound-wave-bars">
            <span class="sound-wave-bar"></span>
            <span class="sound-wave-bar"></span>
            <span class="sound-wave-bar"></span>
            <span class="sound-wave-bar"></span>
          </div>
        </button>
        <div class="sound-check-indicator">${isSelected ? "✓" : ""}</div>
      </div>
    `;

    // Click on card selects sound
    card.addEventListener("click", (e) => {
      selectedGallerySound = opt.id;
      playNotificationSound(opt.id);
      renderSoundGallery();
    });

    // Preview button
    const previewBtn = card.querySelector(".btn-sound-preview");
    if (previewBtn) {
      previewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedGallerySound = opt.id;
        previewBtn.classList.add("playing");
        playNotificationSound(opt.id);
        setTimeout(() => previewBtn.classList.remove("playing"), 1200);
        renderSoundGallery();
      });
    }

    listEl.appendChild(card);
  });
}

function openSoundSelectorModal() {
  selectedGallerySound = getActiveSoundId();
  renderSoundGallery();
  const modal = document.getElementById("sound-selector-modal");
  if (modal) modal.classList.add("open");
}

function closeSoundSelectorModal() {
  const modal = document.getElementById("sound-selector-modal");
  if (modal) modal.classList.remove("open");
}

const openSoundModalBtn = document.getElementById("open-sound-modal-btn");
if (openSoundModalBtn) {
  openSoundModalBtn.addEventListener("click", openSoundSelectorModal);
}

const closeSoundModalBtn = document.getElementById("close-sound-modal");
if (closeSoundModalBtn) {
  closeSoundModalBtn.addEventListener("click", closeSoundSelectorModal);
}

const cancelSoundModalBtn = document.getElementById("cancel-sound-modal");
if (cancelSoundModalBtn) {
  cancelSoundModalBtn.addEventListener("click", closeSoundSelectorModal);
}

const saveSoundModalBtn = document.getElementById("save-sound-modal");
if (saveSoundModalBtn) {
  saveSoundModalBtn.addEventListener("click", () => {
    setActiveSoundId(selectedGallerySound);
    closeSoundSelectorModal();
    const opt = SOUND_OPTIONS.find((s) => s.id === selectedGallerySound);
    showToast(`Sound updated: ${opt ? opt.name : "Saved"}`);
  });
}

// --- Digital Clock Time-Picker Component ---
function createDigitalClockPicker({ containerEl, hiddenInputEl, initialTime = "", showPresets = true, onChange = null }) {
  if (!containerEl) return null;

  let pickerState = {
    h12: 9,
    m: 0,
    ampm: "AM",
    isEmpty: !initialTime,
  };

  function parseTimeStr(timeStr) {
    if (!timeStr) return null;
    const parts = String(timeStr).trim().split(":");
    if (parts.length < 2) return null;
    let h24 = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h24) || isNaN(m)) return null;
    h24 = Math.max(0, Math.min(23, h24));
    m = Math.max(0, Math.min(59, m));

    let ampm = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { h12, m, ampm };
  }

  function to24hString() {
    if (pickerState.isEmpty) return "";
    let h24 = pickerState.h12;
    if (pickerState.ampm === "AM") {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 !== 12) h24 += 12;
    }
    return `${String(h24).padStart(2, "0")}:${String(pickerState.m).padStart(2, "0")}`;
  }

  function to12hDisplayString() {
    if (pickerState.isEmpty) return "Off";
    return `${String(pickerState.h12).padStart(2, "0")}:${String(pickerState.m).padStart(2, "0")} ${pickerState.ampm}`;
  }

  function render() {
    const presetsHtml = showPresets ? `
      <div class="dcp-presets-bar">
        <span class="dcp-presets-title">Quick Presets:</span>
        <div class="dcp-chips-scroll">
          <button type="button" class="dcp-chip" data-preset="in-15">+15m</button>
          <button type="button" class="dcp-chip" data-preset="in-30">+30m</button>
          <button type="button" class="dcp-chip" data-preset="in-60">+1h</button>
          <button type="button" class="dcp-chip" data-preset="09:00">9:00 AM</button>
          <button type="button" class="dcp-chip" data-preset="14:00">2:00 PM</button>
          <button type="button" class="dcp-chip" data-preset="18:00">6:00 PM</button>
          <button type="button" class="dcp-chip" data-preset="21:00">9:00 PM</button>
        </div>
      </div>
    ` : "";

    containerEl.innerHTML = `
      <div class="dcp-display-card">
        <div class="dcp-unit-col">
          <button type="button" class="dcp-step-btn dcp-step-h-up" aria-label="Increase hours">▲</button>
          <input type="text" class="dcp-digit-input dcp-h-input" inputmode="numeric" maxlength="2" value="${String(pickerState.h12).padStart(2, "0")}" aria-label="Hours">
          <button type="button" class="dcp-step-btn dcp-step-h-down" aria-label="Decrease hours">▼</button>
          <span class="dcp-unit-sublabel">Hours</span>
        </div>
        <div class="dcp-colon-wrap">
          <span class="dcp-colon">:</span>
        </div>
        <div class="dcp-unit-col">
          <button type="button" class="dcp-step-btn dcp-step-m-up" aria-label="Increase minutes">▲</button>
          <input type="text" class="dcp-digit-input dcp-m-input" inputmode="numeric" maxlength="2" value="${String(pickerState.m).padStart(2, "0")}" aria-label="Minutes">
          <button type="button" class="dcp-step-btn dcp-step-m-down" aria-label="Decrease minutes">▼</button>
          <span class="dcp-unit-sublabel">Mins</span>
        </div>
        <div class="dcp-ampm-col">
          <button type="button" class="dcp-ampm-btn dcp-btn-am ${pickerState.ampm === "AM" ? "active" : ""}">AM</button>
          <button type="button" class="dcp-ampm-btn dcp-btn-pm ${pickerState.ampm === "PM" ? "active" : ""}">PM</button>
        </div>
      </div>
      ${presetsHtml}
    `;

    bindEvents();
    syncHidden();
  }

  function syncHidden() {
    const val = to24hString();
    if (hiddenInputEl) {
      hiddenInputEl.value = val;
    }
    if (typeof onChange === "function") {
      onChange(val, to12hDisplayString(), pickerState.isEmpty);
    }
  }

  function stepHours(delta) {
    pickerState.isEmpty = false;
    let h = pickerState.h12 + delta;
    if (h > 12) h = 1;
    if (h < 1) h = 12;
    pickerState.h12 = h;
    updateDisplay();
    syncHidden();
  }

  function stepMinutes(delta) {
    pickerState.isEmpty = false;
    let m = pickerState.m;
    if (delta > 0) {
      m = Math.floor(m / 5) * 5 + 5;
      if (m >= 60) m = 0;
    } else {
      m = Math.ceil(m / 5) * 5 - 5;
      if (m < 0) m = 55;
    }
    pickerState.m = m;
    updateDisplay();
    syncHidden();
  }

  function setAmpm(val) {
    pickerState.isEmpty = false;
    pickerState.ampm = val;
    updateDisplay();
    syncHidden();
  }

  function applyPreset(code) {
    pickerState.isEmpty = false;
    if (code.startsWith("in-")) {
      const minsToAdd = parseInt(code.replace("in-", ""), 10) || 15;
      const now = new Date();
      now.setMinutes(now.getMinutes() + minsToAdd);
      const m = Math.ceil(now.getMinutes() / 5) * 5;
      now.setMinutes(m);
      now.setSeconds(0);
      const h24 = now.getHours();
      const mins = now.getMinutes() % 60;
      pickerState.ampm = h24 >= 12 ? "PM" : "AM";
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      pickerState.h12 = h12;
      pickerState.m = mins;
    } else if (code.includes(":")) {
      const parsed = parseTimeStr(code);
      if (parsed) {
        pickerState.h12 = parsed.h12;
        pickerState.m = parsed.m;
        pickerState.ampm = parsed.ampm;
      }
    }
    updateDisplay();
    syncHidden();
  }

  function updateDisplay() {
    const hInput = containerEl.querySelector(".dcp-h-input");
    const mInput = containerEl.querySelector(".dcp-m-input");
    const btnAm = containerEl.querySelector(".dcp-btn-am");
    const btnPm = containerEl.querySelector(".dcp-btn-pm");

    if (hInput) hInput.value = String(pickerState.h12).padStart(2, "0");
    if (mInput) mInput.value = String(pickerState.m).padStart(2, "0");
    if (btnAm) btnAm.classList.toggle("active", pickerState.ampm === "AM");
    if (btnPm) btnPm.classList.toggle("active", pickerState.ampm === "PM");
  }

  function bindEvents() {
    const btnHUp = containerEl.querySelector(".dcp-step-h-up");
    const btnHDown = containerEl.querySelector(".dcp-step-h-down");
    const btnMUp = containerEl.querySelector(".dcp-step-m-up");
    const btnMDown = containerEl.querySelector(".dcp-step-m-down");
    const hInput = containerEl.querySelector(".dcp-h-input");
    const mInput = containerEl.querySelector(".dcp-m-input");
    const btnAm = containerEl.querySelector(".dcp-btn-am");
    const btnPm = containerEl.querySelector(".dcp-btn-pm");

    if (btnHUp) btnHUp.addEventListener("click", () => stepHours(1));
    if (btnHDown) btnHDown.addEventListener("click", () => stepHours(-1));
    if (btnMUp) btnMUp.addEventListener("click", () => stepMinutes(5));
    if (btnMDown) btnMDown.addEventListener("click", () => stepMinutes(-5));

    if (btnAm) btnAm.addEventListener("click", () => setAmpm("AM"));
    if (btnPm) btnPm.addEventListener("click", () => setAmpm("PM"));

    if (hInput) {
      hInput.addEventListener("focus", () => hInput.select());
      hInput.addEventListener("wheel", (e) => {
        e.preventDefault();
        stepHours(e.deltaY < 0 ? 1 : -1);
      });
      hInput.addEventListener("input", () => {
        let val = hInput.value.replace(/\D/g, "");
        if (val.length > 2) val = val.slice(0, 2);
        hInput.value = val;
        let num = parseInt(val, 10);
        if (!isNaN(num)) {
          if (num > 12) num = 12;
          if (num < 1 && val.length === 2) num = 1;
          pickerState.h12 = num || 12;
          pickerState.isEmpty = false;
          syncHidden();
        }
        if (val.length === 2 && mInput) {
          mInput.focus();
          mInput.select();
        }
      });
      hInput.addEventListener("blur", () => {
        let num = parseInt(hInput.value, 10);
        if (isNaN(num) || num < 1) num = 12;
        if (num > 12) num = 12;
        pickerState.h12 = num;
        hInput.value = String(num).padStart(2, "0");
        syncHidden();
      });
    }

    if (mInput) {
      mInput.addEventListener("focus", () => mInput.select());
      mInput.addEventListener("wheel", (e) => {
        e.preventDefault();
        stepMinutes(e.deltaY < 0 ? 5 : -5);
      });
      mInput.addEventListener("input", () => {
        let val = mInput.value.replace(/\D/g, "");
        if (val.length > 2) val = val.slice(0, 2);
        mInput.value = val;
        let num = parseInt(val, 10);
        if (!isNaN(num)) {
          if (num > 59) num = 59;
          pickerState.m = num;
          pickerState.isEmpty = false;
          syncHidden();
        }
      });
      mInput.addEventListener("blur", () => {
        let num = parseInt(mInput.value, 10);
        if (isNaN(num) || num < 0) num = 0;
        if (num > 59) num = 59;
        pickerState.m = num;
        mInput.value = String(num).padStart(2, "0");
        syncHidden();
      });
    }

    containerEl.querySelectorAll(".dcp-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        applyPreset(chip.dataset.preset);
      });
    });
  }

  // Initialize state from initialTime if provided
  if (initialTime) {
    const parsed = parseTimeStr(initialTime);
    if (parsed) {
      pickerState.h12 = parsed.h12;
      pickerState.m = parsed.m;
      pickerState.ampm = parsed.ampm;
      pickerState.isEmpty = false;
    }
  }

  render();

  return {
    setTime(timeStr) {
      if (!timeStr) {
        pickerState.isEmpty = true;
        if (hiddenInputEl) hiddenInputEl.value = "";
        updateDisplay();
        if (typeof onChange === "function") onChange("", "Off", true);
        return;
      }
      const parsed = parseTimeStr(timeStr);
      if (parsed) {
        pickerState.h12 = parsed.h12;
        pickerState.m = parsed.m;
        pickerState.ampm = parsed.ampm;
        pickerState.isEmpty = false;
        updateDisplay();
        syncHidden();
      }
    },
    getTime() {
      return to24hString();
    },
    getFormatted() {
      return to12hDisplayString();
    },
    clear() {
      pickerState.isEmpty = true;
      if (hiddenInputEl) hiddenInputEl.value = "";
      updateDisplay();
      if (typeof onChange === "function") onChange("", "Off", true);
    },
    setDefaultNow(minsAhead = 30) {
      applyPreset(`in-${minsAhead}`);
    },
  };
}

// Global clock picker references
let addClockPicker = null;
let modalClockPicker = null;

// Initialize Add Task digital clock picker
const addClockContainer = document.getElementById("add-digital-clock-picker");
const addClockHidden = document.getElementById("todo-reminder-time-input");
const pillBtn = document.getElementById("todo-clock-pill-btn");
const pillText = document.getElementById("todo-clock-pill-text");
const pillWrap = document.getElementById("todo-reminder-pill-container");
const pillClearBtn = document.getElementById("btn-clear-pill-time");
const popover = document.getElementById("add-todo-clock-popover");
const closePopoverBtn = document.getElementById("close-add-clock-popover");
const applyPopoverBtn = document.getElementById("btn-apply-add-clock");
const clearPopoverBtn = document.getElementById("btn-clear-add-clock");

if (addClockContainer && addClockHidden) {
  addClockPicker = createDigitalClockPicker({
    containerEl: addClockContainer,
    hiddenInputEl: addClockHidden,
    initialTime: "",
    onChange: (val24, val12, isEmpty) => {
      if (pillText) {
        pillText.innerText = isEmpty ? "Remind: Off" : val12;
      }
      if (pillClearBtn) {
        pillClearBtn.style.display = isEmpty ? "none" : "inline-block";
      }
      if (pillWrap) {
        pillWrap.classList.toggle("has-time", !isEmpty);
      }
    },
  });
}

function openAddClockPopover() {
  if (!popover) return;
  popover.style.display = "block";
  if (pillBtn) pillBtn.setAttribute("aria-expanded", "true");
  if (addClockPicker && !addClockHidden.value) {
    addClockPicker.setDefaultNow(30);
  }
}

function closeAddClockPopover() {
  if (!popover) return;
  popover.style.display = "none";
  if (pillBtn) pillBtn.setAttribute("aria-expanded", "false");
}

if (pillBtn) {
  pillBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popover && popover.style.display === "block") {
      closeAddClockPopover();
    } else {
      openAddClockPopover();
    }
  });
}

if (closePopoverBtn) {
  closePopoverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAddClockPopover();
  });
}

if (applyPopoverBtn) {
  applyPopoverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAddClockPopover();
  });
}

if (clearPopoverBtn) {
  clearPopoverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (addClockPicker) addClockPicker.clear();
    closeAddClockPopover();
  });
}

if (pillClearBtn) {
  pillClearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (addClockPicker) addClockPicker.clear();
    closeAddClockPopover();
  });
}

document.addEventListener("click", (e) => {
  if (popover && popover.style.display === "block") {
    if (!popover.contains(e.target) && !pillWrap.contains(e.target)) {
      closeAddClockPopover();
    }
  }
});

// Initialize Modal digital clock picker
const modalClockContainer = document.getElementById("modal-digital-clock-picker");
const modalClockHidden = document.getElementById("modal-reminder-time-input");
if (modalClockContainer && modalClockHidden) {
  modalClockPicker = createDigitalClockPicker({
    containerEl: modalClockContainer,
    hiddenInputEl: modalClockHidden,
    initialTime: "",
  });
}

// --- Daily To-Do Component ---
async function loadTodayTodos() {
  if (!state.todayDateStr) return;
  try {
    const todos = await api(`/todos/date/${state.todayDateStr}`);
    state.todayTodos = todos || [];
  } catch {}
}

async function loadTodosForDate(dateStr) {
  const todos = await api(`/todos/date/${dateStr}`);
  state.todos = todos || [];
  if (dateStr === state.todayDateStr) {
    state.todayTodos = state.todos;
  }
  renderTodos();
}

let currentModalTodo = null;

function openReminderModal(todo) {
  currentModalTodo = todo;
  const modal = document.getElementById("todo-reminder-modal");
  const taskTextEl = document.getElementById("modal-reminder-task-text");
  const soundSelect = document.getElementById("modal-reminder-sound-select");
  const clearBtn = document.getElementById("btn-clear-reminder");

  if (!modal) return;

  if (taskTextEl) taskTextEl.innerText = todo.text;
  if (modalClockPicker) {
    if (todo.reminder_time) {
      modalClockPicker.setTime(String(todo.reminder_time).slice(0, 5));
    } else {
      modalClockPicker.setDefaultNow(30);
    }
  }
  if (soundSelect) {
    soundSelect.value = getActiveSoundId();
  }
  if (clearBtn) {
    clearBtn.style.display = todo.reminder_time ? "inline-flex" : "none";
  }

  modal.classList.add("open");
}

function closeReminderModal() {
  const modal = document.getElementById("todo-reminder-modal");
  if (modal) modal.classList.remove("open");
  currentModalTodo = null;
}

function renderTodos() {
  const listEl = document.getElementById("todo-items-list");
  const emptyEl = document.getElementById("todo-empty-state");
  const emptyMsg = document.getElementById("todo-empty-message");
  const badgeEl = document.getElementById("todo-date-badge");
  const counterEl = document.getElementById("todo-counter-pill");
  const progressBar = document.getElementById("todo-progress-fill");
  const progressStat = document.getElementById("todo-progress-stat");

  if (!listEl) return;

  // Update date badge
  if (badgeEl) {
    if (state.selectedDate === state.todayDateStr) {
      badgeEl.className = "date-badge badge-today";
      badgeEl.innerText = "Today";
    } else if (state.selectedDate > state.todayDateStr) {
      badgeEl.className = "date-badge badge-future";
      badgeEl.innerText = "Future Date";
    } else {
      badgeEl.className = "date-badge badge-past";
      badgeEl.innerText = "Past Date";
    }
  }

  const total = state.todos.length;
  const completedCount = state.todos.filter((t) => t.completed).length;
  const pendingCount = total - completedCount;

  // Update filter counters
  const cAll = document.getElementById("count-filter-all");
  const cActive = document.getElementById("count-filter-active");
  const cComp = document.getElementById("count-filter-completed");
  if (cAll) cAll.innerText = total;
  if (cActive) cActive.innerText = pendingCount;
  if (cComp) cComp.innerText = completedCount;

  // Update progress bar
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressStat) progressStat.innerText = `${pct}%`;

  if (counterEl) {
    if (total === 0) {
      counterEl.innerText = "0 tasks";
      counterEl.classList.remove("all-done");
    } else if (completedCount === total) {
      counterEl.innerText = `${completedCount}/${total} done ✓`;
      counterEl.classList.add("all-done");
    } else {
      counterEl.innerText = `${completedCount}/${total} done`;
      counterEl.classList.remove("all-done");
    }
  }

  // Filter tasks based on selected filter tab
  const filter = state.todoFilter || "all";
  let filtered = state.todos;
  if (filter === "active") {
    filtered = state.todos.filter((t) => !t.completed);
  } else if (filter === "completed") {
    filtered = state.todos.filter((t) => t.completed);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.style.display = "flex";
      if (emptyMsg) {
        if (filter === "active" && total > 0) {
          emptyMsg.innerText = "All caught up! No pending tasks 🎉";
        } else if (filter === "completed" && total > 0) {
          emptyMsg.innerText = "No completed tasks yet.";
        } else {
          emptyMsg.innerText = "No tasks for this day.";
        }
      }
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  listEl.innerHTML = "";

  const activeSound = getActiveSoundId();
  const soundMeta = SOUND_OPTIONS.find((s) => s.id === activeSound) || SOUND_OPTIONS[0];

  filtered.forEach((item) => {
    const el = document.createElement("div");
    el.className = `todo-item ${item.completed ? "completed" : ""}`;
    el.dataset.id = item.id;

    el.innerHTML = `
      <button type="button" class="todo-check-btn" aria-label="Toggle task completion" title="${item.completed ? "Mark incomplete" : "Mark complete"}">
        <span class="todo-checkbox ${item.completed ? "checked" : ""}">
          ${item.completed ? "✓" : ""}
        </span>
      </button>
      <div class="todo-content">
        <span class="todo-text ${item.completed ? "strikethrough" : ""}">${escapeHtml(item.text)}</span>
        <div class="todo-badges-wrap">
          ${item.is_daily ? '<span class="todo-badge-daily" title="Repeats daily until stopped">↻ Daily</span>' : ""}
          ${item.reminder_time ? `
            <button type="button" class="todo-badge-reminder" title="Reminder set for ${formatTimeHHMM(item.reminder_time)} (${soundMeta.name}). Click to edit.">
              🔔 ${formatTimeHHMM(item.reminder_time)}
            </button>
          ` : ""}
        </div>
      </div>
      <div class="todo-actions">
        <button type="button" class="icon-btn-ghost todo-reminder-btn" title="${item.reminder_time ? "Edit reminder time" : "Set reminder time"}">
          🔔
        </button>
        ${item.is_daily && !item.is_disabled ? `
          <button type="button" class="icon-btn-ghost todo-disable-btn" title="Stop recurring from this date onwards">
            ⏹
          </button>
        ` : ""}
        <button type="button" class="icon-btn-ghost todo-delete-btn" title="Delete task permanently">
          ×
        </button>
      </div>
    `;

    // Toggle on clicking item or checkbox
    el.addEventListener("click", (e) => {
      if (
        e.target.closest(".todo-disable-btn") ||
        e.target.closest(".todo-delete-btn") ||
        e.target.closest(".todo-reminder-btn") ||
        e.target.closest(".todo-badge-reminder")
      ) {
        return;
      }
      toggleTodo(item.id);
    });

    // Reminder badge click opens modal
    const reminderBadge = el.querySelector(".todo-badge-reminder");
    if (reminderBadge) {
      reminderBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        openReminderModal(item);
      });
    }

    // Reminder action button click opens modal
    const reminderBtn = el.querySelector(".todo-reminder-btn");
    if (reminderBtn) {
      reminderBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openReminderModal(item);
      });
    }

    const disableBtn = el.querySelector(".todo-disable-btn");
    if (disableBtn) {
      disableBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        disableTodoRecurrence(item.id);
      });
    }

    const deleteBtn = el.querySelector(".todo-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTodoItem(item.id);
      });
    }

    listEl.appendChild(el);
  });
}

// Filter button listeners
document.querySelectorAll(".todo-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".todo-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.todoFilter = btn.dataset.filter || "all";
    renderTodos();
  });
});

async function toggleTodo(todoId) {
  try {
    const res = await api(`/todos/${todoId}/toggle/${state.selectedDate}`, {
      method: "POST",
    });
    if (res) {
      const item = state.todos.find((t) => t.id === todoId);
      if (item) {
        item.completed = res.completed;
        state.todos.sort((a, b) => (a.completed - b.completed));
        renderTodos();
      }
      if (state.todayTodos) {
        const todayItem = state.todayTodos.find((t) => t.id === todoId);
        if (todayItem && state.selectedDate === state.todayDateStr) {
          todayItem.completed = res.completed;
        }
      }
    }
  } catch {}
}

function disableTodoRecurrence(todoId) {
  askConfirmation({
    title: "Stop Daily Recurrence",
    message: "Stop repeating this task on future days starting from this date? Past completed days will remain preserved.",
    onConfirm: async () => {
      try {
        const res = await api(`/todos/${todoId}/disable`, {
          method: "POST",
          body: JSON.stringify({ disabled_date: state.selectedDate }),
        });
        if (res) {
          showToast("Recurrence stopped from this date");
          await loadTodosForDate(state.selectedDate);
          if (state.selectedDate !== state.todayDateStr) {
            await loadTodayTodos();
          }
        }
      } catch {}
    },
  });
}

function deleteTodoItem(todoId) {
  askConfirmation({
    title: "Delete Task",
    message: "Are you sure you want to delete this task?",
    onConfirm: async () => {
      try {
        const res = await api(`/todos/${todoId}`, { method: "DELETE" });
        if (res) {
          showToast("Task deleted");
          await loadTodosForDate(state.selectedDate);
          if (state.selectedDate !== state.todayDateStr) {
            await loadTodayTodos();
          }
        }
      } catch {}
    },
  });
}

// Modal event listeners
const saveReminderForm = document.getElementById("save-reminder-form");
if (saveReminderForm) {
  saveReminderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentModalTodo) return;
    const timeInput = document.getElementById("modal-reminder-time-input");
    const soundSelect = document.getElementById("modal-reminder-sound-select");
    const val = (modalClockPicker && modalClockPicker.getTime()) ? modalClockPicker.getTime() : (timeInput ? timeInput.value : "");
    if (!val) {
      showToast("Please choose a reminder time");
      return;
    }

    if (soundSelect && soundSelect.value) {
      setActiveSoundId(soundSelect.value);
    }

    try {
      const res = await api(`/todos/${currentModalTodo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ reminder_time: val + ":00" }),
      });
      if (res) {
        showToast("Reminder set for " + formatTimeHHMM(res.reminder_time));
        closeReminderModal();
        await loadTodosForDate(state.selectedDate);
        if (state.selectedDate !== state.todayDateStr) {
          await loadTodayTodos();
        }
      }
    } catch {}
  });
}

const clearReminderBtn = document.getElementById("btn-clear-reminder");
if (clearReminderBtn) {
  clearReminderBtn.addEventListener("click", async () => {
    if (!currentModalTodo) return;
    try {
      const res = await api(`/todos/${currentModalTodo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ clear_reminder: true }),
      });
      if (res) {
        showToast("Reminder removed");
        closeReminderModal();
        await loadTodosForDate(state.selectedDate);
        if (state.selectedDate !== state.todayDateStr) {
          await loadTodayTodos();
        }
      }
    } catch {}
  });
}

const cancelReminderBtn = document.getElementById("cancel-reminder-modal");
if (cancelReminderBtn) {
  cancelReminderBtn.addEventListener("click", closeReminderModal);
}

const closeReminderModalBtn = document.getElementById("close-reminder-modal");
if (closeReminderModalBtn) {
  closeReminderModalBtn.addEventListener("click", closeReminderModal);
}

const testChimeBtn = document.getElementById("btn-test-chime");
if (testChimeBtn) {
  testChimeBtn.addEventListener("click", () => {
    const soundSelect = document.getElementById("modal-reminder-sound-select");
    const sound = soundSelect ? soundSelect.value : getActiveSoundId();
    playNotificationSound(sound);
  });
}

const modalPreviewSoundBtn = document.getElementById("btn-modal-preview-sound");
if (modalPreviewSoundBtn) {
  modalPreviewSoundBtn.addEventListener("click", () => {
    const soundSelect = document.getElementById("modal-reminder-sound-select");
    const sound = soundSelect ? soundSelect.value : getActiveSoundId();
    playNotificationSound(sound);
  });
}

const previewAddSoundBtn = document.getElementById("preview-add-sound-btn");
if (previewAddSoundBtn) {
  previewAddSoundBtn.addEventListener("click", () => {
    playNotificationSound();
    const opt = SOUND_OPTIONS.find((s) => s.id === getActiveSoundId());
    showToast(`Playing ${opt ? opt.name : "reminder music"} 🎵`);
  });
}

// Add Task Form Event Listener
const addTodoForm = document.getElementById("add-todo-form");
if (addTodoForm) {
  addTodoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("todo-text-input");
    const dailyCheck = document.getElementById("todo-is-daily-check");
    const reminderInput = document.getElementById("todo-reminder-time-input");
    const text = input ? input.value.trim() : "";
    if (!text) return;
    const isDaily = dailyCheck ? dailyCheck.checked : false;
    const reminderTime = (reminderInput && reminderInput.value) ? reminderInput.value + ":00" : null;

    try {
      const created = await api("/todos", {
        method: "POST",
        body: JSON.stringify({
          text: text,
          start_date: state.selectedDate || state.todayDateStr,
          is_daily: isDaily,
          reminder_time: reminderTime,
        }),
      });

      if (created) {
        if (input) input.value = "";
        if (dailyCheck) dailyCheck.checked = false;
        if (addClockPicker) addClockPicker.clear();
        else if (reminderInput) reminderInput.value = "";
        showToast(isDaily ? (reminderTime ? "Daily task with reminder created" : "Daily task created") : (reminderTime ? "Task with reminder added" : "Task added"));
        await loadTodosForDate(state.selectedDate);
        if (state.selectedDate !== state.todayDateStr) {
          await loadTodayTodos();
        }
      }
    } catch {}
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

// --- Modals: Time Entry (Digital Clock Edition) ---
const entryModal = document.getElementById("entry-modal");
let editingEntryId = null;

let entryStartClockPicker = null;
let entryEndClockPicker = null;

const entryDatePicker = document.getElementById("entry-date-picker");
const entryStartContainer = document.getElementById("entry-start-clock-picker");
const entryEndContainer = document.getElementById("entry-end-clock-picker");
const entryStartHidden = document.getElementById("entry-start-input");
const entryEndHidden = document.getElementById("entry-end-input");
const entryStartValDisplay = document.getElementById("entry-start-val-display");
const entryEndValDisplay = document.getElementById("entry-end-val-display");
const entryDurationCard = document.getElementById("entry-duration-card");
const entryCalculatedDuration = document.getElementById("entry-calculated-duration");
const saveEntrySubmitBtn = document.getElementById("save-entry-submit-btn");

function syncEntryTimesAndDuration() {
  if (!entryStartClockPicker || !entryEndClockPicker) return;

  const dateStr = (entryDatePicker && entryDatePicker.value) ? entryDatePicker.value : (state.selectedDate || state.todayDateStr);
  const startTime = entryStartClockPicker.getTime() || "09:00";
  const endTime = entryEndClockPicker.getTime() || "10:00";

  if (entryStartValDisplay) entryStartValDisplay.innerText = entryStartClockPicker.getFormatted();
  if (entryEndValDisplay) entryEndValDisplay.innerText = entryEndClockPicker.getFormatted();

  const startIso = `${dateStr}T${startTime}:00`;
  const endIso = `${dateStr}T${endTime}:00`;

  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes > 0) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    let durText = "";
    if (hours > 0 && mins > 0) durText = `${hours}h ${mins}m`;
    else if (hours > 0) durText = `${hours}h 00m`;
    else durText = `${mins}m`;

    if (entryCalculatedDuration) entryCalculatedDuration.innerText = `${durText} (${entryStartClockPicker.getFormatted()} → ${entryEndClockPicker.getFormatted()})`;
    if (entryDurationCard) entryDurationCard.classList.remove("invalid");
    if (saveEntrySubmitBtn) saveEntrySubmitBtn.disabled = false;

    if (entryStartHidden) entryStartHidden.value = startIso;
    if (entryEndHidden) entryEndHidden.value = endIso;
  } else {
    if (entryCalculatedDuration) entryCalculatedDuration.innerText = "⚠️ End time must be after start time";
    if (entryDurationCard) entryDurationCard.classList.add("invalid");
    if (saveEntrySubmitBtn) saveEntrySubmitBtn.disabled = true;

    if (entryStartHidden) entryStartHidden.value = "";
    if (entryEndHidden) entryEndHidden.value = "";
  }
}

if (entryStartContainer && entryEndContainer) {
  entryStartClockPicker = createDigitalClockPicker({
    containerEl: entryStartContainer,
    hiddenInputEl: null,
    initialTime: "09:00",
    showPresets: false,
    onChange: () => syncEntryTimesAndDuration(),
  });

  entryEndClockPicker = createDigitalClockPicker({
    containerEl: entryEndContainer,
    hiddenInputEl: null,
    initialTime: "10:00",
    showPresets: false,
    onChange: () => syncEntryTimesAndDuration(),
  });
}

if (entryDatePicker) {
  entryDatePicker.addEventListener("change", () => {
    const subTitleEl = document.getElementById("entry-modal-subtitle");
    if (subTitleEl && entryDatePicker.value) {
      const dateObj = new Date(entryDatePicker.value + "T00:00:00");
      subTitleEl.innerText = dateObj.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
    syncEntryTimesAndDuration();
  });
}

// Duration preset chips
document.querySelectorAll(".duration-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const minsToAdd = parseInt(chip.dataset.mins, 10);
    if (isNaN(minsToAdd) || !entryStartClockPicker || !entryEndClockPicker) return;

    const startTime = entryStartClockPicker.getTime() || "09:00";
    const [hStr, mStr] = startTime.split(":");
    let totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + minsToAdd;
    let newH = Math.floor(totalMins / 60);
    let newM = totalMins % 60;
    if (newH >= 24) newH = 23;

    const newTimeStr = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
    entryEndClockPicker.setTime(newTimeStr);
    syncEntryTimesAndDuration();
  });
});

const addEntryBtn = document.getElementById("add-entry-btn");
if (addEntryBtn) {
  addEntryBtn.addEventListener("click", () => {
    editingEntryId = null;
    document.getElementById("entry-modal-title").innerText = "Add Time Entry";
    const curDate = state.selectedDate || state.todayDateStr;
    if (entryDatePicker) entryDatePicker.value = curDate;

    const subTitleEl = document.getElementById("entry-modal-subtitle");
    if (subTitleEl && curDate) {
      const dateObj = new Date(curDate + "T00:00:00");
      subTitleEl.innerText = dateObj.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }

    if (entryStartClockPicker) entryStartClockPicker.setTime("09:00");
    if (entryEndClockPicker) entryEndClockPicker.setTime("10:00");
    document.getElementById("entry-note-modal-input").value = "";

    syncEntryTimesAndDuration();
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

  const toLocalIsoParts = (dStr) => {
    const d = new Date(dStr);
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    const localIso = new Date(d.getTime() - offsetMs).toISOString();
    return {
      date: localIso.slice(0, 10),
      time: localIso.slice(11, 16),
    };
  };

  const startParts = toLocalIsoParts(entry.start_time);
  const endParts = entry.end_time ? toLocalIsoParts(entry.end_time) : { date: startParts.date, time: "10:00" };

  if (entryDatePicker) entryDatePicker.value = startParts.date;

  const subTitleEl = document.getElementById("entry-modal-subtitle");
  if (subTitleEl && startParts.date) {
    const dateObj = new Date(startParts.date + "T00:00:00");
    subTitleEl.innerText = dateObj.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  if (entryStartClockPicker) entryStartClockPicker.setTime(startParts.time);
  if (entryEndClockPicker) entryEndClockPicker.setTime(endParts.time);

  document.getElementById("entry-note-modal-input").value = entry.note || "";
  syncEntryTimesAndDuration();
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
    const titleEl = document.getElementById("note-modal-title");
    const subTitleEl = document.getElementById("note-modal-subtitle");
    const textInput = document.getElementById("note-text-input");
    const charCount = document.getElementById("note-char-count");

    if (titleEl) titleEl.innerText = "New Planning Note";
    if (subTitleEl && state.selectedDate) {
      const dateObj = new Date(state.selectedDate + "T00:00:00");
      subTitleEl.innerText = dateObj.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (textInput) {
      textInput.value = "";
      setTimeout(() => textInput.focus(), 60);
    }
    if (charCount) charCount.innerText = "0 characters";

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
  const titleEl = document.getElementById("note-modal-title");
  const subTitleEl = document.getElementById("note-modal-subtitle");
  const textInput = document.getElementById("note-text-input");
  const charCount = document.getElementById("note-char-count");

  if (titleEl) titleEl.innerText = "Edit Planning Note";
  if (subTitleEl && state.selectedDate) {
    const dateObj = new Date(state.selectedDate + "T00:00:00");
    subTitleEl.innerText = dateObj.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (textInput) {
    textInput.value = note.note;
    setTimeout(() => textInput.focus(), 60);
  }
  if (charCount) {
    const len = (note.note || "").length;
    charCount.innerText = `${len} character${len === 1 ? "" : "s"}`;
  }

  noteModal.classList.add("open");
}

const noteTextInput = document.getElementById("note-text-input");
if (noteTextInput) {
  noteTextInput.addEventListener("input", () => {
    const charCount = document.getElementById("note-char-count");
    if (charCount) {
      const len = noteTextInput.value.length;
      charCount.innerText = `${len} character${len === 1 ? "" : "s"}`;
    }
  });

  // Ctrl+Enter or Cmd+Enter to save note
  noteTextInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const saveForm = document.getElementById("save-note-form");
      if (saveForm) saveForm.requestSubmit();
    }
  });
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

// Backdrop overlay click & Escape key dismissal for modals
[entryModal, noteModal].forEach((modalEl) => {
  if (modalEl) {
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) modalEl.classList.remove("open");
    });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (entryModal && entryModal.classList.contains("open")) {
      entryModal.classList.remove("open");
    }
    if (noteModal && noteModal.classList.contains("open")) {
      noteModal.classList.remove("open");
    }
    const confirmModal = document.getElementById("confirm-modal");
    if (confirmModal && confirmModal.classList.contains("open")) {
      confirmModal.classList.remove("open");
    }
  }
});

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

// --- Calendar Navigation & View Switching ---
const calMonthBtn = document.getElementById("cal-month-btn");
if (calMonthBtn) {
  calMonthBtn.addEventListener("click", () => {
    if (state.calendarView === "months") {
      setCalendarView("days");
    } else if (state.calendarView === "years") {
      setCalendarView(state.previousCalendarView === "months" ? "months" : "days");
    } else {
      setCalendarView("months");
    }
  });
}

const calYearBtn = document.getElementById("cal-year-btn");
if (calYearBtn) {
  calYearBtn.addEventListener("click", () => {
    if (state.calendarView === "years") {
      setCalendarView(state.previousCalendarView === "months" ? "months" : "days");
    } else {
      state.calendarDecadeStart = Math.floor(state.calendarYear / 10) * 10;
      setCalendarView("years");
    }
  });
}

const prevMonthBtn = document.getElementById("prev-month-btn");
if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    if (state.calendarView === "days") {
      state.calendarMonth -= 1;
      if (state.calendarMonth < 1) {
        state.calendarMonth = 12;
        state.calendarYear -= 1;
      }
      loadCalendar(state.calendarYear, state.calendarMonth);
    } else if (state.calendarView === "months") {
      state.calendarYear -= 1;
      const yearText = document.getElementById("cal-year-text");
      if (yearText) yearText.innerText = state.calendarYear;
      renderMonthsGrid();
    } else if (state.calendarView === "years") {
      state.calendarDecadeStart -= 10;
      renderYearsGrid();
    }
  });
}

const nextMonthBtn = document.getElementById("next-month-btn");
if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    if (state.calendarView === "days") {
      state.calendarMonth += 1;
      if (state.calendarMonth > 12) {
        state.calendarMonth = 1;
        state.calendarYear += 1;
      }
      loadCalendar(state.calendarYear, state.calendarMonth);
    } else if (state.calendarView === "months") {
      state.calendarYear += 1;
      const yearText = document.getElementById("cal-year-text");
      if (yearText) yearText.innerText = state.calendarYear;
      renderMonthsGrid();
    } else if (state.calendarView === "years") {
      state.calendarDecadeStart += 10;
      renderYearsGrid();
    }
  });
}

const todayMonthBtn = document.getElementById("today-month-btn");
if (todayMonthBtn) {
  todayMonthBtn.addEventListener("click", () => {
    const today = new Date(state.todayDateStr || new Date());
    state.calendarYear = today.getFullYear();
    state.calendarMonth = today.getMonth() + 1;
    state.calendarDecadeStart = Math.floor(state.calendarYear / 10) * 10;
    setCalendarView("days");
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

// --- Account & Profile Management ---
const accountModal = document.getElementById("account-modal");
const openProfileBtn = document.getElementById("open-profile-btn");
const closeAccountModalBtn = document.getElementById("close-account-modal");
const cancelAccountModalBtn = document.getElementById("cancel-account-modal");
const cancelSecurityModalBtn = document.getElementById("cancel-security-modal");

const tabProfileBtn = document.getElementById("modal-tab-profile");
const tabSecurityBtn = document.getElementById("modal-tab-security");
const profilePanel = document.getElementById("modal-profile-panel");
const securityPanel = document.getElementById("modal-security-panel");

function switchAccountTab(tab) {
  if (tab === "profile") {
    if (tabProfileBtn) tabProfileBtn.classList.add("active");
    if (tabSecurityBtn) tabSecurityBtn.classList.remove("active");
    if (profilePanel) profilePanel.style.display = "block";
    if (securityPanel) securityPanel.style.display = "none";
  } else {
    if (tabProfileBtn) tabProfileBtn.classList.remove("active");
    if (tabSecurityBtn) tabSecurityBtn.classList.add("active");
    if (profilePanel) profilePanel.style.display = "none";
    if (securityPanel) securityPanel.style.display = "block";
  }
}

if (tabProfileBtn) {
  tabProfileBtn.addEventListener("click", () => switchAccountTab("profile"));
}

if (tabSecurityBtn) {
  tabSecurityBtn.addEventListener("click", () => switchAccountTab("security"));
}

async function openAccountModal() {
  if (!accountModal) return;

  switchAccountTab("profile");

  // Fetch fresh account details
  let user = state.currentUser;
  try {
    const fetched = await api("/account");
    if (fetched) {
      user = fetched;
      state.currentUser = fetched;
    }
  } catch {}

  if (user) {
    const nameDisplay = document.getElementById("user-name-display");
    if (nameDisplay) nameDisplay.innerText = user.name || user.username;

    const cardName = document.getElementById("profile-card-name");
    const cardUsername = document.getElementById("profile-card-username");
    const cardEmail = document.getElementById("profile-card-email");
    const nameInput = document.getElementById("account-name-input");
    const tzSelect = document.getElementById("account-tz-select");

    if (cardName) cardName.innerText = user.name || "User";
    if (cardUsername) cardUsername.innerText = `@${user.username}`;
    if (cardEmail) cardEmail.innerText = user.email || "No email linked";
    if (nameInput) nameInput.value = user.name || "";
    if (tzSelect && user.timezone) tzSelect.value = user.timezone;
  }

  // Clear password inputs
  const curPw = document.getElementById("account-cur-pw");
  const newPw = document.getElementById("account-new-pw");
  if (curPw) curPw.value = "";
  if (newPw) newPw.value = "";

  accountModal.classList.add("open");
}

if (openProfileBtn) {
  openProfileBtn.addEventListener("click", openAccountModal);
}

if (closeAccountModalBtn) {
  closeAccountModalBtn.addEventListener("click", () => accountModal.classList.remove("open"));
}

if (cancelAccountModalBtn) {
  cancelAccountModalBtn.addEventListener("click", () => accountModal.classList.remove("open"));
}

if (cancelSecurityModalBtn) {
  cancelSecurityModalBtn.addEventListener("click", () => accountModal.classList.remove("open"));
}

if (accountModal) {
  accountModal.addEventListener("click", (e) => {
    if (e.target === accountModal) accountModal.classList.remove("open");
  });
}

// Update Profile Form Submit
const updateProfileForm = document.getElementById("update-profile-form");
if (updateProfileForm) {
  updateProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("account-name-input");
    const tzSelect = document.getElementById("account-tz-select");
    const saveBtn = document.getElementById("save-profile-btn");

    const payload = {
      name: nameInput ? nameInput.value.trim() : undefined,
      timezone: tzSelect ? tzSelect.value : undefined,
    };

    if (!payload.name) {
      showToast("Name cannot be empty", "error");
      return;
    }

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";
      }

      const updated = await api("/account", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (updated) {
        state.currentUser = updated;
        const nameDisplay = document.getElementById("user-name-display");
        if (nameDisplay) nameDisplay.innerText = updated.name || updated.username;

        showToast("Profile updated successfully");
        accountModal.classList.remove("open");

        // Refresh today & calendar in case timezone shifted current date
        await refreshTodaySummary();
        await selectDate(state.todayDateStr);
        await loadCalendar(state.calendarYear, state.calendarMonth);
      }
    } catch {} finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Changes";
      }
    }
  });
}

// Change Password Form Submit
const changePasswordForm = document.getElementById("change-password-form");
if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const curPwInput = document.getElementById("account-cur-pw");
    const newPwInput = document.getElementById("account-new-pw");
    const saveBtn = document.getElementById("save-password-btn");

    const curPw = curPwInput ? curPwInput.value : "";
    const newPw = newPwInput ? newPwInput.value : "";

    if (!curPw || !newPw) {
      showToast("Please provide both current and new passwords.", "error");
      return;
    }
    if (newPw.length < 8) {
      showToast("New password must be at least 8 characters long.", "error");
      return;
    }

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = "Updating...";
      }

      const res = await api("/account/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: curPw, new_password: newPw }),
      });

      if (res) {
        showToast("Password changed successfully!");
        accountModal.classList.remove("open");
        if (curPwInput) curPwInput.value = "";
        if (newPwInput) newPwInput.value = "";
      }
    } catch {} finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = "Change Password";
      }
    }
  });
}

// Delete Account Button Click
const deleteAccountBtn = document.getElementById("delete-account-btn");
if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener("click", () => {
    askConfirmation({
      title: "Delete Account",
      message: "Are you sure? All your recorded time entries and notes will be permanently deleted. This cannot be undone.",
      onConfirm: async () => {
        try {
          await api("/account", { method: "DELETE" });
          showToast("Account successfully deleted");
          if (accountModal) accountModal.classList.remove("open");
          handleUnauthenticated();
        } catch {}
      },
    });
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
  createFaviconUrls();
  if (baseFaviconDataUrl) setFavicon(baseFaviconDataUrl);
  updateActiveSoundDisplay();
  updateDigitalClock();
  populateTimezones();
  checkAuth();
  setupPasswordToggle("toggle-account-cur-pw", "account-cur-pw");
  setupPasswordToggle("toggle-account-new-pw", "account-new-pw");
});
