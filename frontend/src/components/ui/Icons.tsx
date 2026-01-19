import type { SVGProps } from "react";
import type { ReactNode } from "react";

// =============================================================================
// Shared types / base icon component
// =============================================================================

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Base SVG wrapper used by every icon in this module.
 *
 * Keeps icons visually consistent (size, stroke, viewBox) and accessible:
 * - `aria-hidden="true"` because these icons are decorative by default.
 * - Consumers should add text labels elsewhere (e.g., button label / aria-label).
 */
function SvgIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// =============================================================================
// Navigation / page icons
// =============================================================================

/** Dashboard grid icon. */
export function IconDashboard(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </SvgIcon>
  );
}

/** Document/file icon (used for "Docs"). */
export function IconDocs(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
      <path d="M9 9h2" />
    </SvgIcon>
  );
}

/** Warning/incident icon (triangle with exclamation). */
export function IconIncidents(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

// =============================================================================
// Actions / controls
// =============================================================================

/** Refresh/sync icon (circular arrows). */
export function IconRefresh(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M21 12a9 9 0 0 1-15.3 6.36" />
      <path d="M3 12a9 9 0 0 1 15.3-6.36" />
      <path d="M21 3v6h-6" />
      <path d="M3 21v-6h6" />
    </SvgIcon>
  );
}

/** Column layout icon (used for column picker). */
export function IconColumns(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </SvgIcon>
  );
}

/** Save/floppy icon. */
export function IconSave(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </SvgIcon>
  );
}

/** Close/remove icon (X). */
export function IconClose(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </SvgIcon>
  );
}

// =============================================================================
// Data / KPI icons
// =============================================================================

/** Clock/time icon (used for "updated at", durations, etc.). */
export function IconClock(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </SvgIcon>
  );
}

/** Euro currency icon (financial KPIs). */
export function IconEuro(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M20 12H7" />
      <path d="M20 8H9" />
      <path d="M20 16H9" />
      <path d="M13 4a8 8 0 1 0 0 16" />
    </SvgIcon>
  );
}

/** Gauge/speedometer icon (risk score, performance, etc.). */
export function IconGauge(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M20 13a8 8 0 1 0-16 0" />
      <path d="M12 13l3-3" />
      <path d="M9 13h6" />
    </SvgIcon>
  );
}

/** Globe icon (geography, countries, coverage). */
export function IconGlobe(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </SvgIcon>
  );
}