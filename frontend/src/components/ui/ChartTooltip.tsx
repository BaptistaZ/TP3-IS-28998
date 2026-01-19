import type { ReactNode } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal subset of a typical chart library payload item (e.g., Recharts).
 * Kept intentionally permissive because upstream types vary by chart component.
 */
type PayloadItem = {
  name?: unknown;
  value?: unknown;
  color?: string;
};

/**
 * Tooltip props are aligned with common chart tooltips:
 * - `active` tells if the tooltip should be visible.
 * - `payload` is the series values at the hovered point.
 * - `label` is the x-axis / category label for that point.
 * - Formatters allow caller-controlled rendering without coupling to a chart library.
 */
type Props = {
  active?: boolean;
  payload?: readonly PayloadItem[];
  label?: unknown;
  title?: ReactNode;
  labelFormatter?: (label: unknown) => ReactNode;
  valueFormatter?: (value: unknown, name: unknown) => ReactNode;
};

// =============================================================================
// Component
// =============================================================================

/**
 * Generic tooltip renderer for charts.
 *
 * Designed to be used as a custom tooltip component, where the charting library
 * passes `active`, `payload`, and `label`. The caller may also inject:
 * - `title` to override the header
 * - `labelFormatter` to format the hovered label
 * - `valueFormatter` to format each series value
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  labelFormatter,
  valueFormatter,
}: Props) {
  // Most chart libs keep tooltip mounted and toggle with `active`;
  // this guard prevents rendering empty UI and avoids errors on undefined payload.
  if (!active || !payload || payload.length === 0) return null;

  // Header text: prefer explicit label formatter, otherwise treat label as renderable.
  const header = labelFormatter ? labelFormatter(label) : (label as ReactNode);

  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipTitle}>{title ?? header}</div>

      {payload.map((it, idx) => {
        // Stable enough key for tooltip rows (series name + index fallback).
        const key = `${String(it.name ?? "v")}:${idx}`;

        return (
          <div key={key} className={styles.chartTooltipRow}>
            <span>
              {/* Color dot: uses series color when available, otherwise falls back to theme primary. */}
              <span
                className={styles.chartTooltipDot}
                style={{ background: it.color ?? "var(--primary)" }}
              />
              {String(it.name ?? "valor")}
            </span>

            <span>
              {/* Prefer caller formatting to keep this component domain-agnostic. */}
              {valueFormatter ? valueFormatter(it.value, it.name) : (it.value as ReactNode)}
            </span>
          </div>
        );
      })}
    </div>
  );
}