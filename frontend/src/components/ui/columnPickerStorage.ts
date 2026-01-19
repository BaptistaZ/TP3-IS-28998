// =============================================================================
// LocalStorage helpers (Column Picker)
// =============================================================================

/**
 * Load the persisted column visibility state from localStorage.
 *
 * Returns:
 * - `Record<string, boolean>` when the stored value is valid JSON and object-like
 * - `null` when no value exists or when the stored content is invalid/unexpected
 */
export function loadColumnPickerState(
  storageKey: string
): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    // We only accept plain object-like values (not arrays, not null).
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    // Defensive filter: keep only boolean values to avoid breaking UI
    // if storage gets polluted with other types.
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }

    return Object.keys(out).length ? out : null;
  } catch {
    // JSON parse errors or storage access errors -> treat as missing state.
    return null;
  }
}

/**
 * Persist the column visibility state into localStorage.
 * This is best-effort: failures (private mode, quota, disabled storage) are ignored.
 */
export function saveColumnPickerState(
  storageKey: string,
  value: Record<string, boolean>
): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Best-effort persistence only.
  }
}