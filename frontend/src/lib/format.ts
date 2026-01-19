// =============================================================================
// Formatting helpers (pt-PT)
// =============================================================================

/**
 * Format an integer using Portuguese (Portugal) locale separators.
 * Example: 1234567 -> "1 234 567"
 */
export function fmtInt(n: number): string {
  return n.toLocaleString("pt-PT");
}

/**
 * Format a decimal number using Portuguese (Portugal) locale separators.
 * `maxFractionDigits` controls the maximum number of decimal places shown.
 */
export function fmtDec(n: number, maxFractionDigits = 2): string {
  return n.toLocaleString("pt-PT", {
    maximumFractionDigits: maxFractionDigits,
  });
}

/**
 * Format a number as EUR currency in Portuguese (Portugal) locale.
 */
export function fmtEur(n: number): string {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

/**
 * Format an ISO-8601 datetime string for display.
 * If parsing fails, returns the original string to avoid hiding data issues.
 */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Trim a string and return `undefined` if it becomes empty.
 * Useful for turning optional text inputs into `undefined` before queries/filters.
 */
export function nonEmptyTrim(v: string): string | undefined {
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
