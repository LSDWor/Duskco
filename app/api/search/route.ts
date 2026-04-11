import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Parsed = {
  destination: string;
  countryCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LITEAPI_URL = "https://api.liteapi.travel/v3.0/data/hotels";

const MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function parseQuery(query: string): Promise<Parsed> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const system = `You extract structured travel search parameters from a user's natural-language request.
Return STRICT JSON only, no prose, no markdown. Schema:
{
  "destination": "<primary city name>",
  "countryCode": "<ISO 3166-1 alpha-2 country code>",
  "checkIn": "YYYY-MM-DD",
  "checkOut": "YYYY-MM-DD",
  "adults": <integer, default 2>
}
Rules:
- If dates are vague (e.g. "next month"), pick sensible concrete dates in the future.
- If only duration is given, assume check-in 30 days from today.
- Today's date is ${todayPlus(0)}.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://duskgo.app",
      "X-Title": "Duskgo",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model did not return JSON");
    parsed = JSON.parse(m[0]);
  }

  if (!parsed.destination || !parsed.countryCode) {
    throw new Error("Could not parse destination from query");
  }

  return {
    destination: String(parsed.destination),
    countryCode: String(parsed.countryCode).toUpperCase(),
    checkIn: String(parsed.checkIn || todayPlus(30)),
    checkOut: String(parsed.checkOut || todayPlus(33)),
    adults: Number.isFinite(parsed.adults) ? Number(parsed.adults) : 2,
  };
}

async function fetchHotels(parsed: Parsed) {
  const apiKey = process.env.LITEAPI_KEY;
  if (!apiKey) throw new Error("LITEAPI_KEY not set");

  const url = new URL(LITEAPI_URL);
  url.searchParams.set("countryCode", parsed.countryCode);
  url.searchParams.set("cityName", parsed.destination);
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteAPI ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw: any[] = json?.data || [];

  return raw.slice(0, 20).map((h) => ({
    id: String(h.id ?? h.hotelId ?? crypto.randomUUID()),
    name: String(h.name ?? "Unknown hotel"),
    address: h.address ?? undefined,
    city: h.city ?? undefined,
    country: h.country ?? undefined,
    rating: typeof h.rating === "number" ? h.rating : undefined,
    thumbnail: h.thumbnail ?? h.main_photo ?? h.image ?? undefined,
  }));
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const parsed = await parseQuery(query);
    const hotels = await fetchHotels(parsed);

    return NextResponse.json({ parsed, hotels });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
