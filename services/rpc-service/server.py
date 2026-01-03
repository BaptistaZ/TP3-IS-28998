import os
from pathlib import Path
from xmlrpc.server import SimpleXMLRPCServer, SimpleXMLRPCRequestHandler

import requests
from dotenv import load_dotenv

# -----------------------------
# Load root .env (project-level)
# -----------------------------
ROOT_ENV = (Path(__file__).resolve().parents[2] / ".env")
load_dotenv(dotenv_path=ROOT_ENV)


class RequestHandler(SimpleXMLRPCRequestHandler):
    # Restrict XML-RPC calls to /RPC2 
    rpc_paths = ("/RPC2",)


def _fetch_fx_eur_usd() -> float:
    """
    Fetch EUR->USD exchange rate from external API (Frankfurter by default).
    Returns a float rate.
    """
    fx_url = os.getenv("EXTERNAL_API_FX_URL", "https://api.frankfurter.app/latest?from=EUR&to=USD")
    r = requests.get(fx_url, timeout=8)
    r.raise_for_status()
    data = r.json()

    # Frankfurter format: {"rates":{"USD":<rate>}, ...}
    if "rates" in data and "USD" in data["rates"]:
        return float(data["rates"]["USD"])

    # Generic fallback format (some providers): {"conversion_rates":{"USD":<rate>}}
    if "conversion_rates" in data and "USD" in data["conversion_rates"]:
        return float(data["conversion_rates"]["USD"])

    raise RuntimeError(f"Unexpected FX API response: {data}")


def ping() -> str:
    """Health-check method for evidence and quick debugging."""
    return "pong"


def get_eur_usd_rate() -> float:
    """
    XML-RPC method used by Processor.
    It calls an external REST API and returns the EUR->USD rate.
    """
    return _fetch_fx_eur_usd()


def main() -> None:
    host = os.getenv("RPC_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("RPC_SERVICE_PORT", "9000"))

    server = SimpleXMLRPCServer(
        (host, port),
        requestHandler=RequestHandler,
        allow_none=True,
        logRequests=True,  # logs each XML-RPC call (good for evidence)
    )

    server.register_introspection_functions()
    server.register_function(ping, "ping")
    server.register_function(get_eur_usd_rate, "get_eur_usd_rate")

    print(f"[XML-RPC] Listening on http://{host}:{port}/RPC2")
    server.serve_forever()


if __name__ == "__main__":
    main()