import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Size = "sm" | "md" | "lg";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  /** Visible label rendered above the select (optional). */
  label?: string;
  /** Helper text rendered below the select (optional). */
  hint?: string;
  /** Visual size variant for padding/font sizing. */
  size?: Size;
};

// =============================================================================
// Utilities
// =============================================================================

/**
 * Keeps JSX readable while allowing optional classes.
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Component
// =============================================================================

/**
 * Form select with optional label and hint text.
 *
 * Accessibility:
 * - When `label` is provided, the component ensures the <label htmlFor> targets
 *   the <select id>. If `id` is not provided, a stable auto-generated id is used.
 * - When `hint` is provided, it is referenced via `aria-describedby`.
 */
export function Select({
  label,
  hint,
  size = "md",
  id,
  className,
  children,
  ...props
}: Props) {
  const autoId = useId();

  // If the caller didn't provide an id, create one only when a label exists.
  // This avoids adding unnecessary ids when the control is unlabeled.
  const selectId = id ?? (label ? autoId : undefined);

  // Tie hint text to the select using aria-describedby when possible.
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