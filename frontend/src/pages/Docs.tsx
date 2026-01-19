import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { Q_DOCS } from "../graphql/queries";

import {
  Card,
  HeaderKpi,
  HeaderKpis,
  PageHeader,
  Section,
} from "../components/ui/Layout";
import { Toolbar } from "../components/ui/Toolbar";
import { Input } from "../components/ui/Input";
import { Button, LinkButton } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Table, type TableColumn } from "../components/ui/Table";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { IconClock, IconDocs } from "../components/ui/Icons";
import styles from "./docs.module.css";
import { fmtDateTime, fmtInt } from "../lib/format";

// =============================================================================
// Local types (GraphQL payload shape)
// =============================================================================

type DocRow = {
  id: number;
  mapperVersion: string;
  createdAt: string;
};

type DocsData = { docs: DocRow[] };

// =============================================================================
// Local helpers
// =============================================================================

/**
 * Picks the "latest" doc from a set of rows.
 * Assumes createdAt is an ISO string, so lexicographic compare matches time order.
 */
function pickLastDoc(rows: DocRow[]): DocRow | null {
  let best: DocRow | null = null;
  for (const r of rows) {
    if (!best || r.createdAt > best.createdAt) best = r;
  }
  return best;
}

// =============================================================================
// Page
// =============================================================================

export default function Docs() {
  const navigate = useNavigate();

  // Limit is a UI state -> becomes a GraphQL variable.
  const [limit, setLimit] = useState(50);

  /**
   * Memoize variables so Apollo doesn't see a new object every render.
   * This avoids unnecessary refetches.
   */
  const variables = useMemo(() => ({ limit }), [limit]);

  /**
   * Fetch docs list via GraphQL.
   * cache-and-network: show cached (if any), then refresh in background.
   */
  const { data, loading, error, refetch } = useQuery<DocsData>(Q_DOCS, {
    variables,
    fetchPolicy: "cache-and-network",
  });

  /**
   * Normalize the docs rows to a stable array.
   * Avoids repeating "data?.docs ?? []" across the render.
   */
  const rows = useMemo(() => data?.docs ?? [], [data?.docs]);

  /**
   * Compute the "last processed" doc for the header KPI.
   */
  const lastDoc = useMemo(() => pickLastDoc(rows), [rows]);

  // -----------------------------
  // Table config
  // -----------------------------

  /**
   * Table columns definition:
   * - mono: fixed-width typeface for ids/versions/timestamps
   * - actions: deep-link to incidents filtered by docId
   */
  const cols: Array<TableColumn<DocRow>> = [
    { key: "id", header: "Doc ID", mono: true, render: (r) => r.id },
    {
      key: "mapperVersion",
      header: "Mapper version",
      mono: true,
      render: (r) => r.mapperVersion,
    },
    {
      key: "createdAt",
      header: "Created at",
      mono: true,
      render: (r) => fmtDateTime(r.createdAt),
    },
    {
      key: "actions",
      header: "Ações",
      render: (r) => (
        <LinkButton
          to={`/incidents?docId=${encodeURIComponent(String(r.id))}`}
          size="sm"
          variant="primary"
        >
          Ver incidentes
        </LinkButton>
      ),
    },
  ];

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <div className={styles.page}>
      <PageHeader
        title="Documentos"
        subtitle={
          <>
            Lista de documentos processados. Clica numa linha para abrir Incidentes com{" "}
            <code>docId</code>.
          </>
        }
      >
        <HeaderKpis>
          <HeaderKpi
            label="Total (neste pedido)"
            value={fmtInt(rows.length)}
            icon={<IconDocs />}
          />
          <HeaderKpi
            label="Último processado"
            value={
              lastDoc ? (
                <>
                  #{lastDoc.id} · {fmtDateTime(lastDoc.createdAt)}
                </>
              ) : (
                "-"
              )
            }
            icon={<IconClock />}
          />
        </HeaderKpis>
      </PageHeader>

      <Section>
        <Toolbar
          left={
            <div className={styles.toolbarLeft}>
              <div className={styles.limitBox}>
                <Input
                  label="Limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  min={1}
                  max={5000}
                  step={10}
                  size="sm"
                />
              </div>

              <div className={styles.resultsMeta} title="Número de linhas recebidas">
                <span className={styles.resultsLabel}>Linhas</span>
                <span className={styles.resultsValue}>{fmtInt(rows.length)}</span>
              </div>
            </div>
          }
          right={
            <Button onClick={() => refetch()} disabled={loading} variant="primary">
              {loading ? "A carregar..." : "Carregar"}
            </Button>
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
          title="Tabela de documentos"
          subtitle="Zebra + hover, com scroll horizontal em ecrãs pequenos."
        >
          {/* 1) loading inicial sem dados -> skeleton */}
          {loading && rows.length === 0 ? (
            <Skeleton className={styles.tableSkeleton} />
          ) : /* 2) sem dados -> empty state */ rows.length === 0 ? (
            <EmptyState
              title="Sem documentos"
              text="A query devolveu zero linhas para o limit atual."
            />
          ) : (
            /* 3) dados -> tabela com click nas linhas */
            <Table
              columns={cols}
              rows={rows}
              rowKey={(r) => String(r.id)}
              compact
              onRowClick={(r) => navigate(`/incidents?docId=${encodeURIComponent(String(r.id))}`)}
              rowAriaLabel={(r) => `Abrir incidentes do docId ${r.id}`}
              empty={<EmptyState title="Sem documentos" />}
            />
          )}
        </Card>
      </Section>
    </div>
  );
}