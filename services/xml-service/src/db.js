import pg from "pg";
const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    const cfg = {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

    console.log("[DB CFG]", cfg.host, cfg.port, cfg.database, cfg.user);

    pool = new Pool(cfg);
  }
  return pool;
}

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

export async function isXmlWellFormed(xml) {
  const p = getPool();

  // 1) caminho preferido: função booleana
  try {
    const r = await p.query("SELECT xml_is_well_formed_document($1) AS ok", [
      xml,
    ]);
    return r.rows?.[0]?.ok === true;
  } catch (e) {
    // 2) fallback: forçar parse (lança erro se inválido)
    try {
      await p.query("SELECT xmlparse(document $1::text) AS x", [xml]);
      return true;
    } catch (_e2) {
      return false;
    }
  }
}
