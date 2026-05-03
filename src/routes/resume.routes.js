import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  analyzeResume,
  analyzeResumeText,
  getAnalysisById,
  listAnalyses,
} from "../controllers/resume.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();
const uploadDir = path.resolve("uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: function (req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    const isPdf = file.mimetype === "application/pdf" || extension === ".pdf";

    if (!isPdf) {
      return cb(new Error("Only PDF resumes are supported"));
    }

    return cb(null, true);
  },
});

const uploadResume = (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next();
  });
};

router.use(protect);

router.get("/analyses", listAnalyses);
router.get("/analyses/:id", getAnalysisById);
router.post("/upload", uploadResume, analyzeResume);
router.post("/analyze-text", analyzeResumeText);

export default router;
