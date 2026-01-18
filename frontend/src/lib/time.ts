import { useEffect, useMemo, useState } from "react";

/**
 * Força re-render periódico (por defeito: 1s) para labels do tipo "Atualizado há X".
 */
export function useNow(tickMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

export function fmtAgo(fromMs: number, toMs: number) {
  const diff = Math.max(0, toMs - fromMs);
  const s = Math.floor(diff / 1000);
  if (s < 2) return "agora";
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

/**
 * Conveniência: string "Atualizado ..." se houver timestamp.
 */
export function useUpdatedLabel(updatedAtMs: number | null | undefined) {
  const now = useNow(1000);
  return useMemo(() => {
    if (!updatedAtMs) return null;
    return `Atualizado ${fmtAgo(updatedAtMs, now)}`;
  }, [updatedAtMs, now]);
}
