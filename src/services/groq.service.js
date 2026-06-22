import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const toStringValue = (value) => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toStringArray = (value) => {
  if (typeof value === "string") {
    const item = toStringValue(value);
    return item ? [item] : [];
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toStringValue(item))
    .filter(Boolean);
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

const normalizeSuggestionsResponse = (payload) =>
  toStringArray(payload?.suggestions).slice(0, 6);


// ======================= RESUME SUGGESTIONS =======================

export const generateSuggestionsWithGroq = async ({
  resumeText,
  jobDescription,
  jobTitle,
  analysis,
}) => {

  const systemPrompt = `
You are an ATS resume improvement advisor. The local analysis engine has already calculated all scores and skill matches. Return only improvement suggestions as valid JSON.

Output rules:
- Return exactly one object with one key named "suggestions".
- The suggestions value must be an array containing 4 to 6 concise strings.
- Base every suggestion only on the supplied resume, job description, and local analysis.
- Do not invent experience, metrics, certifications, tools, companies, or education.
- Do not calculate or return a score, summary, skill list, strengths, weaknesses, or role match.
- Prioritize missing target skills, missing keywords, evidence gaps, quantified impact, and ATS-readable wording.
`.trim();

  const userPrompt = `
Return JSON in this exact format:

{
  "suggestions": []
}

JOB TITLE:
${jobTitle || "Not specified"}

JOB DESCRIPTION:
<<<JOB_DESCRIPTION
${jobDescription || ""}
JOB_DESCRIPTION

LOCAL ANALYSIS:
- ATS score: ${analysis.atsScore.score}/100
- Matched skills: ${analysis.skillsMatch.join(", ") || "None identified"}
- Missing skills: ${analysis.missingSkills.join(", ") || "None identified"}
- Missing keywords: ${analysis.missingKeywords.join(", ") || "None identified"}
- Weaknesses: ${analysis.weaknesses.join(" | ") || "None identified"}

RESUME:
<<<RESUME
${resumeText || ""}
RESUME
`.trim();

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2
  });

  const content = response.choices[0].message.content;

  try {
    const parsed = parseJsonResponse(content);
    const suggestions = normalizeSuggestionsResponse(parsed);

    if (suggestions.length === 0) {
      throw new Error("Groq returned no suggestions");
    }

    return suggestions;
  } catch (error) {
    console.error("Groq suggestion JSON parse failed:", content);
    throw new Error("Invalid AI suggestion format");
  }
};


// ======================= AI SUGGESTIONS =======================

export const improveSectionWithGroq = async (section, text) => {

  let prompt = "";

  switch (section) {

    case "experience":
      prompt = `
Rewrite the following experience into concise ATS-friendly bullet points.

STRICT RULES:
- Maximum 8-12 words per line
- Each point must be ONE line only
- Start with strong action verbs (Built, Developed, Optimized, Led)
- Include measurable results only when they are present or clearly implied
- Remove filler words ("responsible for", "worked on")
- DO NOT use "-" or bullet symbols
- Return ONLY 3 to 5 lines
- Do not invent numbers, employers, tools, or outcomes

Text:
${text}
`;
      break;

    case "project":
      prompt = `
Rewrite the following project into concise resume bullet points.

STRICT RULES:
- Maximum 8-12 words per line
- Each point must be ONE line only
- Mention technologies clearly
- Focus on impact and results
- DO NOT use "-" or bullet symbols
- Return ONLY 3 to 5 lines
- Do not invent numbers, users, tools, or outcomes

Text:
${text}
`;
      break;

    case "skills":
      prompt = `
Suggest relevant technical and soft skills based only on this text:

${text}

Return ONLY comma-separated values.
Do not include explanations, categories, or skills unrelated to the text.
`;
      break;

    case "certifications":
      prompt = `
Suggest relevant certifications for this background:

${text}

Return ONLY 3 to 5 certifications, each on a NEW LINE.
Prefer realistic certifications aligned with the provided skills or target role.
`;
      break;

    default:
      throw new Error("Invalid AI section");
  }

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  const content = response.choices[0].message.content;

  const lines = section === "skills"
    ? content.split("\n").flatMap(line => line.split(","))
    : content.split("\n");

  const cleaned = lines
    .map(line => line.replace(/^[-*\u2022]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(line => line.length > 0);

  return cleaned;
};


// ======================= CHAT WITH RESUME CONTEXT =======================

export const chatWithGroq = async (userMessage, resumeContext, chatHistory = []) => {
  
  const systemPrompt = `You are an expert resume advisor and career coach. You have access to the user's resume analysis and can provide personalized advice.

RESUME CONTEXT:
- File: ${resumeContext.fileName}
- Job Title: ${resumeContext.jobTitle || 'Not specified'}
- Company: ${resumeContext.companyName || 'Not specified'}
- ATS Score: ${resumeContext.atsScore?.score || 0}/100 (${resumeContext.atsScore?.level || 'N/A'})
- Semantic Score: ${resumeContext.semanticScore || 'N/A'}
- Skill Match Score: ${resumeContext.skillScore || 'N/A'}

SUMMARY:
${resumeContext.summary || 'No summary available'}

STRENGTHS:
${resumeContext.strengths?.join('\n- ') || 'None listed'}

WEAKNESSES:
${resumeContext.weaknesses?.join('\n- ') || 'None listed'}

SKILLS DETECTED:
${resumeContext.skillsDetected?.join(', ') || 'None'}

MISSING SKILLS:
${resumeContext.missingSkills?.join(', ') || 'None'}

EXPERIENCE ANALYSIS:
${resumeContext.experienceAnalysis || 'No analysis available'}

SUGGESTIONS FOR IMPROVEMENT:
${resumeContext.suggestions?.join('\n- ') || 'None'}

YOUR ROLE:
- Answer questions about the resume
- Provide specific, actionable advice
- Explain the ATS score and how to improve it
- Suggest improvements based on the analysis
- Help with career guidance
- Be conversational and helpful

RULES:
- Keep responses concise (2-4 paragraphs max)
- Be specific and reference the actual resume data
- Provide actionable advice
- Be encouraging but honest
- If asked about something not in the context, say you don't have that information
- Do not invent resume details, company requirements, scores, or user background`;

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  chatHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  messages.push({
    role: "user",
    content: userMessage
  });

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: messages,
    temperature: 0.7,
    max_tokens: 1000
  });

  return response.choices[0].message.content;
};
