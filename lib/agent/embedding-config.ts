/**
 * Single source of truth for the embedding dimension. The `run_embeddings`
 * column, the mock vector generator, and the runtime guard all read this, so a
 * dimension mismatch is impossible by construction.
 *
 * Must match the configured EMBEDDING_MODEL:
 *   - text-embedding-3-small → 1536
 *   - Qwen3-Embedding        → 2560
 * If you change the model to a different dimension, change this constant and
 * regenerate the migration (the column size follows it).
 */
export const EMBEDDING_DIM = 1536;

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
