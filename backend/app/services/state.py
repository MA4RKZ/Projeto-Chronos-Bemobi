import json, os, time
from typing import Dict, Any

STATE_DIR = "app/data/state"
STATE_PATH = os.path.join(STATE_DIR, "stats.json")
DEFAULT = {"searches": 0, "chats": 0, "vectors": 0, "last_ingest": None}

def _ensure_dir():
    os.makedirs(STATE_DIR, exist_ok=True)

def _read() -> Dict[str, Any]:
    _ensure_dir()
    if not os.path.exists(STATE_PATH):
        _write(DEFAULT)
    with open(STATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def _write(obj: Dict[str, Any]):
    _ensure_dir()
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def get_stats() -> Dict[str, Any]:
    return _read()

def set_vectors(n: int):
    s = _read()
    s["vectors"] = n
    _write(s)

def mark_ingest_now():
    s = _read()
    s["last_ingest"] = int(time.time())
    _write(s)

def inc(key: str, by: int = 1):
    s = _read()
    s[key] = int(s.get(key, 0)) + by
    _write(s)
