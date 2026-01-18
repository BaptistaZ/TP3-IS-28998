import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function S(props: P & { children: React.ReactNode }) {
  const { children, ...rest } = props;
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
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: P) {
  return (
    <S {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </S>
  );
}

export function IconDocs(props: P) {
  return (
    <S {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
      <path d="M9 9h2" />
    </S>
  );
}

export function IconIncidents(props: P) {
  return (
    <S {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </S>
  );
}

export function IconRefresh(props: P) {
  return (
    <S {...props}>
      <path d="M21 12a9 9 0 0 1-15.3 6.36" />
      <path d="M3 12a9 9 0 0 1 15.3-6.36" />
      <path d="M21 3v6h-6" />
      <path d="M3 21v-6h6" />
    </S>
  );
}

export function IconColumns(props: P) {
  return (
    <S {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <rect x="14" y="4" width="7" height="16" rx="1" />
    </S>
  );
}

export function IconSave(props: P) {
  return (
    <S {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </S>
  );
}

export function IconClock(props: P) {
  return (
    <S {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </S>
  );
}

export function IconEuro(props: P) {
  return (
    <S {...props}>
      <path d="M20 12H7" />
      <path d="M20 8H9" />
      <path d="M20 16H9" />
      <path d="M13 4a8 8 0 1 0 0 16" />
    </S>
  );
}

export function IconGauge(props: P) {
  return (
    <S {...props}>
      <path d="M20 13a8 8 0 1 0-16 0" />
      <path d="M12 13l3-3" />
      <path d="M9 13h6" />
    </S>
  );
}

export function IconGlobe(props: P) {
  return (
    <S {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </S>
  );
}

export function IconClose(props: P) {
  return (
    <S {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </S>
  );
}

