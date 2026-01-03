import { create } from "xmlbuilder2";
import { z } from "zod";

// Base payload validation
export const IngestSchema = z.object({
  request_id: z.string().min(3),
  mapper_version: z.string().min(1),
  webhook_url: z.string().url(),
});

// Expected mapped CSV produced by the Processor
export function parseMappedCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Empty CSV or no data rows");

  const header = lines[0].split(",");
  const required = ["internal_id","symbol","category","price_eur","price_usd","volume","fx_eur_usd","mapper_version","processed_at_utc"];
  for (const col of required) {
    if (!header.includes(col)) throw new Error(`Missing required CSV column: ${col}`);
  }

  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < header.length) continue;

    rows.push({
      internal_id: cols[idx.internal_id],
      symbol: cols[idx.symbol],
      category: cols[idx.category],
      price_eur: Number(cols[idx.price_eur]),
      price_usd: Number(cols[idx.price_usd]),
      volume: Number(cols[idx.volume]),
      fx_eur_usd: Number(cols[idx.fx_eur_usd]),
      mapper_version: cols[idx.mapper_version],
      processed_at_utc: cols[idx.processed_at_utc],
    });
  }
  return rows;
}

export function buildXml({ requestId, mapperVersion, rows }) {
  // Hierarchical XML: RelatorioConformidade -> Ativos -> Ativo -> DetalheNegociacao + EnriquecimentoFX
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("RelatorioConformidade", {
      DataGeracao: new Date().toISOString().slice(0, 10),
      Versao: "1.0",
    })
      .ele("Configuracao", {
        ValidadoPor: "XML_Service_Node",
        Requisitante: requestId,
        MapperVersion: mapperVersion,
      }).up()
      .ele("Ativos");

  for (const r of rows) {
    const ativo = doc.ele("Ativo", {
      IDInterno: r.internal_id,
      Ticker: r.symbol,
      Tipo: r.category,
    });

    ativo.ele("DetalheNegociacao")
      .ele("PrecoAtual", { Moeda: "EUR" }).txt(String(r.price_eur)).up()
      .ele("PrecoUSD").txt(String(r.price_usd)).up()
      .ele("Volume", { Unidade: "unidades" }).txt(String(r.volume)).up()
      .up();

    ativo.ele("EnriquecimentoFX")
      .ele("TaxaEURUSD").txt(String(r.fx_eur_usd)).up()
      .ele("ProcessadoEmUTC").txt(String(r.processed_at_utc)).up()
      .up();

    ativo.up();
  }

  return doc.up().up().end({ prettyPrint: true });
}