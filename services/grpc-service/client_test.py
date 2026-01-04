import os
import grpc
from dotenv import load_dotenv

from generated import bi_pb2, bi_pb2_grpc

load_dotenv()


def main():
    host = os.getenv("GRPC_SERVICE_HOST", "localhost")
    port = int(os.getenv("GRPC_SERVICE_PORT", "50051"))
    target = f"{host}:{port}"

    print(f"[Client] Connecting to {target} ...")
    channel = grpc.insecure_channel(target)
    stub = bi_pb2_grpc.BIServiceStub(channel)

    # 1) ListDocs
    print("\n[Client] ListDocs(limit=5)")
    r1 = stub.ListDocs(bi_pb2.ListDocsRequest(limit=5))
    for d in r1.docs:
        print(f" - id={d.id} mapper_version={d.mapper_version} created_at={d.created_at}")

    # 2) QueryIncidents (exemplo com filtros opcionais)
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
    for it in r2.incidents:
        print(
            " - "
            f"doc_id={it.doc_id} incident_id={it.incident_id} "
            f"type={it.incident_type} severity={it.severity} status={it.status} "
            f"country={it.country} city={it.city} "
            f"risk_score={it.risk_score:.3f} estimated_cost_eur={it.estimated_cost_eur:.2f}"
        )

    # 3) AggByType
    print("\n[Client] AggByType()")
    r3 = stub.AggByType(bi_pb2.AggByTypeRequest())
    for row in r3.rows:
        print(
            f" - incident_type={row.incident_type} total_incidents={row.total_incidents} "
            f"avg_risk_score={row.avg_risk_score:.6f} total_estimated_cost_eur={row.total_estimated_cost_eur:.2f}"
        )

    # 4) AggBySeverity
    print("\n[Client] AggBySeverity()")
    r4 = stub.AggBySeverity(bi_pb2.AggBySeverityRequest())
    for row in r4.rows:
        print(
            f" - severity={row.severity} total_incidents={row.total_incidents} "
            f"avg_risk_score={row.avg_risk_score:.6f}"
        )


if __name__ == "__main__":
    main()