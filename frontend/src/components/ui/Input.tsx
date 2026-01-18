import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Size = "sm" | "md" | "lg";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  size?: Size;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Input({ label, hint, size = "md", id, className, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? (label ? autoId : undefined);
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
