import type { HTMLAttributes } from "react";
import styles from "./ui.module.css";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.skeleton, className)} {...props} />;
}

export function Spinner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.spinner, className)} {...props} aria-label="A carregar" />;
}
