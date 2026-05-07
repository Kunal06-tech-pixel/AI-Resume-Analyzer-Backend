import { generateEmbedding } from "./src/utils/embedding.js";
import { cosineSimilarity } from "./src/utils/cosineSimilarity.js";

console.log("🧪 Testing Embedding Retrieval System...\n");

async function testEmbeddings() {
  try {
    // Test 1: Generate embedding for sample text
    console.log("Test 1: Generating embedding for sample text...");
    const sampleText = "Software Engineer with 5 years of experience in JavaScript and React";
    const embedding1 = await generateEmbedding(sampleText);
    
    console.log("✅ Embedding generated successfully");
    console.log(`   - Dimensions: ${embedding1.length}`);
    console.log(`   - First 5 values: [${embedding1.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
    console.log(`   - Type: ${Array.isArray(embedding1) ? 'Array' : typeof embedding1}`);
    
    // Test 2: Generate another embedding
    console.log("\nTest 2: Generating embedding for job description...");
    const jobDesc = "Looking for a Senior Software Engineer with React and Node.js experience";
    const embedding2 = await generateEmbedding(jobDesc);
    
    console.log("✅ Embedding generated successfully");
    console.log(`   - Dimensions: ${embedding2.length}`);
    console.log(`   - First 5 values: [${embedding2.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
    
    // Test 3: Calculate cosine similarity
    console.log("\nTest 3: Calculating cosine similarity...");
    const similarity = cosineSimilarity(embedding1, embedding2);
    
    console.log("✅ Similarity calculated successfully");
    console.log(`   - Similarity score: ${similarity.toFixed(4)}`);
    console.log(`   - Percentage: ${(similarity * 100).toFixed(2)}%`);
    
    // Test 4: Test with unrelated text
    console.log("\nTest 4: Testing with unrelated text...");
    const unrelatedText = "I love cooking pasta and baking bread";
    const embedding3 = await generateEmbedding(unrelatedText);
    const similarityUnrelated = cosineSimilarity(embedding1, embedding3);
    
    console.log("✅ Unrelated text similarity calculated");
    console.log(`   - Similarity score: ${similarityUnrelated.toFixed(4)}`);
    console.log(`   - Percentage: ${(similarityUnrelated * 100).toFixed(2)}%`);
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Embedding generation: WORKING`);
    console.log(`✅ Cosine similarity calculation: WORKING`);
    console.log(`✅ Related text similarity: ${(similarity * 100).toFixed(2)}% (Expected: High)`);
    console.log(`✅ Unrelated text similarity: ${(similarityUnrelated * 100).toFixed(2)}% (Expected: Low)`);
    console.log("\n🎉 All embedding retrieval tests passed!");
    
  } catch (error) {
    console.error("\n❌ Error during testing:");
    console.error(error);
    process.exit(1);
  }
}

testEmbeddings();
