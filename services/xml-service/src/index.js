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

  try {
    IngestSchema.parse({
      request_id: requestId,
      mapper_version: mapperVersion,
      webhook_url: webhookUrl,
    });

    if (!req.file) {
      return res.status(400).json({
        request_id: requestId || "unknown",
        status: "VALIDATION_ERROR",
        error:
          "Missing mapped_csv file (multipart field name must be 'mapped_csv')",
      });
    }

    const csvText = req.file.buffer.toString("utf-8");
    const rows = parseMappedCsv(csvText);

    const xml = buildXml({ requestId, mapperVersion, rows });

    // 1️⃣ Persist XML in DB (source of truth)
    const docId = await insertXmlDocument({
      xml,
      mapperVersion,
      requestId,
    });

    // 2️⃣ Save XML as file (debug / inspection)
    saveXmlToFile({
      xml,
      requestId,
      docId,
    });

    res.status(200).json({
      request_id: requestId,
      status: "OK",
      db_document_id: docId,
    });

    // 3️⃣ Webhook callback
    axios
      .post(webhookUrl, {
        request_id: requestId,
        status: "OK",
        db_document_id: docId,
      })
      .catch((err) => {
        console.warn("[Webhook] failed:", err?.message || err);
      });
  } catch (e) {
    const msg = e?.message || "Error";

    if (webhookUrl) {
      axios
        .post(webhookUrl, {
          request_id: requestId || "unknown",
          status: "VALIDATION_ERROR",
          error: msg,
        })
        .catch(() => {});
    }

    return res.status(400).json({
      request_id: requestId || "unknown",
      status: "VALIDATION_ERROR",
      error: msg,
    });
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
