import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Types
// =============================================================================

/**
 * Supported input sizes mapped to CSS module variants.
 */
type Size = "sm" | "md" | "lg";

/**
 * Input props:
 * - Extends the native <input> props (except the HTML "size" attribute).
 * - Adds optional label + hint rendering.
 * - Adds a `size` variant to control styling.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  size?: Size;
};

// =============================================================================
// Utilities
// =============================================================================

/**
 * Keeps UI components dependency-free (no clsx/classnames).
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Component
// =============================================================================

/**
 * Reusable input field with optional label and hint.
 *
 * Accessibility:
 * - If `label` is provided, the input gets a stable id and the <label htmlFor> is wired.
 * - If `hint` is provided, it is linked via `aria-describedby`.
 *
 * Behaviour:
 * - If `id` is provided, it is always respected.
 * - If no `id` is provided:
 *   - and `label` exists -> generate an id so the label is associated to the input.
 *   - and no label -> omit id (still generates a hint id if needed using a fallback).
 */
export function Input({ label, hint, size = "md", id, className, ...props }: Props) {
  const autoId = useId();

  // If the caller didn't provide an id, only generate one when needed for <label htmlFor>.
  const inputId = id ?? (label ? autoId : undefined);

  // The hint should always have an id when present, to support aria-describedby.
  const hintId = hint ? `${inputId ?? autoId}-hint` : undefined;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={inputId}>
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={cx(
          styles.input,
          size === "sm" && styles.inputSm,
          size === "lg" && styles.inputLg,
          className
        )}
        aria-describedby={hintId}
        {...props}
      />

      {hint && (
        <div id={hintId} className={styles.fieldHint}>
          {hint}
        </div>
      )}
    </div>
  );
}