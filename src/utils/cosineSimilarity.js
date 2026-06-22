export const cosineSimilarity = (vecA, vecB) => {
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length === 0 ||
    vecA.length !== vecB.length
  ) {
    return 0;
  }

  const dotProduct = vecA.reduce(
    (sum, value, index) => sum + value * vecB[index],
    0
  );
  const magnitudeA = Math.sqrt(
    vecA.reduce((sum, value) => sum + value * value, 0)
  );
  const magnitudeB = Math.sqrt(
    vecB.reduce((sum, value) => sum + value * value, 0)
  );

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return Math.max(-1, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
};
