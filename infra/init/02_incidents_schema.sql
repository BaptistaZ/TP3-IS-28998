CREATE TABLE IF NOT EXISTS tp3_incidents_xml (
  id SERIAL PRIMARY KEY,
  xml_documento XML NOT NULL,
  data_criacao TIMESTAMP DEFAULT NOW(),
  mapper_version VARCHAR(50),
  request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_tp3_incidents_xml_data
  ON tp3_incidents_xml (data_criacao DESC);
