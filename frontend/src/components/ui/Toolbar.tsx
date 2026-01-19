import type { ReactNode } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Toolbar (layout component)
// =============================================================================

/**
 * Toolbar layout component used to compose a page header area.
 *
 * Design intent:
 * - Left side can include a title, optional left content (buttons/filters), and optional "chips".
 * - Right side is typically used for primary actions (CTA buttons, export, etc.).
 * - Styling is delegated to `ui.module.css` to keep the component purely structural.
 */
export function Toolbar({
  left,
  right,
  title,
  chips,
}: {
  left?: ReactNode;
  right?: ReactNode;
  title?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        {title && <div className={styles.toolbarTitle}>{title}</div>}
        {left}
        {chips && <div className={styles.toolbarChips}>{chips}</div>}
      </div>

      <div className={styles.toolbarRight}>{right}</div>
    </div>
  );
}