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

from generated import bi_pb2, bi_pb2_grpc 

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


# -----------------------------
# Helpers (gRPC -> GraphQL mapping)
# -----------------------------
def map_doc(d: Any) -> Dict[str, Any]:
    return {
        "id": int(d.id),
        "mapperVersion": str(d.mapper_version),
        "createdAt": str(d.created_at),
    }


def map_asset(a: Any) -> Dict[str, Any]:
    return {
        "docId": int(a.doc_id),
        "internalId": str(a.internal_id),
        "ticker": str(a.ticker),
        "category": str(a.category),
        "priceEur": float(a.price_eur),
        "priceUsd": float(a.price_usd),
        "volume": float(a.volume),
        "fxEurUsd": float(a.fx_eur_usd),
        "processedAtUtc": str(a.processed_at_utc),
    }


def map_agg(row: Any) -> Dict[str, Any]:
    return {
        "category": str(row.category),
        "totalAssets": int(row.total_assets),
        "totalVolume": float(row.total_volume),
        "avgPriceEur": float(row.avg_price_eur),
        "avgPriceUsd": float(row.avg_price_usd),
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
    try:
        stub = grpc_stub()
        resp = stub.ListDocs(bi_pb2.ListDocsRequest(limit=limit))
        return [map_doc(d) for d in resp.docs]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC ListDocs failed: {e.code().name} - {e.details()}")


@query.field("assets")
def resolve_assets(
    *_,
    ticker: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    try:
        stub = grpc_stub()
        resp = stub.QueryAssets(
            bi_pb2.QueryAssetsRequest(
                ticker=ticker or "",
                category=category or "",
                limit=limit,
            )
        )
        return [map_asset(a) for a in resp.assets]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC QueryAssets failed: {e.code().name} - {e.details()}")


@query.field("categoryAgg")
def resolve_category_agg(*_) -> List[Dict[str, Any]]:
    try:
        stub = grpc_stub()
        resp = stub.CategoryAgg(bi_pb2.CategoryAggRequest())
        return [map_agg(r) for r in resp.rows]
    except grpc.RpcError as e:
        raise RuntimeError(f"gRPC CategoryAgg failed: {e.code().name} - {e.details()}")


schema = make_executable_schema(type_defs, query)
app = GraphQL(schema, debug=True)

def http_health(request):
    return JSONResponse({"ok": True, "service": "bi-service"})

starlette_app = Starlette(
    routes=[
        Route("/health", http_health, methods=["GET"]),
        Mount("/graphql", app),
    ]
)


if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=BI_PORT, log_level="info")