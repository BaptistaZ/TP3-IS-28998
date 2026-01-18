import type { ReactNode } from "react";
import { useQuery } from "@apollo/client/react";
import { NavLink } from "react-router-dom";
import styles from "./ui.module.css";
import { Q_AGG_BY_SEVERITY } from "../../graphql/queries";
import { IconDashboard, IconDocs, IconIncidents } from "./Icons";

type Props = { children: ReactNode };

type AggBySeverityRow = { severity: string; totalIncidents: number };
type AggBySeverityData = { aggBySeverity: AggBySeverityRow[] };

const nav = [
  { to: "/", label: "Dashboard", icon: <IconDashboard className={styles.navIcon} /> },
  { to: "/docs", label: "Documentos", icon: <IconDocs className={styles.navIcon} /> },
  { to: "/incidents", label: "Incidentes", icon: <IconIncidents className={styles.navIcon} /> },
];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppShell({ children }: Props) {
  const { data } = useQuery<AggBySeverityData>(Q_AGG_BY_SEVERITY, {
    fetchPolicy: "cache-and-network",
  });

  const incidentsTotal =
    data?.aggBySeverity?.reduce((acc, r) => acc + (r.totalIncidents ?? 0), 0) ?? null;

  return (
    <div className={styles.appShell}>
      <div className={styles.layout}>
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

        <div className={styles.main}>
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

          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}
