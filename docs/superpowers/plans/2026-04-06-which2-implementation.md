# which2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a viral web tool where users upload a photo and discover which 2 famous faces they're a mashup of.

**Architecture:** Single Next.js App Router app with a POST /api/analyze endpoint that sends a base64 image to Gemini 2.0 Flash, fetches celebrity photos from Wikimedia Commons, and returns results. In-memory rate limiting at 2 requests/day per IP. No database, no auth, no file storage.

**Tech Stack:** Next.js (App Router), TypeScript, Bun, Tailwind CSS, Gemini 2.0 Flash, Wikimedia Commons API, Vitest, Playwright, Sentry

**Spec:** `docs/superpowers/specs/2026-04-06-which2-design.md`

---

## File Structure

```
which2/
├── src/
│   ├── app/
│   │   ├── layout.tsx              — Root layout with metadata, fonts, Sentry
│   │   ├── page.tsx                — Main page orchestrating upload → loading → results flow
│   │   ├── globals.css             — Tailwind directives + custom styles
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts        — POST handler: validate → rate limit → Gemini → Wikimedia → respond
│   ├── components/
│   │   ├── upload-zone.tsx         — Drag/drop + tap-to-upload with client-side resize
│   │   ├── loading-state.tsx       — Animated loading with rotating messages
│   │   ├── results-card.tsx        — Three-photo layout with explanation
│   │   └── rate-limit-banner.tsx   — "Come back tomorrow" message
│   └── lib/
│       ├── types.ts                — Shared TypeScript types (AnalyzeResponse, Celebrity, etc.)
│       ├── gemini.ts               — Gemini API client + prompt construction + response parsing
│       ├── wikimedia.ts            — Wikimedia Commons image search with silhouette fallback
│       ├── rate-limiter.ts         — In-memory IP-based rate limiter (2/day, TTL cleanup)
│       └── image-validation.ts     — Server-side base64 image validation (type, size, integrity)
├── tests/
│   ├── unit/
│   │   ├── gemini.test.ts
│   │   ├── rate-limiter.test.ts
│   │   └── image-validation.test.ts
│   ├── integration/
│   │   └── analyze-route.test.ts
│   └── e2e/
│       └── upload-flow.spec.ts
├── public/
│   └── placeholder-silhouette.svg
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── vitest.config.ts
├── playwright.config.ts
├── sentry.client.config.ts
├── sentry.server.config.ts
└── .env.example
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`, `.env.example`, `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: Initialize Next.js project with Bun**

```bash
cd /Users/jzs/GIT/which2/.claude/worktrees/soft-inventing-map
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun
```

Accept defaults. This creates the base Next.js project with App Router, TypeScript, Tailwind, and Bun.

- [ ] **Step 2: Install dependencies**

```bash
bun add @google/generative-ai @sentry/nextjs
bun add -d vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Create .env.example**

```
GEMINI_API_KEY=your-gemini-api-key-here
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

- [ ] **Step 5: Add test scripts to package.json**

Add to the `"scripts"` section:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 6: Verify setup compiles**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Verify .gitignore exists and covers node_modules, .env*, .next**

```bash
cat .gitignore | head -20
```

- [ ] **Step 8: Commit scaffolding**

```bash
git add package.json bun.lock tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs vitest.config.ts .env.example .gitignore .eslintrc.json src/ public/
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface Celebrity {
  name: string;
  description: string;
  imageUrl: string;
}

export interface AnalyzeResponse {
  celebrities: [Celebrity, Celebrity];
  explanation: string;
  remaining: number;
}

export interface AnalyzeError {
  error: string;
  remaining?: number;
}

export interface GeminiResult {
  celebrities: [
    { name: string; description: string },
    { name: string; description: string },
  ];
  explanation: string;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit src/lib/types.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Rate Limiter (TDD)

**Files:**
- Create: `src/lib/rate-limiter.ts`
- Test: `tests/unit/rate-limiter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00Z"));
    limiter = new RateLimiter(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    // #given
    const ip = "192.168.1.1";

    // #when
    const result = limiter.check(ip);

    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("allows exactly the limit number of requests", () => {
    // #given
    const ip = "192.168.1.1";

    // #when
    limiter.check(ip);
    const result = limiter.check(ip);

    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    // #given
    const ip = "192.168.1.1";

    // #when
    limiter.check(ip);
    limiter.check(ip);
    const result = limiter.check(ip);

    // #then
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    // #given
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    // #when
    limiter.check(ip1);
    limiter.check(ip1);
    const result1 = limiter.check(ip1);
    const result2 = limiter.check(ip2);

    // #then
    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  it("resets at UTC midnight", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);
    limiter.check(ip);

    // #when — advance to next UTC day
    vi.setSystemTime(new Date("2026-04-07T00:00:01Z"));
    const result = limiter.check(ip);

    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("returns remaining count without consuming a request via peek", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);

    // #when
    const remaining = limiter.remaining(ip);

    // #then
    expect(remaining).toBe(1);
  });

  it("cleans up stale entries", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);

    // #when — advance 2 days and trigger cleanup
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
    limiter.cleanup();

    // #then — internal map should be empty (we verify via remaining returning full limit)
    expect(limiter.remaining(ip)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/unit/rate-limiter.test.ts
```

Expected: FAIL — module `@/lib/rate-limiter` not found.

- [ ] **Step 3: Implement rate limiter**

```typescript
interface RateLimitEntry {
  count: number;
  dateKey: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  check(ip: string): RateLimitResult {
    const today = todayKey();
    const entry = this.store.get(ip);

    if (!entry || entry.dateKey !== today) {
      this.store.set(ip, { count: 1, dateKey: today });
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.limit - entry.count };
  }

  remaining(ip: string): number {
    const today = todayKey();
    const entry = this.store.get(ip);
    if (!entry || entry.dateKey !== today) return this.limit;
    return Math.max(0, this.limit - entry.count);
  }

  cleanup(): void {
    const today = todayKey();
    for (const [ip, entry] of this.store) {
      if (entry.dateKey !== today) {
        this.store.delete(ip);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/unit/rate-limiter.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limiter.ts tests/unit/rate-limiter.test.ts
git commit -m "feat: add in-memory rate limiter with TDD"
```

---

## Task 4: Image Validation (TDD)

**Files:**
- Create: `src/lib/image-validation.ts`
- Test: `tests/unit/image-validation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { validateImage } from "@/lib/image-validation";

describe("validateImage", () => {
  it("accepts a valid JPEG base64 string", () => {
    // #given — minimal valid JPEG header in base64
    const base64 = "/9j/4AAQSkZJRgABAQ==";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(true);
  });

  it("accepts a valid PNG base64 string", () => {
    // #given — PNG magic bytes in base64
    const base64 = "iVBORw0KGgo=";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(true);
  });

  it("accepts a valid WebP base64 string", () => {
    // #given — RIFF....WEBP header in base64
    const base64 = "UklGRiYAAABXRUJQ";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(true);
  });

  it("rejects an unrecognized image format", () => {
    // #given
    const base64 = "SGVsbG8gV29ybGQ=";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported image format");
  });

  it("rejects base64 that exceeds 2MB", () => {
    // #given — 2MB = ~2,796,203 base64 chars (3MB raw rounds up)
    const base64 = "/9j/4AAQSkZJRgABAQ==" + "A".repeat(2_800_000);

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("rejects empty input", () => {
    // #given
    const base64 = "";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No image");
  });

  it("strips data URI prefix before validating", () => {
    // #given
    const base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

    // #when
    const result = validateImage(base64);

    // #then
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/unit/image-validation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement image validation**

```typescript
const MAX_BASE64_LENGTH = 2_796_203; // ~2MB decoded

const MAGIC_BYTES: Record<string, string> = {
  "/9j/": "image/jpeg",
  iVBORw0KGgo: "image/png",
  UklGR: "image/webp",
};

interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  rawBase64?: string;
}

export function validateImage(input: string): ValidationResult {
  if (!input) {
    return { valid: false, error: "No image provided" };
  }

  const base64 = input.replace(/^data:image\/\w+;base64,/, "");

  if (base64.length > MAX_BASE64_LENGTH) {
    return { valid: false, error: "Image too large (max 2MB)" };
  }

  for (const [prefix, mime] of Object.entries(MAGIC_BYTES)) {
    if (base64.startsWith(prefix)) {
      return { valid: true, mimeType: mime, rawBase64: base64 };
    }
  }

  return { valid: false, error: "Unsupported image format. Use JPEG, PNG, or WebP" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/unit/image-validation.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-validation.ts tests/unit/image-validation.test.ts
git commit -m "feat: add image validation with TDD"
```

---

## Task 5: Gemini Client (TDD)

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `tests/unit/gemini.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeWithGemini, parseGeminiResponse } from "@/lib/gemini";
import type { GeminiResult } from "@/lib/types";

vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    __mockGenerateContent: mockGenerateContent,
  };
});

function getMockGenerateContent() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@google/generative-ai").__mockGenerateContent;
}

const VALID_RESPONSE: GeminiResult = {
  celebrities: [
    { name: "Frida Kahlo", description: "Mexican painter and cultural icon" },
    { name: "MrBeast", description: "YouTuber and philanthropist" },
  ],
  explanation:
    "You've got Frida's bold brows combined with MrBeast's wide smile.",
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
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns parsed result on valid response", async () => {
    // #given
    const mock = getMockGenerateContent();
    mock.mockResolvedValue({
      response: { text: () => JSON.stringify(VALID_RESPONSE) },
    });

    // #when
    const result = await analyzeWithGemini("base64data", "image/jpeg");

    // #then
    expect(result).toEqual(VALID_RESPONSE);
  });

  it("retries once on malformed response then throws", async () => {
    // #given
    const mock = getMockGenerateContent();
    mock
      .mockResolvedValueOnce({ response: { text: () => "garbage" } })
      .mockResolvedValueOnce({ response: { text: () => "still garbage" } });

    // #when / #then
    await expect(analyzeWithGemini("base64data", "image/jpeg")).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("retries once on malformed response and succeeds on retry", async () => {
    // #given
    const mock = getMockGenerateContent();
    mock
      .mockResolvedValueOnce({ response: { text: () => "garbage" } })
      .mockResolvedValueOnce({
        response: { text: () => JSON.stringify(VALID_RESPONSE) },
      });

    // #when
    const result = await analyzeWithGemini("base64data", "image/jpeg");

    // #then
    expect(result).toEqual(VALID_RESPONSE);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/unit/gemini.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Gemini client**

```typescript
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
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/unit/gemini.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts tests/unit/gemini.test.ts
git commit -m "feat: add Gemini client with prompt and response parsing"
```

---

## Task 6: Wikimedia Client (TDD)

**Files:**
- Create: `src/lib/wikimedia.ts`
- Test: `tests/unit/wikimedia.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCelebrityImage } from "@/lib/wikimedia";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("fetchCelebrityImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns thumbnail URL on successful lookup", async () => {
    // #given
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        thumbnail: { source: "https://upload.wikimedia.org/photo.jpg" },
      }),
    });

    // #when
    const result = await fetchCelebrityImage("Frida Kahlo");

    // #then
    expect(result).toBe("https://upload.wikimedia.org/photo.jpg");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://en.wikipedia.org/api/rest_v1/page/summary/Frida_Kahlo",
    );
  });

  it("returns placeholder on 404", async () => {
    // #given
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    // #when
    const result = await fetchCelebrityImage("Unknown Person");

    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });

  it("returns placeholder when thumbnail is missing", async () => {
    // #given
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Some Page" }),
    });

    // #when
    const result = await fetchCelebrityImage("Some Person");

    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });

  it("returns placeholder on network error", async () => {
    // #given
    mockFetch.mockRejectedValue(new Error("Network error"));

    // #when
    const result = await fetchCelebrityImage("Anyone");

    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/unit/wikimedia.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Wikimedia image fetcher**

```typescript
const PLACEHOLDER_URL = "/placeholder-silhouette.svg";

export async function fetchCelebrityImage(name: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(name.replace(/ /g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const response = await fetch(url);

    if (!response.ok) return PLACEHOLDER_URL;

    const data = await response.json();
    return data.thumbnail?.source ?? PLACEHOLDER_URL;
  } catch {
    return PLACEHOLDER_URL;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/unit/wikimedia.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikimedia.ts tests/unit/wikimedia.test.ts
git commit -m "feat: add Wikimedia celebrity image fetcher with TDD"
```

---

## Task 7: Placeholder Silhouette SVG

**Files:**
- Create: `public/placeholder-silhouette.svg`

- [ ] **Step 1: Create SVG**

Create a simple person silhouette placeholder SVG (dark gray silhouette on transparent background, 200x200 viewBox).

- [ ] **Step 2: Commit**

```bash
git add public/placeholder-silhouette.svg
git commit -m "feat: add placeholder silhouette SVG"
```

---

## Task 8: API Route

**Files:**
- Create: `src/app/api/analyze/route.ts`

**Depends on:** Tasks 2-6

- [ ] **Step 1: Implement the POST handler**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateImage } from "@/lib/image-validation";
import { RateLimiter } from "@/lib/rate-limiter";
import { analyzeWithGemini } from "@/lib/gemini";
import { fetchCelebrityImage } from "@/lib/wikimedia";
import type { AnalyzeResponse, AnalyzeError } from "@/lib/types";

const rateLimiter = new RateLimiter(2);

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
  const ip = getClientIp(request);

  // Validate request before consuming a rate limit slot
  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateImage(body.image ?? "");
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error! },
      { status: 400 },
    );
  }

  // Only consume rate limit after validation passes
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
    const isNetworkError =
      err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"));
    return NextResponse.json(
      { error: "Couldn't analyze your photo. Please try again." },
      { status: isNetworkError ? 502 : 500 },
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: add POST /api/analyze route"
```

---

## Task 9: Integration Tests for API Route

**Files:**
- Create: `tests/integration/analyze-route.test.ts`

**Depends on:** Task 8

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";
import type { GeminiResult } from "@/lib/types";

vi.mock("@/lib/gemini", () => ({
  analyzeWithGemini: vi.fn(),
}));

vi.mock("@/lib/wikimedia", () => ({
  fetchCelebrityImage: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => {
  const check = vi.fn();
  const remaining = vi.fn();
  const cleanup = vi.fn();
  return {
    RateLimiter: vi.fn().mockImplementation(() => ({ check, remaining, cleanup })),
    __mockCheck: check,
  };
});

function getMocks() {
  const { analyzeWithGemini } = require("@/lib/gemini");
  const { fetchCelebrityImage } = require("@/lib/wikimedia");
  const { __mockCheck } = require("@/lib/rate-limiter");
  return {
    analyzeWithGemini: analyzeWithGemini as ReturnType<typeof vi.fn>,
    fetchCelebrityImage: fetchCelebrityImage as ReturnType<typeof vi.fn>,
    rateLimitCheck: __mockCheck as ReturnType<typeof vi.fn>,
  };
}

const VALID_GEMINI_RESULT: GeminiResult = {
  celebrities: [
    { name: "Frida Kahlo", description: "Mexican painter" },
    { name: "MrBeast", description: "YouTuber" },
  ],
  explanation: "Bold brows and wide smile.",
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
    vi.clearAllMocks();
  });

  it("returns 200 with celebrity data on success", async () => {
    // #given
    const mocks = getMocks();
    mocks.rateLimitCheck.mockReturnValue({ allowed: true, remaining: 1 });
    mocks.analyzeWithGemini.mockResolvedValue(VALID_GEMINI_RESULT);
    mocks.fetchCelebrityImage.mockResolvedValue("https://example.com/photo.jpg");

    // #when
    const res = await POST(makeRequest({ image: "/9j/4AAQSkZJRgABAQ==" }));
    const json = await res.json();

    // #then
    expect(res.status).toBe(200);
    expect(json.celebrities).toHaveLength(2);
    expect(json.celebrities[0].name).toBe("Frida Kahlo");
    expect(json.explanation).toBe("Bold brows and wide smile.");
  });

  it("returns 429 when rate limited", async () => {
    // #given
    const mocks = getMocks();
    mocks.rateLimitCheck.mockReturnValue({ allowed: false, remaining: 0 });

    // #when
    const res = await POST(makeRequest({ image: "/9j/4AAQSkZJRgABAQ==" }));

    // #then
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid image", async () => {
    // #given
    const mocks = getMocks();
    mocks.rateLimitCheck.mockReturnValue({ allowed: true, remaining: 1 });

    // #when
    const res = await POST(makeRequest({ image: "" }));

    // #then
    expect(res.status).toBe(400);
  });

  it("returns 500 when Gemini fails", async () => {
    // #given
    const mocks = getMocks();
    mocks.rateLimitCheck.mockReturnValue({ allowed: true, remaining: 1 });
    mocks.analyzeWithGemini.mockRejectedValue(new Error("Gemini down"));

    // #when
    const res = await POST(makeRequest({ image: "/9j/4AAQSkZJRgABAQ==" }));

    // #then
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
bun run test -- tests/integration/analyze-route.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/analyze-route.test.ts
git commit -m "test: add integration tests for analyze route"
```

---

## Task 10: UI Components

**Files:**
- Create: `src/components/upload-zone.tsx`, `src/components/loading-state.tsx`, `src/components/results-card.tsx`, `src/components/rate-limit-banner.tsx`

- [ ] **Step 1: Create upload-zone.tsx**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";

const MAX_DIMENSION = 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface UploadZoneProps {
  onImageReady: (base64: string) => void;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(file.type, 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function UploadZone({ onImageReady }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB.");
        return;
      }
      const base64 = await resizeImage(file);
      onImageReady(base64);
    },
    [onImageReady],
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`flex h-64 w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 bg-white hover:border-indigo-300 hover:bg-gray-50"
        }`}
      >
        <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
        </svg>
        <p className="text-lg font-medium text-gray-700">Drop your photo here</p>
        <p className="mt-1 text-sm text-gray-500">or tap to upload</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-gray-400">Your photo is analyzed but never stored</p>
    </div>
  );
}
```

- [ ] **Step 2: Create loading-state.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Scanning 10,000 years of famous faces...",
  "Cross-referencing your jawline...",
  "Consulting the celebrity database...",
  "Analyzing your vibe...",
  "Running facial geometry algorithms...",
  "Comparing eyebrow arches...",
  "Almost there...",
];

export function LoadingState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <p className="animate-pulse text-lg font-medium text-gray-600">
        {MESSAGES[index]}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create results-card.tsx**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type { Celebrity } from "@/lib/types";

interface ResultsCardProps {
  celebrities: [Celebrity, Celebrity];
  explanation: string;
  remaining: number;
  userImage: string;
  onTryAgain: () => void;
}

function CelebrityPhoto({ celebrity }: { celebrity: Celebrity }) {
  const [src, setSrc] = useState(celebrity.imageUrl);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32 overflow-hidden rounded-full bg-gray-100 sm:h-40 sm:w-40">
        <Image
          src={src}
          alt={celebrity.name}
          fill
          className="object-cover"
          unoptimized
          onError={() => setSrc("/placeholder-silhouette.svg")}
        />
      </div>
      <h3 className="text-center text-lg font-bold text-gray-900">{celebrity.name}</h3>
      <p className="text-center text-sm text-gray-500">{celebrity.description}</p>
    </div>
  );
}

export function ResultsCard({
  celebrities,
  explanation,
  remaining,
  userImage,
  onTryAgain,
}: ResultsCardProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex items-center gap-4 sm:gap-8">
        <CelebrityPhoto celebrity={celebrities[0]} />
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-indigo-500 sm:h-40 sm:w-40">
            <Image
              src={userImage}
              alt="You"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <p className="text-sm font-medium text-indigo-600">You</p>
        </div>
        <CelebrityPhoto celebrity={celebrities[1]} />
      </div>

      <p className="max-w-lg text-center text-lg text-gray-700">{explanation}</p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onTryAgain}
          className="rounded-full bg-indigo-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Try again
        </button>
        <p className="text-sm text-gray-400">
          {remaining} of 2 remaining today
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create rate-limit-banner.tsx**

```tsx
interface RateLimitBannerProps {
  onTryAgain: () => void;
}

export function RateLimitBanner({ onTryAgain }: RateLimitBannerProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="text-5xl">🪞</p>
      <h2 className="text-2xl font-bold text-gray-900">
        You&apos;ve used your 2 free looks today
      </h2>
      <p className="text-lg text-gray-500">Come back tomorrow for more!</p>
      <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-8 py-4">
        <p className="text-sm text-gray-400">Upgrade option coming soon</p>
      </div>
      <button
        onClick={onTryAgain}
        className="mt-2 text-sm text-indigo-600 underline hover:text-indigo-800"
      >
        Back to start
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Verify all components compile**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add UI components (upload, loading, results, rate limit)"
```

---

## Task 11: Main Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Depends on:** Task 10

- [ ] **Step 1: Update globals.css**

Keep Tailwind directives. Add any custom animations needed (e.g., pulse for loading).

- [ ] **Step 2: Update layout.tsx**

Set metadata: title "which2 — Find Your Famous Face Mashup", description, Open Graph tags for social sharing. Import a clean sans-serif font (Inter from Google Fonts via `next/font`).

- [ ] **Step 3: Implement page.tsx**

```tsx
"use client";

import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { LoadingState } from "@/components/loading-state";
import { ResultsCard } from "@/components/results-card";
import { RateLimitBanner } from "@/components/rate-limit-banner";
import type { AnalyzeResponse } from "@/lib/types";

type AppState = "upload" | "loading" | "results" | "rate-limited" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [userImage, setUserImage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const reset = () => {
    setState("upload");
    setResult(null);
    setUserImage("");
    setErrorMessage("");
  };

  const handleImageReady = async (base64: string) => {
    setUserImage(base64);
    setState("loading");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (res.status === 429) {
        setState("rate-limited");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }

      const data: AnalyzeResponse = await res.json();
      setResult(data);
      setState("results");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-12">
      <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        which<span className="text-indigo-600">2</span>
      </h1>
      <p className="mb-10 text-center text-lg text-gray-500">
        Find out which 2 famous faces you&apos;re a mashup of
      </p>

      {state === "upload" && <UploadZone onImageReady={handleImageReady} />}
      {state === "loading" && <LoadingState />}
      {state === "results" && result && (
        <ResultsCard
          celebrities={result.celebrities}
          explanation={result.explanation}
          remaining={result.remaining}
          userImage={userImage}
          onTryAgain={reset}
        />
      )}
      {state === "rate-limited" && <RateLimitBanner onTryAgain={reset} />}
      {state === "error" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-lg text-red-600">{errorMessage}</p>
          <button
            onClick={reset}
            className="rounded-full bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Verify it compiles and renders**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: wire up main page with state machine flow"
```

---

## Task 12: Polish & Config

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Add image domains for external celebrity photos:
```typescript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "*.wikipedia.org" },
    ],
  },
};
```

- [ ] **Step 2: Full build and manual smoke test**

```bash
bun run build && bun run start
```

Verify in browser: upload page loads, branding visible, drop zone works.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: configure image domains and final polish"
```

---

## Task 13: Sentry Setup

**Files:**
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`

- [ ] **Step 1: Initialize Sentry configs**

Client config:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
```

Server config (same structure).

- [ ] **Step 2: Run Sentry wizard if needed, otherwise wire manually into next.config.ts**

```bash
bunx @sentry/wizard@latest -i nextjs --saas
```

Or manually wrap next.config.ts with `withSentryConfig`.

- [ ] **Step 3: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts next.config.ts
git commit -m "feat: add Sentry error monitoring"
```

---

## Task 14: E2E Tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/upload-flow.spec.ts`

**Depends on:** All previous tasks

- [ ] **Step 1: Create playwright.config.ts**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

- [ ] **Step 2: Install Playwright browsers**

```bash
bunx playwright install chromium
```

- [ ] **Step 3: Write E2E test for upload happy path**

Test that:
- Page loads with upload zone
- File input accepts an image
- Loading state appears
- Results (or error for missing API key) display

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test: add Playwright E2E tests"
```

---

## Execution Notes

**Parallelizable tasks:**
- Tasks 3, 4, 5, 6, 7 are independent and can run in parallel
- Task 8 depends on 2-6
- Task 9 depends on 8
- Task 10 components are independent of each other
- Tasks 12, 13 are independent

**Environment requirements:**
- `GEMINI_API_KEY` must be set in `.env.local` for the API route to work
- Sentry DSN optional for development
