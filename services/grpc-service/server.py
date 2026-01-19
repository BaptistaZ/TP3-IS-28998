import os
from concurrent import futures
from datetime import timezone

import grpc
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

import bi_pb2
import bi_pb2_grpc

load_dotenv()

# =============================================================================
# Helpers: formatting / conversion
# =============================================================================

# Convert datetime or string to ISO 8601 format (UTC 'Z' suffix).


def _to_iso(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if getattr(value, "tzinfo", None) is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


# Convert DB numeric to float, defaulting to 0.0 on failure.
def _safe_float(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


# Convert DB numeric to int, defaulting to 0 on failure.
def _safe_int(value) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except Exception:
        return 0


# =============================================================================
# Database access
# =============================================================================

# Get a new DB connection using env vars.
def get_db_conn():
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = os.getenv("DB_NAME", "tp3_is")
    user = os.getenv("DB_USER", "tp3_28998")
    password = os.getenv("DB_PASSWORD", "tp3pwd_28998")

    # Keep logs minimal but useful for debugging container env wiring.
    print(
        f"[gRPC] DB config -> host={host} port={port} db={dbname} user={user}", flush=True)

    return psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
    )


# =============================================================================
# SQL builders
# =============================================================================

# Build SQL for querying incidents with dynamic WHERE clause.
def _build_query_incidents_sql(table: str, where_sql: str) -> str:
    return f"""
        SELECT
          d.id as doc_id,

          x.incident_id,
          x.source,
          x.incident_type,
          x.severity,
          x.status,

          x.city,
          x.country,
          x.continent,

          NULLIF(x.lat_txt, '')::numeric as lat,
          NULLIF(x.lon_txt, '')::numeric as lon,
          NULLIF(x.accuracy_m_txt, '')::numeric as accuracy_m,

          x.reported_at,
          x.validated_at,
          x.resolved_at,
          x.last_update_utc,

          x.assigned_unit,

          NULLIF(x.resources_count_txt, '')::numeric as resources_count,
          NULLIF(x.eta_min_txt, '')::numeric as eta_min,
          NULLIF(x.response_time_min_txt, '')::numeric as response_time_min,

          NULLIF(x.estimated_cost_eur_txt, '')::numeric as estimated_cost_eur,
          NULLIF(x.risk_score_txt, '')::numeric as risk_score

        FROM {table} d
        JOIN LATERAL xmltable(
          '/IncidentReport/Incidents/Incident'
          PASSING d.xml_documento
          COLUMNS
            incident_id            text PATH '@IncidentId',
            source                 text PATH '@Source',
            incident_type          text PATH '@Type',
            severity               text PATH '@Severity',
            status                 text PATH '@Status',

            city                   text PATH 'Location/@City',
            country                text PATH 'Location/@Country',
            continent              text PATH 'Location/@Continent',

            accuracy_m_txt         text PATH 'Location/@AccuracyMeters',
            lat_txt                text PATH 'Location/Coordinates/@Lat',
            lon_txt                text PATH 'Location/Coordinates/@Lon',

            reported_at            text PATH 'Timeline/ReportedAt/text()',
            validated_at           text PATH 'Timeline/ValidatedAt/text()',
            resolved_at            text PATH 'Timeline/ResolvedAt/text()',
            last_update_utc        text PATH 'Timeline/LastUpdateUTC/text()',

            assigned_unit          text PATH 'Response/AssignedUnit/text()',
            resources_count_txt    text PATH 'Response/ResourcesCount/text()',
            eta_min_txt            text PATH 'Response/EtaMinutes/text()',
            response_time_min_txt  text PATH 'Response/ResponseTimeMinutes/text()',

            estimated_cost_eur_txt text PATH 'FinancialImpact/EstimatedCost[@currency="EUR"]/text()',
            risk_score_txt         text PATH 'Assessment/RiskScore/text()'
        ) x ON true
        {where_sql}
        ORDER BY d.id DESC
        LIMIT %s;
    """


# Build SQL for aggregation by incident type.
def _build_agg_by_type_sql(table: str) -> str:
    return f"""
        SELECT
          x.incident_type as incident_type,
          COUNT(*) as total_incidents,
          AVG(NULLIF(x.risk_score_txt, '')::numeric) as avg_risk_score,
          SUM(NULLIF(x.estimated_cost_eur_txt, '')::numeric) as total_estimated_cost_eur
        FROM {table} d
        JOIN LATERAL xmltable(
          '/IncidentReport/Incidents/Incident'
          PASSING d.xml_documento
          COLUMNS
            incident_type          text PATH '@Type',
            risk_score_txt         text PATH 'Assessment/RiskScore/text()',
            estimated_cost_eur_txt text PATH 'FinancialImpact/EstimatedCost[@currency="EUR"]/text()'
        ) x ON true
        WHERE NULLIF(x.incident_type, '') IS NOT NULL
        GROUP BY x.incident_type
        ORDER BY total_estimated_cost_eur DESC NULLS LAST;
    """


# Build SQL for aggregation by severity.
def _build_agg_by_severity_sql(table: str) -> str:
    return f"""
        SELECT
          x.severity as severity,
          COUNT(*) as total_incidents,
          AVG(NULLIF(x.risk_score_txt, '')::numeric) as avg_risk_score
        FROM {table} d
        JOIN LATERAL xmltable(
          '/IncidentReport/Incidents/Incident'
          PASSING d.xml_documento
          COLUMNS
            severity       text PATH '@Severity',
            risk_score_txt text PATH 'Assessment/RiskScore/text()'
        ) x ON true
        WHERE NULLIF(x.severity, '') IS NOT NULL
        GROUP BY x.severity
        ORDER BY total_incidents DESC;
    """


# =============================================================================
# gRPC service implementation
# =============================================================================

# BIService implementation
class BIService(bi_pb2_grpc.BIServiceServicer):

    def __init__(self):
        self.table = os.getenv("DB_TABLE", "tp3_incidents_xml")

    # -------------------------------------------------------------------------
    # Docs
    # -------------------------------------------------------------------------
    def ListDocs(self, request, context):
        print(f"[gRPC] ListDocs(limit={request.limit})", flush=True)
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
                    id=_safe_int(r.get("id")),
                    mapper_version=str(r.get("mapper_version") or ""),
                    created_at=_to_iso(r.get("data_criacao")),
                )
                for r in rows
            ]
            return bi_pb2.ListDocsResponse(docs=docs)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"ListDocs DB error: {e}")
            return bi_pb2.ListDocsResponse()

    # -------------------------------------------------------------------------
    # Incidents query (filtered)
    # -------------------------------------------------------------------------
    def QueryIncidents(self, request, context):
        print(
            "[gRPC] QueryIncidents("
            f"type='{request.type}', severity='{request.severity}', status='{request.status}', "
            f"country='{request.country}', limit={request.limit})",
            flush=True,
        )

        inc_type = (request.type or "").strip()
        severity = (request.severity or "").strip()
        status = (request.status or "").strip()
        country = (request.country or "").strip()
        limit = request.limit if request.limit > 0 else 50

        params = []
        where = []

        if inc_type:
            params.append(inc_type)
            where.append("x.incident_type = %s")
        if severity:
            params.append(severity)
            where.append("x.severity = %s")
        if status:
            params.append(status)
            where.append("x.status = %s")
        if country:
            params.append(country)
            where.append("x.country = %s")

        # Avoid emitting empty/broken rows coming from malformed XML nodes.
        where.append("NULLIF(x.incident_id, '') IS NOT NULL")

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        params.append(limit)

        sql = _build_query_incidents_sql(self.table, where_sql)

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql, tuple(params))
                    rows = cur.fetchall()

            incidents = []
            for r in rows:
                incidents.append(
                    bi_pb2.Incident(
                        doc_id=_safe_int(r.get("doc_id")),
                        incident_id=str(r.get("incident_id") or ""),
                        source=str(r.get("source") or ""),
                        incident_type=str(r.get("incident_type") or ""),
                        severity=str(r.get("severity") or ""),
                        status=str(r.get("status") or ""),
                        city=str(r.get("city") or ""),
                        country=str(r.get("country") or ""),
                        continent=str(r.get("continent") or ""),
                        lat=_safe_float(r.get("lat")),
                        lon=_safe_float(r.get("lon")),
                        accuracy_m=_safe_float(r.get("accuracy_m")),
                        reported_at=str(r.get("reported_at") or ""),
                        validated_at=str(r.get("validated_at") or ""),
                        resolved_at=str(r.get("resolved_at") or ""),
                        last_update_utc=str(r.get("last_update_utc") or ""),
                        assigned_unit=str(r.get("assigned_unit") or ""),
                        resources_count=_safe_float(r.get("resources_count")),
                        eta_min=_safe_float(r.get("eta_min")),
                        response_time_min=_safe_float(
                            r.get("response_time_min")),
                        estimated_cost_eur=_safe_float(
                            r.get("estimated_cost_eur")),
                        risk_score=_safe_float(r.get("risk_score")),
                    )
                )

            return bi_pb2.QueryIncidentsResponse(incidents=incidents)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"QueryIncidents DB error: {e}")
            return bi_pb2.QueryIncidentsResponse()

    # -------------------------------------------------------------------------
    # Aggregations
    # -------------------------------------------------------------------------
    def AggByType(self, request, context):
        print("[gRPC] AggByType()", flush=True)
        sql = _build_agg_by_type_sql(self.table)

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql)
                    rows = cur.fetchall()

            out_rows = [
                bi_pb2.AggByTypeRow(
                    incident_type=str(r.get("incident_type") or ""),
                    total_incidents=_safe_int(r.get("total_incidents")),
                    avg_risk_score=_safe_float(r.get("avg_risk_score")),
                    total_estimated_cost_eur=_safe_float(
                        r.get("total_estimated_cost_eur")),
                )
                for r in rows
            ]

            return bi_pb2.AggByTypeResponse(rows=out_rows)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"AggByType DB error: {e}")
            return bi_pb2.AggByTypeResponse()

    def AggBySeverity(self, request, context):
        print("[gRPC] AggBySeverity()", flush=True)
        sql = _build_agg_by_severity_sql(self.table)

        try:
            with get_db_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql)
                    rows = cur.fetchall()

            out_rows = [
                bi_pb2.AggBySeverityRow(
                    severity=str(r.get("severity") or ""),
                    total_incidents=_safe_int(r.get("total_incidents")),
                    avg_risk_score=_safe_float(r.get("avg_risk_score")),
                )
                for r in rows
            ]

            return bi_pb2.AggBySeverityResponse(rows=out_rows)

        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"AggBySeverity DB error: {e}")
            return bi_pb2.AggBySeverityResponse()


# =============================================================================
# Server bootstrap
# =============================================================================
def serve():
    port = int(os.getenv("GRPC_SERVICE_PORT", "50051"))
    addr = f"0.0.0.0:{port}"

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    bi_pb2_grpc.add_BIServiceServicer_to_server(BIService(), server)

    server.add_insecure_port(addr)

    print(f"[gRPC] BIService listening on {addr}", flush=True)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
