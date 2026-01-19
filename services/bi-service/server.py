import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import grpc
import uvicorn
from ariadne import QueryType, gql, make_executable_schema
from ariadne.asgi import GraphQL
from dotenv import load_dotenv
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse, RedirectResponse
from starlette.routing import Mount, Route

import bi_pb2
import bi_pb2_grpc
from xml_service_client import fetch_agg_by_severity, fetch_agg_by_type, fetch_incidents

load_dotenv()

# =============================================================================
# Environment / Configuration
# =============================================================================

# Service port for the BI GraphQL API (supports Render/Heroku-style PORT override).
BI_PORT = int(os.getenv("PORT") or os.getenv("BI_SERVICE_PORT", "4000"))

# Target address for the internal gRPC BI service.
GRPC_HOST = os.getenv("GRPC_SERVICE_HOST", "grpc-service")
GRPC_PORT = int(os.getenv("GRPC_SERVICE_PORT", "50051"))


# =============================================================================
# Type Conversions / Mapping Helpers
# =============================================================================

# Convert a loosely-typed value to int, returning a default when blank.
def _to_int(v: Any, default: int = 0) -> int:
    try:
        if v is None:
            return default
        if isinstance(v, str) and v.strip() == "":
            return default
        return int(v)
    except Exception:
        return default


# Convert a loosely-typed value to float, returning None when blank.
def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return float(v)
    except Exception:
        return None


# Safe float conversion helper for gRPC mapping.
def _safe_float(v: Any) -> Optional[float]:
    try:
        return float(v)
    except Exception:
        return None


# Map a gRPC `Doc` message into a GraphQL-friendly dict.
def map_doc(d: Any) -> Dict[str, Any]:
    return {
        "id": int(d.id),
        "mapperVersion": str(d.mapper_version),
        "createdAt": str(d.created_at),
    }


# Map a gRPC `Incident` message into a GraphQL-friendly dict.
def map_incident(i: Any) -> Dict[str, Any]:
    return {
        "docId": int(i.doc_id),
        "incidentId": str(i.incident_id),
        "source": str(i.source) if i.source else None,
        "incidentType": str(i.incident_type) if i.incident_type else None,
        "severity": str(i.severity) if i.severity else None,
        "status": str(i.status) if i.status else None,
        "city": str(i.city) if i.city else None,
        "country": str(i.country) if i.country else None,
        "continent": str(i.continent) if i.continent else None,
        "lat": _safe_float(i.lat),
        "lon": _safe_float(i.lon),
        "accuracyM": _safe_float(i.accuracy_m),
        "reportedAt": str(i.reported_at) if i.reported_at else None,
        "validatedAt": str(i.validated_at) if i.validated_at else None,
        "resolvedAt": str(i.resolved_at) if i.resolved_at else None,
        "lastUpdateUtc": str(i.last_update_utc) if i.last_update_utc else None,
        "assignedUnit": str(i.assigned_unit) if i.assigned_unit else None,
        "resourcesCount": _safe_float(i.resources_count),
        "etaMin": _safe_float(i.eta_min),
        "responseTimeMin": _safe_float(i.response_time_min),
        "estimatedCostEur": _safe_float(i.estimated_cost_eur),
        "riskScore": _safe_float(i.risk_score),
    }


# =============================================================================
# gRPC Client
# =============================================================================

# Create and return a gRPC BIService stub.
def grpc_stub() -> bi_pb2_grpc.BIServiceStub:
    target = f"{GRPC_HOST}:{GRPC_PORT}"
    channel = grpc.insecure_channel(target)
    return bi_pb2_grpc.BIServiceStub(channel)


# =============================================================================
# GraphQL Schema Loading
# =============================================================================

# Load schema.graphql from the same directory as this file.
schema_path = Path(__file__).with_name("schema.graphql")
type_defs = gql(schema_path.read_text(encoding="utf-8"))

# Root query registry used by Ariadne to bind resolvers.
query = QueryType()


# =============================================================================
# GraphQL Resolvers
# =============================================================================

# Healthcheck resolver.
@query.field("health")
def resolve_health(*_) -> str:
    return "ok"


# Return recent XML documents persisted by the XML Service.
@query.field("docs")
def resolve_docs(*_, limit: int = 10) -> List[Dict[str, Any]]:
    try:
        print(
            f"[BI -> gRPC] docs(limit={limit}) calling {GRPC_HOST}:{GRPC_PORT}",
            flush=True,
        )
        stub = grpc_stub()
        resp = stub.ListDocs(bi_pb2.ListDocsRequest(limit=limit))
        print(f"[BI -> gRPC] docs OK -> {len(resp.docs)} docs", flush=True)
        return [map_doc(d) for d in resp.docs]
    except grpc.RpcError as e:
        # Normalize gRPC errors into a single exception type for GraphQL.
        raise RuntimeError(f"gRPC ListDocs failed: {e.code().name} - {e.details()}")


# Return incidents from the XML Service.
@query.field("incidents")
def resolve_incidents(
    *_,
    docId: Optional[int] = None,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    try:
        rows = fetch_incidents(
            doc_id=docId,
            type=type,
            severity=severity,
            status=status,
            country=country,
            limit=limit,
            offset=offset,
        )

        out: List[Dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    "docId": _to_int(r.get("doc_id"), default=0),
                    "incidentId": r.get("incident_id"),
                    "source": r.get("source"),
                    "incidentType": r.get("incident_type"),
                    "severity": r.get("severity"),
                    "status": r.get("status"),
                    "city": r.get("city"),
                    "country": r.get("country"),
                    "continent": r.get("continent"),
                    "lat": _to_float(r.get("lat")),
                    "lon": _to_float(r.get("lon")),
                    "accuracyM": _to_float(r.get("accuracy_m")),
                    "reportedAt": r.get("reported_at"),
                    "validatedAt": r.get("validated_at"),
                    "resolvedAt": r.get("resolved_at"),
                    "lastUpdateUtc": r.get("last_update_utc"),
                    "assignedUnit": r.get("assigned_unit"),
                    "resourcesCount": _to_float(r.get("resources_count")),
                    "etaMin": _to_float(r.get("eta_min")),
                    "responseTimeMin": _to_float(r.get("response_time_min")),
                    "estimatedCostEur": _to_float(r.get("estimated_cost_eur")),
                    "riskScore": _to_float(r.get("risk_score")),
                    "notes": r.get("notes"),
                }
            )

        return out
    except Exception as e:
        raise RuntimeError(f"XML Service /query/incidents failed: {e}")


# Aggregate KPIs by incident type.
@query.field("aggByType")
def resolve_agg_by_type(*_) -> List[Dict[str, Any]]:
    try:
        rows = fetch_agg_by_type()
        return [
            {
                "incidentType": r.get("incident_type"),
                "totalIncidents": _to_int(r.get("total_incidents"), default=0),
                "avgRiskScore": _to_float(r.get("avg_risk_score")),
                "totalEstimatedCostEur": _to_float(r.get("total_estimated_cost_eur")),
            }
            for r in rows
        ]
    except Exception as e:
        raise RuntimeError(f"XML Service /query/agg/type failed: {e}")


# Aggregate KPIs by incident severity.
@query.field("aggBySeverity")
def resolve_agg_by_severity(*_) -> List[Dict[str, Any]]:
    try:
        rows = fetch_agg_by_severity()
        return [
            {
                "severity": r.get("severity"),
                "totalIncidents": _to_int(r.get("total_incidents"), default=0),
                "avgRiskScore": _to_float(r.get("avg_risk_score")),
            }
            for r in rows
        ]
    except Exception as e:
        raise RuntimeError(f"XML Service /query/agg/severity failed: {e}")


# =============================================================================
# ASGI App (Starlette + Ariadne)
# =============================================================================

# Create the GraphQL executable schema and mount it as an ASGI app.
schema = make_executable_schema(type_defs, query)
graphql_app = GraphQL(schema, debug=True)


# Basic HTTP root redirect to /graphql
def http_root(_request):
    return RedirectResponse(url="/graphql")


# Basic HTTP health endpoint
def http_health(_request):
    return PlainTextResponse("ok")


# Starlette app with:
#  - /        -> redirect to /graphql
#  - /health  -> plain health response
#  - /graphql -> GraphQL endpoint + GraphQL Playground (debug=True)
starlette_app = Starlette(
    routes=[
        Route("/", http_root, methods=["GET"]),
        Route("/health", http_health, methods=["GET"]),
        Mount("/graphql", graphql_app),
    ]
)

# =============================================================================
# Entrypoint
# =============================================================================

if __name__ == "__main__":
    # Run the ASGI server (single process by default).
    uvicorn.run(starlette_app, host="0.0.0.0", port=BI_PORT, log_level="info")