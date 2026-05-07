import { pipeline } from "@xenova/transformers";

// load model once
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

// generate embedding
export const generateEmbedding = async (text) => {
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
};