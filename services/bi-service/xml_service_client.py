import os
from typing import Any, Dict, List, Optional
import requests


XML_BASE_URL = os.getenv("XML_SERVICE_BASE_URL",
                         "http://xml-service:7001").rstrip("/")
TIMEOUT = float(os.getenv("XML_SERVICE_TIMEOUT_SECONDS", "60"))


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{XML_BASE_URL}{path}"
    print("[BI -> XML REST]", url, params or {})
    r = requests.get(url, params=params or {}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


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
    if doc_id is not None:
        params["docId"] = doc_id

    payload = _get("/query/incidents", params=params)
    return payload.get("rows", [])


def fetch_agg_by_type() -> List[Dict[str, Any]]:
    payload = _get("/query/agg/type")
    return payload.get("rows", [])


def fetch_agg_by_severity() -> List[Dict[str, Any]]:
    payload = _get("/query/agg/severity")
    return payload.get("rows", [])
