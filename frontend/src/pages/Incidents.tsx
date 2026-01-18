import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useSearchParams } from "react-router-dom";
import { Q_INCIDENTS } from "../graphql/queries";

import { PageHeader, Section, Card } from "../components/ui/Layout";
import { Toolbar } from "../components/ui/Toolbar";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Table, type TableColumn, TablePagination } from "../components/ui/Table";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { CopyPill } from "../components/ui/CopyButton";
import { FilterSummary, type FilterChip } from "../components/ui/FilterSummary";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { loadColumnPickerState } from "../components/ui/columnPickerStorage";
import { Drawer } from "../components/ui/Drawer";

import styles from "./incidents.module.css";
import { fmtDateTime, fmtDec, fmtEur, fmtInt, nonEmptyTrim } from "../lib/format";

type IncidentRow = {
  docId: number;
  incidentId: string;
  source: string | null;
  incidentType: string | null;
  severity: string | null;
  status: string | null;
  city: string | null;
  country: string | null;
  continent: string | null;
  lat: number | null;
  lon: number | null;
  reportedAt: string | null;
  validatedAt: string | null;
  resolvedAt: string | null;
  lastUpdateUtc: string | null;
  assignedUnit: string | null;
  resourcesCount: number | null;
  etaMin: number | null;
  responseTimeMin: number | null;
  estimatedCostEur: number | null;
  riskScore: number | null;
  notes: string | null;
};

type IncidentsData = { incidents: IncidentRow[] };

const COLUMN_STORAGE_KEY = "incidents.visibleColumns.v1";

const INCIDENT_COLUMN_OPTIONS: ColumnOption[] = [
  { key: "docId", label: "Doc" },
  { key: "incidentId", label: "Incident ID" },
  { key: "incidentType", label: "Type" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "riskScore", label: "Risk" },
  { key: "estimatedCostEur", label: "Cost (EUR)" },
  { key: "reportedAt", label: "Reported" },
  { key: "lastUpdateUtc", label: "Last update" },
];

function defaultVisibleColumns(): Record<string, boolean> {
  const v: Record<string, boolean> = {};
  for (const o of INCIDENT_COLUMN_OPTIONS) v[o.key] = true;
  return v;
}

function readIntParam(searchParams: URLSearchParams, key: string): number | null {
  const raw = searchParams.get(key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function readStrParam(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? "";
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return Math.trunc(n);
}

function severityVariant(sev: string | null): "danger" | "warning" | "info" | "neutral" {
  if (!sev) return "neutral";
  const n = Number(sev);
  if (!Number.isFinite(n)) return "neutral";
  if (n <= 2) return "danger";
  if (n === 3) return "warning";
  if (n === 4) return "info";
  return "neutral";
}

function statusVariant(st: string | null): "success" | "warning" | "danger" | "neutral" | "info" {
  const s = (st ?? "").toLowerCase();
  if (!s) return "neutral";
  if (s === "open") return "danger";
  if (s === "pending" || s === "triage") return "warning";
  if (s === "validated") return "info";
  if (s === "resolved" || s === "closed") return "success";
  return "neutral";
}

function safeText(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export default function Incidents() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [docId, setDocId] = useState<number | "">(() => {
    const n = readIntParam(searchParams, "docId");
    return typeof n === "number" && Number.isFinite(n) ? n : "";
  });
  const [type, setType] = useState(() => readStrParam(searchParams, "type"));
  const [severity, setSeverity] = useState(() => readStrParam(searchParams, "severity"));
  const [status, setStatus] = useState(() => readStrParam(searchParams, "status"));
  const [country, setCountry] = useState(() => readStrParam(searchParams, "country"));

  const [limit, setLimit] = useState(() =>
    clampInt(readIntParam(searchParams, "limit") ?? 100, 10, 2000)
  );
  const [page, setPage] = useState(() => Math.max(0, readIntParam(searchParams, "page") ?? 0));

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    return loadColumnPickerState(COLUMN_STORAGE_KEY) ?? defaultVisibleColumns();
  });

  const [selected, setSelected] = useState<IncidentRow | null>(null);

  // Paginação com offset real (evita fetchLimit = limit*(page+1))
  // Pedimos +1 linha para detetar se existe próxima página.
  const safeLimit = clampInt(limit, 10, 2000);
  const offset = Math.max(0, page) * safeLimit;
  const requestLimit = safeLimit + 1;

  const variables = useMemo(
    () => ({
      docId: typeof docId === "number" ? docId : undefined,
      type: nonEmptyTrim(type),
      severity: nonEmptyTrim(severity),
      status: nonEmptyTrim(status),
      country: nonEmptyTrim(country),
      limit: requestLimit,
      offset,
    }),
    [docId, type, severity, status, country, requestLimit, offset]
  );

  const { data, loading, error, refetch } = useQuery<IncidentsData>(Q_INCIDENTS, {
    variables,
    fetchPolicy: "cache-first",
  });

  const rows = useMemo(() => data?.incidents ?? [], [data?.incidents]);

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [];

    if (typeof docId === "number")
      items.push({
        key: "docId",
        label: `docId=${docId}`,
        onRemove: () => {
          setDocId("");
          setPage(0);
        },
      });

    const t = nonEmptyTrim(type);
    if (t)
      items.push({
        key: "type",
        label: `type=${t}`,
        onRemove: () => {
          setType("");
          setPage(0);
        },
      });

    const sev = nonEmptyTrim(severity);
    if (sev)
      items.push({
        key: "severity",
        label: `severity=${sev}`,
        onRemove: () => {
          setSeverity("");
          setPage(0);
        },
      });

    const st = nonEmptyTrim(status);
    if (st)
      items.push({
        key: "status",
        label: `status=${st}`,
        onRemove: () => {
          setStatus("");
          setPage(0);
        },
      });

    const c = nonEmptyTrim(country);
    if (c)
      items.push({
        key: "country",
        label: `country=${c}`,
        onRemove: () => {
          setCountry("");
          setPage(0);
        },
      });

    return items;
  }, [docId, type, severity, status, country]);

  const allCols = useMemo<Array<TableColumn<IncidentRow>>>(
    () => [
      { key: "docId", header: "Doc", mono: true, render: (r) => r.docId },
      {
        key: "incidentId",
        header: "Incident ID",
        render: (r) => <CopyPill value={r.incidentId} />,
      },
      { key: "incidentType", header: "Type", render: (r) => r.incidentType ?? "-" },
      {
        key: "severity",
        header: "Severity",
        render: (r) => <Badge variant={severityVariant(r.severity)}>{r.severity ?? "-"}</Badge>,
      },
      {
        key: "status",
        header: "Status",
        render: (r) => <Badge variant={statusVariant(r.status)}>{r.status ?? "-"}</Badge>,
      },
      { key: "country", header: "Country", render: (r) => r.country ?? "-" },
      { key: "city", header: "City", render: (r) => r.city ?? "-" },
      {
        key: "riskScore",
        header: "Risk",
        align: "right",
        render: (r) => (typeof r.riskScore === "number" ? fmtDec(r.riskScore, 2) : "-"),
      },
      {
        key: "estimatedCostEur",
        header: "Cost (EUR)",
        align: "right",
        render: (r) => (typeof r.estimatedCostEur === "number" ? fmtEur(r.estimatedCostEur) : "-"),
      },
      {
        key: "reportedAt",
        header: "Reported",
        mono: true,
        render: (r) => (r.reportedAt ? fmtDateTime(r.reportedAt) : "-"),
      },
      {
        key: "lastUpdateUtc",
        header: "Last update",
        mono: true,
        render: (r) => (r.lastUpdateUtc ? fmtDateTime(r.lastUpdateUtc) : "-"),
      },
    ],
    []
  );

  const cols = useMemo(
    () => allCols.filter((c) => visibleColumns[c.key] !== false),
    [allCols, visibleColumns]
  );

  const safePage = Math.max(0, page);
  const hasNext = rows.length > safeLimit;
  const pagedRows = useMemo(() => rows.slice(0, safeLimit), [rows, safeLimit]);
  const pageStart = safePage * safeLimit;
  const pageEnd = pageStart + pagedRows.length;
  const hasPrev = safePage > 0;

  function syncUrl(nextPage: number) {
    const next: Record<string, string> = {};

    if (typeof docId === "number") next.docId = String(docId);

    const t = nonEmptyTrim(type);
    if (t) next.type = t;

    const sev = nonEmptyTrim(severity);
    if (sev) next.severity = sev;

    const st = nonEmptyTrim(status);
    if (st) next.status = st;

    const c = nonEmptyTrim(country);
    if (c) next.country = c;

    if (limit !== 100) next.limit = String(limit);
    if (nextPage > 0) next.page = String(nextPage);

    setSearchParams(next);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Incidentes"
        subtitle={
          <>
            Filtros por <code>docId/type/severity/status/country</code>. As tabelas fazem scroll
            horizontal em ecrãs pequenos.
          </>
        }
      />

      <Section>
        <Toolbar
          title="Filtros"
          left={
            <div className={styles.filters}>
              <div className={styles.fDoc}>
                <Input
                  label="DocId"
                  type="number"
                  value={docId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDocId(v === "" ? "" : Number(v));
                    setPage(0);
                  }}
                  placeholder="ex: 12"
                  size="sm"
                />
              </div>

              <Input
                label="Type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(0);
                }}
                placeholder="ex: fire"
                size="sm"
              />

              <Input
                label="Severity"
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value);
                  setPage(0);
                }}
                placeholder="1..5"
                size="sm"
              />

              <Input
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                placeholder="ex: open"
                size="sm"
              />

              <Input
                label="Country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setPage(0);
                }}
                placeholder="ex: PT"
                size="sm"
              />

              <div className={styles.fLimit}>
                <Input
                  label="Limit"
                  type="number"
                  value={limit}
                  onChange={(e) => {
                    setLimit(clampInt(Number(e.target.value), 10, 2000));
                    setPage(0);
                  }}
                  min={10}
                  max={2000}
                  step={10}
                  size="sm"
                />
              </div>
            </div>
          }
          right={
            <div className={styles.actions}>
              <Button
                variant="primary"
                disabled={loading}
                onClick={() => {
                  syncUrl(0);
                  setPage(0);
                  refetch({
                    docId: typeof docId === "number" ? docId : undefined,
                    type: nonEmptyTrim(type),
                    severity: nonEmptyTrim(severity),
                    status: nonEmptyTrim(status),
                    country: nonEmptyTrim(country),
                    limit: safeLimit + 1,
                    offset: 0,
                  });
                }}
              >
                Aplicar
              </Button>

              <Button
                disabled={loading}
                onClick={() => {
                  setDocId("");
                  setType("");
                  setSeverity("");
                  setStatus("");
                  setCountry("");
                  setLimit(100);
                  setPage(0);
                  setSearchParams({});
                }}
              >
                Limpar
              </Button>
            </div>
          }
        />
      </Section>

      <Section>
        <FilterSummary
          chips={chips}
          onSave={() => {
            try {
              window.localStorage.setItem(
                "incidents.savedFilter.v1",
                JSON.stringify({
                  docId: typeof docId === "number" ? docId : null,
                  type: nonEmptyTrim(type) ?? null,
                  severity: nonEmptyTrim(severity) ?? null,
                  status: nonEmptyTrim(status) ?? null,
                  country: nonEmptyTrim(country) ?? null,
                })
              );
            } catch {
              // ignore
            }
          }}
        />
      </Section>

      {error && (
        <Alert variant="danger" title="Erro GraphQL">
          {error.message}
        </Alert>
      )}

      <Section>
        <Card
          title="Resultados"
          subtitle={
            loading
              ? "A carregar…"
              : error
                ? "Falha ao carregar."
                : rows.length === 0
                  ? "Linhas: 0"
                  : `A mostrar ${fmtInt(pageStart + 1)}–${fmtInt(pageEnd)}${hasNext ? " +" : ""}`
          }
          actions={
            <ColumnPicker
              options={INCIDENT_COLUMN_OPTIONS}
              value={visibleColumns}
              onChange={setVisibleColumns}
              storageKey={COLUMN_STORAGE_KEY}
            />
          }
        >
          {loading && rows.length === 0 ? (
            <Skeleton className={styles.tableSkeleton} />
          ) : !loading && !error && rows.length === 0 ? (
            <EmptyState
              title="Sem resultados"
              text="Sem linhas para os filtros atuais. Ajusta severidade/status ou aumenta o limit."
              actions={
                <Button onClick={() => refetch()} variant="primary">
                  Recarregar
                </Button>
              }
            />
          ) : (
            <Table
              columns={cols}
              rows={pagedRows}
              rowKey={(r) => `${r.docId}:${r.incidentId}`}
              compact
              onRowClick={(r) => setSelected(r)}
              rowAriaLabel={(r) => `Abrir detalhe do incidente ${r.incidentId}`}
              footer={
                <TablePagination
                  info={
                    <>
                      Página {safePage + 1}
                      {rows.length > 0 && (
                        <>
                          {" "}
                          · {fmtInt(pageStart + 1)}–{fmtInt(pageEnd)}
                        </>
                      )}
                    </>
                  }
                  actions={
                    <>
                      <Button
                        size="sm"
                        disabled={loading || !hasPrev}
                        onClick={() => {
                          const prev = Math.max(0, safePage - 1);
                          setPage(prev);
                          syncUrl(prev);
                        }}
                      >
                        Anterior
                      </Button>

                      <Button
                        size="sm"
                        disabled={loading || !hasNext}
                        onClick={() => {
                          const next = safePage + 1;
                          setPage(next);
                          syncUrl(next);
                        }}
                      >
                        Seguinte
                      </Button>
                    </>
                  }
                />
              }
            />
          )}

          <div className={styles.hint}>
            Dica: severidade é string no schema (usa “1”, “2”, … “5”). País usa códigos tipo “PT”.
          </div>
        </Card>
      </Section>

      <Drawer
        open={!!selected}
        title={selected ? `Incidente ${selected.incidentId}` : "Incidente"}
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <>
              <Button
                variant="default"
                onClick={() => {
                  const txt = safeText(selected.notes);
                  if (!txt) return;
                  navigator.clipboard.writeText(txt);
                }}
              >
                Copiar notas
              </Button>
              <Button variant="primary" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </>
          ) : null
        }
      >
        {selected && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge variant={severityVariant(selected.severity)}>{selected.severity ?? "-"}</Badge>
              <Badge variant={statusVariant(selected.status)}>{selected.status ?? "-"}</Badge>
              {selected.incidentType && <Badge variant="neutral">{selected.incidentType}</Badge>}
              {selected.country && <Badge variant="neutral">{selected.country}</Badge>}
              {selected.city && <Badge variant="neutral">{selected.city}</Badge>}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <strong>Risco:</strong>{" "}
                {typeof selected.riskScore === "number" ? fmtDec(selected.riskScore, 2) : "-"}
              </div>
              <div>
                <strong>Custo estimado:</strong>{" "}
                {typeof selected.estimatedCostEur === "number"
                  ? fmtEur(selected.estimatedCostEur)
                  : "-"}
              </div>
              <div>
                <strong>Reported:</strong>{" "}
                {selected.reportedAt ? fmtDateTime(selected.reportedAt) : "-"}
              </div>
              <div>
                <strong>Last update:</strong>{" "}
                {selected.lastUpdateUtc ? fmtDateTime(selected.lastUpdateUtc) : "-"}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Descrição</div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                {selected.notes ?? "—"}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
