import os

import grpc
from dotenv import load_dotenv

from generated import bi_pb2, bi_pb2_grpc

load_dotenv()

# =============================================================================
# Environment / Configuration
# =============================================================================

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 50051


def _get_target() -> str:
    host = os.getenv("GRPC_SERVICE_HOST", DEFAULT_HOST)
    port = int(os.getenv("GRPC_SERVICE_PORT", str(DEFAULT_PORT)))
    return f"{host}:{port}"


# =============================================================================
# Printing helpers
# =============================================================================

def _print_docs(docs) -> None:
    for d in docs:
        print(f" - id={d.id} mapper_version={d.mapper_version} created_at={d.created_at}")


def _print_incidents(incidents) -> None:
    for it in incidents:
        print(
            " - "
            f"doc_id={it.doc_id} incident_id={it.incident_id} "
            f"type={it.incident_type} severity={it.severity} status={it.status} "
            f"country={it.country} city={it.city} "
            f"risk_score={it.risk_score:.3f} estimated_cost_eur={it.estimated_cost_eur:.2f}"
        )


def _print_agg_by_type(rows) -> None:
    for row in rows:
        print(
            f" - incident_type={row.incident_type} total_incidents={row.total_incidents} "
            f"avg_risk_score={row.avg_risk_score:.6f} total_estimated_cost_eur={row.total_estimated_cost_eur:.2f}"
        )


def _print_agg_by_severity(rows) -> None:
    for row in rows:
        print(
            f" - severity={row.severity} total_incidents={row.total_incidents} "
            f"avg_risk_score={row.avg_risk_score:.6f}"
        )


# =============================================================================
# Main
# =============================================================================
def main() -> None:
    target = _get_target()

    print(f"[Client] Connecting to {target} ...")
    channel = grpc.insecure_channel(target)
    stub = bi_pb2_grpc.BIServiceStub(channel)

    print("\n[Client] ListDocs(limit=5)")
    r1 = stub.ListDocs(bi_pb2.ListDocsRequest(limit=5))
    _print_docs(r1.docs)

    print("\n[Client] QueryIncidents(type='medical', severity='', status='', country='', limit=5)")
    r2 = stub.QueryIncidents(
        bi_pb2.QueryIncidentsRequest(
            type="medical",
            severity="",
            status="",
            country="",
            limit=5,
        )
    )
    _print_incidents(r2.incidents)

    print("\n[Client] AggByType()")
    r3 = stub.AggByType(bi_pb2.AggByTypeRequest())
    _print_agg_by_type(r3.rows)

    print("\n[Client] AggBySeverity()")
    r4 = stub.AggBySeverity(bi_pb2.AggBySeverityRequest())
    _print_agg_by_severity(r4.rows)


if __name__ == "__main__":
    main()