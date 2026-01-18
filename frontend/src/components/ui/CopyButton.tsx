import { useMemo, useState } from "react";
import styles from "./ui.module.css";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback (menos ideal, mas funciona)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function CopyPill({
  value,
  max = 28,
  title = "Copiar",
}: {
  value: string;
  max?: number;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

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
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          } catch {
            // sem throw para não poluir UI
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
