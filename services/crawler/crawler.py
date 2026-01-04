import os
import time
from datetime import datetime

import boto3
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv()

MAX_BYTES = int(os.getenv("CRAWLER_MAX_PART_BYTES", str(5 * 1024 * 1024)))

ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
REGION = os.getenv("SUPABASE_S3_REGION", "eu-central-1")
ACCESS_KEY = os.getenv("SUPABASE_S3_ACCESS_KEY")
SECRET_KEY = os.getenv("SUPABASE_S3_SECRET_KEY")
BUCKET = os.getenv("SUPABASE_BUCKET_NAME")

POLL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))

INCOMING_PREFIX = os.getenv("SUPABASE_INCOMING_PREFIX", "incoming/")
if not INCOMING_PREFIX.endswith("/"):
    INCOMING_PREFIX += "/"
    
SAMPLE_PATH = os.getenv("CRAWLER_SAMPLE_CSV", "datasets/generated/incidents_50mb.csv")


def get_s3():
    missing = [k for k, v in {
        "SUPABASE_S3_ENDPOINT": ENDPOINT,
        "SUPABASE_S3_ACCESS_KEY": ACCESS_KEY,
        "SUPABASE_S3_SECRET_KEY": SECRET_KEY,
        "SUPABASE_BUCKET_NAME": BUCKET,
    }.items() if not v]
    if missing:
        raise RuntimeError(f"Faltam variáveis no .env: {', '.join(missing)}")

    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        region_name=REGION,
    )


def upload_once(s3):
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_key = f"incoming/incidents_28998_{ts}"

    part_idx = 1
    current_bytes = 0
    buffer_lines = []

    with open(SAMPLE_PATH, "r", encoding="utf-8", newline="") as f:
        reader = f.read().splitlines()
        if not reader:
            print("[Crawler] CSV vazio, nada a enviar.")
            return

        header = reader[0]
        rows = reader[1:]

        def flush_part(lines, idx):
            if not lines:
                return
            key = f"{base_key}_part{idx:04d}.csv"
            body = "\n".join([header] + lines) + "\n"
            s3.put_object(Bucket=BUCKET, Key=key, Body=body.encode("utf-8"))
            print(f"[Crawler] Uploaded -> {key} ({len(body)/1024:.1f} KB)")

        for line in rows:
            line_bytes = len(line.encode("utf-8")) + 1  
            if current_bytes + line_bytes > MAX_BYTES and buffer_lines:
                flush_part(buffer_lines, part_idx)
                part_idx += 1
                buffer_lines = []
                current_bytes = 0

            buffer_lines.append(line)
            current_bytes += line_bytes

        flush_part(buffer_lines, part_idx)


def main():
    s3 = get_s3()
    print(f"[Crawler] Bucket: {BUCKET}")
    print(f"[Crawler] Source: {SAMPLE_PATH}")
    print(f"[Crawler] Intervalo: {POLL_SECONDS}s")

    while True:
        upload_once(s3)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
