import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSkills,
  matchSkillsWithEmbeddings,
} from "../src/utils/skillMatcher.js";

test("extractSkills canonicalizes common aliases", () => {
  const skills = extractSkills(
    "Built APIs with NodeJS and Postgres, deployed through Amazon Web Services and K8s."
  );
  const names = skills.map((entry) => entry.name);

  assert.ok(names.includes("Node.js"));
  assert.ok(names.includes("PostgreSQL"));
  assert.ok(names.includes("AWS"));
  assert.ok(names.includes("Kubernetes"));
});

test("short skill aliases do not match ordinary lowercase prose", () => {
  const names = extractSkills("We go through each task and improve it.\nPROJECTS").map(
    (entry) => entry.name
  );

  assert.equal(names.includes("Go"), false);
  assert.equal(names.includes("TypeScript"), false);
});

test("skill matcher returns exact, semantic, and missing results", async () => {
  const vectors = new Map([
    ["React professional skill", [1, 0, 0]],
    ["Node.js professional skill", [0, 1, 0]],
    ["AWS professional skill", [0, 0, 1]],
    ["Google Cloud Platform professional skill", [0, 0.1, 0.995]],
  ]);
  const generateEmbeddings = async (labels) => labels.map((label) => vectors.get(label));

  const result = await matchSkillsWithEmbeddings({
    resumeText: "React and GCP",
    jobDescription: "Requires React, Node.js, and AWS",
    generateEmbeddings,
    similarityThreshold: 0.92,
  });

  assert.deepEqual(result.matchedSkills, ["React", "AWS"]);
  assert.deepEqual(result.missingSkills, ["Node.js"]);
  assert.equal(result.matches[0].method, "exact");
  assert.equal(result.matches[1].method, "missing");
  assert.equal(result.matches[2].method, "semantic");
});

test("semantic matching never crosses skill categories", async () => {
  const generateEmbeddings = async (labels) => labels.map(() => [1, 0]);
  const result = await matchSkillsWithEmbeddings({
    resumeText: "Node.js",
    jobDescription: "React",
    generateEmbeddings,
    similarityThreshold: 0.5,
  });

  assert.deepEqual(result.matchedSkills, []);
  assert.deepEqual(result.missingSkills, ["React"]);
});
