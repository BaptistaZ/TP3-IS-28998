import { useEffect, useMemo, useState } from "react";

// =============================================================================
// Time hooks / relative time formatting
// =============================================================================

/**
 * React hook that forces a periodic re-render by updating an internal "now" value.
 * Useful for UI labels like "Updated X ago" without manually wiring timers per component.
 *
 * @param tickMs Interval in milliseconds between updates (default: 1000ms).
 * @returns Current timestamp in milliseconds (Date.now()).
 */
export function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return now;
}

/**
 * Format a relative "time ago" label in Portuguese (pt-PT) given two timestamps.
 *
 * @param fromMs Start timestamp (ms) - usually the event time.
 * @param toMs End timestamp (ms) - usually "now".
 * @returns Human-friendly relative label (e.g., "agora", "há 10s", "há 3min", "há 2h", "há 5d").
 */
export function fmtAgo(fromMs: number, toMs: number): string {
  const diff = Math.max(0, toMs - fromMs);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 2) return "agora";
  if (seconds < 60) return `há ${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

/**
 * Convenience hook that returns an "Atualizado ..." label when a timestamp is provided.
 * Uses `useNow()` to keep the label fresh over time.
 *
 * @param updatedAtMs Timestamp in milliseconds, or null/undefined if unknown.
 * @returns "Atualizado há X" string, or null when `updatedAtMs` is missing.
 */
export function useUpdatedLabel(
  updatedAtMs: number | null | undefined,
): string | null {
  const now = useNow(1000);

  return useMemo(() => {
    if (!updatedAtMs) return null;
    return `Atualizado ${fmtAgo(updatedAtMs, now)}`;
  }, [updatedAtMs, now]);
}
