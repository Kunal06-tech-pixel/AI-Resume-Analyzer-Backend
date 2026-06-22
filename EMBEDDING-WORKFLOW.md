# Resume Analysis and Embedding Workflow

## Pipeline

```text
PDF/text input
  -> text extraction
  -> document embeddings and cosine similarity
  -> local skill extraction
  -> per-skill embedding comparison
  -> local keyword and resume-quality analysis
  -> weighted ATS score
  -> Groq improvement suggestions
  -> MongoDB storage and API response
```

## 1. Document embeddings

- Model: `Xenova/all-MiniLM-L6-v2`
- Dimensions: 384
- Pooling: mean
- Normalization: enabled
- The resume and job description vectors are compared with cosine similarity.
- The result becomes the document semantic score from 0 to 100.

## 2. Skill extraction and matching

The local skill catalogue contains canonical names, categories, and aliases. For example, `Postgres` is normalized to `PostgreSQL`, and `Amazon Web Services` is normalized to `AWS`.

Matching uses two stages:

1. Exact canonical match after alias normalization.
2. Per-skill embedding comparison for unmatched skills.

Semantic matches are restricted to the same skill category and require cosine similarity of at least `0.92`. This conservative threshold reduces false matches between related but non-equivalent tools.

Each required job skill is stored with:

```json
{
  "requiredSkill": "AWS",
  "matchedSkill": "",
  "method": "missing",
  "similarity": 0.58
}
```

Possible methods are `exact`, `semantic`, and `missing`.

## 3. Local ATS score

When a job description is supplied:

```text
ATS Score = 45% Skill Match
          + 30% Document Semantic Similarity
          + 15% Keyword Coverage
          + 10% Resume Quality
```

Resume quality checks common sections, contact details, suitable content length, bullet usage, and quantified impact. When no job description is supplied, the result is a resume-quality score rather than a job-fit score.

Groq does not calculate any score and does not determine matched or missing skills.

## 4. Groq suggestions

After local analysis is complete, Groq receives the resume, job description, and calculated gaps. It returns one field only:

```json
{
  "suggestions": [
    "Add truthful project evidence for Docker where applicable."
  ]
}
```

If Groq is unavailable or returns invalid JSON, deterministic local fallback suggestions are returned so the analysis endpoint still succeeds.

## 5. Stored analysis fields

```text
embedding              Resume vector
embeddingModel         all-MiniLM-L6-v2
embeddingDimensions    384
similarity             Raw document cosine similarity
semanticScore          Document similarity on a 0-100 scale
skillScore             Embedding-assisted skill coverage
keywordScore           Local keyword coverage
resumeQualityScore     Local structure and evidence score
skillMatches           Per-required-skill evidence and method
atsScore               Final weighted score and level
scoringMethod          Human-readable weighting description
suggestions             Groq or fallback suggestions
suggestionSource       groq or local-fallback
```

The legacy `aiScore` field remains in the schema for old records but is `0` for new analyses.

## 6. Main implementation files

- `src/data/skillCatalog.js`: canonical skill catalogue and aliases
- `src/utils/embedding.js`: document and batch skill embeddings
- `src/utils/skillMatcher.js`: exact and semantic skill matching
- `src/services/localAnalysis.service.js`: local scoring and report generation
- `src/services/groq.service.js`: suggestion generation, builder rewriting, and chat
- `src/controllers/resume.controller.js`: PDF/text endpoint orchestration
- `src/models/Analysis.js`: persisted analysis schema

## 7. Verification

```bash
npm test
npm run dev
```

The unit tests cover alias normalization, exact skill matching, conservative semantic matching, missing skills, and category isolation.
