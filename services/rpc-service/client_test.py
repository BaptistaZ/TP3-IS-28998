import os
from pathlib import Path
from xmlrpc.client import ServerProxy

from dotenv import load_dotenv

ROOT_ENV = (Path(__file__).resolve().parents[2] / ".env")
load_dotenv(dotenv_path=ROOT_ENV)

def main():
    host = os.getenv("RPC_SERVICE_HOST", "localhost")
    port = int(os.getenv("RPC_SERVICE_PORT", "9000"))

    url = f"http://{host}:{port}/RPC2"
    client = ServerProxy(url, allow_none=True)

    print("[Client] ping ->", client.ping())
    print("[Client] get_eur_usd_rate ->", client.get_eur_usd_rate())

if __name__ == "__main__":
    main()