import fs from "fs/promises";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";
import Analysis from "../models/Analysis.js";
import { analyzeResumeWithGroq } from "../services/groq.service.js";

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
    roleMatch: toStringValue(parsed.role_match || parsed.roleMatch),
    strengths: firstStringArray(parsed.strengths),
    weaknesses: firstStringArray(parsed.weaknesses),
    skillsDetected,
    missingSkills,
    skillsMatch: firstStringArray(parsed.skills_match, parsed.skillsMatch, skillsDetected),
    missingKeywords: firstStringArray(
      parsed.missing_keywords,
      parsed.missingKeywords,
      missingSkills
    ),
    experienceAnalysis: toStringValue(
      parsed.experience_analysis || parsed.experienceAnalysis || parsed.experience_years
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
    experienceAnalysis: doc.experienceAnalysis,
    suggestions: doc.suggestions || [],
    atsScore,
    rawPayload: doc.rawPayload || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,

    // Backward-compatible aliases for existing result components.
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

    const aiResponse = await analyzeResumeWithGroq(
      resumeText,
      req.body.jobDescription || "",
      req.body.jobTitle || ""
    );

    const normalized = normalizeAnalysis(aiResponse);

    const analysis = await Analysis.create({
      user: req.userId,
      fileName: req.file.originalname,
      companyName: req.body.companyName || "",
      jobTitle: req.body.jobTitle || "",
      jobDescription: req.body.jobDescription || "",
      ...normalized,
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

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: "Resume text is required",
      });
    }

    const aiResponse = await analyzeResumeWithGroq(
      resumeText,
      jobDescription,
      jobTitle
    );

    return res.json({
      success: true,
      analysis: normalizeAnalysis(aiResponse),
    });
  } catch (error) {
    console.error("Analyze text error:", error);

    return res.status(500).json({
      success: false,
      message: "Analysis failed",
    });
  }
};
