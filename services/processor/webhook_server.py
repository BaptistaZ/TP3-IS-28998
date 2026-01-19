from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from datetime import datetime

from dotenv import load_dotenv
from state_store import with_locked_state

load_dotenv()

# Shared state file used by the Processor to correlate webhook callbacks with pending ingests.
TMP_DIR = os.getenv("PROCESSOR_LOCAL_TMP", "tmp")
STATE_PATH = os.path.join(TMP_DIR, "processor_state.json")

# Minimal state shape (also used as a fallback if the state file does not exist yet).
INIT_STATE = {
    "processed_keys": [],
    "ingest_results": {},
    "pending_ingests": {},
    "webhook_events": {},
}


def _ensure_tmp() -> None:
    # The webhook container shares /app/tmp with the Processor via a Docker volume.
    os.makedirs(TMP_DIR, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Only one callback endpoint is expected in this project.
        if self.path != "/webhook/xml-status":
            self.send_response(404)
            self.end_headers()
            return

        # XML Service posts a small JSON payload with request_id/status (+ optional db_document_id/error).
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else ""

        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            # Treat invalid JSON as empty payload (keeps the server resilient).
            payload = {}

        # request_id is the correlation key between Processor -> XML Service -> Webhook.
        request_id = payload.get("request_id") or "unknown"
        status = payload.get("status") or "unknown"
        now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

        print(
            f"[Webhook] Received status={status} request_id={request_id} payload={payload}"
        )

        _ensure_tmp()

        def _tx(state):
            # Store latest callback per request_id (Processor polls/reads this to finalize S3 moves).
            state.setdefault("webhook_events", {})
            state["webhook_events"][request_id] = {
                "received_at_utc": now,
                **payload,
            }

        # Serialize updates to the JSON file to avoid races and partial writes.
        with_locked_state(STATE_PATH, INIT_STATE, _tx)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))


if __name__ == "__main__":
    _ensure_tmp()
    print("[Webhook] Listening on :8000 (POST /webhook/xml-status)")
    HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
