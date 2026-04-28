import express from "express";
import multer from "multer";
import { analyzeResume } from "../controllers/resume.controller.js";
import { analyzeResumeWithGroq } from "../services/groq.service.js"; // ✅ ADD THIS

const router = express.Router();

/* ================= MULTER (FILE UPLOAD) ================= */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ================= EXISTING ROUTE ================= */
router.post("/upload", upload.single("resume"), analyzeResume);


/* ================= NEW TEXT ANALYZE ROUTE ================= */
router.post("/analyze-text", async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText) {
      return res.status(400).json({ error: "Resume text is required" });
    }

    const result = await analyzeResumeWithGroq(
      resumeText,
      "",
      ""
    );

    res.json({
      analysis: {
        raw_output: result
      }
    });

  } catch (error) {
    console.error("Analyze-text error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;