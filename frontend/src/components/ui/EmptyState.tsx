import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function EmptyState({
  title,
  text,
  actions,
}: {
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>
      {text && <div className={styles.emptyText}>{text}</div>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  );
}
