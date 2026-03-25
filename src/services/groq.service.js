import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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

Return JSON in this format:

{
  "name": "",
  "summary": "Write a clear professional SUMMARY (2-3 lines) describing resume quality and improvement scope.",
  "role_match": "",
  "skills_match": [],
  "missing_keywords": [],
  "experience_years": "",
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

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2
  });

  const content = response.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error("Groq JSON parse failed:", content);
    throw new Error("Invalid AI response format");
  }
};