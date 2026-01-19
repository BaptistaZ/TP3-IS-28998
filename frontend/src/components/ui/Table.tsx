import type { ReactNode } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Utilities
// =============================================================================

/**
 * Filters falsy values to keep JSX concise.
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Types
// =============================================================================

/**
 * Column definition for a generic table.
 * - `key` must be stable (used as React key)
 * - `render` receives the row and returns the cell content
 */
export type TableColumn<T> = {
  header: ReactNode;
  key: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  thClassName?: string;
  tdClassName?: string;
};

// =============================================================================
// Table component
// =============================================================================

/**
 * Generic table component with optional:
 * - compact density
 * - empty state
 * - footer area
 * - row click handling with basic keyboard accessibility (Enter/Space)
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  compact,
  empty,
  footer,
  onRowClick,
  rowAriaLabel,
}: {
  columns: Array<TableColumn<T>>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  compact?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  onRowClick?: (row: T, index: number) => void;
  rowAriaLabel?: (row: T, index: number) => string;
}) {
  // Treat the table as "interactive" when a click handler is provided.
  const clickable = typeof onRowClick === "function";

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableScroll}>
        <table className={cx(styles.table, compact && styles.tableCompact)}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx(
                    styles.th,
                    c.align === "right" && styles.cellRight,
                    c.thClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={rowKey(r, idx)}
                className={cx(styles.tr, clickable && styles.trClickable)}
                // Only attach handlers/attributes when rows are actually clickable.
                onClick={clickable ? () => onRowClick?.(r, idx) : undefined}
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
                aria-label={clickable ? rowAriaLabel?.(r, idx) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        // Match common "button-like" keyboard behaviour:
                        // Enter/Space triggers the row action.
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(r, idx);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      styles.td,
                      c.align === "right" && styles.cellRight,
                      c.mono && styles.cellMono,
                      c.tdClassName
                    )}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Empty state row (spans the full table width). */}
            {rows.length === 0 && (
              <tr className={styles.tr}>
                <td className={styles.td} colSpan={columns.length}>
                  {empty ?? "Sem resultados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Optional extra content below the scrollable table (e.g., pagination). */}
      {footer}
    </div>
  );
}

// =============================================================================
// Pagination layout helper
// =============================================================================

/**
 * Simple layout component to standardise pagination UI:
 * - left: informational text (e.g., "1–50 de 120")
 * - right: pagination actions (buttons/selectors)
 */
export function TablePagination({
  info,
  actions,
}: {
  info: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>{info}</div>
      <div className={styles.paginationActions}>{actions}</div>
    </div>
  );
}