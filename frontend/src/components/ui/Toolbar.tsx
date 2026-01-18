import type { ReactNode } from "react";
import styles from "./ui.module.css";

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
