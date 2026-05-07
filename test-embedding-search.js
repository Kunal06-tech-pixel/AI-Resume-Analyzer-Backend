import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import { generateEmbedding } from "./src/utils/embedding.js";
import { cosineSimilarity } from "./src/utils/cosineSimilarity.js";
import Analysis from "./src/models/Analysis.js";

console.log("\n" + "=".repeat(70));
console.log("🔍 TESTING EMBEDDING SEARCH WITH DETAILED LOGS");
console.log("=".repeat(70) + "\n");

async function testEmbeddingSearch() {
  try {
    // Connect to database
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Test query
    const testJobDescription = "Looking for a Full Stack Developer with React, Node.js, and MongoDB experience. Must have 2+ years of experience building web applications.";

    console.log("🎯 TEST QUERY:");
    console.log(`"${testJobDescription}"\n`);

    // Step 1: Generate embedding for query
    console.log("=" .repeat(70));
    console.log("STEP 1: GENERATING QUERY EMBEDDING");
    console.log("=".repeat(70) + "\n");
    
    const queryEmbedding = await generateEmbedding(testJobDescription);

    // Step 2: Retrieve all stored embeddings
    console.log("=".repeat(70));
    console.log("STEP 2: RETRIEVING STORED RESUME EMBEDDINGS FROM DATABASE");
    console.log("=".repeat(70) + "\n");

    const analyses = await Analysis.find({
      embedding: { $exists: true, $ne: [] }
    }).lean();

    console.log(`✅ Retrieved ${analyses.length} resumes with embeddings\n`);

    if (analyses.length === 0) {
      console.log("⚠️  No resumes found. Upload some resumes first!");
      await mongoose.connection.close();
      return;
    }

    analyses.forEach((analysis, index) => {
      console.log(`   ${index + 1}. ${analysis.fileName}`);
      console.log(`      - Job Title: ${analysis.jobTitle || 'N/A'}`);
      console.log(`      - Embedding Dimensions: ${analysis.embedding.length}`);
      console.log(`      - First 3 values: [${analysis.embedding.slice(0, 3).map(v => v.toFixed(4)).join(", ")}]`);
    });

    // Step 3: Calculate similarities
    console.log("\n" + "=".repeat(70));
    console.log("STEP 3: CALCULATING COSINE SIMILARITY FOR EACH RESUME");
    console.log("=".repeat(70) + "\n");

    const results = [];

    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      console.log(`\n📄 Resume ${i + 1}: ${analysis.fileName}`);
      console.log("-".repeat(70));
      
      const similarity = cosineSimilarity(analysis.embedding, queryEmbedding);
      const matchScore = Math.round(similarity * 100);

      results.push({
        fileName: analysis.fileName,
        jobTitle: analysis.jobTitle,
        atsScore: analysis.atsScore?.score || 0,
        matchScore: matchScore,
        similarity: similarity,
        skillsDetected: analysis.skillsDetected?.length || 0,
        missingSkills: analysis.missingSkills?.length || 0
      });
    }

    // Step 4: Rank results
    console.log("\n" + "=".repeat(70));
    console.log("STEP 4: RANKING RESULTS BY SIMILARITY");
    console.log("=".repeat(70) + "\n");

    results.sort((a, b) => b.matchScore - a.matchScore);

    console.log("🏆 RANKED RESULTS (Best Match First):\n");
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.fileName}`);
      console.log(`   ├─ Match Score: ${result.matchScore}% (Similarity: ${result.similarity.toFixed(4)})`);
      console.log(`   ├─ Job Title: ${result.jobTitle || 'N/A'}`);
      console.log(`   ├─ Original ATS Score: ${result.atsScore}`);
      console.log(`   ├─ Skills Detected: ${result.skillsDetected}`);
      console.log(`   └─ Missing Skills: ${result.missingSkills}\n`);
    });

    // Summary
    console.log("=".repeat(70));
    console.log("📊 SEARCH SUMMARY");
    console.log("=".repeat(70));
    console.log(`Total Resumes Searched: ${results.length}`);
    console.log(`Best Match: ${results[0].fileName} (${results[0].matchScore}%)`);
    console.log(`Worst Match: ${results[results.length - 1].fileName} (${results[results.length - 1].matchScore}%)`);
    console.log(`Average Match Score: ${Math.round(results.reduce((sum, r) => sum + r.matchScore, 0) / results.length)}%`);
    console.log("\n✅ Embedding search completed successfully!\n");

  } catch (error) {
    console.error("\n❌ Error during embedding search test:");
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("📡 Database connection closed\n");
  }
}

testEmbeddingSearch();
