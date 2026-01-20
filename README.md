# TP3 — Integração de Sistemas (IS) — 28998

Plataforma de integração e interoperabilidade baseada em **Docker Compose**, com pipeline **CSV → enriquecimento → XML → PostgreSQL → consultas (REST/gRPC/GraphQL)**.

## Visão geral do pipeline

1. **Crawler (Python)**  
   Divide um CSV grande em partes e faz upload para o bucket **Supabase S3** em `incoming/`.

2. **Processor (Python)**  
   Observa `incoming/`, processa cada parte em **streaming** (sem carregar tudo em memória), faz *mapping* / validação / enriquecimento (ex.: taxa EUR→USD e dados meteo), gera `*_mapped_*.csv` e move para `processed/`.  
   Em seguida, envia o ficheiro para o **XML Service** e aguarda o callback do **Webhook**.

3. **XML Service (Node/Express)**  
   Endpoint `/ingest` (multipart) que recebe CSV mapeado, gera XML, persiste em **PostgreSQL** (tabela `tp3_documentos_xml`) e notifica o **Webhook** com o estado.

4. **Webhook (Python)**  
   Recebe callbacks do XML Service (ex.: `POST /webhook/xml-status`) e permite ao Processor finalizar o ciclo.

5. **gRPC Service (Python)**  
   Interface interna para listar documentos e executar consultas/agregações sobre o XML persistido no PostgreSQL.

6. **BI Service (GraphQL)**  
   Camada de consumo (GraphQL) que centraliza filtros/agregações para a UI, consumindo serviços internos (gRPC e/ou XML Service).

---

## Tecnologias

- Docker + Docker Compose  
- PostgreSQL  
- Node.js + Express (XML Service)  
- Python (Crawler, Processor, Webhook, gRPC)  
- gRPC + Protobuf  
- GraphQL (BI Service)  
- Supabase Storage (S3-compatible)

---

## Estrutura (resumo)

> Nomes podem variar ligeiramente; adaptar ao teu repositório.

- `infra/` — `docker-compose.yml`, `.env.docker`, init SQL
- `services/crawler/` — crawler (upload para `incoming/`)
- `services/processor/` — processor (mapping/enriquecimento, move para `processed/`)
- `services/xml-service/` — ingest, geração XML, persistência em Postgres
- `services/webhook/` — callbacks
- `services/grpc-service/` — servidor gRPC + `*.proto`
- `services/bi-service/` — API GraphQL

---

## Pré-requisitos

- Docker Desktop (ou Docker Engine + Compose)
- (Opcional) Python 3.11+ e Node 18+ para correr fora de container
- Credenciais do **Supabase Storage** (S3) configuradas em variáveis de ambiente

---

## Configuração

### Variáveis de ambiente

Configurar no `infra/.env.docker` (ou equivalente):

- **Postgres**
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

- **Supabase Storage (S3)**
  - `S3_ENDPOINT`
  - `S3_ACCESS_KEY`
  - `S3_SECRET_KEY`
  - `S3_BUCKET`
  - `S3_REGION` (se aplicável)
  - Prefixos: `S3_PREFIX_INCOMING=incoming/`, `S3_PREFIX_PROCESSED=processed/`

- **Serviços**
  - `XML_SERVICE_URL` (ex.: `http://xml-service:7001`)
  - `WEBHOOK_URL` (ex.: `http://webhook:8000/webhook/xml-status`)
  - `RPC_SERVICE_URL` (XML-RPC, ex.: `http://rpc-service:9000/RPC2`) — se aplicável
  - `GRPC_SERVICE_HOST=grpc-service`, `GRPC_SERVICE_PORT=50051`
  - `BI_SERVICE_PORT=4000`

---

## Como correr

### 1) Arranque do sistema

```bash
cd infra
docker compose up -d --build