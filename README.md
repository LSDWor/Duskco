# Duskgo

AI-powered travel search. Describe your trip in plain English, get real hotels.

## Phase 1 — Hotels

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **LLM**: OpenRouter (default: `meta-llama/llama-3.3-70b-instruct:free`) parses natural-language queries into structured search params
- **Hotel data**: LiteAPI v3 `/data/hotels`

## Setup

```bash
cp .env.example .env.local
# fill in OPENROUTER_API_KEY and LITEAPI_KEY
npm install
npm run dev
```

Open http://localhost:3000 and try:

> 3 nights in Paris for 2 people in early June

## How it works

1. `POST /api/search` receives `{ query }`
2. OpenRouter extracts `{ destination, countryCode, checkIn, checkOut, adults }` as strict JSON
3. LiteAPI returns hotels for that city
4. UI renders the parsed params and hotel cards

## Roadmap

See `BUILD_PLAN.md`. Next up: live rates via LiteAPI `/hotels/rates`, then flights (Duffel).
