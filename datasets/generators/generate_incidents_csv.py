import argparse
import csv
import json
import random
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path


# ----------------------------
# CSV schema definitions
# ----------------------------
HEADER = [
    "incident_id",
    "source",
    "incident_type",
    "severity",
    "status",
    "lat",
    "lon",
    "city",
    "country",
    "continent",
    "location_accuracy_m",
    "reported_at",
    "validated_at",
    "resolved_at",
    "last_update_utc",
    "assigned_unit",
    "resources_count",
    "response_eta_min",
    "response_time_min",
    "estimated_cost_eur",
    "risk_score",
    "location_corrected",
    "tags",
    "notes",
]


# ----------------------------
# Domain enumerations
# ----------------------------

# Where the incident was reported from
SOURCES = ["citizen", "sensor", "authority", "media"]

# Incident categories
TYPES = ["fire", "flood", "accident", "outage", "medical", "hazard", "crime", "landslide"]

# Workflow status
STATUSES = ["reported", "validated", "in_progress", "resolved", "cancelled"]


# ----------------------------
# World cities seed list
# ----------------------------
CITIES_WORLD = [
    ("Lisbon", "Portugal", "Europe", 38.7223, -9.1393),
    ("Porto", "Portugal", "Europe", 41.1579, -8.6291),
    ("Madrid", "Spain", "Europe", 40.4168, -3.7038),
    ("Paris", "France", "Europe", 48.8566, 2.3522),
    ("London", "United Kingdom", "Europe", 51.5074, -0.1278),
    ("Berlin", "Germany", "Europe", 52.5200, 13.4050),
    ("Rome", "Italy", "Europe", 41.9028, 12.4964),
    ("Athens", "Greece", "Europe", 37.9838, 23.7275),
    ("New York", "USA", "North America", 40.7128, -74.0060),
    ("Los Angeles", "USA", "North America", 34.0522, -118.2437),
    ("Toronto", "Canada", "North America", 43.6532, -79.3832),
    ("Mexico City", "Mexico", "North America", 19.4326, -99.1332),
    ("São Paulo", "Brazil", "South America", -23.5505, -46.6333),
    ("Buenos Aires", "Argentina", "South America", -34.6037, -58.3816),
    ("Santiago", "Chile", "South America", -33.4489, -70.6693),
    ("Lima", "Peru", "South America", -12.0464, -77.0428),
    ("Cairo", "Egypt", "Africa", 30.0444, 31.2357),
    ("Lagos", "Nigeria", "Africa", 6.5244, 3.3792),
    ("Nairobi", "Kenya", "Africa", -1.2921, 36.8219),
    ("Johannesburg", "South Africa", "Africa", -26.2041, 28.0473),
    ("Dubai", "UAE", "Asia", 25.2048, 55.2708),
    ("Mumbai", "India", "Asia", 19.0760, 72.8777),
    ("Delhi", "India", "Asia", 28.6139, 77.2090),
    ("Tokyo", "Japan", "Asia", 35.6762, 139.6503),
    ("Seoul", "South Korea", "Asia", 37.5665, 126.9780),
    ("Bangkok", "Thailand", "Asia", 13.7563, 100.5018),
    ("Singapore", "Singapore", "Asia", 1.3521, 103.8198),
    ("Sydney", "Australia", "Oceania", -33.8688, 151.2093),
    ("Melbourne", "Australia", "Oceania", -37.8136, 144.9631),
    ("Auckland", "New Zealand", "Oceania", -36.8485, 174.7633),
    ("Perth", "Australia", "Oceania", -31.9523, 115.8613),
]


# ----------------------------
# Text fields to make data "feel" real
# ----------------------------

# Tags are useful for search + filtering in UI and XPath queries
TAGS_POOL = [
    "smoke", "highway", "school", "hospital", "downtown", "suburb", "river",
    "powerline", "storm", "crowd", "chemical", "wildfire", "industrial",
    "traffic", "bridge", "evacuation", "hazmat", "blackout", "ambulance",
    "firefighters", "police", "injuries", "collapse", "aftershock"
]

# Short note snippets to emulate operator notes
NOTES_SNIPPETS = [
    "Caller reports heavy smoke in the area.",
    "Multiple vehicles involved. Traffic blocked.",
    "Sensor anomaly detected. Dispatch requested.",
    "Residents report power outage across district.",
    "Possible hazardous material leak. Keep distance.",
    "Flooding observed near river. Roads closed.",
    "Medical assistance requested; patient unconscious.",
    "Authorities validating incident details.",
    "Wind conditions worsening. Escalation possible.",
    "Crowd gathering; police requested for control."
]


# ----------------------------
# Utility helpers
# ----------------------------

# Generate a deterministic-looking ID
def rand_id(prefix: str, n: int = 12) -> str:
    chars = string.ascii_uppercase + string.digits
    return f"{prefix}_" + "".join(random.choice(chars) for _ in range(n))

# Pick a random city and add some noise to lat/lon
def pick_city_world():
    city, country, continent, lat, lon = random.choice(CITIES_WORLD)
    lat += random.uniform(-0.08, 0.08)
    lon += random.uniform(-0.08, 0.08)
    return city, country, continent, round(lat, 6), round(lon, 6)

# Clamp numeric value into [lo, hi]
def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ----------------------------
# Business-rule-like metrics
# ----------------------------

# Rule-based score, it changes with severity, status, source
def compute_risk(severity: int, status: str, source: str) -> float:
    base = severity / 5.0
    status_boost = {
        "reported": 0.05,
        "validated": 0.10,
        "in_progress": 0.15,
        "resolved": -0.20,
        "cancelled": -0.30,
    }.get(status, 0.0)
    source_boost = 0.05 if source == "sensor" else 0.0
    risk = clamp(base + status_boost + source_boost + random.uniform(-0.05, 0.05), 0.0, 1.0)
    return round(risk, 3)

# Estimated cost in euros based on severity, resources, type
def compute_cost(severity: int, resources: int, incident_type: str) -> float:
    type_factor = {
        "fire": 2.2, "flood": 2.0, "accident": 1.4, "outage": 1.3,
        "medical": 1.1, "hazard": 2.5, "crime": 1.2, "landslide": 2.1
    }.get(incident_type, 1.3)
    cost = (severity * 350) * type_factor + resources * random.uniform(120, 600)
    cost *= random.uniform(0.8, 1.3)
    return round(cost, 2)

# Pick a random set of tags
def pick_tags(k_min=1, k_max=4) -> str:
    k = random.randint(k_min, k_max)
    return ";".join(random.sample(TAGS_POOL, k))

# Pick a random note snippet
def pick_notes() -> str:
    s = random.choice(NOTES_SNIPPETS)
    if random.random() < 0.25:
        s += " " + random.choice(["Units en route.", "Awaiting confirmation.", "Area secured.", "Situation evolving."])
    return s


# ----------------------------
# Row generation
# ----------------------------
def generate_row(now_utc: datetime):
    incident_id = rand_id("INC", 14)
    # Sources distribution: mostly citizens, then sensors, then authorities
    source = random.choices(SOURCES, weights=[0.55, 0.20, 0.20, 0.05], k=1)[0]

    # Incident types distribution
    incident_type = random.choices(TYPES, weights=[0.16, 0.10, 0.20, 0.12, 0.16, 0.08, 0.12, 0.06], k=1)[0]

    # severity and status distributions
    severity = random.choices([1, 2, 3, 4, 5], weights=[0.18, 0.28, 0.28, 0.18, 0.08], k=1)[0]

    # Status distribution: many resolved, some active, some cancelled
    status = random.choices(STATUSES, weights=[0.12, 0.20, 0.22, 0.38, 0.08], k=1)[0]

    # Global location (real city + jitter)
    city, country, continent, lat, lon = pick_city_world()

    # Accuracy: sensors are usually more precise than manual reports
    accuracy = random.randint(10, 60) if source == "sensor" else random.randint(30, 250)

    # Reported time within the last 30 days
    reported_at = now_utc - timedelta(minutes=random.randint(0, 60 * 24 * 30))
    reported_at = reported_at.replace(tzinfo=timezone.utc)

    validated_at = ""
    resolved_at = ""
    response_time_min = ""

    #  Assigned unit code
    assigned_unit = f"UNIT_{random.randint(1, 120):03d}"

    # resources based on severity
    resources = random.choices([1, 2, 3, 4, 5, 6], weights=[0.20, 0.25, 0.22, 0.16, 0.10, 0.07], k=1)[0]

    # # ETA: generally faster for higher severity (more urgent dispatch)
    eta = random.randint(3, 45) + (5 - severity) * random.randint(0, 3)  # mais severo -> geralmente mais rápido
    eta = int(clamp(eta, 2, 90))

    # Workflow timestamps depend on status
    if status in ("validated", "in_progress", "resolved"):
        v_dt = reported_at + timedelta(minutes=random.randint(5, 240))
        validated_at = v_dt.isoformat().replace("+00:00", "Z")

    if status == "resolved":
        # response time must be >= ETA; add extra variability.
        rt = random.randint(eta, eta + random.randint(10, 240))
        response_time_min = str(rt)
        r_dt = reported_at + timedelta(minutes=rt + random.randint(15, 720))
        resolved_at = r_dt.isoformat().replace("+00:00", "Z")

    # Sometimes cancelled incidents are also validated (false positives, etc.)
    if status == "cancelled" and random.random() < 0.3:
        v_dt = reported_at + timedelta(minutes=random.randint(5, 240))
        validated_at = v_dt.isoformat().replace("+00:00", "Z")

    # Derived metrics for BI/analytics.
    risk = compute_risk(severity, status, source)
    cost = compute_cost(severity, resources, incident_type)

    # Small chance of location correction after validation
    location_corrected = 1 if random.random() < 0.05 else 0

    # Searchable fields
    tags = pick_tags()
    notes = pick_notes()

    last_update = now_utc.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

    return [
        incident_id,
        source,
        incident_type,
        str(severity),
        status,
        f"{lat:.6f}",
        f"{lon:.6f}",
        city,
        country,
        continent,
        str(accuracy),
        reported_at.isoformat().replace("+00:00", "Z"),
        validated_at,
        resolved_at,
        last_update,
        assigned_unit,
        str(resources),
        str(eta),
        response_time_min,
        f"{cost:.2f}",
        f"{risk:.3f}",
        str(location_corrected),
        tags,
        notes,
    ]

# ----------------------------
# CLI and main loop
# ----------------------------
def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-mb", type=int, required=True, help="Tamanho alvo aproximado em MB (ex.: 50, 200)")
    ap.add_argument("--out", type=str, required=True, help="Caminho do CSV a gerar")
    ap.add_argument("--seed", type=int, default=42, help="Seed para reprodutibilidade")
    ap.add_argument("--manifest-out", type=str, default="", help="Opcional: caminho para manifest JSON")
    return ap.parse_args()

def main():
    args = parse_args()
    random.seed(args.seed)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert MB target into bytes
    target_bytes = args.target_mb * 1024 * 1024
    #  # Use a fixed 'now' per run
    now_utc = datetime.now(timezone.utc)

    rows = 0
    bytes_written = 0

    # Write CSV incrementally until approximate target file size is reached
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        # Write header once
        w.writerow(HEADER)
        f.flush()
        bytes_written = out_path.stat().st_size

        # Generate rows until file size crosses the target
        while bytes_written < target_bytes:
            w.writerow(generate_row(now_utc))
            rows += 1

            if rows % 2000 == 0:
                f.flush()
                bytes_written = out_path.stat().st_size

        f.flush()
        bytes_written = out_path.stat().st_size

    # Build a manifest JSON
    manifest = {
        "name": out_path.name,
        "path": str(out_path),
        "target_mb": args.target_mb,
        "actual_bytes": bytes_written,
        "approx_rows": rows,
        "seed": args.seed,
        "schema": HEADER,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "domain": "emergencies_incidents",
        "notes": "Synthetic global incidents dataset for TP3 pipeline + frontend (map, workflow, timeline, KPIs).",
    }

    manifest_out = args.manifest_out.strip()
    if not manifest_out:
        default_manifest = Path("datasets/manifests") / f"{out_path.stem}.manifest.json"
        default_manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest_out = str(default_manifest)

    with open(manifest_out, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, ensure_ascii=False, indent=2)

    print(f"[OK] CSV gerado: {out_path} ({bytes_written/1024/1024:.2f} MB) ~{rows} linhas")
    print(f"[OK] Manifest: {manifest_out}")

if __name__ == "__main__":
    main()