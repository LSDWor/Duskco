import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type PinnedHotel = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
  description?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LITEAPI_MCP_BASE = "https://mcp.liteapi.travel/api/mcp";

const FALLBACK_MODELS = [
  process.env.OPENROUTER_MODEL,
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
].filter(Boolean) as string[];

function todayISO(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------------------------- MCP client ---------------------------- */

function mcpUrl() {
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("LITEAPI_KEY not set");
  return `${LITEAPI_MCP_BASE}?apiKey=${encodeURIComponent(key)}`;
}

async function mcpCall(tool: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(mcpUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP ${tool} ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = await res.text();

  // Response may be plain JSON or SSE (data: {...} lines).
  let envelope: any = null;
  if (body.trimStart().startsWith("{")) {
    envelope = JSON.parse(body);
  } else {
    const match = body.match(/data: (\{[\s\S]*?\})\s*(?:\r?\n|$)/);
    if (!match) throw new Error(`MCP ${tool}: no data event in response`);
    envelope = JSON.parse(match[1]);
  }

  if (envelope.error) {
    throw new Error(`MCP ${tool}: ${JSON.stringify(envelope.error).slice(0, 200)}`);
  }

  const content = envelope?.result?.content;
  if (Array.isArray(content) && content.length > 0 && content[0].text) {
    const text = content[0].text as string;

    // Some MCP tool wrappers return an error as a mixed text+JSON blob
    // like: "Error: API request failed: 403 Forbidden\n{"error":{...}}".
    // Detect it and throw a clean message.
    const errMatch = text.match(/\{"error":\{[^}]*?"(?:description|message)":"([^"]+)"/);
    if (/^Error:/.test(text) || errMatch) {
      const msg = errMatch?.[1] || text.split("\n")[0].replace(/^Error:\s*/, "");
      throw new Error(`MCP ${tool}: ${msg}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return envelope?.result;
}

/* --------------------------- normalizers --------------------------- */

type Hotel = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
  thumbnail?: string;
  mainPhoto?: string;
  latitude?: number;
  longitude?: number;
  currency?: string;
};

function normalizeHotel(h: any): Hotel {
  return {
    id: String(h.id ?? h.hotelId ?? ""),
    name: String(h.name ?? "Unknown hotel"),
    description:
      typeof h.hotelDescription === "string"
        ? h.hotelDescription.replace(/<[^>]+>/g, " ").slice(0, 500)
        : undefined,
    address: h.address ?? undefined,
    city: h.city ?? undefined,
    country: (h.country ?? "").toString().toUpperCase() || undefined,
    stars: typeof h.stars === "number" ? h.stars : undefined,
    rating: typeof h.rating === "number" ? h.rating : undefined,
    reviewCount:
      typeof h.reviewCount === "number" ? h.reviewCount : undefined,
    thumbnail: h.thumbnail ?? h.main_photo ?? undefined,
    mainPhoto: h.main_photo ?? h.thumbnail ?? undefined,
    latitude: h.latitude ?? undefined,
    longitude: h.longitude ?? undefined,
    currency: h.currency ?? undefined,
  };
}

type Flight = {
  id: string;
  offerId?: string;
  price?: number;
  currency?: string;
  airline?: string;
  airlineCode?: string;
  airlineLogo?: string;
  origin?: string;
  originName?: string;
  destination?: string;
  destinationName?: string;
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  stops?: number;
  cabin?: string;
  seatsRemaining?: number;
  refundable?: boolean;
  changeable?: boolean;
  hasCarryOn?: boolean;
  hasCheckedBag?: boolean;
};

function normalizeJourney(journey: any): Flight {
  const segments: any[] = journey.segments || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const offer = journey.cheapestOffer || journey.offers?.[0];
  const pricing = offer?.pricing?.display;

  return {
    id: journey.journeyKey || crypto.randomUUID(),
    offerId: offer?.offerId,
    price: pricing?.total,
    currency: pricing?.currency,
    airline: first.carrier?.marketingName,
    airlineCode: first.carrier?.marketingCode,
    airlineLogo: first.carrier?.marketingLogo,
    origin: first.originCode,
    originName: first.originName,
    destination: last.destinationCode,
    destinationName: last.destinationName,
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
    durationMinutes: journey.totalDuration?.minutes,
    stops: Math.max(0, segments.length - 1),
    cabin: offer?.fare?.family || offer?.segmentFares?.[0]?.cabin,
    seatsRemaining: offer?.fare?.seatsRemaining,
    refundable: offer?.terms?.refundable,
    changeable: offer?.terms?.changeable,
    hasCarryOn: offer?.baggage?.hasCarryOnBag,
    hasCheckedBag: offer?.baggage?.hasCheckedBag,
  };
}

/* ----------------------------- tools ------------------------------ */

const TOOLS = {
  // Virtual tool: the model returns natural-language text when no
  // external call is needed (comparisons, questions about pinned
  // hotels, explanations). Returns the text unchanged.
  async respond(args: any) {
    return String(args?.text ?? "");
  },

  async compare_hotels(args: any) {
    const ids: string[] = Array.isArray(args?.hotelIds)
      ? args.hotelIds.slice(0, 5).map(String)
      : [];
    if (ids.length < 2) {
      throw new Error("compare_hotels needs at least 2 hotelIds");
    }
    const results = await Promise.allSettled(
      ids.map((id) => mcpCall("get_data_hotel", { hotelId: id }))
    );
    return results.map((r, i) => {
      if (r.status === "rejected") {
        return {
          id: ids[i],
          name: `Hotel ${ids[i]}`,
          error: String(r.reason?.message || r.reason).slice(0, 140),
          topFacilities: [],
          pros: [],
          cons: [],
        };
      }
      const raw = r.value?.data || r.value;
      const desc =
        typeof raw?.hotelDescription === "string"
          ? raw.hotelDescription.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
          : undefined;
      return {
        id: String(raw?.id ?? ids[i]),
        name: raw?.name ?? "Unknown hotel",
        address: raw?.address ?? undefined,
        city: raw?.city ?? undefined,
        country: (raw?.country ?? "").toString().toUpperCase() || undefined,
        stars: typeof raw?.starRating === "number" ? raw.starRating : undefined,
        rating: typeof raw?.rating === "number" ? raw.rating : undefined,
        reviewCount:
          typeof raw?.reviewCount === "number" ? raw.reviewCount : undefined,
        thumbnail: raw?.thumbnail ?? raw?.main_photo ?? undefined,
        hotelType: raw?.hotelType ?? undefined,
        description: desc,
        topFacilities: Array.isArray(raw?.facilities)
          ? raw.facilities
              .slice(0, 8)
              .map((f: any) => f?.name || f?.facilityName)
              .filter(Boolean)
          : [],
        pros: Array.isArray(raw?.sentiment_analysis?.pros)
          ? raw.sentiment_analysis.pros.slice(0, 4)
          : [],
        cons: Array.isArray(raw?.sentiment_analysis?.cons)
          ? raw.sentiment_analysis.cons.slice(0, 4)
          : [],
        childAllowed: raw?.childAllowed,
        petsAllowed: raw?.petsAllowed,
      };
    });
  },

  async search_hotels(args: any) {
    const res = await mcpCall("get_data_hotels", {
      cityName: args.destination,
      countryCode: args.countryCode,
      limit: Math.min(Number(args.limit) || 20, 20),
    });
    const list: any[] = res?.data || res || [];
    return list.map(normalizeHotel);
  },

  async get_hotel_details(args: any) {
    const res = await mcpCall("get_data_hotel", { hotelId: args.hotelId });
    const raw = res?.data || res;
    return normalizeHotel(raw);
  },

  async search_flights(args: any) {
    const apiKey = process.env.LITEAPI_KEY;
    if (!apiKey) throw new Error("LITEAPI_KEY not set");

    const origin = String(args.origin || "").toUpperCase();
    const destination = String(args.destination || "").toUpperCase();
    const departureDate = args.departureDate;
    const returnDate = args.returnDate;
    const adults = Number.isFinite(args.adults) ? Number(args.adults) : 1;
    const currency = args.currency || "USD";
    const cabinClass = args.cabinClass || "Economy";

    const legs: any[] = [
      { origin, destination, date: departureDate, direction: "OUTBOUND" },
    ];
    if (returnDate) {
      legs.push({
        origin: destination,
        destination: origin,
        date: returnDate,
        direction: "INBOUND",
      });
    }

    const res = await fetch("https://api.liteapi.travel/v3.0/flights/rates", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        legs,
        adults,
        children: 0,
        infants: 0,
        currency,
        cabinClass,
        sort: { sortBy: "price", sortOrder: "asc" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      const errMatch = text.match(/"description"\s*:\s*"([^"]+)"/);
      throw new Error(
        errMatch?.[1] || `Flights API ${res.status}: ${text.slice(0, 200)}`
      );
    }

    const json = await res.json();
    const batches: any[] = json?.data || [];
    const journeys: any[] = batches.flatMap((b: any) => b?.journeys || []);
    return journeys.slice(0, 15).map(normalizeJourney);
  },

  async get_destination_weather(args: any) {
    const apiKey = process.env.LITEAPI_KEY;
    if (!apiKey) throw new Error("LITEAPI_KEY not set");

    const city = String(args.city || "");
    const countryCode = String(args.countryCode || "").toUpperCase();
    const startDate = args.startDate || todayISO(0);
    const endDate = args.endDate || todayISO(6);

    // Step 1: geocode via Nominatim (OpenStreetMap) — reliable, no key needed
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        `${city}, ${countryCode}`
      )}&format=json&limit=1`,
      { headers: { "User-Agent": "Duskgo/0.1 (travel-app)" } }
    );
    const geoData = await geoRes.json();
    const lat = parseFloat(geoData?.[0]?.lat);
    const lng = parseFloat(geoData?.[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`Could not find coordinates for ${city}`);
    }

    // Step 2: fetch weather
    const weatherUrl = new URL("https://api.liteapi.travel/v3.0/data/weather");
    weatherUrl.searchParams.set("latitude", String(lat));
    weatherUrl.searchParams.set("longitude", String(lng));
    weatherUrl.searchParams.set("startDate", startDate);
    weatherUrl.searchParams.set("endDate", endDate);
    weatherUrl.searchParams.set("units", "imperial");

    const weatherRes = await fetch(weatherUrl.toString(), {
      headers: { "X-API-Key": apiKey, accept: "application/json" },
    });
    if (!weatherRes.ok) {
      throw new Error(`Weather API ${weatherRes.status}`);
    }
    const weatherJson = await weatherRes.json();
    const wd = weatherJson?.weatherData || [];

    return {
      city,
      countryCode,
      coordinates: { lat, lng },
      startDate,
      endDate,
      days: (wd as any[]).map((item: any) => {
        const dw = item?.dailyWeather ?? item;
        return {
          date: dw.date,
          tempMin: dw.temperature?.min,
          tempMax: dw.temperature?.max,
          humidity: dw.humidity?.afternoon,
          cloudCover: dw.cloud_cover?.afternoon,
          precipitation: dw.precipitation?.total,
          windSpeed: dw.wind?.max?.speed,
        };
      }),
    };
  },
};

/* --------------------------- OpenRouter --------------------------- */

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://duskgo.app",
      "X-Title": "Duskgo",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status} (${model}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "") as string;
}

async function callWithFallback(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  const errors: string[] = [];
  for (const model of FALLBACK_MODELS) {
    try {
      const content = await callOpenRouter(apiKey, model, messages);
      if (content) return content;
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
  }
  throw new Error(`All OpenRouter models failed: ${errors.join(" | ")}`);
}

function extractJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Model did not return JSON");
  return JSON.parse(m[0]);
}

/* -------------------------- system prompt ------------------------- */

function buildSystemPrompt(pinned?: PinnedHotel[]) {
  const pinnedBlock =
    pinned && pinned.length > 0
      ? `\n\nThe user has pinned these hotels to the conversation for reference. Use them when answering comparison, questions, or "which is better" prompts — don't re-search unless the user asks for new options:\n${pinned
          .map((h, i) => {
            const facts = [
              h.city && h.country ? `${h.city}, ${h.country}` : h.city || "",
              typeof h.stars === "number" ? `${h.stars}★` : "",
              typeof h.rating === "number" ? `rating ${h.rating}/10` : "",
              typeof h.reviewCount === "number"
                ? `${h.reviewCount} reviews`
                : "",
            ]
              .filter(Boolean)
              .join(" · ");
            const desc = h.description
              ? ` — ${h.description.slice(0, 220)}`
              : "";
            return `${i + 1}. ${h.name} [id:${h.id}] ${facts}${desc}`;
          })
          .join("\n")}`
      : "";

  const envelope = `For each user message, pick exactly one tool and return ONLY a JSON object (no prose, no markdown, no code fences) with this exact shape:

{
  "reasoning": "<2-5 sentences, first-person, explaining how you interpreted the request and which tool you're calling and why>",
  "tool_call": {
    "name": "<tool name>",
    "arguments": { ... }
  }
}`;

  return `You are Duskgo, an AI travel concierge. You help users discover destinations, find hotels, compare options, and plan trips. You detect user intent automatically:

- **Exploring / researching** (e.g. "best beaches", "where should I go in Europe", "romantic getaway ideas") → use respond with suggest_cities
- **Ready to book** (e.g. "hotels in Rome", "find me a place in Paris") → use search_hotels
- **Asking about a specific pinned hotel** → use respond
- **Comparing pinned hotels** → use compare_hotels

${envelope}

Available tools:

1. respond — Answer with natural-language text. EVERY respond call MUST include one of these in the arguments:
   - "suggest_cities": array of exactly 3 city objects when your answer discusses destinations, areas, or travel research. Each city: {name, countryCode, description (1 sentence), bestFor (1-3 words)}
   - "follow_up_questions": array of exactly 3 short follow-up questions the user might ask next, to keep the conversation going
   - "hotel_preview": {destination, countryCode} when discussing a single specific city and hotels should be shown
   One of these three MUST always be present. Never return respond without at least one.
   arguments: {
     text: string,                // Markdown. Use **bold labels**, bullets, concise paragraphs.
     suggest_cities?: [{name: string, countryCode: string, description: string, bestFor: string}],
     follow_up_questions?: [string, string, string],
     hotel_preview?: {destination: string, countryCode: string}
   }

2. compare_hotels — Side-by-side comparison of 2–5 pinned hotels. Use when user asks to compare, contrast, or pick between pinned hotels.
   arguments: { hotelIds: string[] }

3. search_hotels — Search hotels in a specific city. Use when the user names a city and wants hotel listings.
   arguments: {
     destination: string, countryCode: string,
     checkin?: string, checkout?: string, adults?: integer, limit?: integer
   }

4. get_hotel_details — Full details for one hotel by ID.
   arguments: { hotelId: string }

5. search_flights — Search flights between airports.
   arguments: {
     origin: string, destination: string, departureDate: string,
     returnDate?: string, adults: integer, cabinClass?: string, currency?: string
   }

6. get_destination_weather — Weather forecast for a city.
   arguments: { city: string, countryCode: string, startDate?: string, endDate?: string }

Rules:
- Today is ${todayISO(0)}. Convert vague dates to concrete future dates.
- For flights, use common IATA codes (Paris→CDG, NYC→JFK, London→LHR, Tokyo→HND).
- ALWAYS include a tool_call.
- CRITICAL: Every respond call MUST include suggest_cities OR follow_up_questions OR hotel_preview. The client renders these as interactive cards/buttons. Never leave the user at a dead end.
- When the user asks about beaches, activities, neighborhoods, or points of interest, include suggest_cities with 3 nearby cities where they can find hotels.
- When the user asks about a pinned hotel, use respond with follow_up_questions.
- If 2+ pinned hotels exist and user asks to compare, use compare_hotels.
- Output ONLY the JSON object.${pinnedBlock}`;
}

/* ------------------------------ route ----------------------------- */

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; pinned?: PinnedHotel[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const messages = body.messages;
  const pinned = Array.isArray(body.pinned) ? body.pinned : undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages[] required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        emit({ type: "status", text: "Thinking…" });
        await sleep(80);

        const llmMessages: ChatMessage[] = [
          { role: "system", content: buildSystemPrompt(pinned) },
          ...messages.filter(
            (m) => m.role === "user" || m.role === "assistant"
          ),
        ];

        const raw = await callWithFallback(llmMessages);
        const envelope = extractJson(raw);

        const reasoning: string =
          typeof envelope.reasoning === "string" ? envelope.reasoning : "";
        if (reasoning) emit({ type: "reasoning", text: reasoning });

        const toolCall = envelope.tool_call;
        if (!toolCall || typeof toolCall !== "object") {
          throw new Error("Model did not propose a tool_call");
        }
        const name: string = String(toolCall.name || "");
        const args = toolCall.arguments || toolCall.args || {};

        if (!(name in TOOLS)) {
          throw new Error(`Unknown tool: ${name}`);
        }

        emit({ type: "tool_call", name, args });

        const result = await (TOOLS as any)[name](args);

        // "respond" is a virtual tool — text + interactive elements.
        if (name === "respond") {
          // Emit suggest_cities if present
          const cities = args?.suggest_cities;
          if (Array.isArray(cities) && cities.length > 0) {
            emit({ type: "suggest_cities", cities: cities.slice(0, 3) });
          }

          // Emit follow_up_questions if present
          const questions = args?.follow_up_questions;
          if (Array.isArray(questions) && questions.length > 0) {
            emit({ type: "follow_up_questions", questions: questions.slice(0, 3) });
          }

          // Collect images from pinned hotels for the UI
          if (pinned && pinned.length > 0) {
            const images: { hotelName: string; url: string }[] = [];
            for (const h of pinned) {
              if (!h.id) continue;
              try {
                const detail = await mcpCall("get_data_hotel", { hotelId: h.id });
                const raw = detail?.data || detail;
                const hotelImages: any[] = raw?.hotelImages || [];
                const top = hotelImages
                  .slice(0, 4)
                  .map((img: any) => ({
                    hotelName: h.name,
                    url: img.urlHd || img.url,
                  }))
                  .filter((i: any) => i.url);
                images.push(...top);
              } catch {}
            }
            if (images.length > 0) {
              emit({ type: "images", images: images.slice(0, 8) });
            }
          }

          emit({ type: "message", text: String(result || "") });

          // Auto-fetch 3 hotels if hotel_preview is present
          const preview = args?.hotel_preview;
          if (
            preview &&
            typeof preview.destination === "string" &&
            typeof preview.countryCode === "string"
          ) {
            try {
              emit({
                type: "tool_call",
                name: "search_hotels",
                args: {
                  destination: preview.destination,
                  countryCode: preview.countryCode,
                  limit: 3,
                },
              });
              const hotels = await TOOLS.search_hotels({
                destination: preview.destination,
                countryCode: preview.countryCode,
                limit: 3,
              });
              emit({
                type: "tool_result",
                name: "search_hotels",
                args: {
                  destination: preview.destination,
                  countryCode: preview.countryCode,
                },
                result: hotels,
              });
            } catch {}
          }

          emit({ type: "done" });
          return;
        }

        emit({ type: "tool_result", name, args, result });

        let summary = "";
        if (name === "compare_hotels") {
          const ok = (result as any[]).filter((r) => !r.error);
          summary =
            ok.length >= 2
              ? `Comparing **${ok.map((r: any) => r.name).join("**, **")}** side by side.`
              : `I could only load ${ok.length} of the requested hotels.`;
        } else if (name === "get_destination_weather") {
          const r = result as any;
          const days = r?.days?.length ?? 0;
          summary = days > 0
            ? `Here's the weather forecast for ${r.city} (${r.startDate} to ${r.endDate}).`
            : `Couldn't fetch weather data for ${r?.city || "that destination"}.`;
        } else if (name === "search_hotels") {
          summary =
            result.length === 0
              ? `I couldn't find hotels in ${args.destination}. Try a different city.`
              : `Found ${result.length} hotels in ${args.destination}. Tap any card for details or pin to chat to compare.`;
        } else if (name === "get_hotel_details") {
          summary = result?.name
            ? `Here are the details for ${result.name}.`
            : "Hotel details loaded.";
        } else if (name === "search_flights") {
          summary =
            result.length === 0
              ? `No flights found from ${args.origin} to ${args.destination} on ${args.departureDate}.`
              : `Found ${result.length} flight${result.length === 1 ? "" : "s"} from ${args.origin} to ${args.destination}.`;
        }
        emit({ type: "message", text: summary });
        emit({ type: "done" });
      } catch (err: any) {
        emit({ type: "error", text: err?.message || "Internal error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
