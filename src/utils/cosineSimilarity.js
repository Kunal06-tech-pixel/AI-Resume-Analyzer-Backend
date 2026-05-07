export const cosineSimilarity = (vecA, vecB) => {
  console.log("📊 Calculating cosine similarity...");
  console.log(`   Vector A dimensions: ${vecA.length}`);
  console.log(`   Vector B dimensions: ${vecB.length}`);

  const dotProduct = vecA.reduce(
    (sum, val, i) => sum + val * vecB[i],
    0
  );

  const magnitudeA = Math.sqrt(
    vecA.reduce((sum, val) => sum + val * val, 0)
  );

  const magnitudeB = Math.sqrt(
    vecB.reduce((sum, val) => sum + val * val, 0)
  );

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  
  console.log(`   Dot Product: ${dotProduct.toFixed(4)}`);
  console.log(`   Magnitude A: ${magnitudeA.toFixed(4)}`);
  console.log(`   Magnitude B: ${magnitudeB.toFixed(4)}`);
  console.log(`✅ Similarity Score: ${similarity.toFixed(4)} (${(similarity * 100).toFixed(2)}%)\n`);

  return similarity;
};