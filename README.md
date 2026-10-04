# My Cute Planner 

A cute, pastel-themed personal planner that runs entirely in the browser. No frameworks,
no build step, no external libraries (only Google Fonts). Just open `index.html` and it works.

##  Project structure

```
project-folder/
├── index.html      # semantic structure only
├── style.css       # all styling (CSS variables, grid, responsive)
├── script.js       # all logic (todos, notes, calendar, clock, storage)
└── README.md
```

`index.html` links them with:

```html
<link rel="stylesheet" href="style.css">
<script src="script.js" defer></script>
```

##  Currently completed features

1. **Header** — app title "My Cute Planner 🌸" plus today's full date (`#today-date`),
   rendered with `toLocaleDateString`.
2. **Todo list** (`#todo-section`)
   - Add tasks with the **Add ** button **or the Enter key** via a `<form>` submit.
   - Each task has a custom circular checkbox (shows **❤️** when checked), the text
     (strikethrough when done) and a **** delete button.
   - Filters: **All / Active / Done ** with `aria-pressed` state.
   - Live counter ("3 tasks · 2 left") and a **Clear done ** button (auto-disabled
     when nothing is completed).
   - **Undo toast** after a delete (5 second window).
   - Empty-state message that adapts to the active filter.
3. **Notes** (`#notes-section`)
   - `<textarea id="notes">` auto-saves on every `input` event ("Saving… " →
     "Saved automatically ") and is restored on load.
   - **Clear ** button with a confirmation prompt.
4. **Calendar** (`#calendar-section`)
   - Pure-JS month grid, 7 columns, Sunday-first.
   - Header shows "Month Year " with **‹ / ›** navigation and a
     **Jump to today ** button.
   - Today gets a pulsing **pink circle**; weekend days are tinted;
     days outside the month are dimmed.
   - A **mint dot** marks every day that still has pending tasks.
5. **Analog clock** (`#clock-section`)
   - `<canvas id="clock">` with face, 60 tick marks, numbers 1–12.
   - Hour hand **pink**, minute hand **mint**, second hand **lavender**, drawn every
     250 ms and re-rendered crisply on resize / retina (`devicePixelRatio`).
   - Digital read-out (`#clock-digital`) beside it.
6. **Bonus features**
   - 🌙 / ☀️ **Dark mode toggle** — all colors swap via `html[data-theme="dark"]`,
     preference saved in `localStorage` (falls back to `prefers-color-scheme`).
   -  **Heart burst animation** whenever a task is completed.
   -  **Motivational quote** at the top of the todo list, randomised on each load.
7. **General**
   - All state persists in `localStorage` — works fully offline, from `file://`.
   - Cross-tab sync via the `storage` event; the header date and calendar refresh
     every minute so "today" never goes stale.

##  Design system

All colors, radii and shadows live in `:root` in `style.css` so they are easy to tweak.

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#fff6f0` | soft cream background (+ lavender `--color-bg-alt` `#f3efff`) |
| `--color-pink` | `#ffb6c1` | primary accent (hour hand, today circle, filters) |
| `--color-mint` | `#b5ead7` | secondary accent (minute hand, done states) |
| `--color-blue` | `#c7ceea` | tertiary accent (hover fills, second hand family) |
| `--color-text` | `#4a4a4a` | soft charcoal text |
| `--color-card` | `#ffffff` | card background |
| `--radius-lg` / `--radius-xl` | `20px` / `25px` | card rounding |
| `--shadow-soft` | `0 4px 15px rgba(0,0,0,0.08)` | card shadow |

Typography is **Quicksand** from Google Fonts (with `Comic Neue` and system fallbacks).

##  Layout & responsive behaviour

`.app-grid` is a CSS Grid with named areas:

- **≤ 480px** — single column; header and Add button stack; compact calendar cells.
- **< 820px** (mobile-first default) — one column: Tasks → Notes → Calendar.
- **≥ 820px** — two columns: Tasks on the left, Notes over Calendar on the right.
- **≥ 1180px** — three columns: Tasks | Notes | Calendar side by side.

Motion is reduced automatically under `prefers-reduced-motion: reduce`.

## 🔗 Functional entry points

| Path / element | Purpose |
| --- | --- |
| `index.html` | The whole app — open directly in a browser |
| `#todo-form`, `#todo-input` | Add a task (submit = Enter key or Add button) |
| `.filter-btn[data-filter]` | Filter by `all` \| `active` \| `done` |
| `#clear-done-btn` | Remove completed tasks |
| `#notes` | Auto-saving notes textarea |
| `#notes` → `#clear-notes-btn` | Clear all notes (confirmation) |
| `#prev-month` / `#next-month` / `#today-btn` | Calendar navigation |
| `#theme-toggle` | Dark / light mode |

There is no routing, no query parameters and no backend — state lives in `localStorage`.

## 🗄️ Data models & storage

Plain `localStorage` key/value pairs; JSON-encoded where structured.

| Key | Type | Shape |
| --- | --- | --- |
| `cute-todos` | JSON string | `[{ id: string, text: string, done: boolean, created: number }]` |
| `cute-notes` | JSON string | `"free text"` |
| `cute-theme` | string | `"light"` \| `"dark"` |

Dates are always derived in **local time** (a `YYYY-MM-DD` key built by hand rather than
`toISOString()`, which is UTC) so a task added late at night dots the correct day.

No external services, APIs, databases or authentication are used.

## 🚧 Not yet implemented / known limits

- Tasks have no due date, time, priority or categories — the calendar dot only reflects
  the day a task was **created**.
- No editing of an existing task's text (delete + re-add instead).
- No drag-and-drop reordering, search, or bulk select.
- `localStorage` is per-browser: data does not sync across devices and is lost if the
  browser data is cleared or private/incognito mode is closed.
- Notes are plain text only (no Markdown rendering or lists).

## 💡 Recommended next steps

1. Add a due-date field per task and dot the calendar by due date instead of creation date.
2. Inline editing (double-click a task to rename it) and drag-and-drop reordering.
3. Timer / Pomodoro panel reusing the existing clock tick.
4. Search box for tasks and notes.
5. Optional export / import of todos + notes as a JSON file (`Blob` + download link).
6. Replace `innerHTML`-free rendering with a small diffing step if the list grows
   (currently the list is re-rendered on every change, which is fine at planner scale).

## 🚀 Running it

Open `index.html` locally — double-clicking the file works. To serve it over HTTP instead:


No build, install or compile step is required.

