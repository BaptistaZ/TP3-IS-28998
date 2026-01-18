import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import styles from "./ui.module.css";

type Props = { children: ReactNode };

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/docs", label: "Documentos" },
  { to: "/incidents", label: "Incidentes" },
];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppShell({ children }: Props) {
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
                {it.label}
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
