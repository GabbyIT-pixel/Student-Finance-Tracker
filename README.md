# student-finance-tracker

> A fully accessible, responsive, vanilla HTML/CSS/JS app for tracking student expenses.
> Built for the Summative Assignment — "Building Responsive UI".

**Live Demo:** [GitHub Pages URL here]
 **Author:** Gabriel Mugisha · [@GabbyIT-pixel](https://github.com/GabbyIT-pixel)

---

## Chosen Theme

**Student Finance Tracker** — tracks expenses, monitors budget caps, and visualises spending trends.

---

## Features

| Feature | Details |
|---|---|
|  Dashboard | Total records, total spent, top category, 7-day bar chart, budget progress bar |
|  Regex Validation | 4 basic rules + 2 advanced (back-reference, lookahead) with live field feedback |
|  Regex Search | Real-time search with safe compiler, `<mark>` highlighting, result count |
| ↕ Sorting | Date ↑↓, Amount ↑↓, Description A–Z, Category A–Z |
|  Currency | USD base + EUR + GBP with user-configurable manual rates (Settings) |
|  Persistence | Auto-save to localStorage; JSON import with validation, JSON export |
|  Accessibility | Semantic landmarks, skip link, visible focus, ARIA live regions, keyboard nav |
|  Responsive | Mobile-first: base → 360px → 768px → 1024px+ |
|  Dark Mode | Theme toggle persisted to localStorage |
|  Empty States | Friendly empty-state messages with CTA when no records exist |

---

## File Structure

```
├── index.html          ← Semantic HTML, all sections
├── tests.html          ← Regex test suite (no framework)
├── seed.json           ← 14 diverse seed records
├── README.md
├── assets/
│   └── logo.png
├── scripts/
│   ├── app.js          ← Entry point (async init → bind all)
│   ├── state.js        ← Single source of truth, CRUD, computed stats
│   ├── storage.js      ← All localStorage I/O (namespaced: sft:*)
│   ├── ui.js           ← DOM rendering & event binding
│   ├── validators.js   ← All regex patterns + validateForm()
│   └── search.js       ← compileRegex(), highlight(), filterRecords()
└── styles/
    └── main.css        ← Mobile-first, 3 breakpoints, dark mode, animations
```

---

## Regex Catalogue

| Field | Pattern | Purpose | Type |
|---|---|---|---|
| Description | `/^\S(?:.*\S)?$/` | No leading/trailing whitespace | Basic |
| Amount | `/^(0\|[1-9]\d*)(\.\d{1,2})?$/` | Non-negative, max 2dp | Basic |
| Date | `/^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$/` | Strict YYYY-MM-DD | Basic |
| Category | `/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/` | Letters; spaces/hyphens only | Basic |
| Duplicate word | `/\b(\w+)\s+\1\b/i` | Back-reference catches "tea tea" | ⭐ Advanced |
| Non-zero amount | `/^(?=.*[1-9])(0\|[1-9]\d*)(\.\d{1,2})?$/` | Lookahead: rejects "0.00" | ⭐ Advanced |

---

## Keyboard Map

| Shortcut | Action |
|---|---|
| `Alt+1` | Go to Dashboard |
| `Alt+2` | Go to Records |
| `Alt+3` | Go to Add/Edit form |
| `Alt+4` | Go to Settings |
| `Alt+5` | Go to About |
| `Tab` / `Shift+Tab` | Move focus between elements |
| `Enter` / `Space` | Activate focused record card |

---

## Accessibility Notes

- **Skip link:** "Skip to main content" revealed on focus, takes user past nav.
- **ARIA live regions:** `#formStatus` (polite), budget cap card (assertive when over budget), `#searchStatus` (polite), `#settingsStatus` (polite), `#liveRegion` (polite, for delete confirmations).
- **`aria-current="page"`** applied to the active nav link on every section switch.
- **`aria-required`**, **`aria-describedby`** and **`aria-invalid`** set on all form fields.
- **Visible focus:** 3px solid blue ring on all interactive elements via `:focus-visible`.
- **Inline delete confirm:** Replaces `window.confirm()` so screen readers announce it properly.
- **Semantic landmarks:** `<header role="banner">`, `<nav aria-label="Main navigation">`, `<main id="main">`, `<section aria-labelledby="…">`, `<footer role="contentinfo">`.
- **Color contrast:** All text/background pairs pass WCAG AA (4.5:1 minimum).
- **Dark mode:** Full dark theme via `[data-theme="dark"]` CSS attribute.

---

## How to Run Locally

```bash
# Requires a local server (file:// won't load ES modules or seed.json)
npx serve .
# or
python -m http.server 8080
# then open http://localhost:8080
```

## How to Run Tests

Open `tests.html` in your browser (with the local server running).
The page runs all regex assertions automatically and reports pass/fail counts.

---

## Data Model

```json
{
  "id":          "rec_001",
  "description": "Lunch at cafeteria",
  "amount":      12.50,
  "category":    "Food",
  "date":        "2026-02-19",
  "createdAt":   "2026-02-19T12:00:00Z",
  "updatedAt":   "2026-02-19T12:00:00Z"
}
```

All amounts stored in **USD**. Display currency (EUR/GBP) applied at render time using rates from Settings.

---

## Milestones Completed

- [x] M1 — Spec & Wireframes
- [x] M2 — Semantic HTML & Base CSS
- [x] M3 — Forms & Regex Validation (4+ rules, 2 advanced)
- [x] M4 — Render + Sort + Regex Search
- [x] M5 — Stats + Cap/Targets (7-day chart + ARIA live)
- [x] M6 — Persistence + Import/Export + Currency Settings
- [x] M7 — Polish & A11y Audit
