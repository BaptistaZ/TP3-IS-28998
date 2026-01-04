import os
from concurrent import futures
from datetime import timezone

import grpc
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

from generated import bi_pb2, bi_pb2_grpc

load_dotenv()

def _to_iso(value) -> str:
    """Convert DB datetime (or string) to ISO-8601 string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    # Make it timezone-aware (UTC) if it isn't already
    if getattr(value, "tzinfo", None) is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")

def get_db_conn():
    """Create a DB connection using env vars."""
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = os.getenv("DB_NAME", "tp3_is")
    user = os.getenv("DB_USER", "tp3_28998")
    password = os.getenv("DB_PASSWORD", "tp3pwd_28998")

    print(f"[gRPC] DB config -> host={host} port={port} db={dbname} user={user}")

    return psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
    )

class BIService(bi_pb2_grpc.BIServiceServicer):
    """gRPC BI Service reading XML data from Postgres using XPath/XMLTable."""

    def __init__(self):
        self.table = os.getenv("DB_TABLE", "tp3_documentos_xml")

    def ListDocs(self, request, context):
        print(f"[gRPC] ListDocs(limit={request.limit})")
        limit = request.limit if request.limit > 0 else 10

        sql = f"""
            SELECT id, mapper_version, data_criacao
            FROM {self.table}
            ORDER BY id DESC
            LIMIT %s;
        """

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, (limit,))
                    rows = cur.fetchall()

            docs = [
                bi_pb2.Doc(
                    id=int(r["id"]),
                    mapper_version=str(r["mapper_version"]),
                    created_at=_to_iso(r["data_criacao"]),
                )
                for r in rows
            ]

            return bi_pb2.ListDocsResponse(docs=docs)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"ListDocs DB error: {e}")
            return bi_pb2.ListDocsResponse()

    def QueryAssets(self, request, context):
        print(f"[gRPC] QueryAssets(ticker='{request.ticker}', category='{request.category}', limit={request.limit})")
        ticker = (request.ticker or "").strip()
        category = (request.category or "").strip()
        limit = request.limit if request.limit > 0 else 50

        params = []
        where = []

        if ticker:
            params.append(ticker)
            where.append("x.ticker = %s")

        if category:
            params.append(category)
            where.append("x.tipo = %s")

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""

        params.append(limit)

        sql = f"""
            SELECT
              d.id as doc_id,
              x.id_interno,
              x.ticker,
              x.tipo,
              x.preco_eur,
              x.preco_usd,
              x.volume,
              x.taxa_eurusd,
              x.processado_utc
            FROM {self.table} d
            JOIN LATERAL xmltable(
              '/RelatorioConformidade/Ativos/Ativo'
              PASSING d.xml_documento
              COLUMNS
                id_interno     text    PATH '@IDInterno',
                ticker         text    PATH '@Ticker',
                tipo           text    PATH '@Tipo',
                preco_eur      numeric PATH 'DetalheNegociacao/PrecoAtual/text()',
                preco_usd      numeric PATH 'DetalheNegociacao/PrecoUSD/text()',
                volume         numeric PATH 'DetalheNegociacao/Volume/text()',
                taxa_eurusd    numeric PATH 'EnriquecimentoFX/TaxaEURUSD/text()',
                processado_utc text    PATH 'EnriquecimentoFX/ProcessadoEmUTC/text()'
            ) x ON true
            {where_sql}
            ORDER BY d.id DESC
            LIMIT %s;
        """

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, tuple(params))
                    rows = cur.fetchall()

            assets = []
            for r in rows:
                assets.append(
                    bi_pb2.Asset(
                        doc_id=int(r["doc_id"]),
                        internal_id=str(r["id_interno"] or ""),
                        ticker=str(r["ticker"] or ""),
                        category=str(r["tipo"] or ""),
                        price_eur=float(r["preco_eur"] or 0),
                        price_usd=float(r["preco_usd"] or 0),
                        volume=float(r["volume"] or 0),
                        fx_eur_usd=float(r["taxa_eurusd"] or 0),
                        processed_at_utc=str(r["processado_utc"] or ""),
                    )
                )

            return bi_pb2.QueryAssetsResponse(assets=assets)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"QueryAssets DB error: {e}")
            return bi_pb2.QueryAssetsResponse()

    def CategoryAgg(self, request, context):
        print("[gRPC] CategoryAgg()")
        sql = f"""
            SELECT
              x.tipo as category,
              COUNT(*) as total_assets,
              SUM(x.volume) as total_volume,
              AVG(x.preco_eur) as avg_price_eur,
              AVG(x.preco_usd) as avg_price_usd
            FROM {self.table} d
            JOIN LATERAL xmltable(
              '/RelatorioConformidade/Ativos/Ativo'
              PASSING d.xml_documento
              COLUMNS
                tipo      text    PATH '@Tipo',
                volume    numeric PATH 'DetalheNegociacao/Volume/text()',
                preco_eur numeric PATH 'DetalheNegociacao/PrecoAtual/text()',
                preco_usd numeric PATH 'DetalheNegociacao/PrecoUSD/text()'
            ) x ON true
            GROUP BY x.tipo
            ORDER BY total_volume DESC NULLS LAST;
        """

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql)
                    rows = cur.fetchall()

            out_rows = []
            for r in rows:
                out_rows.append(
                    bi_pb2.CategoryAggRow(
                        category=str(r["category"] or ""),
                        total_assets=int(r["total_assets"] or 0),
                        total_volume=float(r["total_volume"] or 0),
                        avg_price_eur=float(r["avg_price_eur"] or 0),
                        avg_price_usd=float(r["avg_price_usd"] or 0),
                    )
                )

            return bi_pb2.CategoryAggResponse(rows=out_rows)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"CategoryAgg DB error: {e}")
            return bi_pb2.CategoryAggResponse()


def serve():
    port = int(os.getenv("GRPC_SERVICE_PORT", "50051"))
    addr = f"0.0.0.0:{port}"

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    bi_pb2_grpc.add_BIServiceServicer_to_server(BIService(), server)

    server.add_insecure_port(addr)

    print(f"[gRPC] BIService listening on {addr}")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()