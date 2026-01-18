import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Size = "sm" | "md" | "lg";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: string;
  hint?: string;
  size?: Size;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Select({ label, hint, size = "md", id, className, children, ...props }: Props) {
  const autoId = useId();
  const selectId = id ?? (label ? autoId : undefined);
  const hintId = hint ? `${selectId ?? autoId}-hint` : undefined;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={selectId}>
          {label}
        </label>
      )}

      <select
        id={selectId}
        className={cx(
          styles.select,
          size === "sm" && styles.selectSm,
          size === "lg" && styles.selectLg,
          className
        )}
        aria-describedby={hintId}
        {...props}
      >
        {children}
      </select>

      {hint && (
        <div id={hintId} className={styles.fieldHint}>
          {hint}
        </div>
      )}
    </div>
  );
}
