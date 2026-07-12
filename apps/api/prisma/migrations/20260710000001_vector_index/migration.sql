-- Approximate nearest-neighbour index for RAG retrieval.
-- ivfflat requires some rows to be useful but is safe to create up front.
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx"
  ON "document_chunks"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
