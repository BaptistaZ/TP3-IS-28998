import { useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert } from "../components/ui/Alert";
import { ChartTooltip } from "../components/ui/ChartTooltip";
import {
  Card,
  PageHeader,
  Section,
  StatCard,
  StatCol,
  StatGrid,
} from "../components/ui/Layout";
import { Skeleton } from "../components/ui/Skeleton";
import {
  IconEuro,
  IconGauge,
  IconGlobe,
  IconIncidents,
} from "../components/ui/Icons";
import styles from "./dashboard.module.css";

import {
  Q_AGG_BY_SEVERITY,
  Q_AGG_BY_TYPE,
  Q_INCIDENTS_SAMPLE,
} from "../graphql/queries";
import { fmtDec, fmtEur, fmtInt } from "../lib/format";

// =============================================================================
// GraphQL types (local to this page)
// =============================================================================

type AggBySeverityRow = {
  severity: string;
  totalIncidents: number;
  avgRiskScore: number | null;
};
type AggBySeverityData = { aggBySeverity: AggBySeverityRow[] };

type AggByTypeRow = {
  incidentType: string;
  totalIncidents: number;
  avgRiskScore: number | null;
  totalEstimatedCostEur: number | null;
};
type AggByTypeData = { aggByType: AggByTypeRow[] };

type IncidentSampleRow = {
  incidentId: string;
  country: string | null;
  estimatedCostEur: number | null;
  riskScore: number | null;
};
type IncidentsSampleData = { incidents: IncidentSampleRow[] };

// =============================================================================
// Recharts interop helpers
// =============================================================================

/**
 * Minimal payload shape used by our custom ChartTooltip component.
 * This keeps the code "any"-free while remaining compatible with Recharts.
 */
type RechartsPayloadItem = {
  name?: unknown;
  value?: unknown;
  color?: string;
};

/**
 * Defensive conversion of the Recharts tooltip payload into a typed array.
 * If Recharts provides something unexpected, return undefined to avoid crashes.
 */
function asTooltipPayload(payload: unknown): readonly RechartsPayloadItem[] | undefined {
  if (!Array.isArray(payload)) return undefined;
  return payload as readonly RechartsPayloadItem[];
}

/**
 * Choose a bar color based on severity value (1..5).
 * Uses CSS variables to remain consistent with the design system.
 */
function severityFill(sev: string | null | undefined): string {
  const n = Number(sev);
  if (!Number.isFinite(n)) return "var(--chart-1)";
  if (n <= 2) return "var(--danger)";
  if (n === 3) return "var(--warning)";
  if (n === 4) return "var(--info)";
  return "var(--success)";
}

/**
 * Extracts navigation filters from Recharts click event objects.
 * Recharts passes a complex event shape; we only care about the underlying datum.
 */
function asClickPayload(p: unknown): { severity?: string; type?: string } {
  if (!p || typeof p !== "object") return {};
  const rec = p as Record<string, unknown>;
  const payload = rec.payload;
  if (!payload || typeof payload !== "object") return {};
  const d = payload as Record<string, unknown>;
  return {
    severity: typeof d.severity === "string" ? d.severity : undefined,
    type: typeof d.type === "string" ? d.type : undefined,
  };
}

// =============================================================================
// Page
// =============================================================================

export default function Dashboard() {
  const navigate = useNavigate();

  // Run the page queries in parallel (Apollo will dedupe/cache where applicable).
  const severityQuery = useQuery<AggBySeverityData>(Q_AGG_BY_SEVERITY, {
    fetchPolicy: "cache-and-network",
  });
  const typeQuery = useQuery<AggByTypeData>(Q_AGG_BY_TYPE, {
    fetchPolicy: "cache-and-network",
  });
  const sampleQuery = useQuery<IncidentsSampleData>(Q_INCIDENTS_SAMPLE, {
    variables: { limit: 500 },
    fetchPolicy: "cache-and-network",
  });

  // Single loading/error state for the whole page.
  const loading = severityQuery.loading || typeQuery.loading || sampleQuery.loading;
  const error = severityQuery.error || typeQuery.error || sampleQuery.error;

  // -----------------------------
  // Chart data shaping
  // -----------------------------

  /**
   * Severity chart: keep natural order (1..5).
   * We only need `severity` and `total` for the BarChart.
   */
  const severityChartData =
    severityQuery.data?.aggBySeverity
      ?.slice()
      .sort((a, b) => Number(a.severity) - Number(b.severity))
      .map((r) => ({ severity: r.severity, total: r.totalIncidents })) ?? [];

  /**
   * Type chart: keep top 10 types by incident count (descending).
   */
  const typeChartData =
    typeQuery.data?.aggByType
      ?.slice()
      .sort((a, b) => b.totalIncidents - a.totalIncidents)
      .slice(0, 10)
      .map((r) => ({ type: r.incidentType, total: r.totalIncidents })) ?? [];

  // -----------------------------
  // KPI calculations (sample-based)
  // -----------------------------

  const incidents = sampleQuery.data?.incidents ?? [];
  const totalIncidents = incidents.length;

  const totalCostEur = incidents.reduce((acc, it) => acc + (it.estimatedCostEur ?? 0), 0);
  const avgCostEur = totalIncidents > 0 ? totalCostEur / totalIncidents : 0;

  // Filter out nulls so the average is computed only on valid values.
  const riskValues = incidents
    .map((it) => it.riskScore)
    .filter((v): v is number => typeof v === "number");

  const avgRisk =
    riskValues.length > 0 ? riskValues.reduce((a, b) => a + b, 0) / riskValues.length : 0;

  const distinctCountries = new Set(
    incidents.map((it) => it.country).filter((c): c is string => !!c)
  ).size;

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <div className={styles.page}>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            KPIs e agregações do BI. KPIs calculados a partir de{" "}
            <code>incidents(limit=500)</code>.
          </>
        }
      />

      {error && (
        <Alert variant="danger" title="Erro GraphQL">
          {error.message}
        </Alert>
      )}

      <Section>
        <StatGrid>
          <StatCol span={6}>
            <StatCard
              label="Incidentes (amostra)"
              value={fmtInt(totalIncidents)}
              emphasis
              icon={<IconIncidents />}
            />
          </StatCol>

          <StatCol span={6}>
            <StatCard
              label="Custo total (EUR)"
              value={fmtEur(totalCostEur)}
              emphasis
              icon={<IconEuro />}
            />
          </StatCol>

          <StatCol span={4}>
            <StatCard label="Custo médio (EUR)" value={fmtEur(avgCostEur)} icon={<IconEuro />} />
          </StatCol>

          <StatCol span={4}>
            <StatCard label="Risco médio" value={fmtDec(avgRisk, 2)} icon={<IconGauge />} />
          </StatCol>

          <StatCol span={4}>
            <StatCard
              label="Países distintos"
              value={fmtInt(distinctCountries)}
              icon={<IconGlobe />}
            />
          </StatCol>
        </StatGrid>
      </Section>

      <Section>
        <div className={styles.chartsGrid}>
          <Card
            title="Incidentes por severidade"
            subtitle={
              <>
                Fonte: <code>aggBySeverity</code>. Clica numa barra para abrir Incidentes filtrado por
                severidade.
              </>
            }
          >
            {loading ? (
              <Skeleton className={styles.chartSkeleton} />
            ) : (
              <div className={styles.chartBox}>
                <ResponsiveContainer>
                  <BarChart data={severityChartData}>
                    <CartesianGrid
                      stroke="var(--chart-grid)"
                      strokeDasharray="4 4"
                      vertical={false}
                    />
                    <XAxis dataKey="severity" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip
                      content={(p) => (
                        <ChartTooltip
                          active={p.active}
                          payload={asTooltipPayload(p.payload)}
                          label={p.label}
                          title="Severidade"
                        />
                      )}
                    />
                    <Bar
                      dataKey="total"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(p) => {
                        const d = asClickPayload(p);
                        if (!d.severity) return;
                        navigate(`/incidents?severity=${encodeURIComponent(d.severity)}`);
                      }}
                    >
                      {severityChartData.map((r, idx) => (
                        <Cell key={`${r.severity}:${idx}`} fill={severityFill(r.severity)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card
            title="Incidentes por tipo (Top 10)"
            subtitle={
              <>
                Fonte: <code>aggByType</code>. Clica numa barra para abrir Incidentes filtrado por tipo.
              </>
            }
          >
            {loading ? (
              <Skeleton className={styles.chartSkeletonTall} />
            ) : (
              <div className={styles.chartBoxTall}>
                <ResponsiveContainer>
                  <BarChart data={typeChartData} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid
                      stroke="var(--chart-grid)"
                      strokeDasharray="4 4"
                      horizontal={false}
                    />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="type"
                      type="category"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(p) => (
                        <ChartTooltip
                          active={p.active}
                          payload={asTooltipPayload(p.payload)}
                          label={p.label}
                          title="Tipo"
                        />
                      )}
                    />
                    <Bar
                      dataKey="total"
                      radius={[0, 6, 6, 0]}
                      fill="var(--chart-1)"
                      cursor="pointer"
                      onClick={(p) => {
                        const d = asClickPayload(p);
                        if (!d.type) return;
                        navigate(`/incidents?type=${encodeURIComponent(d.type)}`);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </Section>
    </div>
  );
}