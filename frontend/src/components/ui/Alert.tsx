import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Variant = "info" | "success" | "warning" | "danger";

// =============================================================================
// Styling helpers
// =============================================================================

/**
 * Minimal className combiner:
 * - ignores falsy values
 * - joins with spaces
 */
function cx(...parts: Array<string | false |undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Component
// =============================================================================

/**
 * Alert is a lightweight, styled message container for user feedback.
 *
 * Accessibility:
 * - `role="alert"` is used for danger messages (announce immediately).
 * - `role="status"` is used for non-critical messages (polite announcements).
 */
export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title: ReactNode;
  children?: ReactNode;
}) {
  // Map variant to the corresponding CSS module class.
  const variantClass =
    variant === "info"
      ? styles.alertInfo
      : variant === "success"
      ? styles.alertSuccess
      : variant === "warning"
      ? styles.alertWarning
      : styles.alertDanger;

  // Role selection based on urgency.
  const ariaRole = variant === "danger" ? "alert" : "status";

  return (
    <div className={cx(styles.alert, variantClass)} role={ariaRole}>
      <div>
        <div className={styles.alertTitle}>{title}</div>
        {children && <div className={styles.alertText}>{children}</div>}
      </div>
    </div>
  );
}