import { SKILL_CATALOG } from "../data/skillCatalog.js";
import { cosineSimilarity } from "./cosineSimilarity.js";

export const DEFAULT_SKILL_SIMILARITY_THRESHOLD = 0.92;

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createAliasPattern = (alias) => {
  const escaped = escapeRegExp(alias.trim()).replace(/\s+/g, "\\s+");
  const startsWithWord = /^[a-z0-9]/i.test(alias);
  const endsWithWord = /[a-z0-9]$/i.test(alias);
  const pattern = `${startsWithWord ? "(?<![A-Za-z0-9])" : ""}${escaped}${
    endsWithWord ? "(?![A-Za-z0-9])" : ""
  }`;
  const isShortLabel = /^[a-z]{1,2}$/i.test(alias);

  // Short labels such as JS, TS, ML, and Go must preserve case to avoid
  // matching ordinary words inside prose.
  return new RegExp(pattern, isShortLabel ? "" : "i");
};

const catalogWithPatterns = SKILL_CATALOG.map((entry) => ({
  ...entry,
  patterns: [...entry.aliases]
    .sort((left, right) => right.length - left.length)
    .map((alias) => ({ alias, pattern: createAliasPattern(alias) })),
}));

export const extractSkills = (text) => {
  const source = String(text || "");

  return catalogWithPatterns
    .map((entry) => {
      const matchedAlias = entry.patterns.find(({ pattern }) => pattern.test(source));

      if (!matchedAlias) return null;

      return {
        name: entry.name,
        category: entry.category,
        matchedAlias: matchedAlias.alias,
      };
    })
    .filter(Boolean);
};

const createEmbeddingLabel = (entry) => `${entry.name} professional skill`;

export const matchSkillsWithEmbeddings = async ({
  resumeText,
  jobDescription,
  generateEmbeddings,
  similarityThreshold = DEFAULT_SKILL_SIMILARITY_THRESHOLD,
}) => {
  const resumeSkills = extractSkills(resumeText);
  const jobSkills = extractSkills(jobDescription);

  if (jobSkills.length === 0) {
    return {
      resumeSkills,
      jobSkills,
      matchedSkills: [],
      missingSkills: [],
      matches: [],
      skillScore: 0,
    };
  }

  const uniqueSkills = new Map();
  [...jobSkills, ...resumeSkills].forEach((entry) => {
    uniqueSkills.set(entry.name, entry);
  });

  const skillsToEmbed = [...uniqueSkills.values()];
  const vectors = await generateEmbeddings(
    skillsToEmbed.map(createEmbeddingLabel)
  );
  const vectorBySkill = new Map(
    skillsToEmbed.map((entry, index) => [entry.name, vectors[index]])
  );
  const resumeSkillByName = new Map(
    resumeSkills.map((entry) => [entry.name, entry])
  );

  const matches = jobSkills.map((requiredSkill) => {
    const requiredVector = vectorBySkill.get(requiredSkill.name);
    const exactMatch = resumeSkillByName.get(requiredSkill.name);

    if (exactMatch) {
      return {
        requiredSkill: requiredSkill.name,
        matchedSkill: exactMatch.name,
        method: "exact",
        similarity: Number(
          cosineSimilarity(requiredVector, vectorBySkill.get(exactMatch.name)).toFixed(4)
        ),
      };
    }

    const candidates = resumeSkills.filter(
      (candidate) => candidate.category === requiredSkill.category
    );
    let bestMatch = null;

    candidates.forEach((candidate) => {
      const similarity = cosineSimilarity(
        requiredVector,
        vectorBySkill.get(candidate.name)
      );

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { candidate, similarity };
      }
    });

    if (bestMatch && bestMatch.similarity >= similarityThreshold) {
      return {
        requiredSkill: requiredSkill.name,
        matchedSkill: bestMatch.candidate.name,
        method: "semantic",
        similarity: Number(bestMatch.similarity.toFixed(4)),
      };
    }

    return {
      requiredSkill: requiredSkill.name,
      matchedSkill: "",
      method: "missing",
      similarity: Number((bestMatch?.similarity || 0).toFixed(4)),
    };
  });

  const successfulMatches = matches.filter((match) => match.method !== "missing");
  const skillScore = Math.round(
    (successfulMatches.reduce(
      (total, match) => total + (match.method === "exact" ? 1 : match.similarity),
      0
    ) /
      jobSkills.length) *
      100
  );

  return {
    resumeSkills,
    jobSkills,
    matchedSkills: successfulMatches.map((match) => match.requiredSkill),
    missingSkills: matches
      .filter((match) => match.method === "missing")
      .map((match) => match.requiredSkill),
    matches,
    skillScore,
  };
};
