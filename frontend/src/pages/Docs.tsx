import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Link } from "react-router-dom";
import { Q_DOCS } from "../graphql/queries";

type DocRow = {
  id: number;
  mapperVersion: string;
  createdAt: string;
};

type DocsData = {
  docs: DocRow[];
};

export default function Docs() {
  const [limit, setLimit] = useState(50);

  const variables = useMemo(() => ({ limit }), [limit]);

  const { data, loading, error, refetch } = useQuery<DocsData>(Q_DOCS, {
    variables,
  });

  const rows = data?.docs ?? [];

  return (
    <div style={{ padding: 16 }}>
      <h1>Documentos</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Limit</div>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min={1}
            max={5000}
            step={10}
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #333",
              background: "transparent",
              width: 120,
            }}
          />
        </div>

        <button
          onClick={() => refetch()}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #333",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Carregar
        </button>
      </div>

      {loading && <p>A carregar documentos...</p>}

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
                  {["Doc ID", "Mapper version", "Created at", "Ações"].map((h) => (
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
                  <tr key={r.id}>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>
                      {r.id}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>
                      {r.mapperVersion}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>
                      {r.createdAt}
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>
                      {/* Vai funcionar totalmente depois de adicionarmos docId ao query incidents no BI */}
                      <Link to={`/incidents?docId=${encodeURIComponent(String(r.id))}`} style={{ opacity: 0.9 }}>
                        Ver incidentes deste doc
                      </Link>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 12, opacity: 0.8 }}>
                      Sem documentos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ opacity: 0.7, marginTop: 10 }}>
            Nota: o link “Ver incidentes deste doc” fica 100% funcional quando o BI aceitar o argumento opcional{" "}
            <code>docId</code> na query <code>incidents</code>.
          </p>
        </div>
      )}
    </div>
  );
}
