import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useSearchParams } from "react-router-dom";
import { Q_INCIDENTS } from "../graphql/queries";

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

type IncidentsData = {
  incidents: IncidentRow[];
};

function cleanStr(v: string) {
  const t = v.trim();
  return t.length === 0 ? undefined : t;
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
      type: cleanStr(type),
      severity: cleanStr(severity),
      status: cleanStr(status),
      country: cleanStr(country),
      limit,
    }),
    [docId, type, severity, status, country, limit]
  );

  const { data, loading, error, refetch } = useQuery<IncidentsData>(Q_INCIDENTS, {
    variables,
  });

  const rows = data?.incidents ?? [];

  const fmtEur = (n: number) =>
    n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

  const fmtDec2 = (n: number) =>
    n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

  const fmtDec1 = (n: number) =>
    n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });

  return (
    <div style={{ padding: 16 }}>
      <h1>Incidentes</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>DocId</div>
          <input
            type="number"
            value={docId}
            onChange={(e) => {
              const v = e.target.value;
              setDocId(v === "" ? "" : Number(v));
            }}
            placeholder="ex: 12"
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              width: 110,
            }}
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Type</div>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="ex: fire"
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
            }}
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Severity</div>
          <input
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            placeholder="1..5"
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              width: 90,
            }}
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Status</div>
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="ex: open"
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
            }}
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Country</div>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="ex: PT"
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              width: 110,
            }}
          />
        </div>

        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Limit</div>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min={10}
            max={2000}
            step={10}
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              width: 110,
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
          <button
            onClick={() => {
              if (typeof docId === "number" && Number.isFinite(docId)) {
                setSearchParams({ docId: String(docId) });
              } else {
                setSearchParams({});
              }
              refetch();
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Aplicar
          </button>

          <button
            onClick={() => {
              setDocId("");
              setType("");
              setSeverity("");
              setStatus("");
              setCountry("");
              setLimit(100);
              setSearchParams({});
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      {loading && <p>A carregar incidentes...</p>}

      {error && (
        <div>
          <p style={{ color: "salmon" }}>Erro GraphQL: {error.message}</p>
        </div>
      )}

      {!loading && !error && (
        <div>
          <p style={{ opacity: 0.8 }}>Resultados: {rows.length}</p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Doc",
                    "IncidentId",
                    "Type",
                    "Severity",
                    "Status",
                    "Country",
                    "City",
                    "Risk",
                    "Cost (EUR)",
                    "Reported",
                    "Last update",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 8px",
                        borderBottom: "1px solid #333",
                        opacity: 0.85,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.docId}:${r.incidentId}`}>
                    <td
                      style={{
                        padding: "10px 8px",
                        borderBottom: "1px solid #222",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.docId}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        borderBottom: "1px solid #222",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.incidentId}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {r.incidentType ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {r.severity ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {r.status ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {r.country ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {r.city ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {typeof r.riskScore === "number" ? fmtDec2(r.riskScore) : "-"}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222" }}>
                      {typeof r.estimatedCostEur === "number" ? fmtEur(r.estimatedCostEur) : "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        borderBottom: "1px solid #222",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.reportedAt ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        borderBottom: "1px solid #222",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.lastUpdateUtc ?? "-"}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 12, opacity: 0.8 }}>
                      Sem resultados para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ opacity: 0.7, marginTop: 10 }}>
            Dica: a severidade é string no schema. Usa “1”, “2”, … “5”. País usa códigos tipo “PT”.
          </p>

          <details style={{ marginTop: 12, opacity: 0.85 }}>
            <summary style={{ cursor: "pointer" }}>Ver campos operacionais (debug rápido)</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {rows.slice(0, 1).map((r) => (
                <pre
                  key={r.incidentId}
                  style={{
                    padding: 12,
                    border: "1px solid #333",
                    borderRadius: 8,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(
                    {
                      source: r.source,
                      continent: r.continent,
                      coords:
                        r.lat != null && r.lon != null
                          ? `${fmtDec1(r.lat)}, ${fmtDec1(r.lon)}`
                          : null,
                      validatedAt: r.validatedAt,
                      resolvedAt: r.resolvedAt,
                      assignedUnit: r.assignedUnit,
                      resourcesCount: r.resourcesCount,
                      etaMin: r.etaMin,
                      responseTimeMin: r.responseTimeMin,
                    },
                    null,
                    2
                  )}
                </pre>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
