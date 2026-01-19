import os
import time
from datetime import datetime

import boto3
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# Environment / Configuration
# =============================================================================

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

ONE_SHOT = os.getenv("CRAWLER_ONE_SHOT", "0") == "1"


# =============================================================================
# S3 (Supabase Storage) Client
# =============================================================================

def _validate_env() -> None:
    missing = [
        name
        for name, value in {
            "SUPABASE_S3_ENDPOINT": ENDPOINT,
            "SUPABASE_S3_ACCESS_KEY": ACCESS_KEY,
            "SUPABASE_S3_SECRET_KEY": SECRET_KEY,
            "SUPABASE_BUCKET_NAME": BUCKET,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")


def get_s3():
    _validate_env()

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


# =============================================================================
# Upload Logic (split CSV into parts)
# =============================================================================

def upload_once(s3) -> int:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_key = f"{INCOMING_PREFIX}incidents_28998_{ts}"

    with open(SAMPLE_PATH, "r", encoding="utf-8", newline="") as f:
        lines = f.read().splitlines()

    if not lines:
        print("[Crawler] Input CSV is empty. Nothing to upload.")
        return 0

    header = lines[0]
    rows = lines[1:]
    if not rows:
        print("[Crawler] Input CSV has only header. Nothing to upload.")
        return 0

    part_idx = 1
    current_bytes = 0
    buffer_lines = []
    uploaded_parts = 0

    def flush_part(lines_part, idx) -> None:
        nonlocal uploaded_parts
        if not lines_part:
            return

        key = f"{base_key}_part{idx:04d}.csv"
        body = "\n".join([header] + lines_part) + "\n"

        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=body.encode("utf-8"),
        )

        uploaded_parts += 1
        print(f"[Crawler] Uploaded -> {key} ({len(body) / 1024:.1f} KB)")

    for line in rows:
        line_bytes = len(line.encode("utf-8")) + 1  # newline
        if current_bytes + line_bytes > MAX_BYTES and buffer_lines:
            flush_part(buffer_lines, part_idx)
            part_idx += 1
            buffer_lines = []
            current_bytes = 0

        buffer_lines.append(line)
        current_bytes += line_bytes

    flush_part(buffer_lines, part_idx)
    return uploaded_parts


# =============================================================================
# Main Loop
# =============================================================================

def main():
    s3 = get_s3()

    print(f"[Crawler] Bucket: {BUCKET}")
    print(f"[Crawler] Source: {SAMPLE_PATH}")
    print(f"[Crawler] Incoming prefix: {INCOMING_PREFIX}")
    print(f"[Crawler] Max part bytes: {MAX_BYTES}")
    print(f"[Crawler] Poll interval: {POLL_SECONDS}s")
    print(f"[Crawler] One-shot: {ONE_SHOT}")

    parts = upload_once(s3)
    print(f"[Crawler] Batch uploaded parts: {parts}")

    if ONE_SHOT:
        print("[Crawler] ONE_SHOT=1 -> done (exiting).")
        return

    while True:
        time.sleep(POLL_SECONDS)
        parts = upload_once(s3)
        print(f"[Crawler] Batch uploaded parts: {parts}")


if __name__ == "__main__":
    main()