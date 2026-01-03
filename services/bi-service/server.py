import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

from ariadne import QueryType, make_executable_schema, gql
from ariadne.asgi import GraphQL

import uvicorn


# -----------------------------
# Environment loading (root .env)
# -----------------------------
ROOT_ENV = (Path(__file__).resolve().parents[2] / ".env")
load_dotenv(dotenv_path=ROOT_ENV)

# -----------------------------
# Config
# -----------------------------
BI_PORT = int(os.getenv("BI_SERVICE_PORT", "4000"))
XML_BASE_URL = os.getenv("XML_SERVICE_BASE_URL", "http://localhost:7001")

# REST endpoints exposed by xml-service
DOCS_URL = f"{XML_BASE_URL}/docs"
ASSETS_URL = f"{XML_BASE_URL}/query/ativos"
AGG_URL = f"{XML_BASE_URL}/query/agg/category"


# -----------------------------
# Helpers (REST -> GraphQL mapping)
# -----------------------------
def _http_get(url: str, params: Optional[Dict[str, Any]] = None, timeout_s: int = 10) -> Dict[str, Any]:
    """Perform a GET request and return JSON or raise a clear error."""
    r = requests.get(url, params=params or {}, timeout=timeout_s)
    r.raise_for_status()
    return r.json()


def map_doc(d: Dict[str, Any]) -> Dict[str, Any]:
    # xml-service returns: { id, mapper_version, data_criacao }
    return {
        "id": int(d["id"]),
        "mapperVersion": str(d.get("mapper_version", "")),
        "createdAt": str(d.get("data_criacao", "")),
    }


def map_asset(a: Dict[str, Any]) -> Dict[str, Any]:
    # xml-service returns: doc_id, id_interno, ticker, tipo, preco_eur, preco_usd, volume, taxa_eurusd, processado_utc
    return {
        "docId": int(a.get("doc_id")),
        "internalId": str(a.get("id_interno", "")),
        "ticker": str(a.get("ticker", "")),
        "category": str(a.get("tipo", "")),
        "priceEur": float(a["preco_eur"]) if a.get("preco_eur") is not None else None,
        "priceUsd": float(a["preco_usd"]) if a.get("preco_usd") is not None else None,
        "volume": float(a["volume"]) if a.get("volume") is not None else None,
        "fxEurUsd": float(a["taxa_eurusd"]) if a.get("taxa_eurusd") is not None else None,
        "processedAtUtc": str(a.get("processado_utc", "")) if a.get("processado_utc") is not None else None,
    }


def map_agg(row: Dict[str, Any]) -> Dict[str, Any]:
    # xml-service returns: category, total_ativos, total_volume, avg_preco_eur, avg_preco_usd
    return {
        "category": str(row.get("category", "")),
        "totalAssets": int(row.get("total_ativos", 0)),
        "totalVolume": float(row["total_volume"]) if row.get("total_volume") is not None else None,
        "avgPriceEur": float(row["avg_preco_eur"]) if row.get("avg_preco_eur") is not None else None,
        "avgPriceUsd": float(row["avg_preco_usd"]) if row.get("avg_preco_usd") is not None else None,
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
    payload = _http_get(DOCS_URL, params={"limit": limit})
    docs = payload.get("docs", [])
    return [map_doc(d) for d in docs]


@query.field("assets")
def resolve_assets(*_, ticker: Optional[str] = None, category: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {"limit": limit}
    if ticker:
        params["ticker"] = ticker
    if category:
        params["category"] = category

    payload = _http_get(ASSETS_URL, params=params)
    rows = payload.get("rows", [])
    return [map_asset(r) for r in rows]


@query.field("categoryAgg")
def resolve_category_agg(*_) -> List[Dict[str, Any]]:
    payload = _http_get(AGG_URL)
    rows = payload.get("rows", [])
    return [map_agg(r) for r in rows]


schema = make_executable_schema(type_defs, query)

# ASGI app (GraphQL Playground included in-browser)
app = GraphQL(schema, debug=True)


if __name__ == "__main__":
    print(f"[BI GraphQL] Starting on :{BI_PORT}")
    print(f"[BI GraphQL] Using XML Service base URL: {XML_BASE_URL}")
    uvicorn.run(app, host="0.0.0.0", port=BI_PORT, log_level="info")