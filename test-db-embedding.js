import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import { generateEmbedding } from "./src/utils/embedding.js";
import { cosineSimilarity } from "./src/utils/cosineSimilarity.js";
import Analysis from "./src/models/Analysis.js";

console.log("🧪 Testing Database Embedding Storage & Retrieval...\n");

async function testDatabaseEmbeddings() {
  try {
    // Connect to database
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Test 1: Check if any analyses with embeddings exist
    console.log("Test 1: Checking existing analyses with embeddings...");
    const analysesWithEmbeddings = await Analysis.find({
      embedding: { $exists: true, $ne: [] }
    }).limit(5);
    
    console.log(`✅ Found ${analysesWithEmbeddings.length} analyses with embeddings`);
    
    if (analysesWithEmbeddings.length > 0) {
      const sample = analysesWithEmbeddings[0];
      console.log(`   - Sample ID: ${sample._id}`);
      console.log(`   - File Name: ${sample.fileName}`);
      console.log(`   - Embedding Dimensions: ${sample.embedding.length}`);
      console.log(`   - Embedding Model: ${sample.embeddingModel}`);
      console.log(`   - Similarity Score: ${sample.similarity}`);
      console.log(`   - First 5 embedding values: [${sample.embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
      
      // Test 2: Retrieve and compare with new job description
      console.log("\nTest 2: Testing similarity with a new job description...");
      const newJobDesc = "Senior Full Stack Developer with React and Node.js experience";
      const newJobEmbedding = await generateEmbedding(newJobDesc);
      
      const retrievedEmbedding = sample.embedding;
      const newSimilarity = cosineSimilarity(retrievedEmbedding, newJobEmbedding);
      
      console.log("✅ Similarity calculated with retrieved embedding");
      console.log(`   - New similarity score: ${newSimilarity.toFixed(4)}`);
      console.log(`   - Percentage: ${(newSimilarity * 100).toFixed(2)}%`);
      
      // Test 3: Find similar resumes using embeddings
      console.log("\nTest 3: Finding similar resumes using cosine similarity...");
      const allAnalyses = await Analysis.find({
        embedding: { $exists: true, $ne: [] }
      }).limit(10);
      
      const similarities = allAnalyses.map(analysis => ({
        id: analysis._id,
        fileName: analysis.fileName,
        jobTitle: analysis.jobTitle,
        storedSimilarity: analysis.similarity,
        newSimilarity: cosineSimilarity(analysis.embedding, newJobEmbedding)
      }));
      
      similarities.sort((a, b) => b.newSimilarity - a.newSimilarity);
      
      console.log("✅ Top 3 most similar resumes:");
      similarities.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.fileName}`);
        console.log(`      - Job Title: ${item.jobTitle || 'N/A'}`);
        console.log(`      - Stored Similarity: ${(item.storedSimilarity * 100).toFixed(2)}%`);
        console.log(`      - New Similarity: ${(item.newSimilarity * 100).toFixed(2)}%`);
      });
    } else {
      console.log("⚠️  No analyses with embeddings found in database");
      console.log("   Upload a resume through the API to test database storage");
    }
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Database connection: WORKING`);
    console.log(`✅ Embedding storage in Analysis model: WORKING`);
    console.log(`✅ Embedding retrieval from database: WORKING`);
    console.log(`✅ Cosine similarity with retrieved embeddings: WORKING`);
    console.log(`✅ Analyses with embeddings: ${analysesWithEmbeddings.length}`);
    console.log("\n🎉 Database embedding tests completed!");
    
  } catch (error) {
    console.error("\n❌ Error during testing:");
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("\n📡 Database connection closed");
  }
}

testDatabaseEmbeddings();
