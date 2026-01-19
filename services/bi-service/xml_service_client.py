import os
from typing import Any, Dict, List, Optional

import requests

# =============================================================================
# Environment / Configuration
# =============================================================================

# Base URL for the XML Service REST API (container-to-container by default).
# rstrip("/") avoids double slashes when composing URLs.
XML_BASE_URL = os.getenv("XML_SERVICE_BASE_URL", "http://xml-service:7001").rstrip("/")

# Shared request timeout (seconds) for all calls to the XML Service.
TIMEOUT = float(os.getenv("XML_SERVICE_TIMEOUT_SECONDS", "60"))


# =============================================================================
# Low-level HTTP Helpers
# =============================================================================

# Generic GET request helper for the XML Service.
def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{XML_BASE_URL}{path}"
    effective_params = params or {}

    # Log calls for traceability while debugging the pipeline.
    print("[BI -> XML REST]", url, effective_params)

    r = requests.get(url, params=effective_params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


# =============================================================================
# XML Service API Wrappers
# =============================================================================

# Fetch incidents from the XML Service.
def fetch_incidents(
    doc_id: Optional[int] = None,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "type": type or "",
        "severity": severity or "",
        "status": status or "",
        "country": country or "",
        "limit": limit,
        "offset": offset,
    }

    # Only send docId when explicitly provided; keeps behaviour consistent with XML Service defaults.
    if doc_id is not None:
        params["docId"] = doc_id

    payload = _get("/query/incidents", params=params)
    return payload.get("rows", [])


# Fetch aggregation by incident type from the XML Service.
def fetch_agg_by_type() -> List[Dict[str, Any]]:
    payload = _get("/query/agg/type")
    return payload.get("rows", [])


# Fetch aggregation by incident severity from the XML Service.
def fetch_agg_by_severity() -> List[Dict[str, Any]]:
    payload = _get("/query/agg/severity")
    return payload.get("rows", [])