import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useSearchParams } from "react-router-dom";
import { Q_INCIDENTS } from "../graphql/queries";

import { PageHeader, Section, Card } from "../components/ui/Layout";
import { Toolbar } from "../components/ui/Toolbar";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Chip, Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Table, type TableColumn } from "../components/ui/Table";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { CopyPill } from "../components/ui/CopyButton";

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
};

type IncidentsData = { incidents: IncidentRow[] };

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

export default function Incidents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const docIdFromUrlRaw = searchParams.get("docId");
  const docIdFromUrl = docIdFromUrlRaw ? Number(docIdFromUrlRaw) : undefined;

  const [docId, setDocId] = useState<number | "">(
    Number.isFinite(docIdFromUrl as number) ? (docIdFromUrl as number) : ""
  );

  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState(100);

  const variables = useMemo(
    () => ({
      docId: typeof docId === "number" ? docId : undefined,
      type: nonEmptyTrim(type),
      severity: nonEmptyTrim(severity),
      status: nonEmptyTrim(status),
      country: nonEmptyTrim(country),
      limit,
    }),
    [docId, type, severity, status, country, limit]
  );

  const { data, loading, error, refetch } = useQuery<IncidentsData>(Q_INCIDENTS, { variables });
  const rows = data?.incidents ?? [];

  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (typeof docId === "number") items.push({ key: "docId", label: `docId=${docId}`, onRemove: () => setDocId("") });
    if (nonEmptyTrim(type)) items.push({ key: "type", label: `type=${type.trim()}`, onRemove: () => setType("") });
    if (nonEmptyTrim(severity)) items.push({ key: "severity", label: `severity=${severity.trim()}`, onRemove: () => setSeverity("") });
    if (nonEmptyTrim(status)) items.push({ key: "status", label: `status=${status.trim()}`, onRemove: () => setStatus("") });
    if (nonEmptyTrim(country)) items.push({ key: "country", label: `country=${country.trim()}`, onRemove: () => setCountry("") });

    return items;
  }, [docId, type, severity, status, country]);

  const cols: Array<TableColumn<IncidentRow>> = [
    { key: "docId", header: "Doc", mono: true, render: (r) => r.docId },
    {
      key: "incidentId",
      header: "Incident ID",
      render: (r) => <CopyPill value={r.incidentId} />,
    },
    { key: "type", header: "Type", render: (r) => r.incidentType ?? "-" },
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
      key: "risk",
      header: "Risk",
      align: "right",
      render: (r) => (typeof r.riskScore === "number" ? fmtDec(r.riskScore, 2) : "-"),
    },
    {
      key: "cost",
      header: "Cost (EUR)",
      align: "right",
      render: (r) => (typeof r.estimatedCostEur === "number" ? fmtEur(r.estimatedCostEur) : "-"),
    },
    {
      key: "reported",
      header: "Reported",
      mono: true,
      render: (r) => (r.reportedAt ? fmtDateTime(r.reportedAt) : "-"),
    },
    {
      key: "updated",
      header: "Last update",
      mono: true,
      render: (r) => (r.lastUpdateUtc ? fmtDateTime(r.lastUpdateUtc) : "-"),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Incidentes"
        subtitle={
          <>
            Filtros por <code>docId/type/severity/status/country</code>. As tabelas fazem scroll horizontal em ecrãs pequenos.
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
                  }}
                  placeholder="ex: 12"
                  size="sm"
                />
              </div>

              <Input label="Type" value={type} onChange={(e) => setType(e.target.value)} placeholder="ex: fire" size="sm" />
              <Input label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="1..5" size="sm" />
              <Input label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="ex: open" size="sm" />
              <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="ex: PT" size="sm" />

              <div className={styles.fLimit}>
                <Input
                  label="Limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  min={10}
                  max={2000}
                  step={10}
                  size="sm"
                />
              </div>
            </div>
          }
          chips={
            chips.length > 0 ? (
              <>
                {chips.map((c) => (
                  <Chip key={c.key} strong onRemove={c.onRemove}>
                    {c.label}
                  </Chip>
                ))}
              </>
            ) : undefined
          }
          right={
            <div className={styles.actions}>
              <Button
                variant="primary"
                disabled={loading}
                onClick={() => {
                  if (typeof docId === "number" && Number.isFinite(docId)) setSearchParams({ docId: String(docId) });
                  else setSearchParams({});
                  refetch();
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
                  setSearchParams({});
                }}
              >
                Limpar
              </Button>
            </div>
          }
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
            loading ? "A carregar…" : error ? "Falha ao carregar." : `Linhas: ${fmtInt(rows.length)}`
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
            <Table columns={cols} rows={rows} rowKey={(r) => `${r.docId}:${r.incidentId}`} compact />
          )}

          <div className={styles.hint}>
            Dica: severidade é string no schema (usa “1”, “2”, … “5”). País usa códigos tipo “PT”.
          </div>
        </Card>
      </Section>
    </div>
  );
}
