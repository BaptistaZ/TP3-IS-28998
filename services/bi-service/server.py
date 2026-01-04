import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import grpc
from dotenv import load_dotenv

from ariadne import QueryType, make_executable_schema, gql
from ariadne.asgi import GraphQL
import uvicorn

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount

import bi_pb2
import bi_pb2_grpc

load_dotenv()

# -----------------------------
# Config
# -----------------------------
BI_PORT = int(os.getenv("PORT") or os.getenv("BI_SERVICE_PORT", "4000"))

# gRPC BI Service endpoint
GRPC_HOST = os.getenv("GRPC_SERVICE_HOST", "grpc-service")
GRPC_PORT = int(os.getenv("GRPC_SERVICE_PORT", "50051"))


# -----------------------------
# gRPC helpers
# -----------------------------
def grpc_stub() -> bi_pb2_grpc.BIServiceStub:
    """Create a gRPC stub to talk to BIService."""
    target = f"{GRPC_HOST}:{GRPC_PORT}"
    channel = grpc.insecure_channel(target)
    return bi_pb2_grpc.BIServiceStub(channel)


def _safe_float(v: Any) -> Optional[float]:
    """Convert protobuf numeric (or None) to float safely."""
    try:
        return float(v)
    except Exception:
        return None


# -----------------------------
# Helpers (gRPC -> GraphQL mapping)
# -----------------------------
def map_doc(d: Any) -> Dict[str, Any]:
    return {
        "id": int(d.id),
        "mapperVersion": str(d.mapper_version),
        "createdAt": str(d.created_at),
    }


def map_incident(i: Any) -> Dict[str, Any]:
    # Map gRPC Incident -> GraphQL Incident fields
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


def map_agg_by_type(r: Any) -> Dict[str, Any]:
    return {
        "incidentType": str(r.incident_type),
        "totalIncidents": int(r.total_incidents),
        "avgRiskScore": _safe_float(r.avg_risk_score),
        "totalEstimatedCostEur": _safe_float(r.total_estimated_cost_eur),
    }


def map_agg_by_severity(r: Any) -> Dict[str, Any]:
    return {
        "severity": str(r.severity),
        "totalIncidents": int(r.total_incidents),
        "avgRiskScore": _safe_float(r.avg_risk_score),
    }


# -----------------------------
# GraphQL schema + resolvers (Ariadne)
# -----------------------------
schema_path = Path(__file__).with_name("schema.graphql")
type_defs = gql(schema_path.read_text(encoding="utf-8"))

query = QueryType()


@query.field("health")
def resolve_health(*_) -> str:
    return "ok"


@query.field("docs")
def resolve_docs(*_, limit: int = 10) -> List[Dict[str, Any]]:
    """List stored XML docs (metadata only)."""
    try:
        stub = grpc_stub()
        resp = stub.ListDocs(bi_pb2.ListDocsRequest(limit=limit))
        return [map_doc(d) for d in resp.docs]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC ListDocs failed: {e.code().name} - {e.details()}")


@query.field("incidents")
def resolve_incidents(
    *_,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Query incidents with optional filters."""
    try:
        stub = grpc_stub()
        resp = stub.QueryIncidents(
            bi_pb2.QueryIncidentsRequest(
                type=type or "",
                severity=severity or "",
                status=status or "",
                country=country or "",
                limit=limit,
            )
        )
        return [map_incident(i) for i in resp.incidents]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC QueryIncidents failed: {e.code().name} - {e.details()}")


@query.field("aggByType")
def resolve_agg_by_type(*_) -> List[Dict[str, Any]]:
    """Aggregation grouped by incident type."""
    try:
        stub = grpc_stub()
        resp = stub.AggByType(bi_pb2.AggByTypeRequest())
        return [map_agg_by_type(r) for r in resp.rows]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC AggByType failed: {e.code().name} - {e.details()}")


@query.field("aggBySeverity")
def resolve_agg_by_severity(*_) -> List[Dict[str, Any]]:
    """Aggregation grouped by severity."""
    try:
        stub = grpc_stub()
        resp = stub.AggBySeverity(bi_pb2.AggBySeverityRequest())
        return [map_agg_by_severity(r) for r in resp.rows]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC AggBySeverity failed: {e.code().name} - {e.details()}")


schema = make_executable_schema(type_defs, query)
app = GraphQL(schema, debug=True)


def http_health(_request):
    return JSONResponse({"ok": True, "service": "bi-service"})


starlette_app = Starlette(
    routes=[
        Route("/health", http_health, methods=["GET"]),
        Mount("/graphql", app),
    ]
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=BI_PORT, log_level="info")