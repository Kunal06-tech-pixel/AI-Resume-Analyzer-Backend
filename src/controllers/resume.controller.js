import fs from "fs/promises";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";

import Analysis from "../models/Analysis.js";

import { analyzeResumeWithGroq } from "../services/groq.service.js";

// ✅ NEW IMPORTS
import { generateEmbedding } from "../utils/embedding.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";


const clampScore = (score) => {
  const value = Number(score);

  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(100, Math.round(value)));
};

const toStringValue = (value) => {
  if (typeof value === "string") return value.trim();

  if (value === null || value === undefined) return "";

  return String(value).trim();
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toStringValue(item))
    .filter(Boolean);
};

const firstStringArray = (...values) => {
  for (const value of values) {
    const array = toStringArray(value);

    if (array.length > 0) return array;
  }

  return [];
};

const parseAiPayload = (payload) => {
  if (!payload) return {};

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return { summary: payload };
    }
  }

  return payload;
};

const normalizeAnalysis = (payload) => {
  const parsed = parseAiPayload(payload);

  const atsScore = parsed.ats_score || parsed.atsScore || {};

  const skillsDetected = firstStringArray(
    parsed.skills_detected,
    parsed.skillsDetected,
    parsed.skills_match,
    parsed.skillsMatch
  );

  const missingSkills = firstStringArray(
    parsed.missing_skills,
    parsed.missingSkills,
    parsed.missing_keywords,
    parsed.missingKeywords
  );

  return {
    summary: toStringValue(parsed.summary),

    roleMatch: toStringValue(
      parsed.role_match || parsed.roleMatch
    ),

    strengths: firstStringArray(parsed.strengths),

    weaknesses: firstStringArray(parsed.weaknesses),

    skillsDetected,

    missingSkills,

    skillsMatch: firstStringArray(
      parsed.skills_match,
      parsed.skillsMatch,
      skillsDetected
    ),

    missingKeywords: firstStringArray(
      parsed.missing_keywords,
      parsed.missingKeywords,
      missingSkills
    ),

    experienceAnalysis: toStringValue(
      parsed.experience_analysis ||
      parsed.experienceAnalysis ||
      parsed.experience_years
    ),

    suggestions: firstStringArray(parsed.suggestions),

    atsScore: {
      score: clampScore(atsScore.score),
      level: toStringValue(atsScore.level),
    },

    rawPayload: parsed,
  };
};

const serializeAnalysis = (analysis) => {
  const doc =
    typeof analysis.toObject === "function"
      ? analysis.toObject()
      : analysis;

  const id = doc._id?.toString?.() || doc.id;

  const atsScore = doc.atsScore || {
    score: 0,
    level: "",
  };

  return {
    id,

    fileName: doc.fileName,

    companyName: doc.companyName,

    jobTitle: doc.jobTitle,

    jobDescription: doc.jobDescription,

    summary: doc.summary,

    roleMatch: doc.roleMatch,

    strengths: doc.strengths || [],

    weaknesses: doc.weaknesses || [],

    skillsDetected: doc.skillsDetected || [],

    missingSkills: doc.missingSkills || [],

    skillsMatch: doc.skillsMatch || [],

    missingKeywords: doc.missingKeywords || [],

    experienceAnalysis: doc.experienceAnalysis,

    suggestions: doc.suggestions || [],

    atsScore,

    rawPayload: doc.rawPayload || {},

    createdAt: doc.createdAt,

    updatedAt: doc.updatedAt,

    // ✅ NLP & SCORING INFO
    similarity: doc.similarity || 0,
    
    semanticScore: doc.semanticScore || 0,
    
    aiScore: doc.aiScore || 0,

    embeddingModel: doc.embeddingModel || "all-MiniLM-L6-v2",

    embeddingDimensions: doc.embeddingDimensions || 384,

    algorithm: "Cosine Similarity",

    // backward compatibility
    role_match: doc.roleMatch,

    skills_detected: doc.skillsDetected || [],

    missing_skills: doc.missingSkills || [],

    skills_match: doc.skillsMatch || [],

    missing_keywords: doc.missingKeywords || [],

    experience_analysis: doc.experienceAnalysis,

    ats_score: atsScore,
  };
};


// ======================= ANALYZE RESUME =======================

export const analyzeResume = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF resume",
      });
    }

    // ================= PDF PARSE =================

    console.log("\n" + "=".repeat(70));
    console.log("📄 STARTING RESUME ANALYSIS");
    console.log("=".repeat(70));
    console.log(`File: ${req.file.originalname}`);
    console.log(`Size: ${req.file.size} bytes`);
    console.log(`Job Title: ${req.body.jobTitle || 'N/A'}`);
    console.log(`Company: ${req.body.companyName || 'N/A'}`);
    console.log("");

    const fileBuffer = await fs.readFile(req.file.path);

    const parser = new PDFParse({
      data: fileBuffer,
    });

    const result = await parser.getText();

    const resumeText = result.text;

    if (!resumeText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Could not read text from this PDF",
      });
    }

    console.log("✅ PDF text extracted successfully");
    console.log(`   Total characters: ${resumeText.length}`);
    console.log(`   Preview: "${resumeText.substring(0, 100).replace(/\n/g, ' ')}..."\n`);

    // ================= EMBEDDINGS =================

    console.log("🧠 STEP 1: Generating Resume Embedding");
    console.log("-".repeat(70));
    const resumeEmbedding =
      await generateEmbedding(resumeText);

    console.log("🎯 STEP 2: Generating Job Description Embedding");
    console.log("-".repeat(70));
    const jobEmbedding =
      await generateEmbedding(
        req.body.jobDescription || ""
      );

    // ================= COSINE SIMILARITY =================

    console.log("🔬 STEP 3: Computing Semantic Similarity");
    console.log("-".repeat(70));
    const similarity = cosineSimilarity(
      resumeEmbedding,
      jobEmbedding
    );

    const semanticScore = Math.round(
      similarity * 100
    );

    console.log("💾 STEP 4: Storing Embedding in Vector Database");
    console.log("-".repeat(70));
    console.log(`   Embedding dimensions: ${resumeEmbedding.length}`);
    console.log(`   Model: all-MiniLM-L6-v2`);
    console.log(`   Storage: MongoDB (Analysis collection)\n`);

    // ================= AI ANALYSIS =================

    console.log("🤖 STEP 5: Running AI Analysis with Groq");
    console.log("-".repeat(70));
    const aiResponse =
      await analyzeResumeWithGroq(
        resumeText,
        req.body.jobDescription || "",
        req.body.jobTitle || ""
      );

    const normalized =
      normalizeAnalysis(aiResponse);

    console.log("✅ AI analysis completed\n");

    // ✅ HYBRID SCORING: Combine AI score (70%) + Semantic score (30%)
    console.log("📊 STEP 6: Calculating Hybrid ATS Score");
    console.log("-".repeat(70));
    const aiScore = normalized.atsScore.score || 0;
    const hybridScore = Math.round((aiScore * 0.7) + (semanticScore * 0.3));
    
    console.log(`   AI Score: ${aiScore}`);
    console.log(`   Semantic Score: ${semanticScore}`);
    console.log(`   Hybrid Score: ${hybridScore} (70% AI + 30% Semantic)`);
    
    normalized.atsScore.score = hybridScore;
    normalized.semanticScore = semanticScore;
    normalized.aiScore = aiScore;

    if (hybridScore >= 75) {
      normalized.atsScore.level = "High";
    } else if (hybridScore >= 45) {
      normalized.atsScore.level = "Medium";
    } else {
      normalized.atsScore.level = "Low";
    }
    
    console.log(`   Final Level: ${normalized.atsScore.level}\n`);

    // ================= SAVE =================

    console.log("💾 STEP 7: Saving Analysis to Database");
    console.log("-".repeat(70));
    const analysis = await Analysis.create({
      user: req.userId,

      fileName: req.file.originalname,

      companyName:
        req.body.companyName || "",

      jobTitle:
        req.body.jobTitle || "",

      jobDescription:
        req.body.jobDescription || "",

      similarity,
      
      semanticScore,
      
      aiScore: normalized.aiScore,

      embeddingModel:
        "all-MiniLM-L6-v2",

      embeddingDimensions:
        resumeEmbedding.length,

      // ✅ VECTOR STORAGE
      embedding: resumeEmbedding,

      ...normalized,
    });

    console.log(`✅ Analysis saved with ID: ${analysis._id}`);
    console.log(`   Embedding stored: ${analysis.embedding.length} dimensions`);
    console.log(`   Suggestions: ${analysis.suggestions?.length || 0}`);
    console.log(`   Skills detected: ${analysis.skillsDetected?.length || 0}`);
    console.log(`   Missing skills: ${analysis.missingSkills?.length || 0}\n`);

    // ================= RESPONSE =================

    console.log("=".repeat(70));
    console.log("✅ RESUME ANALYSIS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70) + "\n");

    return res.status(201).json({
      success: true,

      analysis:
        serializeAnalysis(analysis),
    });

  } catch (error) {

    console.error(
      "Resume analysis error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Resume analysis failed",
    });

  } finally {

    if (req.file?.path) {
      await fs.unlink(req.file.path)
        .catch(() => {});
    }
  }
};


// ======================= LIST ANALYSES =======================

export const listAnalyses = async (req, res) => {
  try {

    console.log("\n" + "=".repeat(70));
    console.log("📋 RETRIEVING USER ANALYSES FROM DATABASE");
    console.log("=".repeat(70));
    console.log(`User ID: ${req.userId}\n`);

    const analyses = await Analysis.find({
      user: req.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`✅ Retrieved ${analyses.length} analyses`);
    
    // Log embedding info for each analysis
    const withEmbeddings = analyses.filter(a => a.embedding && a.embedding.length > 0);
    console.log(`   - With embeddings: ${withEmbeddings.length}`);
    console.log(`   - Without embeddings: ${analyses.length - withEmbeddings.length}\n`);

    if (withEmbeddings.length > 0) {
      console.log("📊 EMBEDDINGS RETRIEVED FROM DATABASE:");
      
      withEmbeddings.slice(0, 2).forEach((analysis, index) => {
        console.log(`\n   ${index + 1}. ${analysis.fileName}`);
        console.log(`      Model: ${analysis.embeddingModel}`);
        console.log(`      Dimensions: ${analysis.embedding.length}`);
        console.log(`      Similarity Score: ${(analysis.similarity * 100).toFixed(2)}%`);
        
        console.log(`\n      embedding: Array (${analysis.embedding.length})`);
        
        // Show first 20 values
        const displayCount = Math.min(20, analysis.embedding.length);
        for (let i = 0; i < displayCount; i++) {
          console.log(`         ${i}: ${analysis.embedding[i]}`);
        }
        
        if (analysis.embedding.length > 20) {
          console.log(`         ... (${analysis.embedding.length - 20} more values)`);
        }
      });
      
      if (withEmbeddings.length > 2) {
        console.log(`\n   ... and ${withEmbeddings.length - 2} more analyses with embeddings`);
      }
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return res.json({
      success: true,

      total: analyses.length,

      analyses:
        analyses.map(serializeAnalysis),
    });

  } catch (error) {

    console.error(
      "❌ List analyses error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Could not load analyses",
    });
  }
};


// ======================= GET ANALYSIS =======================

export const getAnalysisById = async (req, res) => {
  try {

    console.log("\n" + "=".repeat(70));
    console.log("🔍 RETRIEVING SINGLE ANALYSIS FROM DATABASE");
    console.log("=".repeat(70));
    console.log(`Analysis ID: ${req.params.id}`);
    console.log(`User ID: ${req.userId}\n`);

    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      console.log("❌ Invalid ObjectId format\n");
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    const analysis =
      await Analysis.findOne({
        _id: req.params.id,
        user: req.userId,
      }).lean();

    if (!analysis) {
      console.log("❌ Analysis not found in database\n");
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    console.log("✅ Analysis retrieved successfully");
    console.log(`   File: ${analysis.fileName}`);
    console.log(`   Job Title: ${analysis.jobTitle || 'N/A'}`);
    console.log(`   ATS Score: ${analysis.atsScore?.score || 0} (${analysis.atsScore?.level || 'N/A'})`);
    
    if (analysis.embedding && analysis.embedding.length > 0) {
      console.log("\n🧠 EMBEDDING RETRIEVED FROM DATABASE:");
      console.log(`   Model: ${analysis.embeddingModel}`);
      console.log(`   Dimensions: ${analysis.embeddingDimensions}`);
      console.log(`   Vector Length: ${analysis.embedding.length}`);
      console.log(`   Similarity: ${(analysis.similarity * 100).toFixed(2)}%`);
      console.log(`   Semantic Score: ${analysis.semanticScore || 'N/A'}`);
      console.log(`   AI Score: ${analysis.aiScore || 'N/A'}`);
      
      console.log("\n📊 EMBEDDING ARRAY VALUES:");
      console.log("   embedding: Array (" + analysis.embedding.length + ")");
      
      // Log first 50 values in detail
      const displayCount = Math.min(50, analysis.embedding.length);
      for (let i = 0; i < displayCount; i++) {
        console.log(`      ${i}: ${analysis.embedding[i]}`);
      }
      
      if (analysis.embedding.length > 50) {
        console.log(`      ... (${analysis.embedding.length - 50} more values)`);
        console.log(`      ... showing last 10 values:`);
        for (let i = analysis.embedding.length - 10; i < analysis.embedding.length; i++) {
          console.log(`      ${i}: ${analysis.embedding[i]}`);
        }
      }
    } else {
      console.log("\n⚠️  No embedding stored for this analysis");
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return res.json({
      success: true,

      analysis:
        serializeAnalysis(analysis),
    });

  } catch (error) {

    console.error(
      "❌ Get analysis error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Could not load analysis",
    });
  }
};


// ======================= ANALYZE TEXT =======================

export const analyzeResumeText = async (req, res) => {
  try {

    const {
      resumeText,
      jobDescription = "",
      jobTitle = "",
    } = req.body;

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: "Resume text is required",
      });
    }

    // ✅ embeddings
    const resumeEmbedding =
      await generateEmbedding(resumeText);

    const jobEmbedding =
      await generateEmbedding(jobDescription);

    const similarity = cosineSimilarity(
      resumeEmbedding,
      jobEmbedding
    );

    const semanticScore = Math.round(
      similarity * 100
    );

    // ✅ AI response
    const aiResponse =
      await analyzeResumeWithGroq(
        resumeText,
        jobDescription,
        jobTitle
      );

    const normalized =
      normalizeAnalysis(aiResponse);

    // ✅ HYBRID SCORING: Combine AI score (70%) + Semantic score (30%)
    const aiScore = normalized.atsScore.score || 0;
    const hybridScore = Math.round((aiScore * 0.7) + (semanticScore * 0.3));
    
    normalized.atsScore.score = hybridScore;
    normalized.semanticScore = semanticScore;
    normalized.aiScore = aiScore;

    if (hybridScore >= 75) {
      normalized.atsScore.level = "High";
    } else if (hybridScore >= 45) {
      normalized.atsScore.level = "Medium";
    } else {
      normalized.atsScore.level = "Low";
    }

    return res.json({
      success: true,

      analysis: {
        ...normalized,

        similarity,

        embeddingModel:
          "all-MiniLM-L6-v2",

        embeddingDimensions:
          resumeEmbedding.length,

        algorithm:
          "Cosine Similarity",
      },
    });

  } catch (error) {

    console.error(
      "Analyze text error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Analysis failed",
    });
  }
};