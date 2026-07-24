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

function buildPrompt(diffText, commitMessage) {
  const truncated =
    diffText.length > MAX_DIFF_CHARS
      ? diffText.slice(0, MAX_DIFF_CHARS) + "\n... [diff truncated]"
      : diffText;

  return (
    "You are an automated code reviewer for a GitHub-style platform. " +
    "Review this commit and respond with a summary of the changes, a risk score " +
    "from 1 (trivial/safe) to 10 (dangerous/likely broken), a list of potential " +
    "bugs or problems, and a list of concrete suggestions.\n\n" +
    `Commit message: ${commitMessage}\n\nDiff:\n${truncated}`
  );
}

// Preferred provider: Claude via the official Anthropic SDK.
async function reviewWithClaude(diffText, commitMessage) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: REVIEW_SCHEMA },
    },
    messages: [{ role: "user", content: buildPrompt(diffText, commitMessage) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return { ...JSON.parse(textBlock.text), provider: "claude" };
}

// Fallback provider: Gemini via its REST API (used when only GEMINI_API_KEY is set).
async function reviewWithGemini(diffText, commitMessage) {
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
        { parts: [{ text: buildPrompt(diffText, commitMessage) }] },
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

async function reviewWithOpenRouter(diffText, commitMessage, model) {
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
            buildPrompt(diffText, commitMessage) +
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

async function reviewDiff(diffText, commitMessage) {
  if (process.env.ANTHROPIC_API_KEY) {
    return reviewWithClaude(diffText, commitMessage);
  }
  if (process.env.OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        return await reviewWithOpenRouter(diffText, commitMessage, model);
      } catch (err) {
        console.error(`OpenRouter ${model} failed:`, err.message);
      }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    return reviewWithGemini(diffText, commitMessage);
  }
  throw new Error(
    "No AI provider configured. Add ANTHROPIC_API_KEY (preferred) or GEMINI_API_KEY to .env."
  );
}

module.exports = { reviewDiff };
