import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed } from "ai";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "@/lib/agent/embedding-config";

/**
 * Embed text for semantic similar-bug retrieval. Configurable model via
 * EMBEDDING_MODEL; the dimension is pinned to EMBEDDING_DIM and asserted, so a
 * dimension mismatch with the `run_embeddings` column can never reach the DB.
 *
 * Mock mode (ERVIN_MOCK=1 or no OPENROUTER_API_KEY) returns a deterministic
 * pseudo-vector that still preserves token overlap, so mock retrieval surfaces
 * genuinely related runs.
 */
export function isEmbedMock(): boolean {
  return process.env.ERVIN_MOCK === "1" || !process.env.OPENROUTER_API_KEY;
}

export async function embedText(text: string): Promise<number[]> {
  if (isEmbedMock()) {
    return mockEmbedding(text);
  }

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const { embedding } = await embed({ model: openrouter.textEmbeddingModel(EMBEDDING_MODEL), value: text });
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension ${embedding.length} != expected ${EMBEDDING_DIM} for model ${EMBEDDING_MODEL}. ` +
        "Update EMBEDDING_DIM and the run_embeddings column to match.",
    );
  }
  return embedding;
}

/**
 * Deterministic hashing vectorizer (the "hashing trick"): each token bumps a
 * couple of fixed buckets, then we L2-normalize. Texts that share words get
 * higher cosine similarity — enough for retrieval to work in mock mode.
 */
function mockEmbedding(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    if (STOPWORDS.has(tok)) continue;
    vec[hash(tok) % EMBEDDING_DIM] += 1;
    vec[hash(`${tok}#2`) % EMBEDDING_DIM] += 0.5; // second bucket reduces collisions
  }
  return normalize(vec);
}

const STOPWORDS = new Set(["the", "a", "an", "to", "of", "in", "on", "and", "or", "is", "are", "when", "for"]);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
