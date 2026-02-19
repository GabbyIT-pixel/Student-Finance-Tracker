// scripts/validators.js
// ─────────────────────────────────────────────────────────────────────────────
// All regex patterns and validation logic.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All patterns used across the app.
 *
 * Pattern catalogue (for README):
 *   description   - non-empty, no leading/trailing whitespace
 *   amount        - non-negative decimal, max 2 decimal places
 *   date          - strict YYYY-MM-DD (valid month/day ranges)
 *   category      - letters only, separated by spaces or hyphens
 *   duplicateWord - back-reference to catch repeated consecutive words  ← ADVANCED
 *   lookaheadPos  - amount with lookahead: must have at least one non-zero digit ← ADVANCED
 */
export const patterns = {
  // Basic rules
  description:  /^\S(?:.*\S)?$/,
  amount:       /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date:         /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category:     /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,

  // Advanced — back-reference (catches "tea tea", "bus bus")
  duplicateWord: /\b(\w+)\s+\1\b/i,

  // Advanced — positive lookahead (amount must not be 0.00 i.e. must have a non-zero digit)
  nonZeroAmount: /^(?=.*[1-9])(0|[1-9]\d*)(\.\d{1,2})?$/,
};

/**
 * Validate a single field value against its pattern.
 * For duplicateWord: returns true when a duplicate IS found (invalid state).
 *
 * @param {string} field - key in patterns
 * @param {string} value
 * @returns {boolean} true = passes the rule (or for duplicateWord: true = duplicate detected)
 */
export function validate(field, value) {
  const re = patterns[field];
  if (!re) return true; // unknown field — don't block
  return re.test(value);
}

/**
 * Validate the full form object. Returns an error string or null.
 * @param {{ desc, amount, category, date }} fields
 * @returns {string|null} first validation error, or null if all pass
 */
export function validateForm({ desc, amount, category, date }) {
  if (!validate('description', desc))
    return 'Description must not be empty or start/end with spaces.';
  if (!validate('amount', amount))
    return 'Amount must be a positive number with at most 2 decimal places.';
  if (parseFloat(amount) === 0)
    return 'Amount must be greater than zero.';
  if (!validate('category', category))
    return 'Category: letters only, words separated by a space or hyphen.';
  if (!validate('date', date))
    return 'Date must be in YYYY-MM-DD format.';
  if (validate('duplicateWord', desc))
    return 'Description contains a repeated word (e.g. "lunch lunch").';
  return null; // all good
}

/**
 * Apply/remove the .error class on an input and update its aria-invalid.
 * @param {HTMLElement} el
 * @param {boolean} isError
 */
export function markError(el, isError) {
  if (!el) return;
  el.classList.toggle('error', isError);
  el.setAttribute('aria-invalid', isError ? 'true' : 'false');
}
