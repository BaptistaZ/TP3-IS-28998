import os
import json
import tempfile
import fcntl
from typing import Dict, Any, Callable

# Helper to write JSON atomically to a file.


def _atomic_write_json(path: str, data: Dict[str, Any]) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(
        prefix="state_", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())

        # Atomic on POSIX when source/target are on the same filesystem.
        os.replace(tmp_path, path)
    finally:
        # Best-effort cleanup if something failed before replace().
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass


# Main function to manage state with locking.
def with_locked_state(
    path: str,
    init_state: Dict[str, Any],
    fn: Callable[[Dict[str, Any]], None],
) -> Dict[str, Any]:
    lock_path = path + ".lock"
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    # Lock file handle must remain open while holding the lock.
    with open(lock_path, "w") as lockf:
        fcntl.flock(lockf, fcntl.LOCK_EX)

        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
        else:
            state = dict(init_state)

        # Ensure expected shape (backward compatible if schema evolves).
        state.setdefault("processed_keys", [])
        state.setdefault("ingest_results", {})
        state.setdefault("pending_ingests", {})
        state.setdefault("webhook_events", {})

        # Apply the caller's mutation under the lock.
        fn(state)

        # Persist atomically before releasing the lock.
        _atomic_write_json(path, state)

        # Explicit unlock (optional; context exit would close the file anyway).
        fcntl.flock(lockf, fcntl.LOCK_UN)

    return state
