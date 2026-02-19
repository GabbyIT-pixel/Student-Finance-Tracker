// scripts/storage.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles all localStorage I/O.  All keys are namespaced under 'sft:'.
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = {
  records:  'sft:records',
  cap:      'sft:cap',
  rates:    'sft:rates',
  currency: 'sft:currency',
  theme:    'sft:theme',
};

// ── Records ───────────────────────────────────────────────────────────────────

/** Safely parse JSON; returns fallback on error. */
function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Load records array from localStorage. */
export function loadRecords() {
  const raw = localStorage.getItem(KEYS.records);
  if (!raw) return [];
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

/** Persist records array to localStorage. */
export function saveRecords(data) {
  try {
    localStorage.setItem(KEYS.records, JSON.stringify(Array.isArray(data) ? data : []));
  } catch (err) {
    console.error('[storage] saveRecords error:', err);
  }
}

// ── Budget Cap ────────────────────────────────────────────────────────────────

/** Get the current budget cap (default 500). */
export function getCap() {
  return Number(localStorage.getItem(KEYS.cap) || 500);
}

/** Save the budget cap. */
export function setCap(value) {
  const n = parseFloat(value);
  if (!isNaN(n) && n >= 0) {
    localStorage.setItem(KEYS.cap, n);
  }
}

// ── Currency / Exchange Rates ─────────────────────────────────────────────────

const DEFAULT_RATES = { base: 'USD', EUR: 0.92, GBP: 0.79, RWF: 1460 };

/** Get exchange-rate config object. */
export function getRates() {
  const raw = localStorage.getItem(KEYS.rates);
  return raw ? safeParse(raw, DEFAULT_RATES) : DEFAULT_RATES;
}

/** Save exchange-rate config object. */
export function setRates(obj) {
  try {
    localStorage.setItem(KEYS.rates, JSON.stringify(obj));
  } catch (err) {
    console.error('[storage] setRates error:', err);
  }
}

/** Convert an amount from base to target currency symbol. */
export function convert(amount, toCurrency) {
  const rates = getRates();
  const rate = rates[toCurrency];
  if (!rate) return null;
  // RWF and other whole-unit currencies — no decimal places
  const decimals = ['RWF', 'JPY', 'KRW', 'UGX'].includes(toCurrency) ? 0 : 2;
  return (Number(amount) * rate).toFixed(decimals);
}

/** Get the currently selected display currency (e.g. 'USD'). */
export function getDisplayCurrency() {
  return localStorage.getItem(KEYS.currency) || 'USD';
}

/** Set the display currency. */
export function setDisplayCurrency(code) {
  localStorage.setItem(KEYS.currency, String(code));
}

// ── Theme ─────────────────────────────────────────────────────────────────────

/** Get the current theme: 'light' | 'dark'. */
export function getTheme() {
  return localStorage.getItem(KEYS.theme) || 'light';
}

/** Save the theme preference. */
export function setTheme(theme) {
  localStorage.setItem(KEYS.theme, theme);
}

// ── Clear (test / reset) ──────────────────────────────────────────────────────

/** Wipe all app data from localStorage (useful for tests). */
export function clearAll() {
  Object.values(KEYS).forEach(k => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
}
