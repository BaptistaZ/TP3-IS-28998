CREATE TABLE IF NOT EXISTS tp3_documentos_xml (
  id              SERIAL PRIMARY KEY,
  xml_documento   XML NOT NULL,
  data_criacao    TIMESTAMP NOT NULL DEFAULT NOW(),
  mapper_version  VARCHAR(50) NOT NULL
);