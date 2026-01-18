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

const TABLE = process.env.DB_TABLE || "tp3_incidents_xml";

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

function cleanStr(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/**
 * Query incidents by optional filters
 * Reads from XML stored in Postgres using xmltable()
 */
export async function queryIncidents({
  docId,
  type,
  severity,
  status,
  country,
  limit = 50,
  offset = 0,
}) {
  const p = getPool();

  const params = [];
  // Base filter to avoid empty / broken rows
  const where = ["NULLIF(x.incident_id, '') IS NOT NULL"];

  const docIdNum =
    docId != null && Number.isFinite(Number(docId))
      ? Math.trunc(Number(docId))
      : null;

  const typeS = cleanStr(type);
  const severityS = cleanStr(severity);
  const statusS = cleanStr(status);
  const countryS = cleanStr(country);

  // Se não vier docId, por defeito só lê o documento mais recente.
  if (docIdNum == null) {
    where.push(`d.id = (SELECT MAX(id) FROM ${TABLE})`);
  }

  if (docIdNum != null) {
    params.push(docIdNum);
    where.push(`d.id = $${params.length}`);
  }
  if (typeS) {
    params.push(typeS);
    where.push(`x.incident_type = $${params.length}`);
  }
  if (severityS) {
    params.push(severityS);
    where.push(`x.severity = $${params.length}`);
  }
  if (statusS) {
    params.push(statusS);
    where.push(`x.status = $${params.length}`);
  }
  if (countryS) {
    params.push(countryS);
    where.push(`x.country = $${params.length}`);
  }

  const lim = Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 50;
  const off = Number.isFinite(Number(offset))
    ? Math.max(0, Math.trunc(Number(offset)))
    : 0;
  params.push(lim);
  params.push(off);

  const q = `
    SELECT
      d.id as doc_id,
      x.incident_id,
      x.source,
      x.incident_type,
      x.severity,
      x.status,
      x.city,
      x.country,
      x.continent,

      NULLIF(x.lat_txt, '')::numeric as lat,
      NULLIF(x.lon_txt, '')::numeric as lon,
      NULLIF(x.accuracy_m_txt, '')::numeric as accuracy_m,

      x.reported_at,
      x.validated_at,
      x.resolved_at,
      x.last_update_utc,
      x.assigned_unit,

      NULLIF(x.resources_count_txt, '')::numeric as resources_count,
      NULLIF(x.eta_min_txt, '')::numeric as eta_min,
      NULLIF(x.response_time_min_txt, '')::numeric as response_time_min,
      NULLIF(x.estimated_cost_eur_txt, '')::numeric as estimated_cost_eur,
      NULLIF(x.risk_score_txt, '')::numeric as risk_score,

      x.notes

    FROM ${TABLE} d
    JOIN LATERAL xmltable(
      '/IncidentReport/Incidents/Incident'
      PASSING d.xml_documento
      COLUMNS
        incident_id            text PATH '@IncidentId',
        source                 text PATH '@Source',
        incident_type          text PATH '@Type',
        severity               text PATH '@Severity',
        status                 text PATH '@Status',

        city                   text PATH 'Location/@City',
        country                text PATH 'Location/@Country',
        continent              text PATH 'Location/@Continent',

        accuracy_m_txt         text PATH 'Location/@AccuracyMeters',
        lat_txt                text PATH 'Location/Coordinates/@Lat',
        lon_txt                text PATH 'Location/Coordinates/@Lon',

        reported_at            text PATH 'Timeline/ReportedAt/text()',
        validated_at           text PATH 'Timeline/ValidatedAt/text()',
        resolved_at            text PATH 'Timeline/ResolvedAt/text()',
        last_update_utc        text PATH 'Timeline/LastUpdateUTC/text()',

        assigned_unit          text PATH 'Response/AssignedUnit/text()',
        resources_count_txt    text PATH 'Response/ResourcesCount/text()',
        eta_min_txt            text PATH 'Response/EtaMinutes/text()',
        response_time_min_txt  text PATH 'Response/ResponseTimeMinutes/text()',

        estimated_cost_eur_txt text PATH 'FinancialImpact/EstimatedCost[@currency="EUR"]/text()',
        risk_score_txt         text PATH 'Assessment/RiskScore/text()',

        notes                  text PATH 'Meta/Notes/text()'
    ) x ON true
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY d.id DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length};
  `;

  const r = await p.query(q, params);
  return r.rows;
}

/**
 * Aggregation by incident type
 */
export async function aggByType() {
  const p = getPool();

  const q = `
    SELECT
      x.incident_type as incident_type,
      COUNT(*) as total_incidents,
      AVG(NULLIF(x.risk_score_txt, '')::numeric) as avg_risk_score,
      SUM(NULLIF(x.estimated_cost_eur_txt, '')::numeric) as total_estimated_cost_eur
    FROM ${TABLE} d
    JOIN LATERAL xmltable(
      '/IncidentReport/Incidents/Incident'
      PASSING d.xml_documento
      COLUMNS
        incident_type           text PATH '@Type',
        risk_score_txt          text PATH 'Assessment/RiskScore/text()',
        estimated_cost_eur_txt  text PATH 'FinancialImpact/EstimatedCost[@currency="EUR"]/text()'
    ) x ON true
    WHERE d.id = (SELECT MAX(id) FROM ${TABLE})
      AND NULLIF(x.incident_type, '') IS NOT NULL
    GROUP BY x.incident_type
    ORDER BY total_estimated_cost_eur DESC NULLS LAST;
  `;

  const r = await p.query(q);
  return r.rows;
}

/**
 * Aggregation by severity
 */
export async function aggBySeverity() {
  const p = getPool();

  const q = `
    SELECT
      x.severity as severity,
      COUNT(*) as total_incidents,
      AVG(NULLIF(x.risk_score_txt, '')::numeric) as avg_risk_score
    FROM ${TABLE} d
    JOIN LATERAL xmltable(
      '/IncidentReport/Incidents/Incident'
      PASSING d.xml_documento
      COLUMNS
        severity       text PATH '@Severity',
        risk_score_txt text PATH 'Assessment/RiskScore/text()'
    ) x ON true
    WHERE d.id = (SELECT MAX(id) FROM ${TABLE})
      AND NULLIF(x.severity, '') IS NOT NULL
    GROUP BY x.severity
    ORDER BY total_incidents DESC;
  `;

  const r = await p.query(q);
  return r.rows;
}
