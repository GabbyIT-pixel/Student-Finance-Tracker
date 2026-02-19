// scripts/state.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all records.  All mutations go through here.
// UI never touches localStorage directly — only storage.js does.
// ─────────────────────────────────────────────────────────────────────────────

import { loadRecords, saveRecords } from './storage.js';

let _records = loadRecords();
let _counter = _records.length; // seed counter above existing records

// ── ID Generation ─────────────────────────────────────────────────────────────

/** Generate a collision-safe unique ID. */
function genId() {
  return `rec_${Date.now()}_${(++_counter).toString(36)}`;
}

// ── Record Normaliser ─────────────────────────────────────────────────────────

/** Ensure every field is present and correctly typed. */
function normalise(r) {
  return {
    id:          r.id          || genId(),
    description: String(r.description  || '').trim(),
    amount:      Number(r.amount)       || 0,
    category:    String(r.category     || 'Other').trim(),
    date:        r.date        || new Date().toISOString().slice(0, 10),
    createdAt:   r.createdAt   || new Date().toISOString(),
    updatedAt:   r.updatedAt   || new Date().toISOString(),
  };
}

// ── Init (async seed load) ────────────────────────────────────────────────────

/**
 * Must be awaited before first render.
 * Loads seed.json only if localStorage is empty.
 */
export async function init() {
  if (_records.length > 0) return; // already have data
  try {
    const res = await fetch('seed.json');
    if (!res.ok) throw new Error('seed.json not found');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      _records = data.map(normalise);
      saveRecords(_records);
    }
  } catch {
    _records = []; // silent fail — app still works with no seed
  }
}

// ── Selectors ─────────────────────────────────────────────────────────────────

/** Return a shallow copy to prevent external mutation. */
export function getRecords() {
  return [..._records];
}

/** Find one record by id, or null. */
export function getRecord(id) {
  return _records.find(r => r.id === id) || null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Add a new record.
 * @param {object} data - partial record (id / timestamps are auto-stamped)
 * @returns {object} the normalised, persisted record
 */
export function addRecord(data) {
  if (!data || typeof data !== 'object') return null;
  const record = normalise({ ...data, id: genId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  _records.push(record);
  saveRecords(_records);
  return record;
}

/**
 * Update fields on an existing record.
 * @returns {object|null} updated record, or null if not found
 */
export function updateRecord(id, updates = {}) {
  const idx = _records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const updated = normalise({
    ..._records[idx],
    ...updates,
    id,                                    // never overwrite id
    createdAt: _records[idx].createdAt,    // never overwrite createdAt
    updatedAt: new Date().toISOString(),
  });
  _records[idx] = updated;
  saveRecords(_records);
  return updated;
}

/**
 * Delete a record by id.
 * @returns {boolean} true if a record was removed
 */
export function deleteRecord(id) {
  const before = _records.length;
  _records = _records.filter(r => r.id !== id);
  if (_records.length !== before) {
    saveRecords(_records);
    return true;
  }
  return false;
}

/**
 * Replace ALL records (used by JSON import).
 * Validates that the input is an array before proceeding.
 * @returns {boolean} success
 */
export function replaceAll(recordsArray) {
  if (!Array.isArray(recordsArray)) return false;
  _records = recordsArray.map(r => normalise(r));
  saveRecords(_records);
  return true;
}

// ── Computed Stats ────────────────────────────────────────────────────────────

/**
 * Compute dashboard statistics from the current records.
 * @param {object[]} records - array to compute from (defaults to all)
 */
export function computeStats(records = _records) {
  const total = records.length;
  const sum   = records.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  // Category breakdown
  const categoryMap = {};
  records.forEach(r => {
    const cat = r.category || 'Uncategorized';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const topCategory = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

  // Last-7-days counts and daily totals
  const today = new Date();
  const dayBuckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyTotals = dayBuckets.map(day =>
    records.filter(r => r.date === day)
           .reduce((s, r) => s + Number(r.amount || 0), 0)
  );
  const last7Count = dailyTotals.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
  const last7Sum   = dailyTotals.reduce((s, v) => s + v, 0);

  return { total, sum, topCategory, categoryMap, last7Count, last7Sum, dayBuckets, dailyTotals };
}
