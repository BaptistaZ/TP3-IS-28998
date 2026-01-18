import type { ReactNode } from "react";
import styles from "./ui.module.css";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Wrapper de página (mantém compatibilidade com o teu código atual) */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <PageHeader title={title} />
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode; // opcional: KPIs, toolbar, chips, etc.
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

export function HeaderKpis({ children }: { children: ReactNode }) {
  return <div className={styles.headerKpis}>{children}</div>;
}

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

export function Section({ children }: { children: ReactNode }) {
  return <section className={styles.section}>{children}</section>;
}

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

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

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
