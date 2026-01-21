import { create } from "xmlbuilder2";
import { z } from "zod";

/* =============================================================================
 * Ingest payload validation (multipart fields)
 * ============================================================================= */

/**
 * Minimal validation for the non-file ingest fields.
 * The file itself ("mapped_csv") is validated/handled at the route level.
 */
export const IngestSchema = z.object({
  request_id: z.string().min(3),
  mapper_version: z.string().min(1),
  webhook_url: z.string().url(),
});

/* =============================================================================
 * Processor mapped CSV contract (required columns)
 * =============================================================================
 *
 * These are the required header columns produced by the Processor after mapping/enrichment.
 */
const REQUIRED_COLUMNS = [
  "id_ocorrencia",
  "origem",
  "tipo_ocorrencia",
  "nivel_gravidade",
  "estado",
  "latitude",
  "longitude",
  "cidade",
  "pais",
  "continente",
  "precisao_m",
  "reportado_em",
  "validado_em",
  "resolvido_em",
  "ultima_atualizacao_utc",
  "unidade_atribuida",
  "num_recursos",
  "eta_min",
  "tempo_resposta_min",
  "custo_estimado_eur",
  "custo_estimado_usd",
  "fx_eur_usd",
  "meteo_fonte",
  "meteo_temp_c",
  "meteo_vento_kmh",
  "meteo_precip_mm",
  "meteo_codigo",
  "meteo_time_utc",
  "score_risco",
  "local_corrigido",
  "etiquetas",
  "observacoes",
];

/* =============================================================================
 * Low-level parsing helpers
 * ============================================================================= */

/**
 * Parse a single CSV line into fields.
 *
 * Supports:
 * - Comma separators
 * - Quoted fields (")
 * - Escaped quotes inside quoted fields ("")
 *
 * This is a lightweight parser suitable for the Processor output. It assumes:
 * - No multiline quoted fields (rows are single-line).
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Escaped quote within quoted text: ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

/**
 * Convert a value to a number (or null if empty/invalid).
 *
 * @param {any} value
 * @returns {number|null}
 */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert a value to a boolean (or null if not parseable).
 *
 * Accepted truthy: true, 1, yes
 * Accepted falsy:  false, 0, no
 *
 * @param {any} value
 * @returns {boolean|null}
 */
function toBoolean(value) {
  if (value === null || value === undefined) return null;

  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;

  return null;
}

/**
 * Return a trimmed attribute value if present; otherwise undefined.
 * xmlbuilder2 omits attributes with value `undefined`.
 *
 * @param {any} value
 * @returns {string|undefined}
 */
function attrIf(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function toXsdDateTime(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  // Se já tiver timezone (Z ou +hh:mm / -hh:mm) e segundos, deixa estar
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    return s;
  }

  // "YYYY-MM-DDTHH:MM" -> adiciona ":00Z"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return `${s}:00Z`;
  }

  // "YYYY-MM-DD HH:MM" -> converte para "T" e adiciona ":00Z"
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) {
    return `${s.replace(" ", "T")}:00Z`;
  }

  // Tenta parsear com Date() e converter para ISO UTC
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  // Se não der para entender, devolve null para omitir o atributo (ou lançar erro)
  return null;
}

/* =============================================================================
 * Public: mapped CSV parser
 * ============================================================================= */

/**
 * Parse the mapped CSV produced by the Processor.
 *
 * Validation:
 * - CSV must contain a header and at least one data row.
 * - Header must include all REQUIRED_COLUMNS.
 *
 * Output:
 * - Returns a normalized array of row objects used by buildXml().
 *
 * @param {string} text - Full CSV file contents.
 * @returns {Array<Object>} Parsed and normalized row objects.
 * @throws {Error} When CSV is empty or missing required columns.
 */
export function parseMappedCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Empty CSV or no data rows");

  const header = parseCsvLine(lines[0]).map((h) => h.trim());

  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(`Missing required CSV column: ${col}`);
    }
  }

  // Build a header index map for O(1) column access.
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseCsvLine(lines[i]);

    // Skip malformed/short rows rather than crashing the whole ingest.
    if (cols.length < header.length) continue;

    rows.push({
      incident_id: cols[idx.id_ocorrencia],
      source: cols[idx.origem],
      incident_type: cols[idx.tipo_ocorrencia],
      severity: cols[idx.nivel_gravidade],
      status: cols[idx.estado],

      lat: toNumber(cols[idx.latitude]),
      lon: toNumber(cols[idx.longitude]),

      city: cols[idx.cidade],
      country: cols[idx.pais],
      continent: cols[idx.continente],
      location_accuracy_m: toNumber(cols[idx.precisao_m]),

      reported_at: cols[idx.reportado_em],
      validated_at: cols[idx.validado_em],
      resolved_at: cols[idx.resolvido_em],
      last_update_utc: cols[idx.ultima_atualizacao_utc],

      assigned_unit: cols[idx.unidade_atribuida],
      resources_count: toNumber(cols[idx.num_recursos]),
      response_eta_min: toNumber(cols[idx.eta_min]),
      response_time_min: toNumber(cols[idx.tempo_resposta_min]),

      estimated_cost_eur: toNumber(cols[idx.custo_estimado_eur]),
      estimated_cost_usd: toNumber(cols[idx.custo_estimado_usd]),
      fx_eur_usd: toNumber(cols[idx.fx_eur_usd]),

      weather_source: cols[idx.meteo_fonte],
      weather_temperature_c: toNumber(cols[idx.meteo_temp_c]),
      weather_wind_kmh: toNumber(cols[idx.meteo_vento_kmh]),
      weather_precip_mm: toNumber(cols[idx.meteo_precip_mm]),
      weather_code: toNumber(cols[idx.meteo_codigo]),
      weather_time_utc: toXsdDateTime(cols[idx.meteo_time_utc]),

      risk_score: toNumber(cols[idx.score_risco]),
      location_corrected: toBoolean(cols[idx.local_corrigido]),

      tags: cols[idx.etiquetas],
      notes: cols[idx.observacoes],
    });
  }

  return rows;
}

/* =============================================================================
 * Public: XML builder
 * ============================================================================= */

/**
 * Build the hierarchical XML document expected by downstream XPath/XMLTable queries.
 *
 * Structure:
 * IncidentReport (root)
 *  - Configuration
 *  - Incidents
 *     - Incident (repeated)
 *        - Location (+ Coordinates)
 *        - Weather
 *        - Timeline
 *        - Response
 *        - Assessment
 *        - FinancialImpact
 *        - Meta
 *
 * @param {Object} params
 * @param {string} params.requestId
 * @param {string} params.mapperVersion
 * @param {Array<Object>} params.rows - Output from parseMappedCsv()
 * @returns {string} Pretty-printed XML document string.
 */
export function buildXml({ requestId, mapperVersion, rows }) {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("IncidentReport", {
      GeneratedAtUTC: new Date().toISOString(),
      Version: "1.0",
    })
    .ele("Configuration", {
      ValidatedBy: "XML_Service_Node",
      RequestId: requestId,
      MapperVersion: mapperVersion,
    })
    .up()
    .ele("Incidents");

  for (const r of rows) {
    const incident = doc.ele("Incident", {
      IncidentId: r.incident_id,
      Source: r.source,
      Type: r.incident_type,
      Severity: r.severity,
      Status: r.status,
    });

    // Location block (avoid writing empty numeric attributes)
    incident
      .ele("Location", {
        City: r.city || "",
        Country: r.country || "",
        Continent: r.continent || "",
        ...(attrIf(r.location_accuracy_m) !== undefined
          ? { AccuracyMeters: String(r.location_accuracy_m) }
          : {}),
        ...(attrIf(r.location_corrected) !== undefined
          ? { Corrected: String(r.location_corrected) }
          : {}),
      })
      .ele("Coordinates", {
        ...(attrIf(r.lat) !== undefined ? { Lat: String(r.lat) } : {}),
        ...(attrIf(r.lon) !== undefined ? { Lon: String(r.lon) } : {}),
      })
      .up()
      .up();

    // Weather block (external API enrichment)
    incident
      .ele("Weather", {
        ...(attrIf(r.weather_source) !== undefined
          ? { Source: String(r.weather_source) }
          : {}),
        ...(attrIf(r.weather_time_utc) !== undefined
          ? { TimeUTC: String(r.weather_time_utc) }
          : {}),
        ...(attrIf(r.weather_code) !== undefined
          ? { Code: String(r.weather_code) }
          : {}),
      })
      .ele("TemperatureC")
      .txt(r.weather_temperature_c ?? "")
      .up()
      .ele("WindKMH")
      .txt(r.weather_wind_kmh ?? "")
      .up()
      .ele("PrecipitationMM")
      .txt(r.weather_precip_mm ?? "")
      .up()
      .up();

    // Timeline block
    incident
      .ele("Timeline")
      .ele("ReportedAt")
      .txt(r.reported_at || "")
      .up()
      .ele("ValidatedAt")
      .txt(r.validated_at || "")
      .up()
      .ele("ResolvedAt")
      .txt(r.resolved_at || "")
      .up()
      .ele("LastUpdateUTC")
      .txt(r.last_update_utc || "")
      .up()
      .up();

    // Response block
    incident
      .ele("Response")
      .ele("AssignedUnit")
      .txt(r.assigned_unit || "")
      .up()
      .ele("ResourcesCount")
      .txt(r.resources_count ?? "")
      .up()
      .ele("EtaMinutes")
      .txt(r.response_eta_min ?? "")
      .up()
      .ele("ResponseTimeMinutes")
      .txt(r.response_time_min ?? "")
      .up()
      .up();

    // Risk / Financial Impact block
    incident
      .ele("Assessment")
      .ele("RiskScore")
      .txt(r.risk_score ?? "")
      .up()
      .up();

    incident
      .ele("FinancialImpact")
      .ele("EstimatedCost")
      .att("currency", "EUR")
      .txt(r.estimated_cost_eur ?? "")
      .up()
      .ele("EstimatedCost")
      .att("currency", "USD")
      .txt(r.estimated_cost_usd ?? "")
      .up()
      .ele("ExchangeRate")
      .att("source", "Frankfurter")
      .txt(r.fx_eur_usd ?? "")
      .up()
      .up();

    // Tags / Notes block
    incident
      .ele("Meta")
      .ele("Tags")
      .txt(r.tags || "")
      .up()
      .ele("Notes")
      .txt(r.notes || "")
      .up()
      .up();

    incident.up();
  }

  return doc.up().end({ prettyPrint: true });
}
