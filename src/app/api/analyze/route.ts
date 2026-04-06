import { NextRequest, NextResponse } from "next/server";
import { validateImage } from "@/lib/image-validation";
import { RateLimiter } from "@/lib/rate-limiter";
import { analyzeWithGemini } from "@/lib/gemini";
import { fetchCelebrityImage } from "@/lib/wikimedia";
import type { AnalyzeResponse, AnalyzeError } from "@/lib/types";

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB — generous limit for base64 + JSON overhead
const rateLimiter = new RateLimiter(2);

setInterval(() => rateLimiter.cleanup(), 60 * 60 * 1000);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeResponse | AnalyzeError>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request too large (max 4MB)" },
      { status: 413 },
    );
  }

  const ip = getClientIp(request);

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateImage(body.image ?? "");
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error! }, { status: 400 });
  }

  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Come back tomorrow!", remaining: 0 },
      { status: 429 },
    );
  }

  try {
    const geminiResult = await analyzeWithGemini(
      validation.rawBase64!,
      validation.mimeType!,
    );

    const [img1, img2] = await Promise.all([
      fetchCelebrityImage(geminiResult.celebrities[0].name),
      fetchCelebrityImage(geminiResult.celebrities[1].name),
    ]);

    const response: AnalyzeResponse = {
      celebrities: [
        { ...geminiResult.celebrities[0], imageUrl: img1 },
        { ...geminiResult.celebrities[1], imageUrl: img2 },
      ],
      explanation: geminiResult.explanation,
      remaining: rateCheck.remaining,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[analyze] Error:", err);
    rateLimiter.refund(ip);

    const message = err instanceof Error ? err.message : "";
    const isQuotaError = message.includes("429") || message.includes("quota");
    const isNetworkError =
      err instanceof TypeError || message.includes("fetch");

    if (isQuotaError) {
      return NextResponse.json(
        { error: "AI service is temporarily busy. Please wait a minute and try again." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Couldn't analyze your photo. Please try again." },
      { status: isNetworkError ? 502 : 500 },
    );
  }
}
