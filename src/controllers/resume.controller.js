import fs from "fs/promises";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";

import Analysis from "../models/Analysis.js";
import { generateSuggestionsWithGroq } from "../services/groq.service.js";
import {
  analyzeResumeLocally,
  buildFallbackSuggestions,
} from "../services/localAnalysis.service.js";

const addSuggestions = async ({ resumeText, jobDescription, jobTitle, analysis }) => {
  try {
    const suggestions = await generateSuggestionsWithGroq({
      resumeText,
      jobDescription,
      jobTitle,
      analysis,
    });

    return { ...analysis, suggestions, suggestionSource: "groq" };
  } catch (error) {
    console.error("Groq suggestions failed; using local fallback:", error.message);
    return {
      ...analysis,
      suggestions: buildFallbackSuggestions(analysis),
      suggestionSource: "local-fallback",
    };
  }
};

const runAnalysisPipeline = async ({ resumeText, jobDescription, jobTitle }) => {
  const localResult = await analyzeResumeLocally({
    resumeText,
    jobDescription,
    jobTitle,
  });
  const analysis = await addSuggestions({
    resumeText,
    jobDescription,
    jobTitle,
    analysis: localResult.analysis,
  });

  console.log("Local resume analysis completed", {
    semanticScore: analysis.semanticScore,
    skillScore: analysis.skillScore,
    keywordScore: analysis.keywordScore,
    resumeQualityScore: analysis.resumeQualityScore,
    atsScore: analysis.atsScore.score,
    suggestionSource: analysis.suggestionSource,
  });

  return { ...localResult, analysis };
};

const serializeAnalysis = (analysis) => {
  const doc = typeof analysis.toObject === "function" ? analysis.toObject() : analysis;
  const id = doc._id?.toString?.() || doc.id;
  const atsScore = doc.atsScore || { score: 0, level: "" };

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
    matchedKeywords: doc.matchedKeywords || [],
    skillMatches: doc.skillMatches || [],
    experienceAnalysis: doc.experienceAnalysis,
    suggestions: doc.suggestions || [],
    suggestionSource: doc.suggestionSource || "",
    atsScore,
    rawPayload: doc.rawPayload || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    similarity: doc.similarity || 0,
    semanticScore: doc.semanticScore || 0,
    skillScore: doc.skillScore || 0,
    keywordScore: doc.keywordScore || 0,
    resumeQualityScore: doc.resumeQualityScore || 0,
    scoringMethod: doc.scoringMethod || "",
    aiScore: doc.aiScore || 0,
    embeddingModel: doc.embeddingModel || "all-MiniLM-L6-v2",
    embeddingDimensions: doc.embeddingDimensions || 384,
    algorithm: "Cosine similarity with embedding-assisted skill matching",

    // Backward-compatible response keys.
    role_match: doc.roleMatch,
    skills_detected: doc.skillsDetected || [],
    missing_skills: doc.missingSkills || [],
    skills_match: doc.skillsMatch || [],
    missing_keywords: doc.missingKeywords || [],
    experience_analysis: doc.experienceAnalysis,
    ats_score: atsScore,
  };
};

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF resume",
      });
    }

    const fileBuffer = await fs.readFile(req.file.path);
    const parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    const resumeText = result.text;

    if (!resumeText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Could not read text from this PDF",
      });
    }

    const companyName = req.body.companyName || "";
    const jobTitle = req.body.jobTitle || "";
    const jobDescription = req.body.jobDescription || "";
    const { resumeEmbedding, analysis: resultAnalysis } = await runAnalysisPipeline({
      resumeText,
      jobDescription,
      jobTitle,
    });

    const analysis = await Analysis.create({
      user: req.userId,
      fileName: req.file.originalname,
      companyName,
      jobTitle,
      jobDescription,
      aiScore: 0,
      embeddingModel: "all-MiniLM-L6-v2",
      embeddingDimensions: resumeEmbedding.length,
      embedding: resumeEmbedding,
      ...resultAnalysis,
    });

    return res.status(201).json({
      success: true,
      analysis: serializeAnalysis(analysis),
    });
  } catch (error) {
    console.error("Resume analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "Resume analysis failed",
    });
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
};

export const listAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      total: analyses.length,
      analyses: analyses.map(serializeAnalysis),
    });
  } catch (error) {
    console.error("List analyses error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load analyses",
    });
  }
};

export const getAnalysisById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.userId,
    }).lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    return res.json({
      success: true,
      analysis: serializeAnalysis(analysis),
    });
  } catch (error) {
    console.error("Get analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load analysis",
    });
  }
};

export const analyzeResumeText = async (req, res) => {
  try {
    const { resumeText, jobDescription = "", jobTitle = "" } = req.body;

    if (!String(resumeText || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Resume text is required",
      });
    }

    const { resumeEmbedding, analysis } = await runAnalysisPipeline({
      resumeText,
      jobDescription,
      jobTitle,
    });

    return res.json({
      success: true,
      analysis: serializeAnalysis({
        ...analysis,
        jobTitle,
        jobDescription,
        aiScore: 0,
        embeddingModel: "all-MiniLM-L6-v2",
        embeddingDimensions: resumeEmbedding.length,
      }),
    });
  } catch (error) {
    console.error("Analyze text error:", error);
    return res.status(500).json({
      success: false,
      message: "Analysis failed",
    });
  }
};
