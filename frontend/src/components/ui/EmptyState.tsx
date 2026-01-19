import type { ReactNode } from "react";

import styles from "./ui.module.css";

// =============================================================================
// Component
// =============================================================================

/**
 * Generic empty-state block used when a page/section has no data to display.
 * Supports optional description text and optional action buttons/links.
 */
export function EmptyState({
  title,
  text,
  actions,
}: {
  /** Main message shown in the empty state (usually a short headline). */
  title: ReactNode;

  /** Optional supporting text (e.g., explanation, next steps). */
  text?: ReactNode;

  /** Optional actions (e.g., "Retry", "Create", "Clear filters"). */
  actions?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>

      {/* Render supporting text only when provided to avoid empty spacing. */}
      {text && <div className={styles.emptyText}>{text}</div>}

      {/* Render actions only when provided to keep the component minimal. */}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  );
}