import { useEffect } from "react";
import styles from "./ui.module.css";
import { Button } from "./Button";
import { IconClose } from "./Icons";

export function Drawer({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
      <div className={styles.drawerPanel}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>{title}</div>
          <Button size="sm" variant="default" onClick={onClose} aria-label="Fechar">
            <IconClose />
          </Button>
        </div>

        <div className={styles.drawerBody}>{children}</div>

        {footer && <div className={styles.drawerFooter}>{footer}</div>}
      </div>
    </div>
  );
}
