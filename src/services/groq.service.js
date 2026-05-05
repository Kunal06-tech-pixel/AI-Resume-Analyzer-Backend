// dotenv is loaded in server.js before this module is imported
import Groq from "groq-sdk";

let groq;

const ensureGroq = () => {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Groq API key is not configured. Set GROQ_API_KEY in your .env file.");
    }
    groq = new Groq({ apiKey });
  }
  return groq;
};

const parseJsonResponse = (content) => {
  const trimmed = String(content || "").trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }

    throw new Error("Invalid AI response format");
  }
};


// ======================= ATS ANALYZER (UNCHANGED) =======================

export const analyzeResumeWithGroq = async (resumeText, jobDescription, jobTitle) => {

  const prompt = `
You are an ATS (Applicant Tracking System).

Your job is to compare the resume with the job description and evaluate how well they match.

STRICT RULES:

1. ATS SCORE must be between 0 and 100.
2. Also classify the score:
   - 0–40 → Low
   - 41–70 → Medium
   - 71–100 → High
3. Extract important keywords from the JOB DESCRIPTION.
4. Compare them with the RESUME.
5. List the missing keywords.
6. Do NOT return empty arrays unless absolutely necessary.
7. Return ONLY JSON.

Return JSON in this exact format:

{
  "summary": "Write a clear professional SUMMARY (2-3 lines)",
  "role_match": "",
  "strengths": [
    "Strong technical skills in relevant areas"
  ],
  "weaknesses": [
    "Missing measurable impact in some bullets"
  ],
  "skills_detected": [],
  "missing_skills": [],
  "skills_match": [],
  "missing_keywords": [],
  "experience_analysis": "Analyze career growth, project impact, responsibilities, and relevance to the target role.",
  "ats_score": {
      "score": 0,
      "level": ""
  },
  "suggestions": []
}

JOB TITLE:
${jobTitle}

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}
`;

  const response = await ensureGroq().chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });

  const content = response.choices[0].message.content;

  try {
    const parsed = parseJsonResponse(content);
    return parsed;
  } catch (error) {
    console.error("Groq JSON parse failed:", content);
    throw new Error("Invalid AI response format");
  }
};


// ======================= AI SUGGESTIONS (FIXED FOR SHORT CONTENT) =======================

export const improveSectionWithGroq = async (section, text) => {

  let prompt = "";

  switch (section) {

    case "experience":
      prompt = `
Rewrite the following experience into concise ATS-friendly bullet points.

STRICT RULES:
- Maximum 8–12 words per line
- Each point must be ONE line only
- Start with strong action verbs (Built, Developed, Optimized, Led)
- Include measurable results (%, users, performance) if possible
- Remove filler words ("responsible for", "worked on")
- DO NOT use "-" or bullet symbols
- Return ONLY 3 to 5 lines

Text:
${text}
`;
      break;

    case "project":
      prompt = `
Rewrite the following project into concise resume bullet points.

STRICT RULES:
- Maximum 8–12 words per line
- Each point must be ONE line only
- Mention technologies clearly
- Focus on impact and results
- DO NOT use "-" or bullet symbols
- Return ONLY 3 to 5 lines

Text:
${text}
`;
      break;

    case "skills":
      prompt = `
Suggest relevant technical and soft skills based on:

${text}

Return ONLY comma-separated values (no explanation).
`;
      break;

    case "certifications":
      prompt = `
Suggest relevant certifications for:

${text}

Return ONLY 3 to 5 certifications, each on a NEW LINE.
`;
      break;

    default:
      throw new Error("Invalid AI section");
  }

  const response = await ensureGroq().chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  const content = response.choices[0].message.content;

  // ✅ CLEAN OUTPUT (NO CHANGE IN FLOW)
  const cleaned = content
    .split("\n")
    .map(line => line.replace(/^[-•]/, "").trim())
    .filter(line => line.length > 0);

  return cleaned;
};
