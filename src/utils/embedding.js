import { pipeline } from "@xenova/transformers";

// load model once
console.log("🔧 Loading embedding model: Xenova/all-MiniLM-L6-v2...");
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);
console.log("✅ Embedding model loaded successfully\n");

// generate embedding
export const generateEmbedding = async (text) => {
  const textPreview = text.substring(0, 100).replace(/\n/g, ' ');
  console.log("🔍 Generating embedding for text:");
  console.log(`   Preview: "${textPreview}..."`);
  console.log(`   Length: ${text.length} characters`);
  
  const startTime = Date.now();
  
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);
  const endTime = Date.now();
  
  console.log(`✅ Embedding generated in ${endTime - startTime}ms`);
  console.log(`   Dimensions: ${embedding.length}`);
  console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
  console.log(`   Last 5 values: [${embedding.slice(-5).map(v => v.toFixed(4)).join(", ")}]`);
  console.log("");

  return embedding;
};