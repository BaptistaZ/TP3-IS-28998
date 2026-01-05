import os
import time
import requests
from typing import Optional, Dict, Any, Tuple

WEATHER_ENABLED = os.getenv("WEATHER_ENABLED", "0") == "1"
BASE_URL = os.getenv("WEATHER_API_BASE_URL", "https://api.open-meteo.com/v1/forecast")
TIMEOUT = float(os.getenv("WEATHER_TIMEOUT_SECONDS", "1"))
CACHE_TTL = int(os.getenv("WEATHER_CACHE_TTL_SECONDS", "86400"))

# 2 casas = ~1km; 1 casa = ~11km (muito mais rápido)
ROUND_DECIMALS = int(os.getenv("WEATHER_ROUND_DECIMALS", "1"))

# Rate limit
WEATHER_RPS = float(os.getenv("WEATHER_RPS", "5"))
_MIN_INTERVAL = (1.0 / WEATHER_RPS) if WEATHER_RPS > 0 else 0.0
_last_request_ts = 0.0

# Fail protection
FAIL_STREAK_MAX = int(os.getenv("WEATHER_FAIL_STREAK_MAX", "5"))
FAIL_COOLDOWN_SECONDS = int(os.getenv("WEATHER_FAIL_COOLDOWN_SECONDS", "60"))

_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_fail_streak = 0
_cooldown_until = 0.0

# Reutiliza ligações HTTP
_session = requests.Session()


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    item = _cache.get(key)
    if not item:
        return None
    expires_at, data = item
    if time.time() > expires_at:
        _cache.pop(key, None)
        return None
    return data


def _cache_set(key: str, data: Dict[str, Any]) -> None:
    _cache[key] = (time.time() + CACHE_TTL, data)


def _rate_limit_sleep() -> None:
    global _last_request_ts
    if _MIN_INTERVAL <= 0:
        return
    now = time.time()
    wait = (_last_request_ts + _MIN_INTERVAL) - now
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.time()


def fetch_weather(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    global _fail_streak, _cooldown_until

    if not WEATHER_ENABLED:
        return None

    now = time.time()
    if now < _cooldown_until:
        return None

    lat_n = round(float(lat), ROUND_DECIMALS)
    lon_n = round(float(lon), ROUND_DECIMALS)
    key = f"{lat_n:.{ROUND_DECIMALS}f}:{lon_n:.{ROUND_DECIMALS}f}"

    cached = _cache_get(key)
    if cached:
        return cached

    params = {
        "latitude": lat_n,
        "longitude": lon_n,
        "current": "temperature_2m,wind_speed_10m,precipitation,weather_code",
        "timezone": "UTC",
    }

    try:
        _rate_limit_sleep()
        r = _session.get(BASE_URL, params=params, timeout=TIMEOUT)
        r.raise_for_status()
        j = r.json()

        cur = (j.get("current") or {})
        data = {
            "weather_source": "open-meteo",
            "weather_temperature_c": cur.get("temperature_2m"),
            "weather_wind_kmh": cur.get("wind_speed_10m"),
            "weather_precip_mm": cur.get("precipitation"),
            "weather_code": cur.get("weather_code"),
            "weather_time_utc": cur.get("time"),
        }

        _cache_set(key, data)
        _fail_streak = 0
        return data

    except Exception as e:
        print(f"[Weather] fetch failed key={key}: {e}")

        _fail_streak += 1
        if _fail_streak >= FAIL_STREAK_MAX:
            _cooldown_until = time.time() + FAIL_COOLDOWN_SECONDS
            print(f"[Weather] too many failures -> cooldown {FAIL_COOLDOWN_SECONDS}s (streak={_fail_streak})")
            _fail_streak = 0

        return None