import { create } from "xmlbuilder2";
import { z } from "zod";

// Base payload validation
export const IngestSchema = z.object({
  request_id: z.string().min(3),
  mapper_version: z.string().min(1),
  webhook_url: z.string().url(),
});

// Required columns from the Processor output
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

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Handle escaped quote: ""
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

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

/**
 * Expected mapped CSV produced by the Processor
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

  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseCsvLine(lines[i]);
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
      weather_time_utc: cols[idx.meteo_time_utc],

      risk_score: toNumber(cols[idx.score_risco]),
      location_corrected: toBoolean(cols[idx.local_corrigido]),

      tags: cols[idx.etiquetas],
      notes: cols[idx.observacoes],
    });
  }

  return rows;
}

function attrIf(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

export function buildXml({ requestId, mapperVersion, rows }) {
  // Hierarchical XML: IncidentReport -> Configuration -> Incidents -> Incident
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
