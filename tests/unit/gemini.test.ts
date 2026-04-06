import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeWithGemini, parseGeminiResponse } from "@/lib/gemini";
import type { GeminiResult } from "@/lib/types";

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    };
  }),
}));

const VALID_RESPONSE: GeminiResult = {
  celebrities: [
    { name: "Frida Kahlo", description: "Mexican painter and cultural icon" },
    { name: "MrBeast", description: "YouTuber and philanthropist" },
  ],
  explanation: "You've got Frida's bold brows combined with MrBeast's wide smile.",
};

describe("parseGeminiResponse", () => {
  it("parses valid JSON response", () => {
    // #given
    const raw = JSON.stringify(VALID_RESPONSE);
    // #when
    const result = parseGeminiResponse(raw);
    // #then
    expect(result).toEqual(VALID_RESPONSE);
  });

  it("extracts JSON from markdown code block", () => {
    // #given
    const raw = "```json\n" + JSON.stringify(VALID_RESPONSE) + "\n```";
    // #when
    const result = parseGeminiResponse(raw);
    // #then
    expect(result).toEqual(VALID_RESPONSE);
  });

  it("throws on response with wrong number of celebrities", () => {
    // #given
    const raw = JSON.stringify({
      celebrities: [{ name: "Frida Kahlo", description: "Painter" }],
      explanation: "Only one match.",
    });
    // #when / #then
    expect(() => parseGeminiResponse(raw)).toThrow("exactly 2");
  });

  it("throws on missing explanation", () => {
    // #given
    const raw = JSON.stringify({
      celebrities: [
        { name: "A", description: "A" },
        { name: "B", description: "B" },
      ],
    });
    // #when / #then
    expect(() => parseGeminiResponse(raw)).toThrow("explanation");
  });

  it("throws on unparseable text", () => {
    // #given
    const raw = "Sorry, I can't analyze this image.";
    // #when / #then
    expect(() => parseGeminiResponse(raw)).toThrow();
  });
});

describe("analyzeWithGemini", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns parsed result on valid response", async () => {
    // #given
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(VALID_RESPONSE) },
    });
    // #when
    const result = await analyzeWithGemini("base64data", "image/jpeg");
    // #then
    expect(result).toEqual(VALID_RESPONSE);
  });

  it("retries once on malformed response then throws", async () => {
    // #given
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => "garbage" } })
      .mockResolvedValueOnce({ response: { text: () => "still garbage" } });
    // #when / #then
    await expect(analyzeWithGemini("base64data", "image/jpeg")).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("retries once on malformed response and succeeds on retry", async () => {
    // #given
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => "garbage" } })
      .mockResolvedValueOnce({
        response: { text: () => JSON.stringify(VALID_RESPONSE) },
      });
    // #when
    const result = await analyzeWithGemini("base64data", "image/jpeg");
    // #then
    expect(result).toEqual(VALID_RESPONSE);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
