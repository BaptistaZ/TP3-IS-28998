import type { ReactNode } from "react";
import styles from "./ui.module.css";

type PayloadItem = {
  name?: unknown;
  value?: unknown;
  color?: string;
};

type Props = {
  active?: boolean;
  payload?: readonly PayloadItem[];
  label?: unknown;
  title?: ReactNode;
  labelFormatter?: (label: unknown) => ReactNode;
  valueFormatter?: (value: unknown, name: unknown) => ReactNode;
};

export function ChartTooltip({
  active,
  payload,
  label,
  title,
  labelFormatter,
  valueFormatter,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;

  const header = labelFormatter ? labelFormatter(label) : (label as ReactNode);

  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipTitle}>{title ?? header}</div>

      {payload.map((it, idx) => (
        <div key={`${String(it.name ?? "v")}:${idx}`} className={styles.chartTooltipRow}>
          <span>
            <span
              className={styles.chartTooltipDot}
              style={{ background: it.color ?? "var(--primary)" }}
            />
            {String(it.name ?? "valor")}
          </span>
          <span>
            {valueFormatter ? valueFormatter(it.value, it.name) : (it.value as ReactNode)}
          </span>
        </div>
      ))}
    </div>
  );
}
