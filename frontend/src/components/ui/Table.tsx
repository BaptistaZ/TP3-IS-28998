import type { ReactNode } from "react";
import styles from "./ui.module.css";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type TableColumn<T> = {
  header: ReactNode;
  key: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  thClassName?: string;
  tdClassName?: string;
};

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
                onClick={clickable ? () => onRowClick?.(r, idx) : undefined}
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
                aria-label={clickable ? rowAriaLabel?.(r, idx) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
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

      {footer}
    </div>
  );
}

export function TablePagination({ info, actions }: { info: ReactNode; actions: ReactNode }) {
  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>{info}</div>
      <div className={styles.paginationActions}>{actions}</div>
    </div>
  );
}
