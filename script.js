(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   *  Constants & tiny helpers
   * ------------------------------------------------------------------ */
  const STORAGE_KEYS = {
    todos: "cute-todos",
    notes: "cute-notes",
    theme: "cute-theme",
  };

  const QUOTES = [
    "Small steps still move mountains. 🏔️",
    "You are doing amazing today! 💕",
    "One task at a time, sweet friend. 🌷",
    "Progress beats perfection. ✨",
    "Be proud of every little win. 🎀",
    "Soft heart, steady focus. 🍓",
    "Your future self says thank you. 💌",
    "Tiny habits, big sparkle. 🌟",
  ];

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const $ = (selector) => document.querySelector(selector);

  /** Read JSON from localStorage without ever throwing. */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      console.warn("[Cute Planner] Could not read " + key + ":", err);
      return fallback;
    }
  }

  /** Write JSON to localStorage (silently ignores private-mode failures). */
  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[Cute Planner] Could not save " + key + ":", err);
      return false;
    }
  }

  /** Build a local-time YYYY-MM-DD key (never use toISOString: it is UTC). */
  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  /** Math.random-based UUID with a fallback for very old browsers. */
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  /* ------------------------------------------------------------------ *
   *  State
   * ------------------------------------------------------------------ */
  const state = {
    todos: [],           // { id, text, done, created }
    filter: "all",       // all | active | done
    notes: "",
    viewDate: new Date(Date.now()), // first day of the month being displayed
    lastDeleted: null,   // for the undo snackbar
  };

  /** Coerce whatever is in storage into a usable todo array. */
  function normalizeTodos(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((t) => t && typeof t.text === "string" && t.text.trim() !== "")
      .map((t) => ({
        id: typeof t.id === "string" && t.id ? t.id : makeId(),
        text: t.text,
        done: Boolean(t.done),
        created: typeof t.created === "number" ? t.created : Date.now(),
      }));
  }

  /* ------------------------------------------------------------------ *
   *  0. Theme (dark mode) — bonus feature
   * ------------------------------------------------------------------ */
  function initTheme() {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    applyTheme(theme);

    $("#theme-toggle").addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEYS.theme, next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const button = $("#theme-toggle");
    const icon = button.querySelector(".theme-icon");
    const isDark = theme === "dark";
    icon.textContent = isDark ? "☀️" : "🌙";
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", String(isDark));
  }

  /* ------------------------------------------------------------------ *
   *  1. Todo list
   * ------------------------------------------------------------------ */
  function initTodos() {
    state.todos = normalizeTodos(loadJSON(STORAGE_KEYS.todos, []));

    // Add via the form (covers the button AND the Enter key)
    $("#todo-form").addEventListener("submit", (event) => {
      event.preventDefault();
      addTodo($("#todo-input").value);
    });

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll(".filter-btn").forEach((btn) => {
          const active = btn === button;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
        renderTodos();
      });
    });

    // Clear all completed tasks
    $("#clear-done-btn").addEventListener("click", clearDone);

    // Delegated clicks for toggling + deleting (works for re-rendered items)
    $("#todo-list").addEventListener("click", (event) => {
      const item = event.target.closest(".todo-item");
      if (!item) return;
      const id = item.dataset.id;

      if (event.target.closest(".delete-btn")) {
        deleteTodo(id, event);
      } else if (event.target.closest(".todo-checkbox")) {
        toggleTodo(id, event.target.closest(".todo-checkbox"));
      }
    });

    renderTodos();
  }

  function addTodo(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return;

    state.todos.unshift({ id: makeId(), text, done: false, created: Date.now() });
    persistTodos();
    renderTodos();

    const input = $("#todo-input");
    input.value = "";
    input.focus();
  }

  function toggleTodo(id, checkboxEl) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) return;

    todo.done = !todo.done;
    persistTodos();

    // Celebrate immediately while the element is still on screen
    if (todo.done && checkboxEl) {
      const box = checkboxEl.getBoundingClientRect();
      burstHearts(box.left + box.width / 2, box.top + box.height / 2);
    }

    renderTodos();
    renderCalendar();
  }

  function deleteTodo(id, event) {
    const index = state.todos.findIndex((t) => t.id === id);
    if (index === -1) return;

    state.lastDeleted = { todo: state.todos[index], index: index };
    showUndoToast(state.todos[index].text);

    state.todos.splice(index, 1);
    persistTodos();
    renderTodos();
    renderCalendar();

    if (event && event.target) {
      const el = event.target.closest(".todo-item");
      if (el) el.blur();
    }
  }

  function clearDone() {
    const remaining = state.todos.filter((t) => !t.done);
    if (remaining.length === state.todos.length) return;
    state.todos = remaining;
    persistTodos();
    renderTodos();
    renderCalendar();
  }

  function persistTodos() {
    saveJSON(STORAGE_KEYS.todos, state.todos);
  }

  /** Everything is drawn from state — one render path for every action. */
  function renderTodos() {
    const list = $("#todo-list");
    const emptyState = $("#todo-empty");
    const countEl = $("#todo-count");

    const visible = state.todos.filter((todo) => {
      if (state.filter === "active") return !todo.done;
      if (state.filter === "done") return todo.done;
      return true;
    });

    list.innerHTML = "";
    const fragment = document.createDocumentFragment();

    visible.forEach((todo) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.done ? " is-done" : "");
      li.dataset.id = todo.id;

      const checkbox = document.createElement("button");
      checkbox.type = "button";
      checkbox.className = "todo-checkbox" + (todo.done ? " is-checked" : "");
      checkbox.setAttribute("role", "checkbox");
      checkbox.setAttribute("aria-checked", String(todo.done));
      checkbox.setAttribute(
        "aria-label",
        (todo.done ? "Mark as active: " : "Mark as done: ") + todo.text
      );

      const span = document.createElement("span");
      span.className = "todo-text";
      span.textContent = todo.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-btn";
      del.textContent = "🗑️";
      del.setAttribute("aria-label", "Delete task: " + todo.text);
      del.title = "Delete";

      li.append(checkbox, span, del);
      fragment.appendChild(li);
    });

    list.appendChild(fragment);

    // Honest empty messaging that reflects the active filter
    const activeCount = state.todos.filter((t) => !t.done).length;
    let message = "Nothing here yet — add your first task! 🌷";
    if (state.todos.length > 0) {
      if (state.filter === "active") message = "All done! Time for a little treat 🍰";
      else if (state.filter === "done") message = "No finished tasks yet ⏰";
      else message = "Hmm, nothing to show here 🌸";
    }
    emptyState.textContent = message;
    emptyState.hidden = visible.length > 0;

    countEl.textContent =
      state.todos.length === 0
        ? "0 tasks"
        : state.todos.length + (state.todos.length === 1 ? " task" : " tasks") +
          " · " + activeCount + " left";

    const clearBtn = $("#clear-done-btn");
    clearBtn.disabled = state.todos.every((t) => !t.done);
  }

  /* ------------------------------------------------------------------ *
   *  Undo toast for deletions
   * ------------------------------------------------------------------ */
  let toastTimer = null;

  function showUndoToast(text) {
    let toast = $("#undo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "undo-toast";
      toast.className = "undo-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }

    const label = document.createElement("span");
    label.textContent = 'Deleted "' + text.slice(0, 28) + (text.length > 28 ? "…" : "") + '"';

    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "undo-btn";
    undoBtn.textContent = "Undo ↩️";
    undoBtn.addEventListener("click", () => {
      if (state.lastDeleted) {
        state.todos.splice(
          Math.min(state.lastDeleted.index, state.todos.length),
          0,
          state.lastDeleted.todo
        );
        state.lastDeleted = null;
        persistTodos();
        renderTodos();
        renderCalendar();
      }
      hideToast();
    });

    toast.innerHTML = "";
    toast.append(label, undoBtn);
    toast.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      hideToast();
      state.lastDeleted = null;
    }, 5000);
  }

  function hideToast() {
    const toast = $("#undo-toast");
    if (toast) toast.classList.remove("is-visible");
    window.clearTimeout(toastTimer);
  }

  /* ------------------------------------------------------------------ *
   *  2. Notes
   * ------------------------------------------------------------------ */
  function initNotes() {
    const textarea = $("#notes");
    const status = $("#notes-status");

    const saved = localStorage.getItem(STORAGE_KEYS.notes);
    if (typeof saved === "string") {
      textarea.value = saved;
      state.notes = saved;
    }

    let statusTimer = null;

    textarea.addEventListener("input", () => {
      state.notes = textarea.value;
      saveJSON(STORAGE_KEYS.notes, state.notes);

      status.textContent = "Saving… ✏️";
      status.classList.remove("is-saved");
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        status.textContent = "Saved automatically 💾";
        status.classList.add("is-saved");
      }, 400);
    });

    $("#clear-notes-btn").addEventListener("click", () => {
      if (textarea.value.trim() !== "" && !window.confirm("Clear all your notes? 🗑️")) return;
      textarea.value = "";
      state.notes = "";
      saveJSON(STORAGE_KEYS.notes, "");
      status.textContent = "Notes cleared 🧼";
      textarea.focus();
    });

    // Flush the last keystrokes if the tab is closed quickly
    window.addEventListener("beforeunload", () => {
      saveJSON(STORAGE_KEYS.notes, textarea.value);
    });
  }

  /* ------------------------------------------------------------------ *
   *  3. Calendar
   * ------------------------------------------------------------------ */
  function initCalendar() {
    state.viewDate = new Date();
    state.viewDate.setDate(1);

    $("#prev-month").addEventListener("click", () => changeMonth(-1));
    $("#next-month").addEventListener("click", () => changeMonth(1));
    $("#today-btn").addEventListener("click", () => {
      state.viewDate = new Date();
      state.viewDate.setDate(1);
      renderCalendar();
    });

    renderCalendar();
  }

  function changeMonth(delta) {
    // Day is pinned to 1, so adding months can never overflow into the next one.
    state.viewDate = new Date(
      state.viewDate.getFullYear(),
      state.viewDate.getMonth() + delta,
      1
    );
    renderCalendar();
  }

  function renderCalendar() {
    const grid = $("#calendar-grid");
    const heading = $("#calendar-heading");

    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();

    heading.textContent = MONTH_NAMES[month] + " " + year + " 📅";

    // Start the grid on the Sunday on or before the 1st of the month
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = startOffset + daysInMonth;
    const weeks = Math.ceil(totalCells / 7);
    const cellCount = weeks * 7;

    // Local-time "today" + the set of days that still have pending tasks
    const today = new Date();
    const pendingDays = new Set(
      state.todos.filter((t) => !t.done).map((t) => dateKey(new Date(t.created)))
    );

    grid.innerHTML = "";

    let row = null;

    for (let i = 0; i < cellCount; i++) {
      // Wrap every group of 7 cells in a row so assistive tech can read the grid
      if (i % 7 === 0) {
        row = document.createElement("div");
        row.className = "cal-week";
        row.setAttribute("role", "row");
        grid.appendChild(row);
      }

      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );

      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.setAttribute("role", "gridcell");
      cell.textContent = String(cellDate.getDate());

      const outside = cellDate.getMonth() !== month || cellDate.getFullYear() !== year;
      const isToday = isSameDay(cellDate, today);
      const weekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

      if (outside) cell.classList.add("is-outside");
      if (weekend) cell.classList.add("is-weekend");
      if (pendingDays.has(dateKey(cellDate))) cell.classList.add("has-pending");
      if (isToday) cell.classList.add("is-today");

      const label = WEEKDAY_SHORT[cellDate.getDay()] + ", " +
        MONTH_NAMES[cellDate.getMonth()] + " " + cellDate.getDate() +
        ", " + cellDate.getFullYear() + (isToday ? " (today)" : "");
      cell.setAttribute("aria-label", label);
      cell.title = label;

      row.appendChild(cell);
    }
  }

  /* ------------------------------------------------------------------ *
   *  4. Analog clock (canvas)
   * ------------------------------------------------------------------ */
  let clockCtx = null;

  function drawClock() {
    const canvas = $("#clock");
    if (!canvas || !canvas.getContext) return;
    if (!clockCtx) clockCtx = canvas.getContext("2d");

    const ctx = clockCtx;
    const rect = canvas.getBoundingClientRect();
    const cssSize = rect.width || canvas.clientWidth || 180;
    const dpr = window.devicePixelRatio || 1;

    // Keep the canvas crisp on retina displays
    const pixelSize = Math.round(cssSize * dpr);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }

    const size = canvas.width;
    const center = size / 2;
    const radius = center * 0.94;

    const styles = getComputedStyle(document.documentElement);
    const face = styles.getPropertyValue("--clock-face").trim() || "#ffffff";
    const tickColor = styles.getPropertyValue("--clock-tick").trim() || "#c9c4d6";
    const pink = styles.getPropertyValue("--color-pink").trim() || "#ffb6c1";
    const pinkDeep = styles.getPropertyValue("--color-pink-deep").trim() || "#ff8fa3";
    const mint = styles.getPropertyValue("--color-mint-deep").trim() || "#7fd8b6";
    const lavender = styles.getPropertyValue("--color-blue-deep").trim() || "#a3aee0";
    const charcoal = styles.getPropertyValue("--color-text").trim() || "#4a4a4a";

    const now = new Date();

    ctx.clearRect(0, 0, size, size);

    // --- Face + outer ring -------------------------------------------------
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = face;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.018);
    ctx.strokeStyle = pinkDeep;
    ctx.stroke();

    // --- Tick marks --------------------------------------------------------
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isHour = i % 5 === 0;
      const outer = radius * 0.9;
      const inner = isHour ? radius * 0.78 : radius * 0.85;

      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
      ctx.lineWidth = isHour ? Math.max(2, size * 0.014) : Math.max(1, size * 0.006);
      ctx.strokeStyle = isHour ? pink : tickColor;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // --- Numbers 12 / 3 / 6 / 9 -------------------------------------------
    ctx.fillStyle = charcoal;
    ctx.font = "700 " + Math.max(10, size * 0.1) + "px Quicksand, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const numberRadius = radius * 0.66;
    for (let n = 1; n <= 12; n++) {
      const angle = (n / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(
        String(n),
        center + Math.cos(angle) * numberRadius,
        center + Math.sin(angle) * numberRadius
      );
    }

    // --- Hands -------------------------------------------------------------
    const ms = now.getMilliseconds();
    const sec = now.getSeconds() + ms / 1000;
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;

    const angleFor = (units, perTurn) => (units / perTurn) * Math.PI * 2 - Math.PI / 2;

    /** Rounded-tip hand so the clock reads soft, not sharp. */
    drawHand(ctx, {
      angle: angleFor(hr, 12),
      length: radius * 0.5,
      width: Math.max(3, size * 0.026),
      color: pink,
      center: center,
      tail: radius * 0.12,
    });

    drawHand(ctx, {
      angle: angleFor(min, 60),
      length: radius * 0.7,
      width: Math.max(2, size * 0.018),
      color: mint,
      center: center,
      tail: radius * 0.16,
    });

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(
      center + Math.cos(angleFor(sec, 60)) * radius * 0.8,
      center + Math.sin(angleFor(sec, 60)) * radius * 0.8
    );
    ctx.lineWidth = Math.max(1, size * 0.008);
    ctx.strokeStyle = lavender;
    ctx.lineCap = "round";
    ctx.stroke();

    // --- Centre pin --------------------------------------------------------
    ctx.beginPath();
    ctx.arc(center, center, Math.max(3, size * 0.035), 0, Math.PI * 2);
    ctx.fillStyle = pinkDeep;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center, center, Math.max(1.5, size * 0.016), 0, Math.PI * 2);
    ctx.fillStyle = face;
    ctx.fill();

    // --- Digital read-out --------------------------------------------------
    const digital = $("#clock-digital");
    if (digital) digital.textContent = now.toLocaleTimeString();
  }

  function drawHand(ctx, opts) {
    const { angle, length, width, color, center, tail } = opts;
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.moveTo(
      center - Math.cos(angle) * tail,
      center - Math.sin(angle) * tail
    );
    ctx.lineTo(
      center + Math.cos(angle) * length,
      center + Math.sin(angle) * length
    );
    ctx.stroke();
  }

  function startClock() {
    drawClock();
    // 250ms keeps the sweep smooth without busy-looping; drawn hands stay
    // readable because each call renders the true position of "now".
    window.setInterval(drawClock, 250);
    window.addEventListener("resize", drawClock);
  }

  /* ------------------------------------------------------------------ *
   *  5. Header date + motivational quote
   * ------------------------------------------------------------------ */
  function renderHeaderDate() {
    const el = $("#today-date");
    if (!el) return;
    const now = new Date();
    el.textContent =
      now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) + " 📅";
  }

  function renderQuote() {
    const el = $("#motivation-quote");
    if (!el) return;
    el.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }

  /* ------------------------------------------------------------------ *
   *  6. Heart burst celebration — bonus feature
   * ------------------------------------------------------------------ */
  function burstHearts(x, y) {
    const layer = $("#confetti-layer");
    if (!layer) return;

    const glyphs = ["💖", "💕", "🌸", "✨", "🎀"];
    for (let i = 0; i < 8; i++) {
      const heart = document.createElement("span");
      heart.className = "heart-pop";
      heart.textContent = glyphs[i % glyphs.length];
      heart.style.left = x + (Math.random() * 60 - 30) + "px";
      heart.style.top = y + (Math.random() * 20 - 10) + "px";
      heart.style.setProperty("--spin", (Math.random() * 80 - 40) + "deg");
      heart.style.animationDelay = (i * 45) + "ms";
      layer.appendChild(heart);
      window.setTimeout(() => heart.remove(), 1400 + i * 45);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */
  function init() {
    initTheme();
    renderHeaderDate();
    renderQuote();
    initTodos();
    initNotes();
    initCalendar();
    startClock();

    // Re-check the date at midnight-ish so "today" never goes stale
    window.setInterval(() => {
      renderHeaderDate();
      renderCalendar();
    }, 60 * 1000);

    // Keep multiple open tabs in sync
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEYS.todos) {
        state.todos = normalizeTodos(loadJSON(STORAGE_KEYS.todos, []));
        renderTodos();
        renderCalendar();
      }
      if (event.key === STORAGE_KEYS.notes) {
        const textarea = $("#notes");
        if (textarea && document.activeElement !== textarea) {
          textarea.value = event.newValue === null ? "" : event.newValue;
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


