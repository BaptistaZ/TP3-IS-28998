import dotenv from "dotenv";
dotenv.config({ path: new URL("../../../.env", import.meta.url).pathname });

console.log("[ENV CHECK]", {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  XML_SERVICE_PORT: process.env.XML_SERVICE_PORT
});

import { listDocs, queryAtivos, aggByCategory } from "./queries.js";

import express from "express";
import multer from "multer";
import axios from "axios";

import { insertXmlDocument } from "./db.js";
import { IngestSchema, parseMappedCsv, buildXml } from "./xml.js";

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB para testes

app.get("/health", (_, res) => res.json({ ok: true }));

app.get("/docs", async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const docs = await listDocs(limit);
  res.json({ ok: true, docs });
});

app.get("/query/ativos", async (req, res) => {
  const ticker = req.query.ticker?.toString();
  const category = req.query.category?.toString();
  const limit = Number(req.query.limit || 50);

  const rows = await queryAtivos({ ticker, category, limit });
  res.json({ ok: true, count: rows.length, rows });
});

app.get("/query/agg/category", async (_req, res) => {
  const rows = await aggByCategory();
  res.json({ ok: true, rows });
});

// multipart: fields + file
// fields: request_id, mapper_version, webhook_url
// file: mapped_csv
app.post("/ingest", upload.single("mapped_csv"), async (req, res) => {
  const requestId = req.body.request_id;
  const mapperVersion = req.body.mapper_version;
  const webhookUrl = req.body.webhook_url;

  try {
    IngestSchema.parse({ request_id: requestId, mapper_version: mapperVersion, webhook_url: webhookUrl });

    if (!req.file) throw new Error("Missing mapped_csv file");

    const csvText = req.file.buffer.toString("utf-8");
    const rows = parseMappedCsv(csvText);

    // Generate XML
    const xml = buildXml({ requestId, mapperVersion, rows });

    // Persist to Postgres
    const docId = await insertXmlDocument({ xml, mapperVersion, requestId });

    // Immediate response (sync)
    res.status(200).json({ request_id: requestId, status: "OK", db_document_id: docId });

    // Async webhook (do not block response)
    axios.post(webhookUrl, {
      request_id: requestId,
      status: "OK",
      db_document_id: docId,
    }).catch(() => {});
  } catch (e) {
    const msg = e?.message || "Error";
    // Try to notify via webhook
    if (webhookUrl) {
      axios.post(webhookUrl, {
        request_id: requestId || "unknown",
        status: "VALIDATION_ERROR",
        error: msg,
      }).catch(() => {});
    }
    res.status(400).json({ request_id: requestId, status: "VALIDATION_ERROR", error: msg });
  }
});

const PORT = process.env.XML_SERVICE_PORT || 7001;
app.listen(PORT, () => console.log(`[XML Service] listening on :${PORT}`));