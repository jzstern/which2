import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { GeminiResult } from "@/lib/types";

const { mockAnalyzeWithGemini, mockFetchCelebrityImage, mockRateLimiterCheck } = vi.hoisted(
  () => ({
    mockAnalyzeWithGemini: vi.fn(),
    mockFetchCelebrityImage: vi.fn(),
    mockRateLimiterCheck: vi.fn(),
  }),
);

vi.mock("@/lib/gemini", () => ({
  analyzeWithGemini: mockAnalyzeWithGemini,
}));

vi.mock("@/lib/wikimedia", () => ({
  fetchCelebrityImage: mockFetchCelebrityImage,
}));

vi.mock("@/lib/rate-limiter", () => ({
  RateLimiter: vi.fn(function () {
    return { check: mockRateLimiterCheck };
  }),
}));

import { POST } from "@/app/api/analyze/route";

const VALID_BASE64_JPEG = "/9j/validjpegdata";

const GEMINI_RESULT: GeminiResult = {
  celebrities: [
    { name: "Frida Kahlo", description: "Mexican painter and cultural icon" },
    { name: "MrBeast", description: "YouTuber and philanthropist" },
  ],
  explanation: "You've got Frida's bold brows combined with MrBeast's wide smile.",
};

function makeRequest(body: unknown, ip = "127.0.0.1"): NextRequest {
  return new NextRequest("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    mockAnalyzeWithGemini.mockReset();
    mockFetchCelebrityImage.mockReset();
    mockRateLimiterCheck.mockReset();
  });

  it("returns 200 with celebrity data on success", async () => {
    // #given
    mockRateLimiterCheck.mockReturnValue({ allowed: true, remaining: 1 });
    mockAnalyzeWithGemini.mockResolvedValue(GEMINI_RESULT);
    mockFetchCelebrityImage
      .mockResolvedValueOnce("https://example.com/frida.jpg")
      .mockResolvedValueOnce("https://example.com/mrbeast.jpg");

    // #when
    const response = await POST(makeRequest({ image: VALID_BASE64_JPEG }));
    const body = await response.json();

    // #then
    expect(response.status).toBe(200);
    expect(body.celebrities).toHaveLength(2);
    expect(body.celebrities[0].name).toBe("Frida Kahlo");
    expect(body.celebrities[0].imageUrl).toBe("https://example.com/frida.jpg");
    expect(body.celebrities[1].name).toBe("MrBeast");
    expect(body.celebrities[1].imageUrl).toBe("https://example.com/mrbeast.jpg");
    expect(body.explanation).toBe(GEMINI_RESULT.explanation);
    expect(body.remaining).toBe(1);
  });

  it("returns 429 when rate limited", async () => {
    // #given
    mockRateLimiterCheck.mockReturnValue({ allowed: false, remaining: 0 });

    // #when
    const response = await POST(makeRequest({ image: VALID_BASE64_JPEG }));
    const body = await response.json();

    // #then
    expect(response.status).toBe(429);
    expect(body.error).toContain("Rate limit");
    expect(body.remaining).toBe(0);
  });

  it("returns 400 for empty image", async () => {
    // #given
    const request = makeRequest({ image: "" });

    // #when
    const response = await POST(request);
    const body = await response.json();

    // #then
    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("returns 400 for unsupported image format", async () => {
    // #given
    const request = makeRequest({ image: "invalidbase64notavalidimage" });

    // #when
    const response = await POST(request);
    const body = await response.json();

    // #then
    expect(response.status).toBe(400);
    expect(body.error).toContain("Unsupported image format");
  });

  it("returns 500 when Gemini fails", async () => {
    // #given
    mockRateLimiterCheck.mockReturnValue({ allowed: true, remaining: 1 });
    mockAnalyzeWithGemini.mockRejectedValue(new Error("Gemini service unavailable"));

    // #when
    const response = await POST(makeRequest({ image: VALID_BASE64_JPEG }));
    const body = await response.json();

    // #then
    expect(response.status).toBe(500);
    expect(body.error).toContain("analyze");
  });
});
