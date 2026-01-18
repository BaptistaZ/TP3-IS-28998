export function loadColumnPickerState(storageKey: string): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, boolean>;
  } catch {
    return null;
  }
}

export function saveColumnPickerState(storageKey: string, value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore
  }
}
