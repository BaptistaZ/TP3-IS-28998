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
        return r.json()


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
# State handling
# -----------------------------
def load_state() -> Dict[str, Any]:
    """
    State is used to avoid reprocessing the same S3 keys.
    """
    if not os.path.exists(STATE_PATH):
        return {"processed_keys": [], "ingest_results": {}}

    with open(STATE_PATH, "r", encoding="utf-8") as f:
        state = json.load(f)

    # Backward-compatible defaults
    state.setdefault("processed_keys", [])
    state.setdefault("ingest_results", {})
    return state


def save_state(state: Dict[str, Any]):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


# -----------------------------
# External enrichment
# -----------------------------

def _to_float(value: Any) -> float:
    # xmlrpc pode devolver coisas "estranhas" para o type-checker
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, bytes):
        return float(value.decode("utf-8").strip())
    if hasattr(value, "data") and isinstance(getattr(value, "data"), (bytes, bytearray)):
        # xmlrpc.client.Binary -> tem .data (bytes)
        return float(value.data.decode("utf-8").strip())
    # fallback: str()
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
        # XML-RPC call (Protocol: RPC/XML-RPC)
        client = ServerProxy(rpc_url, allow_none=True)

        rate = client.get_eur_usd_rate()
        rate_f = _to_float(rate)

        # Evidence: confirms the FX rate was obtained via XML-RPC
        print(f"[Processor] FX via XML-RPC OK -> {rate_f}")

        return rate_f

    except Exception as e:
        # Fallback to REST FX API (keeps pipeline resilient)
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
    # Sort oldest -> newest
    items.sort(key=lambda x: x["LastModified"])

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
    """
    Stream read + stream write (row by row).
    """
    reader = csv.DictReader(input_stream)

    fieldnames = [
        "incident_id",
        "source",
        "incident_type",
        "severity",
        "status",
        "city",
        "country",
        "continent",
        "lat",
        "lon",
        "location_accuracy_m",
        "reported_at",
        "validated_at",
        "resolved_at",
        "last_update_utc",
        "assigned_unit",
        "resources_count",
        "response_eta_min",
        "response_time_min",
        "estimated_cost_eur",
        "estimated_cost_usd",
        "risk_score",
        "location_corrected",
        "tags",
        "notes",
        "fx_eur_usd",
        "mapper_version",
        "processed_at_utc",
    ]

    processed_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    mapper_version = os.getenv("MAPPER_VERSION", "1.0.0")

    with open(local_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            cost_eur_str = (row.get("estimated_cost_eur") or "").strip()
            cost_eur = float(cost_eur_str) if cost_eur_str else 0.0
            cost_usd = round(cost_eur * fx_usd, 6)

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
                "mapper_version": mapper_version,
                "processed_at_utc": processed_at,
            })


def upload_processed_csv(s3, local_path: str, original_key: str) -> str:
    base_name = os.path.basename(original_key).replace(".csv", "")
    out_key = f"{OUT_PREFIX}{base_name}_mapped.csv"
    s3.upload_file(local_path, BUCKET, out_key)
    return out_key


def delete_original(s3, key: str):
    s3.delete_object(Bucket=BUCKET, Key=key)


# -----------------------------
# Main loop
# -----------------------------
def main():
    ensure_tmp()
    s3 = s3_client()
    state = load_state()

    print(f"[Processor] Bucket: {BUCKET}")
    print(f"[Processor] Watching prefix: {IN_PREFIX}")
    print(f"[Processor] Output prefix: {OUT_PREFIX}")
    print(f"[Processor] Poll interval: {POLL_SECONDS}s")

    while True:
        try:
            fx = fetch_fx_eur_usd()
            new_keys = list_new_csv_objects(s3, state["processed_keys"])

            if not new_keys:
                print("[Processor] No new CSVs found.")
                time.sleep(POLL_SECONDS)
                continue

            for key in new_keys:
                print(f"[Processor] Processing: {key}")

                try:
                    input_stream = download_object_to_memory(s3, key)

                    # Use a unique local filename (avoid overwriting)
                    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                    base = os.path.basename(key).replace(".csv", "")
                    local_out = os.path.join(TMP_DIR, f"{base}_mapped_{ts}.csv")

                    # Generate mapped CSV locally
                    write_mapped_csv(local_out, input_stream, fx)

                    # 1) Send to XML Service (automatic ingest)
                    resp = send_to_xml_service(local_out, key)
                    print(f"[Processor] XML ingest OK -> {resp}")

                    # Save ingest response for traceability/reporting
                    state["ingest_results"][key] = resp

                    # 2) Only after ingest success:
                    #    - upload to processed/
                    #    - delete from incoming/
                    #    - mark as processed in local state
                    out_key = upload_processed_csv(s3, local_out, key)
                    delete_original(s3, key)

                    state["processed_keys"].append(key)
                    save_state(state)

                    print(f"[Processor] OK -> uploaded: {out_key} | deleted: {key}")

                except Exception as e:
                    # Do NOT delete the original S3 object and do NOT mark it as processed.
                    # This allows retry on the next cycle.
                    print(f"[Processor] FAILED for {key}: {e}")
                    continue

        except Exception as e:
            print(f"[Processor] LOOP ERROR: {e}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()