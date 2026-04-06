import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiResult } from "@/lib/types";

const PROMPT = `You are analyzing a photo of a person's face. Your job is to pick exactly 2 famous/recognizable people that this person looks like a mashup of.

Rules:
- Pick exactly 2 celebrities, public figures, or historical figures
- They can be from any era or category: actors, musicians, athletes, politicians, influencers, YouTubers, historical figures, etc.
- Prioritize widely recognizable figures who are likely to have a Wikipedia page
- Be creative and specific in your explanation of why the person looks like a mix

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "celebrities": [
    { "name": "Full Name", "description": "Brief role/identity (under 10 words)" },
    { "name": "Full Name", "description": "Brief role/identity (under 10 words)" }
  ],
  "explanation": "2-3 sentences explaining why this person looks like a mashup of these two celebrities. Be fun, specific, and reference actual facial features."
}`;

export function parseGeminiResponse(raw: string): GeminiResult {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${raw.slice(0, 100)}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.celebrities) || obj.celebrities.length !== 2) {
    throw new Error("Gemini response must contain exactly 2 celebrities");
  }

  if (typeof obj.explanation !== "string" || !obj.explanation) {
    throw new Error("Gemini response must contain an explanation");
  }

  for (const celeb of obj.celebrities) {
    if (typeof celeb.name !== "string" || typeof celeb.description !== "string") {
      throw new Error("Each celebrity must have name and description strings");
    }
  }

  return obj as unknown as GeminiResult;
}

export async function analyzeWithGemini(
  base64Image: string,
  mimeType: string,
): Promise<GeminiResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imagePart = {
    inlineData: { data: base64Image, mimeType },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await model.generateContent([PROMPT, imagePart]);
    const text = result.response.text();

    try {
      return parseGeminiResponse(text);
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }

  throw new Error("Unreachable");
}
