import express from "express";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

// 🔒 Protected route
router.get("/profile", protect, (req, res) => {
  res.json({
    message: "Protected route accessed",
    userId: req.userId,
  });
});

export default router;