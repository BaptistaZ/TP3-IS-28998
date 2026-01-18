export function fmtInt(n: number) {
  return n.toLocaleString("pt-PT");
}

export function fmtDec(n: number, maxFractionDigits = 2) {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: maxFractionDigits });
}

export function fmtEur(n: number) {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

export function nonEmptyTrim(v: string) {
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}
