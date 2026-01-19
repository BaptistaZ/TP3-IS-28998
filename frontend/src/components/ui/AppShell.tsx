import type { ReactNode } from "react";
import { useQuery } from "@apollo/client/react";
import { NavLink } from "react-router-dom";

import styles from "./ui.module.css";
import { Q_AGG_BY_SEVERITY } from "../../graphql/queries";
import { IconDashboard, IconDocs, IconIncidents } from "./Icons";

// =============================================================================
// Types
// =============================================================================

type Props = { children: ReactNode };

type AggBySeverityRow = { severity: string; totalIncidents: number };
type AggBySeverityData = { aggBySeverity: AggBySeverityRow[] };

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
};

// =============================================================================
// Navigation configuration
// =============================================================================

/**
 * Sidebar / mobile navigation items used by the shell layout.
 * - `to` must match the React Router routes defined in `App.tsx`.
 */
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <IconDashboard className={styles.navIcon} /> },
  { to: "/docs", label: "Documentos", icon: <IconDocs className={styles.navIcon} /> },
  { to: "/incidents", label: "Incidentes", icon: <IconIncidents className={styles.navIcon} /> },
];

// =============================================================================
// Styling helpers
// =============================================================================

/**
 * Minimal className combiner:
 * - ignores falsy values
 * - joins with spaces
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// =============================================================================
// Component
// =============================================================================

/**
 * AppShell provides the main layout for the UI:
 * - Desktop: sidebar navigation + main content area
 * - Mobile: topbar navigation + main content area
 *
 * It also fetches a lightweight KPI (total incidents) to show in the navigation.
 */
export function AppShell({ children }: Props) {
  // Fetch aggregated counts. This is used purely as a UI KPI (nav badge).
  // `cache-and-network` shows cached values quickly while refreshing in the background.
  const { data } = useQuery<AggBySeverityData>(Q_AGG_BY_SEVERITY, {
    fetchPolicy: "cache-and-network",
  });

  /**
   * Derive total incidents from the `aggBySeverity` response.
   * - `null` means "unknown/not loaded" (keeps the UI stable and avoids showing 0 incorrectly).
   */
  const incidentsTotal =
    data?.aggBySeverity?.reduce((acc, r) => acc + (r.totalIncidents ?? 0), 0) ?? null;

  return (
    <div className={styles.appShell}>
      <div className={styles.layout}>
        {/* =============================================================================
            Desktop sidebar
        ============================================================================= */}
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.brandTitle}>BI Dashboard</div>
            <div className={styles.brandSub}>KPIs, documentos e incidentes</div>
          </div>

          <nav className={styles.nav} aria-label="Navegação principal">
            {nav.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
              >
                {it.icon}
                {it.label}

                {/* Optional KPI badge displayed only on the "Incidents" nav entry. */}
                {it.to === "/incidents" && typeof incidentsTotal === "number" && (
                  <span className={styles.navRight}>
                    <span className={styles.navCount} title="Total de incidentes (aggBySeverity)">
                      {incidentsTotal.toLocaleString("pt-PT")}
                    </span>
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* =============================================================================
            Main content area
        ============================================================================= */}
        <div className={styles.main}>
          {/* Mobile header / nav (keeps navigation accessible on small screens). */}
          <header className={styles.mobileTopbar}>
            <div className={styles.mobileTopbarInner}>
              <div className={styles.brandTitle}>BI</div>

              <nav className={styles.mobileNav} aria-label="Navegação principal">
                {nav.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === "/"}
                    className={({ isActive }) =>
                      cx(styles.mobileNavLink, isActive && styles.mobileNavLinkActive)
                    }
                  >
                    {it.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </header>

          {/* Route content injected by React Router via `App.tsx`. */}
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}