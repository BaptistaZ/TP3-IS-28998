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

    # 2) QueryAssets
    print("\n[Client] QueryAssets(ticker='IPVC', limit=10)")
    r2 = stub.QueryAssets(bi_pb2.QueryAssetsRequest(ticker="IPVC", category="", limit=10))
    for a in r2.assets:
        print(
            f" - doc_id={a.doc_id} internal_id={a.internal_id} ticker={a.ticker} "
            f"category={a.category} price_eur={a.price_eur} volume={a.volume} fx={a.fx_eur_usd}"
        )

    # 3) CategoryAgg
    print("\n[Client] CategoryAgg()")
    r3 = stub.CategoryAgg(bi_pb2.CategoryAggRequest())
    for row in r3.rows:
        print(
            f" - category={row.category} total_assets={row.total_assets} "
            f"total_volume={row.total_volume} avg_price_eur={row.avg_price_eur} avg_price_usd={row.avg_price_usd}"
        )


if __name__ == "__main__":
    main()