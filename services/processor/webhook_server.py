from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from datetime import datetime
from dotenv import load_dotenv

from state_store import with_locked_state  # <-- NOVO

load_dotenv()

TMP_DIR = os.getenv("PROCESSOR_LOCAL_TMP", "tmp")
STATE_PATH = os.path.join(TMP_DIR, "processor_state.json")

INIT_STATE = {
    "processed_keys": [],
    "ingest_results": {},
    "pending_ingests": {},
    "webhook_events": {},
}


def _ensure_tmp():
    os.makedirs(TMP_DIR, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook/xml-status":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else ""

        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {}

        request_id = payload.get("request_id") or "unknown"
        status = payload.get("status") or "unknown"
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

        print(f"[Webhook] Received status={status} request_id={request_id} payload={payload}")

        _ensure_tmp()

        def _tx(state):
            state.setdefault("webhook_events", {})
            state["webhook_events"][request_id] = {
                "received_at_utc": now,
                **payload
            }

        # Lock por ficheiro + escrita atómica (sem lost updates)
        with_locked_state(STATE_PATH, INIT_STATE, _tx)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))


if __name__ == "__main__":
    _ensure_tmp()
    print("[Webhook] Listening on :8000 (POST /webhook/xml-status)")
    HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()