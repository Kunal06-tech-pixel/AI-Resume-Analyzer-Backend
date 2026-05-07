import mongoose from "mongoose";

const embeddingSchema = new mongoose.Schema({
  userId: String,

  resumeText: String,

  embedding: {
    type: [Number],
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Embedding", embeddingSchema);