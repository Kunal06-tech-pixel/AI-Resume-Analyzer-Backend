import express from "express";
import {
  getOrCreateChat,
  sendMessage,
  getChatHistory,
  deleteChat,
} from "../controllers/chat.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// Get or create chat for an analysis
router.get("/:analysisId", getOrCreateChat);

// Send message in chat
router.post("/:analysisId/message", sendMessage);

// Get chat history
router.get("/:analysisId/history", getChatHistory);

// Delete chat
router.delete("/:analysisId", deleteChat);

export default router;
