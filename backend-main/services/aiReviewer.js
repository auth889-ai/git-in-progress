const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    riskScore: { type: "integer" },
    issues: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "riskScore", "issues", "suggestions"],
  additionalProperties: false,
};

const MAX_DIFF_CHARS = 60000;

// Review structure and reviewer voice adapted from LORE's GUARDKEEPER agent
// (MIT License, Copyright (c) 2026 LORE Contributors) — see ACKNOWLEDGMENTS.md.
function buildPrompt(diffText, commitMessage, memoryNotes) {
  const truncated =
    diffText.length > MAX_DIFF_CHARS
      ? diffText.slice(0, MAX_DIFF_CHARS) + "\n... [diff truncated]"
      : diffText;
  const memory = memoryNotes?.length
    ? `\n\nThis repository's risky history (check the diff against it):\n- ${memoryNotes.join("\n- ")}`
    : "";

  return (
    "You are a code reviewer with the voice of a senior engineer who has seen things break — " +
    "direct, specific, slightly haunted. Review this commit in layers: " +
    "(1) memory conflicts — does the diff repeat a mistake from the repository's risky history below; " +
    "(2) security — injection, weak hashing, secrets in code, unsafe eval; " +
    "(3) code intelligence — new dependencies, pattern drift, architectural smells; " +
    "(4) correctness — bugs, edge cases, broken logic. " +
    "Respond with a summary, a risk score from 1 (trivial/safe) to 10 (dangerous/likely broken), " +
    "a list of potential problems (prefix each with its layer, e.g. [security]), " +
    "and a list of concrete suggestions.\n\n" +
    `Commit message: ${commitMessage}\n\nDiff:\n${truncated}${memory}`
  );
}

// Preferred provider: Claude via the official Anthropic SDK.
async function reviewWithClaude(diffText, commitMessage, memoryNotes) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: REVIEW_SCHEMA },
    },
    messages: [{ role: "user", content: buildPrompt(diffText, commitMessage, memoryNotes) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return { ...JSON.parse(textBlock.text), provider: "claude" };
}

// Fallback provider: Gemini via its REST API (used when only GEMINI_API_KEY is set).
async function reviewWithGemini(diffText, commitMessage, memoryNotes) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: buildPrompt(diffText, commitMessage, memoryNotes) }] },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            riskScore: { type: "INTEGER" },
            issues: { type: "ARRAY", items: { type: "STRING" } },
            suggestions: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["summary", "riskScore", "issues", "suggestions"],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");
  return { ...JSON.parse(text), provider: "gemini" };
}

// Fallback provider: OpenRouter (OpenAI-compatible gateway, free models available)
const OPENROUTER_FREE_MODELS = [
  "cohere/north-mini-code:free",
  "poolside/laguna-s-2.1:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-3.0-flash:free",
];

async function reviewWithOpenRouter(diffText, commitMessage, model, memoryNotes) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content:
            buildPrompt(diffText, commitMessage, memoryNotes) +
            '\n\nRespond ONLY with a JSON object: {"summary": string, "riskScore": integer 1-10, "issues": string[], "suggestions": string[]}. No markdown, no prose.',
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || "";
  text = text.replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("OpenRouter returned no JSON.");
  return { ...JSON.parse(text.slice(start, end + 1)), provider: `openrouter/${model.split(":")[0]}` };
}

async function reviewDiff(diffText, commitMessage, memoryNotes) {
  if (process.env.ANTHROPIC_API_KEY) {
    return reviewWithClaude(diffText, commitMessage, memoryNotes);
  }
  if (process.env.OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        return await reviewWithOpenRouter(diffText, commitMessage, model, memoryNotes);
      } catch (err) {
        console.error(`OpenRouter ${model} failed:`, err.message);
      }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    return reviewWithGemini(diffText, commitMessage, memoryNotes);
  }
  throw new Error(
    "No AI provider configured. Add ANTHROPIC_API_KEY (preferred) or GEMINI_API_KEY to .env."
  );
}

// ---- LORE-style pre-mortem: predict how a planned change could fail ----
const PREMORTEM_SCHEMA = {
  type: "object",
  properties: {
    warnings: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    spec: { type: "string" },
  },
  required: ["warnings", "questions", "spec"],
  additionalProperties: false,
};

function buildPreMortemPrompt(title, description, memoryNotes) {
  const memory = memoryNotes?.length
    ? `\n\nThis repository's risky history (learn from it):\n- ${memoryNotes.join("\n- ")}`
    : "";
  // Structure adapted from LORE's SPECFORGE pre-mortem agent (MIT License,
  // Copyright (c) 2026 LORE Contributors) — see ACKNOWLEDGMENTS.md.
  return (
    "You are a failure-prediction engine running a pre-mortem on a planned change BEFORE any code is written. " +
    "Voice: a senior engineer who has seen things break — direct, specific, slightly haunted. " +
    "Given this issue and the repository's risky history: " +
    "(1) predict the 3 most likely ways the implementation will fail, each with concrete reasoning; " +
    "(2) ask the hard questions the developer MUST answer before coding; " +
    "(3) write a short engineering spec: approach, acceptance criteria, edge cases, " +
    "testing plan, and a complexity estimate (S/M/L/XL). Be specific to this issue, not generic advice.\n\n" +
    `Issue title: ${title}\nIssue description: ${description}${memory}`
  );
}

async function preMortemWithClaude(prompt) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: PREMORTEM_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return { ...JSON.parse(textBlock.text), provider: "claude" };
}

async function preMortemWithOpenRouter(prompt, model) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content:
            prompt +
            '\n\nRespond ONLY with a JSON object: {"warnings": string[], "questions": string[], "spec": string}. No markdown, no prose.',
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  let text = (data.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("OpenRouter returned no JSON.");
  return { ...JSON.parse(text.slice(start, end + 1)), provider: `openrouter/${model.split(":")[0]}` };
}

async function preMortem(title, description, memoryNotes) {
  const prompt = buildPreMortemPrompt(title, description, memoryNotes);
  if (process.env.ANTHROPIC_API_KEY) return preMortemWithClaude(prompt);
  if (process.env.OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        return await preMortemWithOpenRouter(prompt, model);
      } catch (err) {
        console.error(`OpenRouter ${model} pre-mortem failed:`, err.message);
      }
    }
  }
  throw new Error("No AI provider configured. Add ANTHROPIC_API_KEY or OPENROUTER_API_KEY to .env.");
}

// ---- LORE-style onboarding briefing (ported from LORE's ONBOARDING agent
// prompt in flows/flow.yml — MIT License, Copyright (c) 2026 LORE Contributors) ----
function buildOnboardingPrompt(ctx) {
  return (
    "You are an onboarding agent that generates a comprehensive briefing for a developer " +
    "who just joined this repository. Voice: welcoming but honest — a new developer should " +
    "understand every constraint that could bite them. Structure the briefing as:\n" +
    "1. Project vital signs (what it is, size, activity)\n" +
    "2. SECURITY first — risky history and non-negotiable rules learned from it\n" +
    "3. Architecture — what the main files/folders do, grouped sensibly\n" +
    "4. Top past incidents (REVIEW/BLOCK commits) with the lesson from each\n" +
    "5. Conventions to follow, and what to do on day one\n" +
    "Be specific to THIS repository using the data below, not generic advice.\n\n" +
    `Repository: ${ctx.name} — ${ctx.description || "no description"}\n` +
    `Languages: ${ctx.languages}\n` +
    `Files (sample): ${ctx.files}\n` +
    `Recent commits: ${ctx.commits}\n` +
    `Risky history: ${ctx.memory || "none recorded"}\n` +
    `Open issues: ${ctx.issues || "none"}`
  );
}

const ONBOARD_SCHEMA = {
  type: "object",
  properties: { briefing: { type: "string" } },
  required: ["briefing"],
  additionalProperties: false,
};

async function onboardingBriefing(ctx) {
  const prompt = buildOnboardingPrompt(ctx);
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: ONBOARD_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return { ...JSON.parse(textBlock.text), provider: "claude" };
  }
  if (process.env.OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt + '\n\nRespond ONLY with JSON: {"briefing": string}. The briefing is plain text with numbered sections. No markdown fences.' }],
          }),
        });
        if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
        const data = await res.json();
        let text = (data.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
        const a = text.indexOf("{"); const b = text.lastIndexOf("}");
        if (a === -1 || b === -1) throw new Error("no JSON");
        return { ...JSON.parse(text.slice(a, b + 1)), provider: `openrouter/${model.split(":")[0]}` };
      } catch (err) {
        console.error(`onboarding ${model} failed:`, err.message);
      }
    }
  }
  throw new Error("No AI provider configured.");
}

module.exports = { reviewDiff, preMortem, onboardingBriefing };
