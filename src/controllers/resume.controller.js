import fs from "fs";
import { PDFParse } from "pdf-parse";
import { analyzeResumeWithGroq } from "../services/groq.service.js";

export const analyzeResume = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No resume uploaded"
      });
    }

    // get job data from frontend form
    const jobTitle = req.body.jobTitle;
    const jobDescription = req.body.jobDescription;

    const filePath = req.file.path;

    // read uploaded file
    const fileBuffer = fs.readFileSync(filePath);

    // create parser
    const parser = new PDFParse({ data: fileBuffer });``

    // extract text
    const result = await parser.getText();

    const resumeText = result.text;

    console.log("Resume text extracted");

    // send resume + job info to AI
    const aiResponse = await analyzeResumeWithGroq(
      resumeText,
      jobDescription,
      jobTitle
    );

    let analysis;

    try {
      analysis = JSON.parse(aiResponse);
    } catch {
      analysis = { raw_output: aiResponse };
    }

    res.json({
      success: true,
      analysis
    });

  } catch (error) {

    console.error("Resume analysis error:", error);

    res.status(500).json({
      success: false,
      message: "Resume analysis failed"
    });

  }
};