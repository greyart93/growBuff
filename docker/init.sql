-- GrowBuff local database bootstrap.
-- pgvector is available for the production vector-store upgrade path
-- (see docs/architecture.md, "Knowledge base / RAG"). The MVP stores
-- embeddings as float arrays and ranks them in application code.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
