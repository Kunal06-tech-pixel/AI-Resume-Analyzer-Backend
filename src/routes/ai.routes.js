import express from "express";
import { improveSection } from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/improve", improveSection);

export default router;