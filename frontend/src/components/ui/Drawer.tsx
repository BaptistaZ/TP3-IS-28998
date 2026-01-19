import { useEffect } from "react";

import { Button } from "./Button";
import { IconClose } from "./Icons";
import styles from "./ui.module.css";

// =============================================================================
// Component
// =============================================================================

/**
 * Slide-over panel rendered on top of the page (modal-like).
 * - Mounts only when `open` is true.
 * - Closes on ESC key and via close button.
 * - Uses basic ARIA roles for accessibility.
 */
export function Drawer({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  /** Controls whether the drawer is visible (mounted) or not. */
  open: boolean;

  /** Drawer title displayed in the header. */
  title: string;

  /** Main content of the drawer. */
  children: React.ReactNode;

  /** Called when the user requests closing (ESC or close button). */
  onClose: () => void;

  /** Optional footer area (e.g., actions such as Save/Cancel). */
  footer?: React.ReactNode;
}) {
  // Close the drawer when the user presses ESC, only while open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Avoid rendering any overlay/panel markup when closed.
  if (!open) return null;

  return (
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
      <div className={styles.drawerPanel}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>{title}</div>

          <Button
            size="sm"
            variant="default"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconClose />
          </Button>
        </div>

        <div className={styles.drawerBody}>{children}</div>

        {/* Footer is optional to keep the drawer compact when not needed. */}
        {footer && <div className={styles.drawerFooter}>{footer}</div>}
      </div>
    </div>
  );
}