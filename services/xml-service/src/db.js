import pg from "pg";

const { Pool } = pg;

let pool; // Cached Pool instance (singleton per process)

/**
 * Get (or create) a cached pg.Pool instance.
 *
 * The pool is lazily created the first time it is needed. This avoids doing DB work
 * at import time and keeps startup predictable.
 *
 * @returns {pg.Pool}
 */
function getPool() {
  if (pool) return pool;

  const cfg = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  // Avoid logging secrets; only log connection "shape" for troubleshooting.
  console.log("[DB CFG]", cfg.host, cfg.port, cfg.database, cfg.user);

  pool = new Pool(cfg);
  return pool;
}

/**
 * Insert a generated XML document into the configured table.
 *
 * Expected table columns (at minimum):
 * - xml_documento (XML)
 * - data_criacao (timestamp)
 * - mapper_version (text)
 * - request_id (text)
 * - mapper_json (jsonb)   [optional but supported here]
 *
 * @param {Object} params
 * @param {string} params.xml - XML payload to persist (will be cast to ::xml).
 * @param {string} params.mapperVersion - Mapping version used to generate the XML.
 * @param {string} params.requestId - Correlation ID used across the pipeline.
 * @param {Object|string|null} [params.mapperJson] - Mapper definition stored as jsonb (optional).
 * @returns {Promise<number>} Inserted row ID.
 */
export async function insertXmlDocument({
  xml,
  mapperVersion,
  requestId,
  mapperJson,
}) {
  const table = process.env.DB_TABLE || "tp3_incidents_xml";
  const p = getPool();

  const q = `
    INSERT INTO ${table} (xml_documento, data_criacao, mapper_version, request_id, mapper_json)
    VALUES ($1::xml, NOW(), $2, $3, $4::jsonb)
    RETURNING id
  `;

  const r = await p.query(q, [
    xml,
    mapperVersion,
    requestId,
    mapperJson || null,
  ]);
  return r.rows[0].id;
}

/**
 * Check if a string contains a well-formed XML document.
 *
 * Primary strategy:
 * - xml_is_well_formed_document(text) -> boolean
 *
 * Fallback strategy:
 * - Force parsing via xmlparse(document ...) which throws if invalid.
 *
 * @param {string} xml - XML string payload.
 * @returns {Promise<boolean>} True if the XML is well-formed, otherwise false.
 */
export async function isXmlWellFormed(xml) {
  const p = getPool();

  try {
    const r = await p.query("SELECT xml_is_well_formed_document($1) AS ok", [
      xml,
    ]);
    return r.rows?.[0]?.ok === true;
  } catch (_e1) {
    // Fallback: parse the document; invalid XML triggers an error.
    try {
      await p.query("SELECT xmlparse(document $1::text) AS x", [xml]);
      return true;
    } catch (_e2) {
      return false;
    }
  }
}
