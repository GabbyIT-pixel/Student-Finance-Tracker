// scripts/search.js
// ─────────────────────────────────────────────────────────────────────────────
// Safe regex compilation and accessible match highlighting.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely compile a user-supplied regex string.
 * Returns null (not an error) if input is empty or invalid.
 *
 * @param {string} input  - raw pattern from the user
 * @param {string} flags  - default 'i' (case-insensitive)
 * @returns {RegExp|null}
 */
export function compileRegex(input, flags = 'i') {
  if (!input || !input.trim()) return null;
  try {
    return new RegExp(input.trim(), flags);
  } catch {
    return null; // invalid pattern — degrade gracefully
  }
}

/**
 * Wrap every match of `re` inside the text with <mark>.
 * The text should already be HTML-escaped before calling this.
 *
 * @param {string}    text  - already-escaped HTML string
 * @param {RegExp|null} re  - compiled regex, or null (returns text unchanged)
 * @returns {string}
 */
export function highlight(text, re) {
  if (!re || !text) return text;
  return text.replace(re, m => `<mark class="search-hit">${m}</mark>`);
}

/**
 * Filter records by a regex against description, category, and date.
 *
 * @param {object[]} records
 * @param {RegExp|null} re
 * @returns {object[]}
 */
export function filterRecords(records, re) {
  if (!re) return records;
  return records.filter(r =>
    re.test(r.description || '') ||
    re.test(r.category    || '') ||
    re.test(r.date        || '')
  );
}
