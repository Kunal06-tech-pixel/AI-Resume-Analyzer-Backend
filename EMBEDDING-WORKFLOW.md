# 📄 Resume Analysis Embedding Workflow

## Your Exact Workflow

```
PDF Upload → Text Extraction → Generate Embeddings → Store in Vector DB → 
AI Analysis → ATS Score → AI Suggestions
```

## Step-by-Step Process

### 1. **PDF Upload** 
- User uploads PDF resume via `/api/resume/upload`
- File is temporarily stored using Multer

### 2. **Text Extraction**
- PDF is parsed using `pdf-parse` library
- Text content is extracted from the PDF
- Validates that text was successfully extracted

### 3. **Generate Embeddings**
- **Resume Embedding**: Text from resume → 384-dimensional vector
- **Job Description Embedding**: Job description → 384-dimensional vector
- Model: `Xenova/all-MiniLM-L6-v2`
- Method: Mean pooling + normalization

### 4. **Store in Vector Database**
- Embeddings stored in MongoDB (Analysis collection)
- Each document contains:
  - Resume embedding (384 dimensions)
  - Original text metadata
  - User information
  - Job details

### 5. **Calculate Semantic Similarity**
- Cosine similarity between resume and job description embeddings
- Produces a semantic score (0-100%)

### 6. **AI Analysis**
- Groq AI analyzes the resume text
- Extracts:
  - Skills detected
  - Missing skills
  - Strengths
  - Weaknesses
  - Experience analysis
  - Role match assessment

### 7. **Hybrid ATS Score**
- **AI Score** (70% weight): From Groq analysis
- **Semantic Score** (30% weight): From embedding similarity
- **Final Score** = (AI Score × 0.7) + (Semantic Score × 0.3)
- Classification:
  - 75-100: High
  - 45-74: Medium
  - 0-44: Low

### 8. **AI Suggestions**
- Actionable recommendations to improve resume
- Based on missing skills, weaknesses, and job requirements

## API Endpoints

### Upload & Analyze Resume
```
POST /api/resume/upload
Headers: Authorization: Bearer <token>
Body (multipart/form-data):
  - resume: PDF file
  - jobDescription: string
  - jobTitle: string
  - companyName: string (optional)
```

### Get All Analyses
```
GET /api/resume/analyses
Headers: Authorization: Bearer <token>
```

### Get Single Analysis
```
GET /api/resume/analyses/:id
Headers: Authorization: Bearer <token>
```

### Analyze Text (without PDF)
```
POST /api/resume/analyze-text
Headers: Authorization: Bearer <token>
Body (JSON):
  - resumeText: string
  - jobDescription: string
  - jobTitle: string
```

## Response Format

```json
{
  "success": true,
  "analysis": {
    "id": "...",
    "fileName": "resume.pdf",
    "jobTitle": "Software Developer",
    "companyName": "TechCorp",
    
    "atsScore": {
      "score": 65,
      "level": "Medium"
    },
    
    "aiScore": 70,
    "semanticScore": 50,
    "similarity": 0.50,
    
    "summary": "...",
    "roleMatch": "...",
    
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    
    "skillsDetected": ["React", "Node.js", "..."],
    "missingSkills": ["Docker", "AWS", "..."],
    
    "suggestions": [
      "Add Agile experience",
      "Highlight code review involvement",
      "..."
    ],
    
    "embeddingModel": "all-MiniLM-L6-v2",
    "embeddingDimensions": 384,
    "algorithm": "Cosine Similarity"
  }
}
```

## Database Schema

### Analysis Model
```javascript
{
  user: ObjectId,
  fileName: String,
  jobTitle: String,
  companyName: String,
  jobDescription: String,
  
  // Embeddings
  embedding: [Number],        // 384 dimensions
  embeddingModel: String,     // "all-MiniLM-L6-v2"
  embeddingDimensions: Number, // 384
  
  // Scores
  similarity: Number,         // 0-1
  semanticScore: Number,      // 0-100
  aiScore: Number,           // 0-100
  atsScore: {
    score: Number,           // 0-100 (hybrid)
    level: String            // "High", "Medium", "Low"
  },
  
  // Analysis Results
  summary: String,
  roleMatch: String,
  strengths: [String],
  weaknesses: [String],
  skillsDetected: [String],
  missingSkills: [String],
  suggestions: [String],
  experienceAnalysis: String,
  
  timestamps: true
}
```

## Console Logging

When you run the server, you'll see detailed logs for:

1. **Model Loading**
   - Embedding model initialization

2. **PDF Processing**
   - File details
   - Text extraction progress

3. **Embedding Generation**
   - Text preview
   - Generation time
   - Vector dimensions
   - Sample values

4. **Similarity Calculation**
   - Vector dimensions
   - Dot product
   - Magnitudes
   - Final similarity score

5. **Database Storage**
   - Document ID
   - Embedding storage confirmation
   - Analysis metadata

6. **AI Analysis**
   - Groq API call
   - Response parsing

7. **Score Calculation**
   - AI score
   - Semantic score
   - Hybrid score
   - Final level

## Testing

Run the test scripts to verify the workflow:

```bash
# Test embedding generation
node test-embedding.js

# Test database storage and retrieval
node test-db-embedding.js

# Test complete workflow
node test-complete-workflow.js

# Test embedding search (optional)
node test-embedding-search.js
```

## Key Features

✅ **PDF to Text**: Automatic extraction from PDF files
✅ **Embeddings**: 384-dimensional semantic vectors
✅ **Vector Storage**: MongoDB with embedding arrays
✅ **AI Analysis**: Comprehensive resume evaluation
✅ **Hybrid Scoring**: Combines AI + semantic similarity
✅ **Actionable Suggestions**: Specific improvement recommendations
✅ **Detailed Logging**: Full visibility into the process

## Technologies Used

- **@xenova/transformers**: Embedding generation (all-MiniLM-L6-v2)
- **pdf-parse**: PDF text extraction
- **Groq SDK**: AI analysis
- **MongoDB**: Vector database storage
- **Express**: REST API
- **Multer**: File upload handling
