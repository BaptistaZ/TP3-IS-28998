import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./ui.module.css";
import { IconColumns } from "./Icons";
import { saveColumnPickerState } from "./columnPickerStorage";

export type ColumnOption = { key: string; label: string };

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const visibleCount = useMemo(() => Object.values(value).filter(Boolean).length, [value]);

  function commit(next: Record<string, boolean>) {
    onChange(next);
    if (storageKey) saveColumnPickerState(storageKey, next);
  }

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
              const checked = value[o.key] !== false;
              return (
                <label key={o.key} className={styles.menuItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = { ...value, [o.key]: e.target.checked };
                      const c = Object.values(next).filter(Boolean).length;
                      if (c === 0) return; // não permitir ficar sem colunas
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
