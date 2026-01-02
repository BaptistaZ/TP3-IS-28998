import os
import time
from datetime import datetime

import boto3
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv()

ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
REGION = os.getenv("SUPABASE_S3_REGION", "eu-central-1")
ACCESS_KEY = os.getenv("SUPABASE_S3_ACCESS_KEY")
SECRET_KEY = os.getenv("SUPABASE_S3_SECRET_KEY")
BUCKET = os.getenv("SUPABASE_BUCKET_NAME")

POLL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))
SAMPLE_PATH = os.getenv("CRAWLER_SAMPLE_CSV",
                        "samples/sample_market_28998.csv")


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
    key = f"incoming/sample_market_28998_{ts}.csv"
    s3.upload_file(SAMPLE_PATH, BUCKET, key)
    print(f"[Crawler] Upload OK -> s3://{BUCKET}/{key}")


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
