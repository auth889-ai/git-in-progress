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

async function reviewDiff(diffText, commitMessage) {
  if (process.env.ANTHROPIC_API_KEY) {
    return reviewWithClaude(diffText, commitMessage);
  }
  if (process.env.GEMINI_API_KEY) {
    return reviewWithGemini(diffText, commitMessage);
  }
  throw new Error(
    "No AI provider configured. Add ANTHROPIC_API_KEY (preferred) or GEMINI_API_KEY to .env."
  );
}

module.exports = { reviewDiff };
