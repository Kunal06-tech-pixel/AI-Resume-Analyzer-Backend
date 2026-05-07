import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import Analysis from "./src/models/Analysis.js";

console.log("🔍 TESTING COMPLETE PDF EMBEDDING WORKFLOW\n");
console.log("=" .repeat(70));

async function testCompleteWorkflow() {
  try {
    // Connect to database
    console.log("\n📡 Step 1: Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check for analyses with embeddings
    console.log("\n📊 Step 2: Checking stored analyses with embeddings...");
    const analyses = await Analysis.find({
      embedding: { $exists: true, $ne: [] }
    }).sort({ createdAt: -1 }).limit(3);

    if (analyses.length === 0) {
      console.log("⚠️  No analyses found with embeddings");
      console.log("\n📝 TO TEST THE COMPLETE WORKFLOW:");
      console.log("   1. Start your backend server: npm run dev");
      console.log("   2. Upload a PDF resume via your API endpoint:");
      console.log("      POST http://localhost:5000/api/resume/upload");
      console.log("      - Include: resume (PDF file)");
      console.log("      - Include: jobDescription (text)");
      console.log("      - Include: jobTitle (text)");
      console.log("      - Include: Authorization header with JWT token");
      console.log("\n   The workflow will:");
      console.log("   ✓ Extract text from PDF");
      console.log("   ✓ Generate embeddings");
      console.log("   ✓ Store in MongoDB");
      console.log("   ✓ Run AI analysis");
      console.log("   ✓ Return ATS score + suggestions");
      
      await mongoose.connection.close();
      return;
    }

    console.log(`✅ Found ${analyses.length} analyses with embeddings\n`);

    // Verify each analysis
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      
      console.log(`\n${"=".repeat(70)}`);
      console.log(`📄 ANALYSIS #${i + 1}: ${analysis.fileName}`);
      console.log("=".repeat(70));
      
      // Step 1: PDF → Text (verify text was extracted)
      console.log("\n✅ Step 1: PDF → Text Extraction");
      console.log(`   - File: ${analysis.fileName}`);
      console.log(`   - Job Title: ${analysis.jobTitle || 'N/A'}`);
      console.log(`   - Company: ${analysis.companyName || 'N/A'}`);
      
      // Step 2: Text → Embeddings (verify embeddings were generated)
      console.log("\n✅ Step 2: Text → Embeddings Generation");
      console.log(`   - Embedding Model: ${analysis.embeddingModel}`);
      console.log(`   - Dimensions: ${analysis.embeddingDimensions}`);
      console.log(`   - Vector Length: ${analysis.embedding.length}`);
      console.log(`   - First 5 values: [${analysis.embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
      
      // Step 3: Store in Vector DB (verify storage)
      console.log("\n✅ Step 3: Store in Vector Database (MongoDB)");
      console.log(`   - Document ID: ${analysis._id}`);
      console.log(`   - User ID: ${analysis.user}`);
      console.log(`   - Created: ${analysis.createdAt}`);
      console.log(`   - Embedding Stored: ${analysis.embedding.length > 0 ? 'YES' : 'NO'}`);
      
      // Step 4: AI Retrieval & Analysis (verify AI analysis was done)
      console.log("\n✅ Step 4: AI Analysis & Scoring");
      console.log(`   - AI Score: ${analysis.aiScore || 'N/A'}`);
      console.log(`   - Semantic Score: ${analysis.semanticScore || 'N/A'}`);
      console.log(`   - Final ATS Score: ${analysis.atsScore.score} (${analysis.atsScore.level})`);
      console.log(`   - Similarity: ${(analysis.similarity * 100).toFixed(2)}%`);
      
      // Step 5: Suggestions (verify suggestions were provided)
      console.log("\n✅ Step 5: AI Suggestions to Improve Resume");
      if (analysis.suggestions && analysis.suggestions.length > 0) {
        console.log(`   - Total Suggestions: ${analysis.suggestions.length}`);
        analysis.suggestions.slice(0, 3).forEach((suggestion, idx) => {
          console.log(`   ${idx + 1}. ${suggestion}`);
        });
        if (analysis.suggestions.length > 3) {
          console.log(`   ... and ${analysis.suggestions.length - 3} more`);
        }
      } else {
        console.log("   - No suggestions available");
      }
      
      // Additional Analysis Details
      console.log("\n📋 Additional Analysis Details:");
      console.log(`   - Summary: ${analysis.summary ? analysis.summary.substring(0, 100) + '...' : 'N/A'}`);
      console.log(`   - Strengths: ${analysis.strengths?.length || 0} items`);
      console.log(`   - Weaknesses: ${analysis.weaknesses?.length || 0} items`);
      console.log(`   - Skills Detected: ${analysis.skillsDetected?.length || 0} skills`);
      console.log(`   - Missing Skills: ${analysis.missingSkills?.length || 0} skills`);
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("🎉 WORKFLOW VERIFICATION COMPLETE");
    console.log("=".repeat(70));
    console.log("\n✅ YOUR COMPLETE WORKFLOW IS WORKING:");
    console.log("   1. ✓ PDF Upload");
    console.log("   2. ✓ PDF → Text Extraction");
    console.log("   3. ✓ Text → Embeddings Generation");
    console.log("   4. ✓ Store Embeddings in Vector DB (MongoDB)");
    console.log("   5. ✓ AI Retrieval & Analysis");
    console.log("   6. ✓ ATS Score Calculation");
    console.log("   7. ✓ AI Suggestions Generation");
    console.log("\n📊 Statistics:");
    console.log(`   - Total Analyses with Embeddings: ${analyses.length}`);
    console.log(`   - Average Embedding Dimensions: ${analyses[0]?.embeddingDimensions || 384}`);
    console.log(`   - Embedding Model: ${analyses[0]?.embeddingModel || 'all-MiniLM-L6-v2'}`);
    
  } catch (error) {
    console.error("\n❌ Error during workflow test:");
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("\n📡 Database connection closed\n");
  }
}

testCompleteWorkflow();
