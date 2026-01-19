import type { ReactNode } from "react";
import styles from "./ui.module.css";

// =============================================================================
// Utilities
// =============================================================================

/**
 * Useful for conditionally applying CSS module classes without extra deps.
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Page primitives
// =============================================================================

/**
 * Page wrapper used across the app.
 * Renders a consistent header area and the page body below it.
 */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <PageHeader title={title} />
      {children}
    </div>
  );
}

/**
 * Standard page header layout.
 *
 * Slots:
 * - `title`: required page title.
 * - `subtitle`: optional secondary line (string, small component, etc.).
 * - `actions`: optional right-side actions (buttons, filters, etc.).
 * - `children`: optional extra content under the header (KPIs, toolbars, chips).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={styles.pageHeader}>
      <div className={styles.pageHeaderTop}>
        <div className={styles.pageTitleWrap}>
          <div className={styles.pageTitle}>{title}</div>
          {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
        </div>

        {actions && <div className={styles.pageActions}>{actions}</div>}
      </div>

      {children}
    </section>
  );
}

// =============================================================================
// Header KPI helpers
// =============================================================================

/**
 * Container for KPI tiles displayed inside a PageHeader.
 */
export function HeaderKpis({ children }: { children: ReactNode }) {
  return <div className={styles.headerKpis}>{children}</div>;
}

/**
 * Single KPI tile used in the header.
 * Typically contains a label + prominent value, optionally with an icon.
 */
export function HeaderKpi({
  label,
  value,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.headerKpi}>
      {icon && <div className={styles.headerKpiIcon}>{icon}</div>}

      <div className={styles.headerKpiBody}>
        <div className={styles.headerKpiLabel}>{label}</div>
        <div className={styles.headerKpiValue}>{value}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Layout blocks
// =============================================================================

/**
 * Generic vertical section with consistent spacing.
 * Useful to keep page spacing uniform across different pages.
 */
export function Section({ children }: { children: ReactNode }) {
  return <section className={styles.section}>{children}</section>;
}

/**
 * Card container with optional header rows.
 *
 * Header is rendered only if at least one of {title, subtitle, actions} exists.
 * The body is always rendered and holds the card content.
 */
export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card}>
      {(title || subtitle || actions) && (
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            {title && <div className={styles.cardTitle}>{title}</div>}
            {subtitle && <div className={styles.cardSub}>{subtitle}</div>}
          </div>

          {actions && <div>{actions}</div>}
        </div>
      )}

      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

// =============================================================================
// Stats grid helpers
// =============================================================================

/**
 * Responsive grid container for StatCard components.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

/**
 * Grid column wrapper for StatCard.
 * `span` maps to predefined CSS module classes to keep the layout consistent.
 */
export function StatCol({
  span = 3,
  children,
}: {
  span?: 3 | 4 | 6;
  children: ReactNode;
}) {
  const cls =
    span === 4 ? styles.statCol4 : span === 6 ? styles.statCol6 : styles.statCol3;

  return <div className={cls}>{children}</div>;
}

/**
 * Statistic card showing a label/value pair, optionally with trend and metadata.
 *
 * - `trend` and `trendDirection` allow styling a delta indicator (e.g., +3%, -2%).
 * - `emphasis` enables a highlighted style variant for the primary KPI.
 * - `icon` is displayed next to the label when provided.
 */
export function StatCard({
  label,
  value,
  trend,
  trendDirection,
  meta,
  emphasis,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  trend?: ReactNode;
  trendDirection?: "up" | "down";
  meta?: ReactNode;
  emphasis?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={cx(styles.statCard, emphasis && styles.statCardEmphasis)}>
      <div className={styles.statTop}>
        <div className={styles.statLabelRow}>
          {icon && <div className={styles.statIcon}>{icon}</div>}
          <div className={styles.statLabel}>{label}</div>
        </div>

        {trend && (
          <div
            className={cx(
              styles.statTrend,
              trendDirection === "up" && styles.statTrendUp,
              trendDirection === "down" && styles.statTrendDown
            )}
          >
            {trend}
          </div>
        )}
      </div>

      <div className={cx(styles.statValue, emphasis && styles.statValueEmphasis)}>{value}</div>

      {meta && <div className={styles.statMeta}>{meta}</div>}
    </div>
  );
}