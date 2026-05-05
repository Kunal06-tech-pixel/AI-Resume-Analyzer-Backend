import { pipeline } from "@xenova/transformers";

/**
 * Lazy-loaded embedding pipeline.
 *
 * The first call downloads the model weights (~90 MB) from Hugging Face
 * and caches them to disk. Every subsequent call reuses the cached model,
 * so it's fast after the first run.
 */
let embedder = null;

const ensureEmbedder = async () => {
  if (!embedder) {
    console.log("⏳ Loading Xenova/e5-base-v2 embedding model (first run may take a moment)...");
    embedder = await pipeline("feature-extraction", "Xenova/e5-base-v2");
    console.log("✅ Embedding model loaded.");
  }
  return embedder;
};

/**
 * Converts text into a numerical embedding vector using the e5-base-v2 model.
 *
 * The E5 model family requires a type prefix to work correctly:
 *   - "passage: " → for documents (resume text)
 *   - "query: "   → for search queries (job description)
 *
 * This is why ats.service.js passes type="passage" for resumes
 * and type="query" for job descriptions.
 *
 * The output is a 768-dimensional vector (array of 768 floats).
 * Cosine similarity is then used in ats.service.js to compare the two.
 *
 * @param {string} text              - The text to embed
 * @param {"passage"|"query"} type   - Determines the E5 prefix
 * @returns {Promise<number[]>}      - 768-float embedding vector
 */
export const getEmbedding = async (text, type = "passage") => {
  const pipe = await ensureEmbedder();

  // E5 models use type-specific prefixes for best accuracy
  const prefix = type === "query" ? "query: " : "passage: ";
  const input = prefix + String(text).trim().slice(0, 4000); // ~512 tokens max

  const output = await pipe(input, {
    pooling: "mean",    // average all token embeddings into one vector
    normalize: true,   // L2-normalize so cosine similarity = dot product
  });

  // output.data is a Float32Array — convert to plain JS array
  return Array.from(output.data);
};
