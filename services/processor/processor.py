import os
import time
import json
from datetime import datetime
import csv
import io
from typing import Dict, Any, List
from xmlrpc.client import ServerProxy

import boto3
from botocore.client import Config
import requests
from dotenv import load_dotenv

from weather_client import fetch_weather
from state_store import with_locked_state  # <-- NOVO

load_dotenv()

# -----------------------------
# Environment / Configuration
# -----------------------------
ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
REGION = os.getenv("SUPABASE_S3_REGION", "eu-central-1")
ACCESS_KEY = os.getenv("SUPABASE_S3_ACCESS_KEY")
SECRET_KEY = os.getenv("SUPABASE_S3_SECRET_KEY")
BUCKET = os.getenv("SUPABASE_BUCKET_NAME")

IN_PREFIX = os.getenv("SUPABASE_INCOMING_PREFIX", "incoming/")
OUT_PREFIX = os.getenv("SUPABASE_PROCESSED_PREFIX", "processed/")
POLL_SECONDS = int(os.getenv("PROCESSOR_POLL_SECONDS", "10"))
TMP_DIR = os.getenv("PROCESSOR_LOCAL_TMP", "tmp")

# External API used for enrichment (EUR -> USD)
FX_URL = os.getenv(
    "EXTERNAL_API_FX_URL",
    "https://api.frankfurter.app/latest?from=EUR&to=USD"
)

STATE_PATH = os.path.join(TMP_DIR, "processor_state.json")

# Progress logs
PROGRESS_EVERY = int(os.getenv("PROCESSOR_PROGRESS_EVERY", "2000"))

# Estado inicial (para state_store)
INIT_STATE = {
    "processed_keys": [],
    "ingest_results": {},
    "pending_ingests": {},
    "webhook_events": {},
}


# -----------------------------
# XML Service integration
# -----------------------------
def send_to_xml_service(mapped_csv_path: str, source_key: str) -> Dict[str, Any]:
    """
    Sends the mapped CSV to the XML Service via multipart/form-data.
    The XML Service will:
      - validate payload
      - generate XML
      - persist XML into Postgres
      - call back the webhook URL asynchronously

    Returns the XML Service JSON response (sync response).
    """
    ingest_url = os.getenv("XML_SERVICE_INGEST_URL", "http://localhost:7001/ingest")
    webhook_url = os.getenv("PROCESSOR_WEBHOOK_URL", "http://localhost:8000/webhook/xml-status")
    mapper_version = os.getenv("MAPPER_VERSION", "1.0.0")
    timeout_s = int(os.getenv("XML_SERVICE_TIMEOUT_SECONDS", "20"))
    prefix = os.getenv("PROCESSOR_REQUEST_ID_PREFIX", "Processor")

    # Build a unique, traceable request id
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_key = source_key.replace("/", "_").replace(":", "_")
    request_id = f"{prefix}_{safe_key}_{ts}"

    with open(mapped_csv_path, "rb") as f:
        files = {"mapped_csv": (os.path.basename(mapped_csv_path), f, "text/csv")}
        data = {
            "request_id": request_id,
            "mapper_version": mapper_version,
            "webhook_url": webhook_url,
        }

        r = requests.post(ingest_url, data=data, files=files, timeout=timeout_s)
        r.raise_for_status()
        resp = r.json()
        resp["_request_id"] = request_id
        resp["_source_key"] = source_key
        return resp


# -----------------------------
# S3 (Supabase Storage) client
# -----------------------------
def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        region_name=REGION,
    )


def ensure_tmp():
    os.makedirs(TMP_DIR, exist_ok=True)


# -----------------------------
# External enrichment
# -----------------------------
def _to_float(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, bytes):
        return float(value.decode("utf-8").strip())
    if hasattr(value, "data") and isinstance(getattr(value, "data"), (bytes, bytearray)):
        return float(value.data.decode("utf-8").strip())
    return float(str(value).strip())


def fetch_fx_eur_usd():
    """
    Prefer XML-RPC (internal protocol requirement).
    Fallback to direct REST call if XML-RPC is unavailable.
    """
    rpc_host = os.getenv("RPC_SERVICE_HOST", "localhost")
    rpc_port = int(os.getenv("RPC_SERVICE_PORT", "9000"))
    rpc_url = f"http://{rpc_host}:{rpc_port}/RPC2"

    try:
        client = ServerProxy(rpc_url, allow_none=True)
        rate = client.default.get_eur_usd_rate()
        rate_f = _to_float(rate)
        print(f"[Processor] FX via XML-RPC OK -> {rate_f}")
        return rate_f

    except Exception as e:
        print(f"[Processor] XML-RPC unavailable, fallback to REST FX API. Reason: {e}")

        r = requests.get(FX_URL, timeout=8)
        r.raise_for_status()
        data = r.json()

        if "rates" in data and "USD" in data["rates"]:
            rate = float(data["rates"]["USD"])
            print(f"[Processor] FX via REST OK -> {rate}")
            return rate

        if "conversion_rates" in data and "USD" in data["conversion_rates"]:
            rate = float(data["conversion_rates"]["USD"])
            print(f"[Processor] FX via REST OK -> {rate}")
            return rate

        raise RuntimeError(f"Unexpected FX API response: {data}")


# -----------------------------
# S3 helpers
# -----------------------------
def list_new_csv_objects(s3, processed_keys: List[str]) -> List[str]:
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=IN_PREFIX)
    items = resp.get("Contents", [])
    items.sort(key=lambda x: x["LastModified"])  # oldest -> newest
    keys = [it["Key"] for it in items if it["Key"].endswith(".csv")]
    return [k for k in keys if k not in processed_keys]


def download_object_to_memory(s3, key: str) -> io.StringIO:
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    body = obj["Body"].read()
    return io.StringIO(body.decode("utf-8"))


# -----------------------------
# Mapping / transformation
# -----------------------------
def write_mapped_csv(local_path: str, input_stream: io.StringIO, fx_usd: float):
    MAX_WEATHER_CALLS_PER_FILE = int(os.getenv("MAX_WEATHER_CALLS_PER_FILE", "300"))

    reader = csv.DictReader(input_stream)

    fieldnames = [
        "incident_id", "source", "incident_type", "severity", "status",
        "city", "country", "continent", "lat", "lon", "location_accuracy_m",
        "reported_at", "validated_at", "resolved_at", "last_update_utc",
        "assigned_unit", "resources_count", "response_eta_min", "response_time_min",
        "estimated_cost_eur", "estimated_cost_usd", "risk_score", "location_corrected",
        "tags", "notes", "fx_eur_usd",
        "weather_source", "weather_temperature_c", "weather_wind_kmh", "weather_precip_mm",
        "weather_code", "weather_time_utc",
        "mapper_version", "processed_at_utc",
    ]

    processed_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    mapper_version = os.getenv("MAPPER_VERSION", "1.0.0")

    weather_cache: Dict[tuple, dict] = {}
    empty_weather = {
        "weather_source": "",
        "weather_temperature_c": "",
        "weather_wind_kmh": "",
        "weather_precip_mm": "",
        "weather_code": "",
        "weather_time_utc": "",
    }

    weather_calls = 0
    weather_hits = 0
    weather_misses = 0
    weather_skipped = 0

    t0 = time.time()
    rows_written = 0

    with open(local_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            rows_written += 1

            if PROGRESS_EVERY > 0 and (rows_written % PROGRESS_EVERY == 0):
                elapsed = time.time() - t0
                rps = rows_written / elapsed if elapsed > 0 else 0.0
                print(f"[Processor] mapping... rows={rows_written} elapsed={elapsed:.1f}s (~{rps:.1f} rows/s)")

            cost_eur_str = (row.get("estimated_cost_eur") or "").strip()
            cost_eur = float(cost_eur_str) if cost_eur_str else 0.0
            cost_usd = round(cost_eur * fx_usd, 6)

            weather = None
            try:
                lat_raw = (row.get("lat") or "").strip()
                lon_raw = (row.get("lon") or "").strip()

                if lat_raw and lon_raw:
                    lat = float(lat_raw)
                    lon = float(lon_raw)

                    ROUND_DECIMALS = int(os.getenv("WEATHER_ROUND_DECIMALS", "1"))
                    lat2 = round(lat, ROUND_DECIMALS)
                    lon2 = round(lon, ROUND_DECIMALS)
                    wkey = (lat2, lon2)

                    if wkey in weather_cache:
                        weather = weather_cache[wkey]
                        weather_hits += 1
                    else:
                        if weather_calls < MAX_WEATHER_CALLS_PER_FILE:
                            weather_calls += 1
                            weather = fetch_weather(lat2, lon2)
                            if weather:
                                weather_cache[wkey] = weather
                                weather_misses += 1
                        else:
                            weather_skipped += 1
            except Exception:
                weather = None

            if not weather:
                weather = empty_weather

            writer.writerow({
                "incident_id": row.get("incident_id", ""),
                "source": row.get("source", ""),
                "incident_type": row.get("incident_type", ""),
                "severity": row.get("severity", ""),
                "status": row.get("status", ""),
                "city": row.get("city", ""),
                "country": row.get("country", ""),
                "continent": row.get("continent", ""),
                "lat": row.get("lat", ""),
                "lon": row.get("lon", ""),
                "location_accuracy_m": row.get("location_accuracy_m", ""),
                "reported_at": row.get("reported_at", ""),
                "validated_at": row.get("validated_at", ""),
                "resolved_at": row.get("resolved_at", ""),
                "last_update_utc": row.get("last_update_utc", ""),
                "assigned_unit": row.get("assigned_unit", ""),
                "resources_count": row.get("resources_count", ""),
                "response_eta_min": row.get("response_eta_min", ""),
                "response_time_min": row.get("response_time_min", ""),
                "estimated_cost_eur": f"{cost_eur:.2f}",
                "estimated_cost_usd": f"{cost_usd:.2f}",
                "risk_score": row.get("risk_score", ""),
                "location_corrected": row.get("location_corrected", ""),
                "tags": row.get("tags", ""),
                "notes": row.get("notes", ""),
                "fx_eur_usd": fx_usd,
                "weather_source": weather.get("weather_source", ""),
                "weather_temperature_c": weather.get("weather_temperature_c", ""),
                "weather_wind_kmh": weather.get("weather_wind_kmh", ""),
                "weather_precip_mm": weather.get("weather_precip_mm", ""),
                "weather_code": weather.get("weather_code", ""),
                "weather_time_utc": weather.get("weather_time_utc", ""),
                "mapper_version": mapper_version,
                "processed_at_utc": processed_at,
            })

    elapsed = time.time() - t0
    rps = rows_written / elapsed if elapsed > 0 else 0.0
    print(f"[Processor] mapping done -> rows={rows_written} elapsed={elapsed:.1f}s (~{rps:.1f} rows/s)")
    print(
        "[Processor] weather stats -> "
        f"budget={MAX_WEATHER_CALLS_PER_FILE} calls={weather_calls} hits={weather_hits} "
        f"misses={weather_misses} skipped={weather_skipped} cache_entries={len(weather_cache)}"
    )


def upload_processed_csv(s3, local_path: str, original_key: str) -> str:
    base_name = os.path.basename(original_key).replace(".csv", "")
    out_key = f"{OUT_PREFIX}{base_name}_mapped.csv"
    s3.upload_file(local_path, BUCKET, out_key)
    return out_key


def delete_original(s3, key: str):
    s3.delete_object(Bucket=BUCKET, Key=key)


# -----------------------------
# Webhook gating (finalize)
# -----------------------------
def finalize_ready_ingests(s3):
    """
    Finaliza pendentes quando existir webhook_event.
    Tudo dentro de 1 lock (sem lost updates).
    """

    def _tx(state: Dict[str, Any]):
        pending: Dict[str, Any] = state.get("pending_ingests", {}) or {}
        events: Dict[str, Any] = state.get("webhook_events", {}) or {}

        if not pending:
            return

        done_request_ids: List[str] = []

        # Iterar snapshot (para poderes remover do pending em segurança)
        for request_id, pinfo in list(pending.items()):
            ev = events.get(request_id)
            if not ev:
                continue

            status = (ev.get("status") or "").upper()
            source_key = pinfo["source_key"]
            mapped_local_path = pinfo["mapped_local_path"]

            if status == "OK":
                out_key = upload_processed_csv(s3, mapped_local_path, source_key)
                delete_original(s3, source_key)

                if source_key not in state["processed_keys"]:
                    state["processed_keys"].append(source_key)

                state["ingest_results"][source_key] = {
                    "request_id": request_id,
                    "status": "OK",
                    "db_document_id": ev.get("db_document_id"),
                    "xml_service_response": pinfo.get("xml_service_response"),
                    "webhook_event": ev,
                }

                print(
                    f"[Processor] FINALIZED OK -> uploaded={out_key} deleted={source_key} request_id={request_id}"
                )
                done_request_ids.append(request_id)

            else:
                state["ingest_results"][source_key] = {
                    "request_id": request_id,
                    "status": status,
                    "error": ev.get("error"),
                    "xml_service_response": pinfo.get("xml_service_response"),
                    "webhook_event": ev,
                }
                print(
                    f"[Processor] FINALIZED ERROR -> status={status} source={source_key} request_id={request_id} error={ev.get('error')}"
                )
                done_request_ids.append(request_id)

        # limpeza
        for rid in done_request_ids:
            pending.pop(rid, None)
            events.pop(rid, None)

        state["pending_ingests"] = pending
        state["webhook_events"] = events

    with_locked_state(STATE_PATH, INIT_STATE, _tx)


def register_pending_ingest(request_id: str, entry: Dict[str, Any]):
    """
    Regista pending dentro de lock para não atropelar updates do webhook.
    """
    def _tx(state: Dict[str, Any]):
        state.setdefault("pending_ingests", {})
        state["pending_ingests"][request_id] = entry

    with_locked_state(STATE_PATH, INIT_STATE, _tx)


# -----------------------------
# Main loop
# -----------------------------
def main():
    ensure_tmp()
    s3 = s3_client()

    print(f"[Processor] Bucket: {BUCKET}")
    print(f"[Processor] Watching prefix: {IN_PREFIX}")
    print(f"[Processor] Output prefix: {OUT_PREFIX}")
    print(f"[Processor] Poll interval: {POLL_SECONDS}s")
    print(f"[Processor] Progress every: {PROGRESS_EVERY} rows")

    while True:
        try:
            # 0) Finalize pendentes (gate real)
            finalize_ready_ingests(s3)

            # 1) Ler state para ver se ainda há pendentes
            state = with_locked_state(STATE_PATH, INIT_STATE, lambda s: None)

            if state.get("pending_ingests"):
                print(f"[Processor] {len(state['pending_ingests'])} pending ingests -> waiting webhook (not taking new files)")
                time.sleep(POLL_SECONDS)
                continue

            # 2) Normal processing
            fx = fetch_fx_eur_usd()
            processed_keys = state.get("processed_keys", [])
            new_keys = list_new_csv_objects(s3, processed_keys)

            if not new_keys:
                print("[Processor] No new CSVs found.")
                time.sleep(POLL_SECONDS)
                continue

            for key in new_keys:
                print(f"[Processor] Processing: {key}")

                try:
                    input_stream = download_object_to_memory(s3, key)

                    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    base = os.path.basename(key).replace(".csv", "")
                    local_out = os.path.join(TMP_DIR, f"{base}_mapped_{ts}.csv")

                    write_mapped_csv(local_out, input_stream, fx)

                    resp = send_to_xml_service(local_out, key)
                    request_id = resp.get("_request_id")
                    print(f"[Processor] XML ingest ACK -> request_id={request_id} resp={resp}")

                    if not request_id:
                        raise RuntimeError("XML Service response missing _request_id (cannot gate via webhook)")

                    register_pending_ingest(request_id, {
                        "source_key": key,
                        "mapped_local_path": local_out,
                        "created_at_utc": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
                        "xml_service_response": resp,
                    })

                    print(f"[Processor] PENDING -> waiting webhook for request_id={request_id} source={key}")

                except Exception as e:
                    print(f"[Processor] FAILED for {key}: {e}")
                    continue

        except Exception as e:
            print(f"[Processor] LOOP ERROR: {e}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()