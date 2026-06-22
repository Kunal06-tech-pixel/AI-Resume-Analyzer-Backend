import { pipeline } from "@xenova/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

// Load once and reuse for document and skill embeddings.
console.log(`Loading embedding model: ${EMBEDDING_MODEL}...`);
const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL);
console.log("Embedding model loaded successfully\n");

const cleanText = (text) => String(text || "").trim() || "No content provided";

export const generateEmbeddings = async (texts) => {
  const input = (Array.isArray(texts) ? texts : [texts]).map(cleanText);
  const startTime = Date.now();

  const output = await extractor(input, {
    pooling: "mean",
    normalize: true,
  });

  const values = Array.from(output.data);
  const dimensions = output.dims?.at(-1) || values.length / input.length;
  const embeddings = input.map((_, index) =>
    values.slice(index * dimensions, (index + 1) * dimensions)
  );

  console.log(
    `Generated ${embeddings.length} embedding(s) in ${Date.now() - startTime}ms ` +
    `(${dimensions} dimensions)`
  );

  return embeddings;
};

export const generateEmbedding = async (text) => {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
};
