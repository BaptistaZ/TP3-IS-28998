import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { Q_DOCS } from "../graphql/queries";

import { PageHeader, Section, Card, HeaderKpis, HeaderKpi } from "../components/ui/Layout";
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

type DocRow = {
  id: number;
  mapperVersion: string;
  createdAt: string;
};

type DocsData = { docs: DocRow[] };

function pickLastDoc(rows: DocRow[]): DocRow | null {
  let best: DocRow | null = null;
  for (const r of rows) {
    if (!best || r.createdAt > best.createdAt) best = r;
  }
  return best;
}

export default function Docs() {
  const navigate = useNavigate();

  const [limit, setLimit] = useState(50);
  const variables = useMemo(() => ({ limit }), [limit]);

  const { data, loading, error, refetch } = useQuery<DocsData>(Q_DOCS, {
    variables,
    fetchPolicy: "cache-and-network",
  });

  const rows = useMemo(() => data?.docs ?? [], [data?.docs]);
  const lastDoc = useMemo(() => pickLastDoc(rows), [rows]);

  const cols: Array<TableColumn<DocRow>> = [
    { key: "id", header: "Doc ID", mono: true, render: (r) => r.id },
    { key: "mapperVersion", header: "Mapper version", mono: true, render: (r) => r.mapperVersion },
    { key: "createdAt", header: "Created at", mono: true, render: (r) => fmtDateTime(r.createdAt) },
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

  return (
    <div className={styles.page}>
      <PageHeader
        title="Documentos"
        subtitle={
          <>
            Lista de documentos processados. Clica numa linha para abrir Incidentes com <code>docId</code>.
          </>
        }
      >
        <HeaderKpis>
          <HeaderKpi label="Total (neste pedido)" value={fmtInt(rows.length)} icon={<IconDocs />} />
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
        <Card title="Tabela de documentos" subtitle="Zebra + hover, com scroll horizontal em ecrãs pequenos.">
          {loading && rows.length === 0 ? (
            <Skeleton className={styles.tableSkeleton} />
          ) : rows.length === 0 ? (
            <EmptyState title="Sem documentos" text="A query devolveu zero linhas para o limit atual." />
          ) : (
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
