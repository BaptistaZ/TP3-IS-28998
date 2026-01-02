import pg from "pg";
const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
  }
  return pool;
}

const TABLE = process.env.DB_TABLE || "tp3_documentos_xml";

export async function listDocs(limit = 10) {
  const p = getPool();
  const q = `
    SELECT id, mapper_version, data_criacao
    FROM ${TABLE}
    ORDER BY id DESC
    LIMIT $1;
  `;
  const r = await p.query(q, [limit]);
  return r.rows;
}

export async function queryAtivos({ ticker, category, limit = 50 }) {
  const p = getPool();

  const params = [];
  const where = [];

  if (ticker) {
    params.push(ticker);
    where.push(`x.ticker = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`x.tipo = $${params.length}`);
  }

  params.push(limit);

  const q = `
    SELECT
      d.id as doc_id,
      x.id_interno,
      x.ticker,
      x.tipo,
      x.preco_eur,
      x.preco_usd,
      x.volume,
      x.taxa_eurusd,
      x.processado_utc
    FROM ${TABLE} d
    JOIN LATERAL xmltable(
      '/RelatorioConformidade/Ativos/Ativo'
      PASSING d.xml_documento
      COLUMNS
        id_interno   text    PATH '@IDInterno',
        ticker       text    PATH '@Ticker',
        tipo         text    PATH '@Tipo',
        preco_eur    numeric PATH 'DetalheNegociacao/PrecoAtual/text()',
        preco_usd    numeric PATH 'DetalheNegociacao/PrecoUSD/text()',
        volume       numeric PATH 'DetalheNegociacao/Volume/text()',
        taxa_eurusd  numeric PATH 'EnriquecimentoFX/TaxaEURUSD/text()',
        processado_utc text   PATH 'EnriquecimentoFX/ProcessadoEmUTC/text()'
    ) x ON true
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY d.id DESC
    LIMIT $${params.length};
  `;

  const r = await p.query(q, params);
  return r.rows;
}

export async function aggByCategory() {
  const p = getPool();

  const q = `
    SELECT
      x.tipo as category,
      COUNT(*) as total_ativos,
      SUM(x.volume) as total_volume,
      AVG(x.preco_eur) as avg_preco_eur,
      AVG(x.preco_usd) as avg_preco_usd
    FROM ${TABLE} d
    JOIN LATERAL xmltable(
      '/RelatorioConformidade/Ativos/Ativo'
      PASSING d.xml_documento
      COLUMNS
        tipo     text    PATH '@Tipo',
        volume   numeric PATH 'DetalheNegociacao/Volume/text()',
        preco_eur numeric PATH 'DetalheNegociacao/PrecoAtual/text()',
        preco_usd numeric PATH 'DetalheNegociacao/PrecoUSD/text()'
    ) x ON true
    GROUP BY x.tipo
    ORDER BY total_volume DESC NULLS LAST;
  `;

  const r = await p.query(q);
  return r.rows;
}