import dotenv from "dotenv";
dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });

console.log("[ENV CHECK]", {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  XML_SERVICE_PORT: process.env.XML_SERVICE_PORT,
  DEBUG_VALIDATION: process.env.DEBUG_VALIDATION || "0",
  SAVE_XML_FILES: process.env.SAVE_XML_FILES || "0",
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

import { insertXmlDocument, isXmlWellFormed } from "./db.js";
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

/* ======================================================
   Ingest XML
====================================================== */
app.post("/ingest", upload.single("mapped_csv"), async (req, res) => {
  const requestId = req.body?.request_id;
  const mapperVersion = req.body?.mapper_version;
  const webhookUrl = req.body?.webhook_url;
  const mapperJsonRaw = req.body?.mapper_json;

  const safeWebhookPost = async (payload) => {
    if (!webhookUrl) return;
    try {
      await axios.post(webhookUrl, payload);
    } catch (err) {
      console.warn("[Webhook] failed:", err?.message || err);
    }
  };

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

    if (!req.file) {
      return await fail(
        400,
        "ERRO_VALIDACAO",
        "Missing mapped_csv file (multipart field name must be 'mapped_csv')",
      );
    }

    let mapperJson = null;
    if (mapperJsonRaw) {
      try {
        mapperJson = JSON.parse(mapperJsonRaw);
      } catch (_e) {
        return await fail(
          400,
          "ERRO_VALIDACAO",
          "mapper_json is not valid JSON",
        );
      }
    }

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

    if (
      process.env.DEBUG_VALIDATION === "1" &&
      req.query?.force_invalid_xml === "1"
    ) {
      console.warn(
        "[XML Service] force_invalid_xml=1 -> corrupting XML for test",
      );
      xml = xml + "<";
    }

    const okXml = await isXmlWellFormed(xml);
    if (!okXml) {
      return await fail(
        400,
        "ERRO_VALIDACAO",
        "Generated XML is not well-formed",
      );
    }

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
      return await fail(500, "ERRO_PERSISTENCIA", msg);
    }

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

    res.status(200).json({
      request_id: requestId,
      status: "OK",
      db_document_id: docIdInserted,
    });

    await safeWebhookPost({
      request_id: requestId,
      status: "OK",
      db_document_id: docIdInserted,
    });
  } catch (e) {
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
