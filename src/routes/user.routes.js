import express from "express";
import protect from "../middleware/auth.middleware.js";
import User from "../models/User.js"; // ✅ IMPORT USER MODEL

const router = express.Router();

// 🔒 Protected route
router.get("/profile", protect, async (req, res) => {
  try {
    // ✅ Fetch full user from DB
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Send full user data (IMPORTANT)
    res.json({
      userId: user._id,
      email: user.email,
      name: user.name, // optional
    });

  } catch (error) {
    console.error("PROFILE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;