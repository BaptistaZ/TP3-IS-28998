import { useMemo, useState } from "react";

import styles from "./ui.module.css";

// =============================================================================
// Clipboard helpers
// =============================================================================

/**
 * Copy text to the user's clipboard.
 * Prefers the async Clipboard API when available; falls back to `execCommand`.
 */
async function copyToClipboard(text: string): Promise<void> {
  // Modern browsers (secure contexts): preferred path.
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / insecure contexts.
  // Uses a hidden textarea + selection + execCommand("copy").
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  document.execCommand("copy");
  document.body.removeChild(textarea);
}

// =============================================================================
// Component
// =============================================================================

/**
 * Compact "pill" that shows a (possibly truncated) value and provides a copy action.
 * Intended for IDs / requestIds / keys where the full value is still accessible via `title`.
 */
export function CopyPill({
  value,
  max = 28,
  title = "Copiar",
}: {
  /** Value to display and copy. */
  value: string;

  /** Maximum visible characters (value is truncated in the middle when exceeded). */
  max?: number;

  /** Button label for accessibility and tooltip. */
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Build a stable, readable truncated representation:
  // - Keep the start and end.
  // - Ensure the prefix is not too short (min 8 chars).
  const display = useMemo(() => {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(8, max - 9))}…${value.slice(-6)}`;
  }, [value, max]);

  return (
    <span className={styles.copyPill} title={value}>
      <span className={styles.copyPillCode}>{display}</span>

      <button
        type="button"
        className={styles.copyPillBtn}
        onClick={async () => {
          try {
            await copyToClipboard(value);

            // Temporary UI feedback ("Copied") without persisting state.
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          } catch {
            // Intentionally swallow errors to avoid noisy UI;
            // clipboard failures are common in restricted contexts.
          }
        }}
        aria-label={title}
        title={title}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}