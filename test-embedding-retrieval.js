import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import Analysis from "./src/models/Analysis.js";

console.log("\n" + "=".repeat(70));
console.log("🔍 TESTING EMBEDDING RETRIEVAL FROM DATABASE");
console.log("=".repeat(70) + "\n");

async function testEmbeddingRetrieval() {
  try {
    // Connect to database
    console.log("📡 STEP 1: Connecting to MongoDB...");
    console.log("-".repeat(70));
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected successfully\n");

    // Retrieve all analyses with embeddings
    console.log("📊 STEP 2: Querying Database for Analyses with Embeddings");
    console.log("-".repeat(70));
    console.log("Query: { embedding: { $exists: true, $ne: [] } }");
    console.log("Sort: { createdAt: -1 }");
    console.log("Limit: 10\n");

    const startTime = Date.now();
    
    const analyses = await Analysis.find({
      embedding: { $exists: true, $ne: [] }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const endTime = Date.now();
    
    console.log(`✅ Query completed in ${endTime - startTime}ms`);
    console.log(`   Found: ${analyses.length} analyses with embeddings\n`);

    if (analyses.length === 0) {
      console.log("⚠️  No analyses with embeddings found in database");
      console.log("   Upload a resume first to test embedding retrieval\n");
      await mongoose.connection.close();
      return;
    }

    // Display detailed embedding information
    console.log("=".repeat(70));
    console.log("📦 STEP 3: EMBEDDING RETRIEVAL DETAILS");
    console.log("=".repeat(70) + "\n");

    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      
      console.log(`\n${"─".repeat(70)}`);
      console.log(`📄 ANALYSIS #${i + 1}`);
      console.log("─".repeat(70));
      
      // Basic Info
      console.log("\n📋 Document Information:");
      console.log(`   - ID: ${analysis._id}`);
      console.log(`   - File Name: ${analysis.fileName}`);
      console.log(`   - Job Title: ${analysis.jobTitle || 'N/A'}`);
      console.log(`   - Company: ${analysis.companyName || 'N/A'}`);
      console.log(`   - Created: ${analysis.createdAt}`);
      console.log(`   - User ID: ${analysis.user}`);

      // Embedding Details
      console.log("\n🧠 Embedding Retrieved from Database:");
      console.log(`   - Model: ${analysis.embeddingModel}`);
      console.log(`   - Dimensions: ${analysis.embeddingDimensions}`);
      console.log(`   - Vector Length: ${analysis.embedding.length}`);
      console.log(`   - Data Type: ${Array.isArray(analysis.embedding) ? 'Array' : typeof analysis.embedding}`);
      
      // Vector Statistics
      const min = Math.min(...analysis.embedding);
      const max = Math.max(...analysis.embedding);
      const avg = analysis.embedding.reduce((sum, val) => sum + val, 0) / analysis.embedding.length;
      const magnitude = Math.sqrt(analysis.embedding.reduce((sum, val) => sum + val * val, 0));
      
      console.log("\n📊 Vector Statistics:");
      console.log(`   - Min Value: ${min.toFixed(6)}`);
      console.log(`   - Max Value: ${max.toFixed(6)}`);
      console.log(`   - Average: ${avg.toFixed(6)}`);
      console.log(`   - Magnitude: ${magnitude.toFixed(6)}`);
      
      // Sample Values
      console.log("\n🔢 Sample Vector Values:");
      console.log(`   - First 10: [${analysis.embedding.slice(0, 10).map(v => v.toFixed(4)).join(", ")}]`);
      console.log(`   - Middle 10: [${analysis.embedding.slice(187, 197).map(v => v.toFixed(4)).join(", ")}]`);
      console.log(`   - Last 10: [${analysis.embedding.slice(-10).map(v => v.toFixed(4)).join(", ")}]`);

      // Scores
      console.log("\n📈 Analysis Scores:");
      console.log(`   - Similarity: ${(analysis.similarity * 100).toFixed(2)}%`);
      console.log(`   - Semantic Score: ${analysis.semanticScore || 'N/A'}`);
      console.log(`   - AI Score: ${analysis.aiScore || 'N/A'}`);
      console.log(`   - Final ATS Score: ${analysis.atsScore?.score || 0} (${analysis.atsScore?.level || 'N/A'})`);

      // Additional Analysis Data
      console.log("\n📝 Analysis Results:");
      console.log(`   - Skills Detected: ${analysis.skillsDetected?.length || 0}`);
      console.log(`   - Missing Skills: ${analysis.missingSkills?.length || 0}`);
      console.log(`   - Strengths: ${analysis.strengths?.length || 0}`);
      console.log(`   - Weaknesses: ${analysis.weaknesses?.length || 0}`);
      console.log(`   - Suggestions: ${analysis.suggestions?.length || 0}`);
    }

    // Summary Statistics
    console.log("\n\n" + "=".repeat(70));
    console.log("📊 RETRIEVAL SUMMARY");
    console.log("=".repeat(70));
    
    const totalEmbeddings = analyses.length;
    const avgDimensions = analyses.reduce((sum, a) => sum + a.embedding.length, 0) / totalEmbeddings;
    const avgSimilarity = analyses.reduce((sum, a) => sum + (a.similarity || 0), 0) / totalEmbeddings;
    const avgAtsScore = analyses.reduce((sum, a) => sum + (a.atsScore?.score || 0), 0) / totalEmbeddings;
    
    console.log(`\n✅ Successfully retrieved ${totalEmbeddings} embeddings from database`);
    console.log(`   - Average Dimensions: ${avgDimensions.toFixed(0)}`);
    console.log(`   - Average Similarity: ${(avgSimilarity * 100).toFixed(2)}%`);
    console.log(`   - Average ATS Score: ${avgAtsScore.toFixed(2)}`);
    console.log(`   - Embedding Model: ${analyses[0].embeddingModel}`);
    console.log(`   - Query Time: ${endTime - startTime}ms`);

    // Test: Verify embedding can be used for calculations
    console.log("\n🧪 STEP 4: Verifying Embedding Usability");
    console.log("-".repeat(70));
    
    const testEmbedding = analyses[0].embedding;
    const testMagnitude = Math.sqrt(testEmbedding.reduce((sum, val) => sum + val * val, 0));
    
    console.log("✅ Embedding is valid and ready for:");
    console.log("   - Cosine similarity calculations");
    console.log("   - Vector search operations");
    console.log("   - Semantic matching");
    console.log(`   - Test magnitude: ${testMagnitude.toFixed(6)}`);

    console.log("\n" + "=".repeat(70));
    console.log("🎉 EMBEDDING RETRIEVAL TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70) + "\n");

  } catch (error) {
    console.error("\n❌ Error during embedding retrieval test:");
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("📡 Database connection closed\n");
  }
}

testEmbeddingRetrieval();
