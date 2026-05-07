import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Analysis from "../models/Analysis.js";
import { chatWithGroq } from "../services/groq.service.js";

// ======================= CREATE OR GET CHAT =======================

export const getOrCreateChat = async (req, res) => {
  try {
    const { analysisId } = req.params;

    console.log("\n" + "=".repeat(70));
    console.log("💬 GET OR CREATE CHAT SESSION");
    console.log("=".repeat(70));
    console.log(`Analysis ID: ${analysisId}`);
    console.log(`User ID: ${req.userId}\n`);

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    // Verify analysis exists and belongs to user
    const analysis = await Analysis.findOne({
      _id: analysisId,
      user: req.userId,
    }).lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({
      user: req.userId,
      analysis: analysisId,
      isActive: true,
    });

    if (!chat) {
      console.log("📝 Creating new chat session...");
      chat = await Chat.create({
        user: req.userId,
        analysis: analysisId,
        title: `Chat about ${analysis.fileName}`,
        messages: [],
      });
      console.log(`✅ Chat created: ${chat._id}\n`);
    } else {
      console.log(`✅ Existing chat found: ${chat._id}\n`);
    }

    console.log("=".repeat(70) + "\n");

    return res.json({
      success: true,
      chat: {
        id: chat._id,
        analysisId: chat.analysis,
        title: chat.title,
        messages: chat.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Get or create chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get or create chat",
    });
  }
};

// ======================= SEND MESSAGE =======================

export const sendMessage = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { message } = req.body;

    console.log("\n" + "=".repeat(70));
    console.log("💬 SENDING MESSAGE TO CHAT");
    console.log("=".repeat(70));
    console.log(`Analysis ID: ${analysisId}`);
    console.log(`User ID: ${req.userId}`);
    console.log(`Message: "${message.substring(0, 100)}..."\n`);

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    // Get analysis with embedding
    console.log("📊 Retrieving analysis and embedding...");
    const analysis = await Analysis.findOne({
      _id: analysisId,
      user: req.userId,
    }).lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    console.log(`✅ Analysis retrieved: ${analysis.fileName}`);
    console.log(`   - ATS Score: ${analysis.atsScore?.score || 0}`);
    console.log(`   - Skills Detected: ${analysis.skillsDetected?.length || 0}`);
    console.log(`   - Embedding: ${analysis.embedding?.length || 0} dimensions\n`);

    // Get or create chat
    let chat = await Chat.findOne({
      user: req.userId,
      analysis: analysisId,
      isActive: true,
    });

    if (!chat) {
      chat = await Chat.create({
        user: req.userId,
        analysis: analysisId,
        title: `Chat about ${analysis.fileName}`,
        messages: [],
      });
    }

    // Add user message
    chat.messages.push({
      role: "user",
      content: message,
    });

    // Prepare context for LLM
    const context = {
      fileName: analysis.fileName,
      jobTitle: analysis.jobTitle,
      companyName: analysis.companyName,
      atsScore: analysis.atsScore,
      summary: analysis.summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      skillsDetected: analysis.skillsDetected,
      missingSkills: analysis.missingSkills,
      suggestions: analysis.suggestions,
      experienceAnalysis: analysis.experienceAnalysis,
      semanticScore: analysis.semanticScore,
      aiScore: analysis.aiScore,
    };

    // Get chat history (last 10 messages)
    const chatHistory = chat.messages.slice(-10);

    console.log("🤖 Calling Groq AI for response...");
    const aiResponse = await chatWithGroq(message, context, chatHistory);
    console.log(`✅ AI response received (${aiResponse.length} characters)\n`);

    // Add assistant message
    chat.messages.push({
      role: "assistant",
      content: aiResponse,
    });

    await chat.save();

    console.log("💾 Chat saved to database");
    console.log(`   Total messages: ${chat.messages.length}`);
    console.log("=".repeat(70) + "\n");

    return res.json({
      success: true,
      message: {
        role: "assistant",
        content: aiResponse,
      },
      chat: {
        id: chat._id,
        totalMessages: chat.messages.length,
      },
    });
  } catch (error) {
    console.error("❌ Send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};

// ======================= GET CHAT HISTORY =======================

export const getChatHistory = async (req, res) => {
  try {
    const { analysisId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    const chat = await Chat.findOne({
      user: req.userId,
      analysis: analysisId,
      isActive: true,
    });

    if (!chat) {
      return res.json({
        success: true,
        chat: null,
        messages: [],
      });
    }

    return res.json({
      success: true,
      chat: {
        id: chat._id,
        analysisId: chat.analysis,
        title: chat.title,
        messages: chat.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Get chat history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get chat history",
    });
  }
};

// ======================= DELETE CHAT =======================

export const deleteChat = async (req, res) => {
  try {
    const { analysisId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analysis ID",
      });
    }

    await Chat.updateOne(
      {
        user: req.userId,
        analysis: analysisId,
      },
      {
        isActive: false,
      }
    );

    return res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete chat",
    });
  }
};
