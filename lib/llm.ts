import "./load-env.js";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type LlmProvider = "gemini" | "openai" | "anthropic";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("Geen geldige JSON in LLM-antwoord");
}

function geminiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

function resolveProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (
    explicit === "gemini" ||
    explicit === "openai" ||
    explicit === "anthropic"
  ) {
    return explicit;
  }
  if (geminiKey()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  throw new Error("Geen LLM_PROVIDER of API-key geconfigureerd");
}

async function askGeminiJson(prompt: string): Promise<unknown> {
  const apiKey = geminiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ontbreekt");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) {
    throw new Error("Leeg antwoord van Gemini");
  }

  return extractJson(text);
}

async function askOpenAiJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ontbreekt");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Je antwoordt altijd met één geldig JSON-object, zonder markdown of uitleg eromheen.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Leeg antwoord van OpenAI");
  }

  return extractJson(text);
}

async function askAnthropicJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt");
  }

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    apiKey,
    defaultHeaders: workspaceId
      ? { "anthropic-workspace-id": workspaceId }
      : undefined,
  });
  const model = process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;

  const message = await client.messages.create({
    model,
    max_tokens: 1200,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  if (!text) {
    throw new Error("Leeg antwoord van Claude");
  }

  return extractJson(text);
}

export async function askLlmJson(prompt: string): Promise<unknown> {
  const provider = resolveProvider();
  if (provider === "gemini") {
    return askGeminiJson(prompt);
  }
  if (provider === "openai") {
    return askOpenAiJson(prompt);
  }
  return askAnthropicJson(prompt);
}
