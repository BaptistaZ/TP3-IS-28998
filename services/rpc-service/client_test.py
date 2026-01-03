import os
from xmlrpc.client import ServerProxy
from dotenv import load_dotenv

load_dotenv()

def main():
    host = os.getenv("RPC_SERVICE_HOST", "localhost")
    port = int(os.getenv("RPC_SERVICE_PORT", "9000"))
    url = f"http://{host}:{port}/RPC2"

    client = ServerProxy(url, allow_none=True)
    rate = client.get_eur_usd_rate()
    print(f"[client] get_eur_usd_rate -> {rate}")

if __name__ == "__main__":
    main()