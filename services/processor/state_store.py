import os, json, tempfile, fcntl
from typing import Dict, Any, Callable

def _atomic_write_json(path: str, data: Dict[str, Any]):
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="state_", suffix=".json", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass

def with_locked_state(path: str, init_state: Dict[str, Any], fn: Callable[[Dict[str, Any]], None]) -> Dict[str, Any]:
    """
    Lock partilhado por ficheiro (flock) para evitar lost updates.
    Lê -> aplica fn(state) -> escreve de forma atómica -> devolve state.
    """
    lock_path = path + ".lock"
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    with open(lock_path, "w") as lockf:
        fcntl.flock(lockf, fcntl.LOCK_EX)

        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
        else:
            state = dict(init_state)

        # defaults
        state.setdefault("processed_keys", [])
        state.setdefault("ingest_results", {})
        state.setdefault("pending_ingests", {})
        state.setdefault("webhook_events", {})

        fn(state)

        _atomic_write_json(path, state)

        fcntl.flock(lockf, fcntl.LOCK_UN)

    return state