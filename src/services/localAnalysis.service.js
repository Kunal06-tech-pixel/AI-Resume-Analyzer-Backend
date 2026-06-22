import { generateEmbedding, generateEmbeddings } from "../utils/embedding.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";
import { matchSkillsWithEmbeddings } from "../utils/skillMatcher.js";

const SCORE_WEIGHTS = {
  skills: 0.45,
  semantic: 0.3,
  keywords: 0.15,
  quality: 0.1,
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "been", "being", "but", "can",
  "candidate", "company", "for", "from", "have", "into", "job", "must", "our",
  "role", "should", "that", "the", "their", "them", "this", "through", "using",
  "will", "with", "within", "work", "working", "years", "your", "you", "who",
  "required", "requirements", "preferred", "responsibilities", "responsibility",
  "including", "strong", "excellent", "ability", "knowledge", "experience", "skills",
  "team", "teams", "looking", "seeking", "plus", "other", "such", "related",
  "build", "building", "developer", "need", "needs",
]);

const clampScore = (score) =>
  Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

const getScoreLevel = (score) => {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
};

const stemToken = (token) => {
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
};

const tokenize = (text) =>
  (String(text || "")
    .toLowerCase()
    .match(/[a-z][a-z0-9+#.-]{2,}/g) || [])
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 3);

const analyzeKeywords = (jobDescription, resumeText, jobSkills) => {
  const skillTokens = new Set(
    jobSkills.flatMap((entry) => tokenize(entry.name).map(stemToken))
  );
  const jobTokens = tokenize(jobDescription).filter(
    (token) => !STOP_WORDS.has(token) && !skillTokens.has(stemToken(token))
  );
  const resumeTokenStems = new Set(tokenize(resumeText).map(stemToken));
  const counts = new Map();

  jobTokens.forEach((token, index) => {
    const stem = stemToken(token);
    const current = counts.get(stem) || { label: token, count: 0, firstIndex: index };
    current.count += 1;
    counts.set(stem, current);
  });

  const importantKeywords = [...counts.entries()]
    .sort((left, right) => {
      const countDifference = right[1].count - left[1].count;
      return countDifference || left[1].firstIndex - right[1].firstIndex;
    })
    .slice(0, 12);
  const matchedKeywords = importantKeywords
    .filter(([stem]) => resumeTokenStems.has(stem))
    .map(([, details]) => details.label);
  const missingKeywords = importantKeywords
    .filter(([stem]) => !resumeTokenStems.has(stem))
    .map(([, details]) => details.label);
  const keywordScore = importantKeywords.length
    ? Math.round((matchedKeywords.length / importantKeywords.length) * 100)
    : 0;

  return { matchedKeywords, missingKeywords, keywordScore };
};

const analyzeResumeQuality = (resumeText) => {
  const text = String(resumeText || "");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const sections = [
    /(?:^|\n)\s*(?:professional\s+)?summary\s*(?:\n|:)/i,
    /(?:^|\n)\s*(?:work\s+)?experience\s*(?:\n|:)/i,
    /(?:^|\n)\s*education\s*(?:\n|:)/i,
    /(?:^|\n)\s*(?:technical\s+)?skills\s*(?:\n|:)/i,
    /(?:^|\n)\s*(?:projects?|certifications?)\s*(?:\n|:)/i,
  ];
  const sectionCount = sections.filter((pattern) => pattern.test(text)).length;
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const hasMetrics = /\b\d+(?:\.\d+)?%|\b\d+\+\b|\b(?:increased|reduced|improved|grew|saved)\b/i.test(text);
  const hasBullets = /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+\S/m.test(text);

  let score = sectionCount * 10;
  score += hasEmail ? 8 : 0;
  score += hasPhone ? 7 : 0;
  score += wordCount >= 250 && wordCount <= 1200 ? 15 : wordCount >= 120 ? 8 : 0;
  score += hasMetrics ? 10 : 0;
  score += hasBullets ? 10 : 0;

  return {
    score: clampScore(score),
    sectionCount,
    wordCount,
    hasEmail,
    hasPhone,
    hasMetrics,
    hasBullets,
  };
};

const getExperienceAnalysis = (resumeText, matchedCount) => {
  const yearMatches = [...String(resumeText || "").matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi)];
  const years = yearMatches
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value < 60);
  const experienceEvidence = years.length
    ? `The resume explicitly reports up to ${Math.max(...years)} years of experience.`
    : "The resume does not state a clear total number of years of experience.";

  return `${experienceEvidence} ${matchedCount} target skill${matchedCount === 1 ? " is" : "s are"} supported by explicit resume text; seniority and responsibility depth are not inferred by the embedding model.`;
};

const buildNarrative = ({
  jobTitle,
  semanticScore,
  skillAnalysis,
  keywordAnalysis,
  qualityAnalysis,
  finalScore,
}) => {
  const target = jobTitle ? `the ${jobTitle} role` : "the target role";
  const matchedCount = skillAnalysis.matchedSkills.length;
  const requiredCount = skillAnalysis.jobSkills.length;
  const matchStatement = requiredCount
    ? `${matchedCount} of ${requiredCount} identified job skills are supported by the resume.`
    : "No catalogued job skills were identified in the supplied job description.";

  const strengths = [];
  if (matchedCount) {
    strengths.push(`Matched target skills: ${skillAnalysis.matchedSkills.slice(0, 6).join(", ")}.`);
  }
  if (semanticScore >= 60) {
    strengths.push(`The resume has ${semanticScore}% overall semantic alignment with the job description.`);
  }
  if (qualityAnalysis.sectionCount >= 4) {
    strengths.push(`${qualityAnalysis.sectionCount} standard resume sections were detected.`);
  }
  if (qualityAnalysis.hasMetrics) {
    strengths.push("The resume includes measurable impact or quantified outcomes.");
  }
  if (strengths.length === 0) {
    strengths.push("The resume contains readable text that can be compared with the target role.");
  }

  const weaknesses = skillAnalysis.missingSkills
    .slice(0, 3)
    .map((name) => `${name} is requested by the job description but is not supported by explicit or high-confidence semantic evidence in the resume.`);
  if (keywordAnalysis.missingKeywords.length) {
    weaknesses.push(`Important wording is missing: ${keywordAnalysis.missingKeywords.slice(0, 5).join(", ")}.`);
  }
  if (!qualityAnalysis.hasMetrics) {
    weaknesses.push("No clear quantified impact was detected in the resume text.");
  }
  if (weaknesses.length === 0) {
    weaknesses.push("Review semantic skill matches manually because embeddings indicate similarity, not proof of professional experience.");
  }

  return {
    summary: `${matchStatement} Overall local ATS fit is ${finalScore}% with ${semanticScore}% document-level semantic alignment.`,
    roleMatch: `The resume has a ${getScoreLevel(finalScore).toLowerCase()} calculated fit for ${target}, based on local skill, semantic, keyword, and resume-quality signals.`,
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
  };
};

export const buildFallbackSuggestions = (analysis) => {
  const suggestions = [];

  if (analysis.missingSkills.length) {
    suggestions.push(
      `Add truthful project or work evidence for these target skills where applicable: ${analysis.missingSkills.slice(0, 5).join(", ")}.`
    );
  }
  if (analysis.missingKeywords.length) {
    suggestions.push(
      `Use relevant job-description wording where accurate: ${analysis.missingKeywords.slice(0, 5).join(", ")}.`
    );
  }
  suggestions.push("Rewrite experience bullets with an action, the work performed, and a measurable result.");
  suggestions.push("Keep standard headings such as Summary, Experience, Education, Skills, and Projects.");
  suggestions.push("Verify every claimed skill and remove wording that cannot be supported in an interview.");

  return suggestions.slice(0, 6);
};

export const analyzeResumeLocally = async ({
  resumeText,
  jobDescription = "",
  jobTitle = "",
}) => {
  const resumeEmbedding = await generateEmbedding(resumeText);
  const hasJobDescription = Boolean(String(jobDescription).trim());
  const jobEmbedding = hasJobDescription
    ? await generateEmbedding(jobDescription)
    : [];
  const similarity = hasJobDescription
    ? cosineSimilarity(resumeEmbedding, jobEmbedding)
    : 0;
  const semanticScore = clampScore(Math.max(0, similarity) * 100);
  const skillAnalysis = await matchSkillsWithEmbeddings({
    resumeText,
    jobDescription,
    generateEmbeddings,
  });
  const keywordAnalysis = analyzeKeywords(
    jobDescription,
    resumeText,
    skillAnalysis.jobSkills
  );
  const qualityAnalysis = analyzeResumeQuality(resumeText);

  const finalScore = hasJobDescription
    ? clampScore(
        skillAnalysis.skillScore * SCORE_WEIGHTS.skills +
          semanticScore * SCORE_WEIGHTS.semantic +
          keywordAnalysis.keywordScore * SCORE_WEIGHTS.keywords +
          qualityAnalysis.score * SCORE_WEIGHTS.quality
      )
    : qualityAnalysis.score;
  const narrative = buildNarrative({
    jobTitle,
    semanticScore,
    skillAnalysis,
    keywordAnalysis,
    qualityAnalysis,
    finalScore,
  });
  return {
    resumeEmbedding,
    analysis: {
      ...narrative,
      experienceAnalysis: getExperienceAnalysis(
        resumeText,
        skillAnalysis.matchedSkills.length
      ),
      skillsDetected: skillAnalysis.resumeSkills.map((entry) => entry.name),
      skillsMatch: skillAnalysis.matchedSkills,
      missingSkills: skillAnalysis.missingSkills,
      missingKeywords: keywordAnalysis.missingKeywords,
      matchedKeywords: keywordAnalysis.matchedKeywords,
      skillMatches: skillAnalysis.matches,
      similarity,
      semanticScore,
      skillScore: skillAnalysis.skillScore,
      keywordScore: keywordAnalysis.keywordScore,
      resumeQualityScore: qualityAnalysis.score,
      atsScore: {
        score: finalScore,
        level: getScoreLevel(finalScore),
      },
      scoringMethod: hasJobDescription
        ? "45% skill match + 30% document similarity + 15% keywords + 10% resume quality"
        : "Resume quality score (no job description supplied)",
      rawPayload: {
        analysisEngine: "local-embedding-v2",
        scoreWeights: hasJobDescription ? SCORE_WEIGHTS : { quality: 1 },
        requiredSkills: skillAnalysis.jobSkills.map((entry) => entry.name),
        qualitySignals: qualityAnalysis,
      },
    },
  };
};
