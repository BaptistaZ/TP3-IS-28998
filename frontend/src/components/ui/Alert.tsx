import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Variant = "info" | "success" | "warning" | "danger";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        styles.alert,
        variant === "info" && styles.alertInfo,
        variant === "success" && styles.alertSuccess,
        variant === "warning" && styles.alertWarning,
        variant === "danger" && styles.alertDanger
      )}
      role={variant === "danger" ? "alert" : "status"}
    >
      <div>
        <div className={styles.alertTitle}>{title}</div>
        {children && <div className={styles.alertText}>{children}</div>}
      </div>
    </div>
  );
}
