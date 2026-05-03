import { improveSectionWithGroq } from "../services/groq.service.js";

export const improveSection = async (req, res) => {
  try {
    const { section, text } = req.body;

    if (!section || !text) {
      return res.status(400).json({
        message: "Section and text are required"
      });
    }

    const result = await improveSectionWithGroq(section, text);

    res.json({
      improved: result
    });

  } catch (error) {
    console.error("AI Error:", error.message);

    res.status(500).json({
      message: "AI processing failed"
    });
  }
};