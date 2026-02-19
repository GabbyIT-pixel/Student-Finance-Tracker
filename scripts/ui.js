// scripts/ui.js
// ─────────────────────────────────────────────────────────────────────────────
// All DOM rendering and user-interaction binding.
// No direct localStorage access — always goes through state.js / storage.js.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getRecords, getRecord, addRecord, updateRecord, deleteRecord,
  replaceAll, computeStats,
} from './state.js';
import { getCap, setCap, getRates, setRates, setDisplayCurrency,
         getDisplayCurrency, convert, getTheme, setTheme } from './storage.js';
import { compileRegex, highlight, filterRecords } from './search.js';
import { validateForm, markError, validate } from './validators.js';

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Escape user content before inserting into innerHTML. */
function esc(str) {
  return String(str ?? '').replace(/[&<>"'`=/]/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    '/':'&#x2F;','`':'&#x60;','=':'&#x3D;',
  }[s] || s));
}

/** Format a number as currency string. */
function formatAmount(n, currency = getDisplayCurrency()) {
  const rates = getRates();
  const symbols = { USD: '$', EUR: '€', GBP: '£', RWF: 'RWF ' };
  if (currency === 'USD') {
    return (symbols['USD'] || '') + Number(n).toFixed(2);
  }
  const converted = convert(n, currency);
  if (converted === null) return '$' + Number(n).toFixed(2);
  return (symbols[currency] || currency + ' ') + converted;
}

/**
 * Show one section, hide all others. Update aria-current on nav links.
 * @param {string} id - section id
 */
export function showSection(id) {
  document.querySelectorAll('main section').forEach(sec => {
    sec.style.display = 'none';
    sec.removeAttribute('aria-hidden');
  });
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';

  // aria-current on nav
  document.querySelectorAll('nav a').forEach(a => {
    const matches = a.getAttribute('href') === `#${id}`;
    if (matches) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  // Re-render live sections
  if (id === 'dashboard') renderDashboard(getRecords());
  if (id === 'records')   renderRecords(getRecords());
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function bindNavigation() {
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showSection(link.getAttribute('href').substring(1));
    });
  });
  // Default: show about
  showSection('about');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function renderDashboard(records) {
  const container = document.getElementById('dashboard');
  if (!container) return;

  const stats   = computeStats(records);
  const cap     = getCap();
  const isOver  = stats.sum > cap;
  const currency = getDisplayCurrency();

  // Budget bar percentage
  const pct = Math.min((stats.sum / (cap || 1)) * 100, 100).toFixed(1);

  // Build 7-day bar chart
  const maxDay = Math.max(...stats.dailyTotals, 0.01);
  const chartBars = stats.dayBuckets.map((day, i) => {
    const val = stats.dailyTotals[i];
    const h   = ((val / maxDay) * 72).toFixed(0);
    const label = day.slice(5); // MM-DD
    return `
      <div class="chart-col">
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${h}px"
               title="${label}: ${formatAmount(val, currency)}">
          </div>
        </div>
        <span class="chart-label">${label}</span>
      </div>`;
  }).join('');

  // Category breakdown pills
  const catPills = Object.entries(stats.categoryMap)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 5)
    .map(([cat, count]) => `<span class="cat-pill">${esc(cat)} <em>${count}</em></span>`)
    .join('');

  container.innerHTML = `
    <div class="dash-grid">
      <div class="stat-card accent">
        <span class="stat-label">Total Records</span>
        <span class="stat-value">${stats.total}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Spent (${esc(currency)})</span>
        <span class="stat-value">${formatAmount(stats.sum, currency)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Top Category</span>
        <span class="stat-value cat">${esc(stats.topCategory)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Active Days (last 7)</span>
        <span class="stat-value">${stats.last7Count} <small>/7</small></span>
      </div>
    </div>

    <div class="budget-card ${isOver ? 'over' : 'under'}"
         role="status"
         aria-live="${isOver ? 'assertive' : 'polite'}">
      <div class="budget-header">
        <span class="budget-label">Budget Cap</span>
        <span class="budget-status">
          ${isOver
            ? `⚠ Over by ${formatAmount(stats.sum - cap, currency)}`
            : `✓ ${formatAmount(cap - stats.sum, currency)} remaining`}
        </span>
      </div>
      <div class="budget-bar-track" role="img" aria-label="Budget used: ${pct}%">
        <div class="budget-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="budget-amounts">
        <span>$0</span>
        <span>${formatAmount(stats.sum, currency)} of ${formatAmount(cap, currency)}</span>
      </div>
    </div>

    <div class="chart-card">
      <h3 class="chart-title">Last 7 Days — Spending Trend</h3>
      <div class="chart-bars" aria-label="Bar chart of daily spending over the last 7 days">
        ${chartBars}
      </div>
    </div>

    <div class="cats-card">
      <h3 class="chart-title">Categories</h3>
      <div class="cat-pills">${catPills || '<span class="no-data">No records yet</span>'}</div>
    </div>
  `;
}

// ── Records ───────────────────────────────────────────────────────────────────

/**
 * Render record cards.
 * @param {object[]} records
 * @param {RegExp|null} re - optional regex for highlighting
 */
export function renderRecords(records, re = null) {
  const container = document.getElementById('records-list');
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state" role="status">
        <div class="empty-icon">📭</div>
        <p>No records found.</p>
        <button class="btn-primary" onclick="document.getElementById('nav-form').click()">
          Add your first record →
        </button>
      </div>`;
    return;
  }

  const currency = getDisplayCurrency();

  container.innerHTML = records.map(r => {
    const descHtml     = re ? highlight(esc(r.description), re) : esc(r.description);
    const categoryHtml = re ? highlight(esc(r.category),    re) : esc(r.category);
    const dateHtml     = re ? highlight(esc(r.date),        re) : esc(r.date);
    return `
      <div class="record-card" data-id="${esc(r.id)}" tabindex="0"
           role="article" aria-label="Record: ${esc(r.description)}, ${formatAmount(r.amount, currency)}">
        <div class="record-main">
          <div class="record-top">
            <strong class="record-desc">${descHtml}</strong>
            <span class="record-amount">${formatAmount(r.amount, currency)}</span>
          </div>
          <div class="record-meta">
            <span class="record-cat">${categoryHtml}</span>
            <span class="record-date">${dateHtml}</span>
          </div>
        </div>
        <div class="record-actions">
          <button class="btn-edit" data-id="${esc(r.id)}" aria-label="Edit ${esc(r.description)}">
            Edit
          </button>
          <button class="btn-delete" data-id="${esc(r.id)}" aria-label="Delete ${esc(r.description)}">
            Delete
          </button>
        </div>

      </div>`;
  }).join('');

  // Edit buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = getRecord(btn.dataset.id);
      if (!rec) return;
      _populateForm(rec);
      showSection('form');
    });
  });

  // Delete buttons — open modal
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const desc = btn.closest('.record-card')?.querySelector('.record-desc')?.textContent || 'this record';
      _showDeleteModal(id, desc, re);
    });
  });

  // Keyboard: Enter/Space activates focused card
  container.querySelectorAll('.record-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.querySelector('.btn-edit')?.click();
      }
    });
  });
}

/** Populate the form with an existing record for editing. */
function _populateForm(rec) {
  const form = document.getElementById('recordForm');
  if (!form) return;
  form.dataset.editId = rec.id;
  document.getElementById('desc').value     = rec.description || '';
  document.getElementById('amount').value   = rec.amount ?? '';
  document.getElementById('category').value = rec.category   || '';
  document.getElementById('date').value     = rec.date       || '';
  // Support both ID conventions (generated index.html vs original)
  const heading = document.getElementById('form-heading') || document.getElementById('formTitle');
  if (heading) heading.textContent = 'Edit Record';
  const submitBtn = document.getElementById('form-submit-btn') ||
                    document.querySelector('#recordForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Record';
}

/** Reset the form to "add" mode. */
function _resetForm() {
  const form = document.getElementById('recordForm');
  if (!form) return;
  form.reset();
  delete form.dataset.editId;
  const heading = document.getElementById('form-heading') || document.getElementById('formTitle');
  if (heading) heading.textContent = 'Add / Edit Record';
  const submitBtn = document.getElementById('form-submit-btn') ||
                    document.querySelector('#recordForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Record';
  ['desc','amount','category','date'].forEach(id => markError(document.getElementById(id), false));
  _setFormStatus('', '');
}

// ── Form ──────────────────────────────────────────────────────────────────────

export function bindForm() {
  const form      = document.getElementById('recordForm');
  const cancelBtn = document.getElementById('form-cancel-btn');
  if (!form) return;

  // Live field validation feedback
  ['desc','amount','category','date'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', () => _liveValidate(id));
    document.getElementById(id)?.addEventListener('input', () => {
      const el = document.getElementById(id);
      if (el.classList.contains('error')) _liveValidate(id);
    });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const desc     = document.getElementById('desc')?.value     ?? '';
    const amount   = document.getElementById('amount')?.value   ?? '';
    const category = document.getElementById('category')?.value ?? '';
    const date     = document.getElementById('date')?.value     ?? '';

    // Highlight all invalid fields
    const fieldErrors = [
      ['desc',     !validate('description', desc.trim())],
      ['amount',   !validate('amount', amount) || parseFloat(amount) === 0],
      ['category', !validate('category', category.trim())],
      ['date',     !validate('date', date)],
    ];
    fieldErrors.forEach(([id, err]) => markError(document.getElementById(id), err));

    const error = validateForm({ desc: desc.trim(), amount, category: category.trim(), date });
    if (error) {
      _setFormStatus(error, 'error');
      return;
    }

    const editId = form.dataset.editId;
    if (editId) {
      updateRecord(editId, {
        description: desc.trim(),
        amount:      parseFloat(amount),
        category:    category.trim(),
        date,
      });
      _setFormStatus('Record updated successfully!', 'success');
    } else {
      addRecord({
        description: desc.trim(),
        amount:      parseFloat(amount),
        category:    category.trim(),
        date,
      });
      _setFormStatus('Record added successfully!', 'success');
    }

    const current = getRecords();
    renderRecords(current);
    renderDashboard(current);
    _resetForm();
  });

  cancelBtn?.addEventListener('click', () => _resetForm());
}

/** Validate a single field on blur / after fix. */
function _liveValidate(fieldId) {
  const el  = document.getElementById(fieldId);
  if (!el) return;
  const val = el.value;
  const fieldMap = { desc: 'description', amount: 'amount', category: 'category', date: 'date' };
  const pattern  = fieldMap[fieldId];
  const invalid  = !validate(pattern, fieldId === 'desc' ? val.trim() : val);
  markError(el, invalid);
}

/** Update the form status div. */
function _setFormStatus(msg, type = '') {
  const el = document.getElementById('formStatus');
  if (!el) return;
  el.textContent  = msg;
  el.className    = `form-status ${type}`;
}

// ── Search ────────────────────────────────────────────────────────────────────

export function bindSearch() {
  const input     = document.getElementById('regexSearchInput');
  const statusEl  = document.getElementById('searchStatus');
  if (!input) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const re      = compileRegex(input.value, 'i');
      const all     = getRecords();
      const results = filterRecords(all, re);

      // Show regex validity
      if (input.value && !re) {
        input.setAttribute('aria-invalid', 'true');
        if (statusEl) statusEl.textContent = 'Invalid regex pattern.';
        return;
      }
      input.removeAttribute('aria-invalid');
      if (statusEl) {
        statusEl.textContent = re
          ? `${results.length} of ${all.length} records match.`
          : '';
      }

      renderRecords(results, re || null);
    }, 180);
  });
}

// ── Sorting ───────────────────────────────────────────────────────────────────

export function bindSorting() {
  const select = document.getElementById('sortSelect');
  if (!select) return;
  select.addEventListener('change', _applySort);
}

function _applySort() {
  const select  = document.getElementById('sortSelect');
  const searchQ = document.getElementById('regexSearchInput')?.value || '';
  const re      = compileRegex(searchQ, 'i');
  let   sorted  = filterRecords(getRecords(), re || null);

  switch (select?.value) {
    case 'date':
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
    case 'date-desc':
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
    case 'amount':
      sorted.sort((a, b) => Number(a.amount) - Number(b.amount)); break;
    case 'amount-desc':
      sorted.sort((a, b) => Number(b.amount) - Number(a.amount)); break;
    case 'description':
      sorted.sort((a, b) => String(a.description).localeCompare(String(b.description))); break;
    case 'category':
      sorted.sort((a, b) => String(a.category).localeCompare(String(b.category))); break;
  }
  renderRecords(sorted, re || null);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function bindSettings() {
  _initSettingsUI();
  _bindExport();
  _bindImport();
  _bindBudgetCap();
  _bindCurrencySettings();
  _bindThemeToggle();
}

function _initSettingsUI() {
  const capInput = document.getElementById('capInput');
  if (capInput) capInput.value = getCap();

  const rates = getRates();
  const eurEl = document.getElementById('eurRate');
  const gbpEl = document.getElementById('gbpRate');
  if (eurEl) eurEl.value = rates.EUR;
  if (gbpEl) gbpEl.value = rates.GBP;
  const rwfEl = document.getElementById('rwfRate');
  if (rwfEl) rwfEl.value = rates.RWF ?? 1460;

  const currEl = document.getElementById('currencySelect');
  if (currEl) currEl.value = getDisplayCurrency();

  // Theme
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = getTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);
  if (themeToggle) themeToggle.checked = currentTheme === 'dark';
}

function _bindBudgetCap() {
  document.getElementById('saveCapBtn')?.addEventListener('click', () => {
    const capInput = document.getElementById('capInput');
    const val = parseFloat(capInput?.value);
    if (isNaN(val) || val < 0) {
      _settingsAlert('Please enter a valid positive number.', 'error'); return;
    }
    setCap(val);
    renderDashboard(getRecords());
    _settingsAlert('Budget cap saved!', 'success');
  });
}

function _bindCurrencySettings() {
  document.getElementById('saveRatesBtn')?.addEventListener('click', () => {
    const eur = parseFloat(document.getElementById('eurRate')?.value);
    const gbp = parseFloat(document.getElementById('gbpRate')?.value);
    const rwf = parseFloat(document.getElementById('rwfRate')?.value);
    if (isNaN(eur) || isNaN(gbp) || eur <= 0 || gbp <= 0) {
      _settingsAlert('Please enter valid positive rates.', 'error', 'rateMsg'); return;
    }
    const rwfRate = (!isNaN(rwf) && rwf > 0) ? rwf : 1460;
    setRates({ base: 'USD', EUR: eur, GBP: gbp, RWF: rwfRate });
    renderDashboard(getRecords());
    renderRecords(getRecords());
    _settingsAlert('✓ Exchange rates saved!', 'success', 'rateMsg');
  });

  document.getElementById('currencySelect')?.addEventListener('change', e => {
    setDisplayCurrency(e.target.value);
    renderDashboard(getRecords());
    renderRecords(getRecords());
    _settingsAlert(`✓ Display currency set to ${e.target.value}.`, 'success', 'rateMsg');
  });
}

function _bindThemeToggle() {
  document.getElementById('themeToggle')?.addEventListener('change', e => {
    const theme = e.target.checked ? 'dark' : 'light';
    setTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
  });
}

function _bindExport() {
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getRecords(), null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `finance-records-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    _settingsAlert('Records exported!', 'success');
  });
}

function _bindImport() {
  document.getElementById('importFile')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('Root must be an array');
        // Validate each entry has at minimum description and amount
        data.forEach((r, i) => {
          if (typeof r !== 'object' || r === null) throw new Error(`Item ${i} is not an object`);
          if (r.amount === undefined && r.description === undefined)
            throw new Error(`Item ${i} missing required fields`);
        });
        if (!replaceAll(data)) throw new Error('Import failed');
        const current = getRecords();
        renderRecords(current);
        renderDashboard(current);
        _settingsAlert(`✓ Imported ${data.length} records from "${file.name}" successfully!`, 'success', 'importMsg');
      } catch (err) {
        _settingsAlert(`✗ Import error: ${err.message}`, 'error', 'importMsg');
      }
      e.target.value = ''; // reset file input
    };
    reader.onerror = () => _settingsAlert('✗ Could not read file.', 'error', 'importMsg');
    reader.readAsText(file);
  });
}

function _settingsAlert(msg, type = '', targetId = null) {
  // Support both a single global status div (settingsStatus) AND
  // per-block message elements (importMsg, capMsg, rateMsg) used in the original index.html
  const ids = targetId
    ? [targetId]
    : ['settingsStatus', 'importMsg', 'capMsg', 'rateMsg'];

  // Only write to the most relevant element — prefer the targeted one,
  // then the first one that exists in the DOM
  const el = ids.map(id => document.getElementById(id)).find(Boolean);
  if (!el) return;
  el.textContent = msg;
  el.className   = `settings-msg ${type}`;            // works for both class names
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.textContent = '';
    el.className   = 'settings-msg';
  }, 5000);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

export function bindKeyboardShortcuts() {
  const map = { '1':'dashboard','2':'records','3':'form','4':'settings','5':'about' };
  document.addEventListener('keydown', e => {
    if (!e.altKey) return;
    const section = map[e.key];
    if (section) {
      e.preventDefault();
      showSection(section);
    }
  });
}

// ── Delete modal ─────────────────────────────────────────────────────────────

function _showDeleteModal(id, desc, re = null) {
  // Remove any existing modal
  document.getElementById('deleteModal')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'deleteModal';
  modal.className = 'delete-modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'deleteModalTitle');
  modal.innerHTML = `
    <div class="delete-modal">
      <div class="delete-modal-icon" aria-hidden="true">🗑</div>
      <h3 id="deleteModalTitle" class="delete-modal-title">Delete Record?</h3>
      <p class="delete-modal-desc">
        You're about to permanently delete<br>
        <strong>"${desc}"</strong>
      </p>
      <p class="delete-modal-warning">This action cannot be undone.</p>
      <div class="delete-modal-actions">
        <button class="delete-modal-cancel" id="deleteModalCancel">Keep it</button>
        <button class="delete-modal-confirm" id="deleteModalConfirm">Yes, delete</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => modal.classList.add('visible'));

  const cancelBtn  = modal.querySelector('#deleteModalCancel');
  const confirmBtn = modal.querySelector('#deleteModalConfirm');

  // Focus the safe option (Cancel) by default
  cancelBtn.focus();

  function closeModal() {
    modal.classList.remove('visible');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
  }

  cancelBtn.addEventListener('click', closeModal);

  confirmBtn.addEventListener('click', () => {
    closeModal();
    deleteRecord(id);
    const current = getRecords();
    renderRecords(current, re);
    renderDashboard(current);
    _announce('Record deleted successfully.');
    _showDeleteToast();
  });

  // Escape key closes
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(); }
    // Tab trap
    if (e.key === 'Tab') {
      const focusable = [cancelBtn, confirmBtn];
      const idx = focusable.indexOf(document.activeElement);
      e.preventDefault();
      focusable[(idx + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
    }
  });

  // Click overlay to cancel
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

/** Brief toast notification after successful delete */
function _showDeleteToast() {
  document.getElementById('deleteToast')?.remove();
  const toast = document.createElement('div');
  toast.id        = 'deleteToast';
  toast.className = 'delete-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = '✓ Record deleted';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2800);
}

// ── ARIA live region ──────────────────────────────────────────────────────────

function _announce(msg) {
  const el = document.getElementById('liveRegion');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}
