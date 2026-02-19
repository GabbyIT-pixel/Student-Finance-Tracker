// scripts/app.js
// ─────────────────────────────────────────────────────────────────────────────
// Application entry point.  Awaits seed init, then wires up all UI modules.
// ─────────────────────────────────────────────────────────────────────────────

import { init, getRecords } from './state.js';
import {
  bindNavigation, renderDashboard, renderRecords,
  bindForm, bindSearch, bindSorting, bindSettings,
  bindKeyboardShortcuts, showSection,
} from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Await seed load so first render has data
  await init();

  // 2. Wire up all UI modules
  bindNavigation();
  bindForm();
  bindSearch();
  bindSorting();
  bindSettings();
  bindKeyboardShortcuts();

  // 3. Initial renders (dashboard & records pre-loaded even if not visible)
  const records = getRecords();
  renderDashboard(records);
  renderRecords(records);

  // 4. Show about section on first load
  showSection('dashboard');

  // 5. Expose showSection globally for the empty-state CTA button
  window.showSection = showSection;
});
