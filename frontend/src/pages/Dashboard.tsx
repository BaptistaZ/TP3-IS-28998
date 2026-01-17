import { useQuery } from "@apollo/client/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Q_AGG_BY_SEVERITY,
  Q_AGG_BY_TYPE,
  Q_INCIDENTS_SAMPLE,
} from "../graphql/queries";

type AggBySeverityRow = {
  severity: string;
  totalIncidents: number;
  avgRiskScore: number | null;
};

type AggBySeverityData = {
  aggBySeverity: AggBySeverityRow[];
};

type AggByTypeRow = {
  incidentType: string;
  totalIncidents: number;
  avgRiskScore: number | null;
  totalEstimatedCostEur: number | null;
};

type AggByTypeData = {
  aggByType: AggByTypeRow[];
};

type IncidentSampleRow = {
  incidentId: string;
  country: string | null;
  estimatedCostEur: number | null;
  riskScore: number | null;
};

type IncidentsSampleData = {
  incidents: IncidentSampleRow[];
};

export default function Dashboard() {
  const severityQuery = useQuery<AggBySeverityData>(Q_AGG_BY_SEVERITY);
  const typeQuery = useQuery<AggByTypeData>(Q_AGG_BY_TYPE);

  const sampleQuery = useQuery<IncidentsSampleData>(Q_INCIDENTS_SAMPLE, {
    variables: { limit: 500 },
  });

  const loading = severityQuery.loading || typeQuery.loading || sampleQuery.loading;
  const error = severityQuery.error || typeQuery.error || sampleQuery.error;

  const severityChartData =
    severityQuery.data?.aggBySeverity
      ?.slice()
      .sort((a, b) => Number(a.severity) - Number(b.severity))
      .map((r) => ({
        severity: r.severity,
        total: r.totalIncidents,
        avgRisk: r.avgRiskScore ?? 0,
      })) ?? [];

  const typeChartData =
    typeQuery.data?.aggByType
      ?.slice()
      .sort((a, b) => b.totalIncidents - a.totalIncidents)
      .slice(0, 10)
      .map((r) => ({
        type: r.incidentType,
        total: r.totalIncidents,
      })) ?? [];

  const incidents = sampleQuery.data?.incidents ?? [];

  const totalIncidents = incidents.length;

  const totalCostEur = incidents.reduce(
    (acc, it) => acc + (it.estimatedCostEur ?? 0),
    0
  );

  const avgCostEur = totalIncidents > 0 ? totalCostEur / totalIncidents : 0;

  const riskValues = incidents
    .map((it) => it.riskScore)
    .filter((v): v is number => typeof v === "number");

  const avgRisk =
    riskValues.length > 0
      ? riskValues.reduce((a, b) => a + b, 0) / riskValues.length
      : 0;

  const countries = new Set(
    incidents.map((it) => it.country).filter((c): c is string => !!c)
  );
  const distinctCountries = countries.size;

  const fmtInt = (n: number) => n.toLocaleString("pt-PT");
  const fmtEur = (n: number) =>
    n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const fmtDec2 = (n: number) =>
    n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

  return (
    <div style={{ padding: 16 }}>
      <h1>Dashboard</h1>

      {loading && <p>A carregar dados do BI...</p>}

      {error && (
        <div>
          <p style={{ color: "salmon" }}>Erro GraphQL: {error.message}</p>
        </div>
      )}

      {!loading && !error && (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, minWidth: 220 }}>
              <div style={{ opacity: 0.8 }}>Incidentes (amostra)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtInt(totalIncidents)}</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, minWidth: 220 }}>
              <div style={{ opacity: 0.8 }}>Custo total (EUR)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtEur(totalCostEur)}</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, minWidth: 220 }}>
              <div style={{ opacity: 0.8 }}>Custo médio (EUR)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtEur(avgCostEur)}</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, minWidth: 220 }}>
              <div style={{ opacity: 0.8 }}>Risco médio</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtDec2(avgRisk)}</div>
            </div>

            <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8, minWidth: 220 }}>
              <div style={{ opacity: 0.8 }}>Países distintos</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtInt(distinctCountries)}</div>
            </div>
          </div>

          <p style={{ opacity: 0.7, marginTop: -8 }}>
            KPIs calculados a partir de <code>incidents(limit=500)</code>.
          </p>

          <h2>Incidentes por severidade</h2>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={severityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p style={{ opacity: 0.8 }}>
            Nota: valores vêm diretamente de <code>aggBySeverity</code> (BI Service).
          </p>

          <h2 style={{ marginTop: 32 }}>Incidentes por tipo (Top 10)</h2>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={typeChartData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p style={{ opacity: 0.8 }}>
            Nota: valores vêm diretamente de <code>aggByType</code> (BI Service).
          </p>
        </div>
      )}
    </div>
  );
}
