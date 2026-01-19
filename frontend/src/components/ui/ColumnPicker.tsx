import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./ui.module.css";
import { IconColumns } from "./Icons";
import { saveColumnPickerState } from "./columnPickerStorage";

export type ColumnOption = { key: string; label: string };

// =============================================================================
// Styling helper
// =============================================================================

/**
 * Minimal className combiner used across UI components.
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// ColumnPicker
// =============================================================================

/**
 * Small dropdown menu that lets the user toggle which table columns are visible.
 *
 * Notes:
 * - `value` is a dictionary where keys are column keys and values are booleans.
 * - Missing keys are treated as visible (default visible), so new columns show up automatically.
 * - Optionally persists the selection to localStorage via `storageKey`.
 */
export function ColumnPicker({
  options,
  value,
  onChange,
  storageKey,
  buttonLabel = "Colunas",
}: {
  options: ColumnOption[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  storageKey?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  // Used to detect clicks outside the menu and close it.
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // =============================================================================
  // Behaviour: close on outside click
  // =============================================================================
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;

      // If the click happened inside the component, keep it open.
      if (e.target instanceof Node && el.contains(e.target)) return;

      setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // =============================================================================
  // Derived UI state
  // =============================================================================

  /**
   * Visible columns count shown next to the button label.
   */
  const visibleCount = useMemo(
    () => Object.values(value).filter(Boolean).length,
    [value]
  );

  // =============================================================================
  // Persistence + change propagation
  // =============================================================================

  /**
   * Centralized "commit" to keep state updates and persistence in sync.
   */
  function commit(next: Record<string, boolean>) {
    onChange(next);
    if (storageKey) saveColumnPickerState(storageKey, next);
  }

  // =============================================================================
  // Render
  // =============================================================================
  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <Button
        size="sm"
        variant="default"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconColumns />
        {buttonLabel}
        <span className={styles.menuCount}>{visibleCount}</span>
      </Button>

      {open && (
        <div className={styles.menuPanel} role="menu">
          <div className={styles.menuTitle}>Colunas visíveis</div>

          <div className={styles.menuItems}>
            {options.map((o) => {
              // Default behaviour: columns are visible unless explicitly set to false.
              const checked = value[o.key] !== false;

              return (
                <label key={o.key} className={styles.menuItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = { ...value, [o.key]: e.target.checked };

                      // Guardrail: never allow "0 visible columns" to avoid rendering an empty table.
                      const countAfter = Object.values(next).filter(Boolean).length;
                      if (countAfter === 0) return;

                      commit(next);
                    }}
                  />
                  <span className={styles.menuItemLabel}>{o.label}</span>
                </label>
              );
            })}
          </div>

          <div className={styles.menuFooter}>
            <button
              type="button"
              className={styles.menuLink}
              onClick={() => {
                // Set every column to visible.
                const all: Record<string, boolean> = {};
                for (const o of options) all[o.key] = true;
                commit(all);
              }}
            >
              Mostrar tudo
            </button>

            <button
              type="button"
              className={cx(styles.menuLink, styles.menuLinkDanger)}
              onClick={() => {
                // Opinionated default set: keep only essential columns visible.
                // If options change, non-listed keys default to false here (explicit reset).
                const next: Record<string, boolean> = {};
                for (const o of options) {
                  next[o.key] =
                    o.key === "docId" ||
                    o.key === "incidentId" ||
                    o.key === "incidentType" ||
                    o.key === "severity" ||
                    o.key === "status";
                }
                commit(next);
              }}
            >
              Reset (essenciais)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}