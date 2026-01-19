import type { ReactNode } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Types
// =============================================================================

/**
 * Visual variants supported by the badge/chip stylesheet.
 * Keep this in sync with `ui.module.css`.
 */
type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

// =============================================================================
// Styling helpers
// =============================================================================

/**
 * Minimal className combiner:
 * - ignores falsy values
 * - joins with spaces
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Components
// =============================================================================

/**
 * Badge component used for short status/category labels.
 *
 * Accessibility:
 * - Rendered as a <span> because it is informational, not interactive.
 */
export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cx(
        styles.badge,
        variant === "neutral" && styles.badgeNeutral,
        variant === "info" && styles.badgeInfo,
        variant === "success" && styles.badgeSuccess,
        variant === "warning" && styles.badgeWarning,
        variant === "danger" && styles.badgeDanger
      )}
    >
      {children}
    </span>
  );
}

/**
 * Chip component used for filter pills or small interactive tags.
 *
 * Behaviour:
 * - If `onRemove` is provided, renders a small remove button (×).
 *
 * Accessibility:
 * - The remove action is a real <button> with aria-label/title so screen readers
 *   and tooltips convey the intent clearly.
 */
export function Chip({
  children,
  strong,
  onRemove,
  removeLabel = "Remove",
}: {
  children: ReactNode;
  strong?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className={cx(styles.chip, strong && styles.chipStrong)}>
      <span>{children}</span>

      {onRemove && (
        <button
          type="button"
          className={styles.chipRemove}
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
        >
          ×
        </button>
      )}
    </span>
  );
}