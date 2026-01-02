import os
import time
import json
from datetime import datetime
import csv
import io

import boto3
from botocore.client import Config
import requests
from dotenv import load_dotenv

load_dotenv()

ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
REGION = os.getenv("SUPABASE_S3_REGION", "eu-central-1")
ACCESS_KEY = os.getenv("SUPABASE_S3_ACCESS_KEY")
SECRET_KEY = os.getenv("SUPABASE_S3_SECRET_KEY")
BUCKET = os.getenv("SUPABASE_BUCKET_NAME")

IN_PREFIX = os.getenv("SUPABASE_INCOMING_PREFIX", "incoming/")
OUT_PREFIX = os.getenv("SUPABASE_PROCESSED_PREFIX", "processed/")
POLL_SECONDS = int(os.getenv("PROCESSOR_POLL_SECONDS", "10"))
TMP_DIR = os.getenv("PROCESSOR_LOCAL_TMP", "tmp")

FX_URL = os.getenv("EXTERNAL_API_FX_URL", "https://api.exchangerate.host/latest?base=EUR&symbols=USD")

STATE_PATH = os.path.join(TMP_DIR, "processor_state.json")

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

def load_state():
    if not os.path.exists(STATE_PATH):
        return {"processed_keys": []}
    with open(STATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
    
def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def fetch_fx_eur_usd():
    r = requests.get(FX_URL, timeout=8)
    r.raise_for_status()
    data = r.json()

    # Formato esperado (Frankfurter): {"rates":{"USD":1.0}, ...}
    if "rates" in data and "USD" in data["rates"]:
        return float(data["rates"]["USD"])

    # Fallback (algumas APIs tipo open.er-api.com): {"conversion_rates":{"USD":...}}
    if "conversion_rates" in data and "USD" in data["conversion_rates"]:
        return float(data["conversion_rates"]["USD"])

    raise RuntimeError(f"Resposta inesperada da FX API: {data}")

def list_new_csv_objects(s3, processed_keys):
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=IN_PREFIX)
    items = resp.get("Contents", [])
    # ordena do mais antigo para o mais recente
    items.sort(key=lambda x: x["LastModified"])
    keys = [it["Key"] for it in items if it["Key"].endswith(".csv")]
    return [k for k in keys if k not in processed_keys]

def download_object_to_memory(s3, key) -> io.StringIO:
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    body = obj["Body"].read()
    return io.StringIO(body.decode("utf-8"))

def write_mapped_csv(local_path, input_stream, fx_usd):
    """
    Lê em stream e escreve em stream (linha a linha).
    Mapeia nomes do CSV para nomes do domínio e adiciona enriquecimento.
    """
    reader = csv.DictReader(input_stream)
    fieldnames = [
        "internal_id",
        "symbol",
        "category",
        "price_eur",
        "price_usd",      
        "volume",
        "fx_eur_usd",     
        "mapper_version",
        "processed_at_utc",
    ]

    processed_at = datetime.utcnow().isoformat()

    with open(local_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            price_eur = float(row["preco"])
            price_usd = round(price_eur * fx_usd, 6)

            writer.writerow({
                "internal_id": row["id_interno"],
                "symbol": row["ticker"],
                "category": row["tipo"],
                "price_eur": price_eur,
                "price_usd": price_usd,
                "volume": int(row["volume"]),
                "fx_eur_usd": fx_usd,
                "mapper_version": os.getenv("MAPPER_VERSION", "1.0.0"),
                "processed_at_utc": processed_at,
            })

def upload_processed_csv(s3, local_path, original_key):
    base_name = os.path.basename(original_key).replace(".csv", "")
    out_key = f"{OUT_PREFIX}{base_name}_mapped.csv"
    s3.upload_file(local_path, BUCKET, out_key)
    return out_key

def delete_original(s3, key):
    s3.delete_object(Bucket=BUCKET, Key=key)

def main():
    ensure_tmp()
    s3 = s3_client()
    state = load_state()

    print(f"[Processor] Bucket: {BUCKET}")
    print(f"[Processor] Watching: {IN_PREFIX}")
    print(f"[Processor] Output: {OUT_PREFIX}")
    print(f"[Processor] Poll: {POLL_SECONDS}s")

    while True:
        try:
            fx = fetch_fx_eur_usd()
            new_keys = list_new_csv_objects(s3, state["processed_keys"])

            if not new_keys:
                print("[Processor] No new CSVs.")
                time.sleep(POLL_SECONDS)
                continue

            for key in new_keys:
                print(f"[Processor] Processing: {key}")

                input_stream = download_object_to_memory(s3, key)
                local_out = os.path.join(TMP_DIR, "mapped_output.csv")

                write_mapped_csv(local_out, input_stream, fx)
                out_key = upload_processed_csv(s3, local_out, key)

                delete_original(s3, key)

                state["processed_keys"].append(key)
                save_state(state)

                print(f"[Processor] OK -> uploaded: {out_key} | deleted: {key}")

        except Exception as e:
            print(f"[Processor] ERROR: {e}")

        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()