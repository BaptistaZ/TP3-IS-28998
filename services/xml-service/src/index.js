import dotenv from "dotenv";
dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });

console.log("[ENV CHECK]", {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  XML_SERVICE_PORT: process.env.XML_SERVICE_PORT,
});

import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import path from "path";

import {
  listDocs,
  queryIncidents,
  aggByType,
  aggBySeverity,
} from "./queries.js";

import { insertXmlDocument } from "./db.js";
import { IngestSchema, parseMappedCsv, buildXml } from "./xml.js";

const app = express();

/* ======================================================
   File upload config
====================================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB
});

/* ======================================================
   Utils
====================================================== */
function saveXmlToFile({ xml, requestId, docId }) {
  const baseDir = path.resolve("generated-xml");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const safeRequestId = String(requestId).replace(/[^a-zA-Z0-9_-]/g, "_");

  const filename = `incident_${docId}_${safeRequestId}.xml`;
  const filepath = path.join(baseDir, filename);

  fs.writeFileSync(filepath, xml, "utf-8");

  console.log(`[XML Service] XML written to ${filepath}`);
}

/* ======================================================
   Routes
====================================================== */
app.get("/health", (_, res) => res.json({ ok: true, service: "xml-service" }));

app.get("/docs", async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const docs = await listDocs(limit);
  res.json({ ok: true, docs });
});

app.get("/query/incidents", async (req, res) => {
  const type = req.query.type?.toString();
  const severity = req.query.severity?.toString();
  const status = req.query.status?.toString();
  const country = req.query.country?.toString();
  const limit = Number(req.query.limit || 50);

  const rows = await queryIncidents({
    type,
    severity,
    status,
    country,
    limit,
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

/* ======================================================
   Ingest XML
====================================================== */
// multipart fields:
// - request_id
// - mapper_version
// - webhook_url
// - mapped_csv (file)
app.post("/ingest", upload.single("mapped_csv"), async (req, res) => {
  const requestId = req.body?.request_id;
  const mapperVersion = req.body?.mapper_version;
  const webhookUrl = req.body?.webhook_url;

  // helper: envia webhook sem rebentar o fluxo
  const safeWebhookPost = async (payload) => {
    if (!webhookUrl) return;
    try {
      await axios.post(webhookUrl, payload);
    } catch (err) {
      console.warn("[Webhook] failed:", err?.message || err);
    }
  };

  // helper: resposta + webhook com status normalizado
  const fail = async (httpStatus, status, errorMsg, docId = null) => {
    const payload = {
      request_id: requestId || "unknown",
      status,
      db_document_id: docId,
      error: errorMsg,
    };
    await safeWebhookPost(payload);
    return res.status(httpStatus).json(payload);
  };

  try {
    // 1) Validação dos campos obrigatórios
    try {
      IngestSchema.parse({
        request_id: requestId,
        mapper_version: mapperVersion,
        webhook_url: webhookUrl,
      });
    } catch (e) {
      const msg = e?.message || "Invalid request fields";
      return await fail(400, "ERRO_VALIDACAO", msg);
    }

    // 2) Ficheiro obrigatório
    if (!req.file) {
      return await fail(
        400,
        "ERRO_VALIDACAO",
        "Missing mapped_csv file (multipart field name must be 'mapped_csv')"
      );
    }

    // 3) Parsing + build XML (continua a ser validação/transformação)
    let rows;
    let xml;
    try {
      const csvText = req.file.buffer.toString("utf-8");
      rows = parseMappedCsv(csvText);
      xml = buildXml({ requestId, mapperVersion, rows });
    } catch (e) {
      const msg = e?.message || "Invalid CSV/XML build error";
      return await fail(400, "ERRO_VALIDACAO", msg);
    }

    // 4) Persistência (qualquer falha aqui é ERRO_PERSISTENCIA)
    let docId;
    try {
      docId = await insertXmlDocument({ xml, mapperVersion, requestId });
    } catch (e) {
      const msg = e?.message || "DB persistence error";
      return await fail(500, "ERRO_PERSISTENCIA", msg);
    }

    // 5) Guardar ficheiro (debug) — se falhar, não deve invalidar o fluxo
    try {
      saveXmlToFile({ xml, requestId, docId });
    } catch (e) {
      console.warn("[XML Service] saveXmlToFile failed (ignored):", e?.message || e);
    }

    // 6) Responder ao processor
    res.status(200).json({
      request_id: requestId,
      status: "OK",
      db_document_id: docId,
    });

    // 7) Webhook callback (assíncrono)
    await safeWebhookPost({
      request_id: requestId,
      status: "OK",
      db_document_id: docId,
    });
  } catch (e) {
    // fallback: algo inesperado
    const msg = e?.message || "Unhandled error";
    return await fail(500, "ERRO_PERSISTENCIA", msg);
  }
});

/* ======================================================
   Error handler
====================================================== */
app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      status: "PAYLOAD_TOO_LARGE",
      error: "Uploaded file exceeds multer size limit",
    });
  }
  console.error("[XML Service] unhandled error:", err);
  return res.status(500).json({
    ok: false,
    status: "INTERNAL_ERROR",
  });
});

/* ======================================================
   Server
====================================================== */
const PORT = Number(process.env.XML_SERVICE_PORT || 7001);
app.listen(PORT, () => console.log(`[XML Service] listening on :${PORT}`));
