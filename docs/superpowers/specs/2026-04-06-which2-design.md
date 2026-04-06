# which2 — Design Spec

## Overview

A viral web tool where users upload a photo and find out which 2 famous faces they're a mashup of. Optimized for fun, shareability, and low cost.

## Goals

- **Primary:** Fun viral tool — optimized for social sharing, quick laughs, low friction
- **Non-goals:** User accounts, photo storage, high accuracy, portfolio polish

## Architecture

Single Next.js app (App Router, TypeScript, Bun) deployed on Railway.

### Data Flow

```
User uploads photo
  → Browser resizes image client-side (max ~1024px)
  → POST /api/analyze with base64 image payload
  → API route validates image (type, size)
  → API route checks rate limit (2/day per IP)
  → Calls Gemini 2.0 Flash with vision prompt
  → Gemini returns: 2 famous person names, who they are, why the user looks like a mix
  → API route validates response structure (exactly 2 names)
  → API route fetches celebrity photos from Wikimedia Commons API (with silhouette fallback)
  → Returns JSON to client (including image URLs)
  → Renders screenshot-friendly results page
```

### Key Constraints

- No database, no file storage — photo is base64, processed, discarded
- No authentication — public tool, no accounts
- CORS restricted to app's own origin
- Max base64 payload: 2MB (after client-side resize)
- Celebrity scope: actors, musicians, athletes, historical figures, influencers, YouTubers, TikTokers, politicians, world leaders — any widely recognizable person

## Tech Stack

| Layer             | Choice                          |
|-------------------|---------------------------------|
| Framework         | Next.js (App Router)            |
| Language          | TypeScript                      |
| Runtime           | Bun                             |
| AI API            | Gemini 2.0 Flash                |
| Celebrity images  | Wikimedia Commons API           |
| Styling           | Tailwind CSS                    |
| Testing           | Vitest + Playwright             |
| Error monitoring  | Sentry                          |
| Deployment        | Railway                         |
| Rate limiting     | In-memory (IP-based, 2/day)     |

## UI/UX Flow

### Screen 1: Upload

- Clean, centered layout with "which2" branding
- Large drop zone / tap-to-upload (mobile-first)
- Tagline: "Find out which 2 famous faces you're a mashup of"
- Client-side image resize before upload
- Brief privacy note: "Your photo is analyzed but never stored"

### Screen 2: Loading

- Playful animated loading state (~2-5s)
- Rotating fun messages (e.g., "Scanning 10,000 years of famous faces...")

### Screen 3: Results

- Three photos in a row: **Celebrity 1 | User's photo | Celebrity 2**
- Celebrity names + brief description underneath each
- Explanation text: why you're a mashup of these two
- "Try again" button
- Rate limit counter: "X of 2 remaining today"
- Designed for phone screenshots: bold text, clean background, clear branding
- Fallback: silhouette placeholder if no Wikimedia image found for a celebrity

### Rate Limit Hit Screen

- Friendly message: "You've used your 2 free looks today — come back tomorrow!"
- Placeholder area for future upgrade CTA (Stripe integration ready)

## API Design

### POST /api/analyze

**Request:**
```json
{
  "image": "base64-encoded-string"
}
```

**Response (200):**
```json
{
  "celebrities": [
    {
      "name": "Frida Kahlo",
      "description": "Mexican painter and cultural icon",
      "imageUrl": "https://commons.wikimedia.org/..."
    },
    {
      "name": "MrBeast",
      "description": "YouTuber and philanthropist",
      "imageUrl": "https://commons.wikimedia.org/..."
    }
  ],
  "explanation": "You've got Frida's bold brows and intense gaze combined with MrBeast's wide smile and energetic presence.",
  "remaining": 1
}
```

**Error responses:**
- `400` — Invalid image (wrong type, too large)
- `429` — Rate limit exceeded
- `500` — Gemini API failure / malformed response
- `502` — Gemini API unreachable

## Gemini Prompt Strategy

The prompt instructs Gemini to:
1. Analyze the uploaded face
2. Pick exactly 2 famous/recognizable people from any era or category
3. Prioritize widely recognizable figures likely to have Wikipedia/Wikimedia presence
4. Explain why the person looks like a mashup of those two
5. Return structured JSON

Response validation: must contain exactly 2 celebrity entries with name and description fields. If malformed, retry once, then return error.

## Rate Limiting

- In-memory Map keyed by IP address
- 2 requests per IP per calendar day (UTC)
- TTL-based cleanup to prevent memory leaks
- Rate limit info included in response headers and body
- Resets on deploy (acceptable for v1 — users get a bonus reset)
- Future: swap to Redis/external store if scaling requires it

## Monetization (Future-Ready)

- Rate limit is the monetization hook — 2 free/day, paid tier unlocks more
- Results page layout reserves space for future upgrade CTA
- No monetization in v1 beyond the limit itself

## Error Handling

- **Sentry** integration for error tracking (free tier)
- Client-side validation: file type (JPEG, PNG, WebP), max 5MB before resize
- Server-side validation: image type, size, base64 integrity
- Gemini errors: friendly "Couldn't analyze your photo, try again" with retry button
- Malformed Gemini response: retry once, then error
- No raw errors exposed to users

## Testing Strategy

- **Unit tests (Vitest):** Gemini response parsing, rate limiter logic, image validation, prompt construction
- **Integration tests (Vitest):** API route with mocked Gemini responses, Wikimedia API fallback
- **E2E tests (Playwright):** Upload flow happy path, rate limit enforcement, error states
- **BDD conventions:** `#given`, `#when`, `#then` comments in all tests
- **Mock strategy:** Mock Gemini API and Wikimedia API; never mock the code under test

## File Structure

```
which2/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Upload screen
│   │   ├── globals.css
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts      # POST handler
│   ├── components/
│   │   ├── upload-zone.tsx
│   │   ├── loading-state.tsx
│   │   ├── results-card.tsx
│   │   └── rate-limit-banner.tsx
│   └── lib/
│       ├── gemini.ts             # Gemini API client + prompt
│       ├── wikimedia.ts          # Celebrity image fetching
│       ├── rate-limiter.ts       # In-memory IP rate limiter
│       ├── image-validation.ts   # Server-side image checks
│       └── types.ts              # Shared TypeScript types
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
├── sentry.client.config.ts
├── sentry.server.config.ts
└── .env.example
```
