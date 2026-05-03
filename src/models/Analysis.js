import mongoose from "mongoose";

const atsScoreSchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      default: "",
      trim: true,
    },
    jobTitle: {
      type: String,
      default: "",
      trim: true,
    },
    jobDescription: {
      type: String,
      default: "",
      trim: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    roleMatch: {
      type: String,
      default: "",
      trim: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    skillsDetected: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    skillsMatch: {
      type: [String],
      default: [],
    },
    missingKeywords: {
      type: [String],
      default: [],
    },
    experienceAnalysis: {
      type: String,
      default: "",
      trim: true,
    },
    suggestions: {
      type: [String],
      default: [],
    },
    atsScore: {
      type: atsScoreSchema,
      default: () => ({}),
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

analysisSchema.index({ user: 1, createdAt: -1 });

const Analysis = mongoose.model("Analysis", analysisSchema);
export default Analysis;
