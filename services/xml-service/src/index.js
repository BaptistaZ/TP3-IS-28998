import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import path from "path";
import { validateXmlWithXsd } from "./xsdValidate.js";

import {
  listDocs,
  queryIncidents,
  aggByType,
  aggBySeverity,
} from "./queries.js";
import { insertXmlDocument, isXmlWellFormed } from "./db.js";
import { IngestSchema, parseMappedCsv, buildXml } from "./xml.js";

/* Load environment variables from .env file */
dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });

console.log("[ENV CHECK]", {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  XML_SERVICE_PORT: process.env.XML_SERVICE_PORT,
  DEBUG_VALIDATION: process.env.DEBUG_VALIDATION || "0",
  SAVE_XML_FILES: process.env.SAVE_XML_FILES || "0",
});

const app = express();

/* Upload configuration */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 MB
});

/* =============================================================================
 * Helpers
 * =============================================================================
 */

/**
 * Persist a generated XML document to disk (debug/development only).
 *
 * The output directory is inside the container working directory and can be mounted
 * via Docker volumes if needed.
 *
 * @param {Object} params
 * @param {string} params.xml
 * @param {string} params.requestId
 * @param {number} params.docId
 */
function saveXmlToFile({ xml, requestId, docId }) {
  const baseDir = path.resolve("generated-xml");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Sanitize requestId for filesystem usage.
  const safeRequestId = String(requestId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `incident_${docId}_${safeRequestId}.xml`;
  const filepath = path.join(baseDir, filename);

  fs.writeFileSync(filepath, xml, "utf-8");
  console.log(`[XML Service] XML written to ${filepath}`);
}

/**
 * Post a webhook payload best-effort.
 * This must never throw to the caller; ingestion should not fail due to webhook errors.
 *
 * @param {string} webhookUrl
 * @param {Object} payload
 */
async function postWebhookSafe(webhookUrl, payload) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, payload);
  } catch (err) {
    console.warn("[Webhook] failed:", err?.message || err);
  }
}

/**
 * Build and send an error response payload (and notify webhook best-effort).
 *
 * @param {Object} params
 * @param {import("express").Response} params.res
 * @param {string|null|undefined} params.requestId
 * @param {string} params.webhookUrl
 * @param {number} params.httpStatus
 * @param {string} params.status
 * @param {string} params.error
 * @param {number|null} [params.docId]
 */
async function respondFailure({
  res,
  requestId,
  webhookUrl,
  httpStatus,
  status,
  error,
  docId = null,
}) {
  const payload = {
    request_id: requestId || "unknown",
    status,
    db_document_id: docId,
    error,
  };

  await postWebhookSafe(webhookUrl, payload);
  return res.status(httpStatus).json(payload);
}

/* =============================================================================
 * Routes: health + queries
 * =============================================================================
 */

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "xml-service" }),
);

app.get("/docs", async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const docs = await listDocs(limit);
  res.json({ ok: true, docs });
});

app.get("/query/incidents", async (req, res) => {
  const rawDocId = req.query.docId;

  let docId = null;
  if (rawDocId !== undefined) {
    const n = Number(rawDocId);
    if (!Number.isFinite(n)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid docId (must be a number)",
      });
    }
    docId = n;
  }

  const type = req.query.type?.toString();
  const severity = req.query.severity?.toString();
  const status = req.query.status?.toString();
  const country = req.query.country?.toString();
  const limit = Number(req.query.limit || 50);
  const offset = Number(req.query.offset || 0);

  const rows = await queryIncidents({
    docId,
    type,
    severity,
    status,
    country,
    limit,
    offset,
  });

  res.json({ ok: true, count: rows.length, rows });
});

app.get("/query/agg/type", async (_req, res) => {
  const rows = await aggByType();
  res.json({ ok: true, rows });
});

app.get("/query/agg/severity", async (_req, res) => {
  const rows = await aggBySeverity();
  res.json({ ok: true, rows });
});

/* =============================================================================
 * Ingest mapped CSV, build XML, validate, persist, respond + webhook notify.
 * =============================================================================
 */
app.post("/ingest", upload.single("mapped_csv"), async (req, res) => {
  const requestId = req.body?.request_id;
  const mapperVersion = req.body?.mapper_version;
  const webhookUrl = req.body?.webhook_url;
  const mapperJsonRaw = req.body?.mapper_json;

  // Validate required fields with a schema validator (keeps errors consistent).
  try {
    IngestSchema.parse({
      request_id: requestId,
      mapper_version: mapperVersion,
      webhook_url: webhookUrl,
    });
  } catch (e) {
    const msg = e?.message || "Invalid request fields";
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 400,
      status: "ERRO_VALIDACAO",
      error: msg,
    });
  }

  if (!req.file) {
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 400,
      status: "ERRO_VALIDACAO",
      error:
        "Missing mapped_csv file (multipart field name must be 'mapped_csv')",
    });
  }

  // Parse optional mapper_json (stored in DB as jsonb for traceability/debugging).
  let mapperJson = null;
  if (mapperJsonRaw) {
    try {
      mapperJson = JSON.parse(mapperJsonRaw);
    } catch (_e) {
      return await respondFailure({
        res,
        requestId,
        webhookUrl,
        httpStatus: 400,
        status: "ERRO_VALIDACAO",
        error: "mapper_json is not valid JSON",
      });
    }
  }

  // Parse CSV and build XML (domain structure), handling parse/build errors as validation failures.
  let rows;
  let xml;
  try {
    const csvText = req.file.buffer.toString("utf-8");
    rows = parseMappedCsv(csvText);
    xml = buildXml({ requestId, mapperVersion, rows });
  } catch (e) {
    const msg = e?.message || "Invalid CSV/XML build error";
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 400,
      status: "ERRO_VALIDACAO",
      error: msg,
    });
  }

  console.log(
    `[XML Service] validating generated XML (request_id=${requestId}, mapper_version=${mapperVersion}, bytes=${Buffer.byteLength(
      xml,
      "utf8",
    )})`,
  );

  if (mapperJson) {
    console.log(
      "[XML Service] mapper_json received -> keys=",
      Object.keys(mapperJson),
    );
  }

  // Debug toggle to intentionally corrupt the XML for negative tests.
  if (
    process.env.DEBUG_VALIDATION === "1" &&
    req.query?.force_invalid_xml === "1"
  ) {
    console.warn(
      "[XML Service] force_invalid_xml=1 -> corrupting XML for test",
    );
    xml = xml + "<";
  }

  // Verify well-formedness via Postgres functions (fast & reliable).
  const okXml = await isXmlWellFormed(xml);
  if (!okXml) {
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 400,
      status: "ERRO_VALIDACAO",
      error: "Generated XML is not well-formed",
    });
  }

  const xsdPath = path.resolve("schema/incident_report.xsd");
  const xsdRes = await validateXmlWithXsd(xml, xsdPath);

  if (!xsdRes.ok) {
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 400,
      status: "ERRO_VALIDACAO",
      error: `XML does not conform to XSD: ${xsdRes.error}`,
    });
  }

  // Persist to DB and capture the generated document ID.
  let docIdInserted;
  try {
    docIdInserted = await insertXmlDocument({
      xml,
      mapperVersion,
      requestId,
      mapperJson,
    });
  } catch (e) {
    const msg = e?.message || "DB persistence error";
    return await respondFailure({
      res,
      requestId,
      webhookUrl,
      httpStatus: 500,
      status: "ERRO_PERSISTENCIA",
      error: msg,
    });
  }

  // Optional debug artifact for manual inspection.
  if (process.env.SAVE_XML_FILES === "1") {
    try {
      saveXmlToFile({ xml, requestId, docId: docIdInserted });
    } catch (e) {
      console.warn(
        "[XML Service] saveXmlToFile failed (ignored):",
        e?.message || e,
      );
    }
  }

  // Respond to the caller first, then notify webhook asynchronously (best-effort).
  res.status(200).json({
    request_id: requestId,
    status: "OK",
    db_document_id: docIdInserted,
  });

  await postWebhookSafe(webhookUrl, {
    request_id: requestId,
    status: "OK",
    db_document_id: docIdInserted,
  });
});

/* =============================================================================
 * Error handling
 * =============================================================================
 */

app.use((err, _req, res, _next) => {
  // Multer file size limit handling.
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      status: "PAYLOAD_TOO_LARGE",
      error: "Uploaded file exceeds multer size limit",
    });
  }

  console.error("[XML Service] unhandled error:", err);
  return res.status(500).json({ ok: false, status: "INTERNAL_ERROR" });
});

/* =============================================================================
 * Server startup
 * =============================================================================
 */

const PORT = Number(process.env.XML_SERVICE_PORT || 7001);
app.listen(PORT, () => console.log(`[XML Service] listening on :${PORT}`));
