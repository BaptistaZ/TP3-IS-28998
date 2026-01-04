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

export async function insertXmlDocument({ xml, mapperVersion, requestId }) {
  const table = process.env.DB_TABLE || "tp3_incidents_xml";
  const p = getPool();

  const q = `
    INSERT INTO ${table} (xml_documento, data_criacao, mapper_version, request_id)
    VALUES ($1::xml, NOW(), $2, $3)
    RETURNING id
  `;

  const r = await p.query(q, [xml, mapperVersion, requestId]);
  return r.rows[0].id;
}