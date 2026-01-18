import type { ReactNode } from "react";
import styles from "./ui.module.css";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) {
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

export function Chip({
  children,
  strong,
  onRemove,
  removeLabel = "Remover",
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
        <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
          ×
        </button>
      )}
    </span>
  );
}
