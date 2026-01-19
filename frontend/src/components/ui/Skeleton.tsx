import type { HTMLAttributes } from "react";
import styles from "./ui.module.css";

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
// Loading primitives
// =============================================================================

/**
 * Skeleton placeholder for content that is still loading.
 * Accepts any standard div attributes (e.g., style, aria-*, data-*).
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.skeleton, className)} {...props} />;
}

/**
 * Spinner indicator for async loading states.
 * `aria-label` provides an accessible name for screen readers.
 */
export function Spinner({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(styles.spinner, className)}
      {...props}
      aria-label="A carregar"
    />
  );
}