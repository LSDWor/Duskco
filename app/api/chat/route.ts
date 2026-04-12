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
  price?: number;
  currency?: string;
  airline?: string;
  airlineCode?: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
  cabin?: string;
  raw?: any;
};

function normalizeFlight(f: any, idx: number): Flight {
  // LiteAPI flight offers have a few possible shapes. Extract defensively.
  const id =
    f.id ?? f.offerId ?? f.offer_id ?? f.uniqueId ?? `flight-${idx}`;
  const price =
    f.price?.total ??
    f.totalPrice ??
    f.total ??
    f.pricing?.total ??
    f.price ??
    undefined;
  const currency =
    f.price?.currency ??
    f.currency ??
    f.pricing?.currency ??
    undefined;

  const firstSegment =
    f.itineraries?.[0]?.segments?.[0] ??
    f.segments?.[0] ??
    f.slices?.[0]?.segments?.[0] ??
    {};

  const lastSegment =
    f.itineraries?.[0]?.segments?.slice(-1)?.[0] ??
    f.segments?.slice(-1)?.[0] ??
    f.slices?.[0]?.segments?.slice(-1)?.[0] ??
    firstSegment;

  const stopsCount =
    (f.itineraries?.[0]?.segments?.length ?? f.segments?.length ?? 1) - 1;

  return {
    id: String(id),
    price: typeof price === "number" ? price : undefined,
    currency,
    airline:
      firstSegment.carrierName ??
      firstSegment.airline?.name ??
      firstSegment.operating?.carrierName ??
      undefined,
    airlineCode:
      firstSegment.carrierCode ??
      firstSegment.airline?.iata ??
      firstSegment.operating?.carrierCode ??
      undefined,
    origin:
      firstSegment.departure?.iataCode ??
      firstSegment.origin ??
      firstSegment.from ??
      undefined,
    destination:
      lastSegment.arrival?.iataCode ??
      lastSegment.destination ??
      lastSegment.to ??
      undefined,
    departureTime:
      firstSegment.departure?.at ??
      firstSegment.departureTime ??
      undefined,
    arrivalTime:
      lastSegment.arrival?.at ??
      lastSegment.arrivalTime ??
      undefined,
    duration: f.duration ?? f.totalDuration ?? undefined,
    stops: Number.isFinite(stopsCount) ? Math.max(0, stopsCount) : undefined,
    cabin: f.cabinClass ?? firstSegment.cabin ?? undefined,
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
    const payload: any = {
      origin: String(args.origin || "").toUpperCase(),
      destination: String(args.destination || "").toUpperCase(),
      departureDate: args.departureDate,
      adults: Number.isFinite(args.adults) ? Number(args.adults) : 1,
      currency: args.currency || "USD",
    };
    if (args.returnDate) payload.returnDate = args.returnDate;
    if (args.cabinClass) payload.cabinClass = args.cabinClass;

    const res = await mcpCall("post_flights_rates", payload);
    const offers: any[] =
      res?.data?.offers ??
      res?.offers ??
      res?.data ??
      (Array.isArray(res) ? res : []);
    return offers.slice(0, 15).map((f, i) => normalizeFlight(f, i));
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

  return `You are Duskgo, an AI travel concierge with access to real travel inventory via the LiteAPI MCP server. The user chats with you in natural language. For each user message, pick exactly one tool and return ONLY a JSON object (no prose, no markdown, no code fences) with this exact shape:

{
  "reasoning": "<2-5 sentences, first-person, explaining how you interpreted the request and which tool you're calling and why>",
  "tool_call": {
    "name": "<tool name>",
    "arguments": { ... }
  }
}

Available tools:

1. respond — Answer the user directly with natural-language text. Use this when the user is asking a question, requesting hotel details they've pinned, seeking advice, or the answer can be composed from conversation context without a fresh data lookup. This is the default when the user has pinned hotels and is asking about them (except comparisons — see #2).
   arguments: {
     text: string              // Markdown. Structure answers with short headings or **bold labels**, concise bullet lists (- ...), and 1–2 sentence paragraphs. Always include concrete facts from the pinned context (location, star rating, review score, standout features). Avoid generic filler. For "tell me about <hotel>" prompts, structure as: 1-sentence headline, then bullets covering Vibe, Best for, Standout features, and any caveats from cons.
   }

2. compare_hotels — Build a side-by-side structured comparison of 2–5 hotels. USE THIS (not respond) when the user asks to "compare", "contrast", "side by side", "which is better", "differences", "vs", or similar, AND there are 2+ pinned hotels available. The client renders the result as a real comparison table.
   arguments: {
     hotelIds: string[]        // 2–5 hotel IDs drawn from the pinned context (each pinned hotel has an [id:...] tag below)
   }

3. search_hotels — Search hotels in a city. Use when the user asks about hotels, stays, or a place to stay and wants NEW options.
   arguments: {
     destination: string,       // city name, e.g. "Paris"
     countryCode: string,       // ISO 3166-1 alpha-2, e.g. "FR"
     limit?: integer            // max 20
   }

4. get_hotel_details — Get full details for one hotel by ID. Use only when you need deeper info on a specific hotel and don't already have it from pinned context or prior results.
   arguments: {
     hotelId: string            // e.g. "lp1beec"
   }

5. search_flights — Search flights between two airports. Use when the user asks about flights, airfare, or getting to a destination.
   arguments: {
     origin: string,            // 3-letter IATA airport code, e.g. "JFK"
     destination: string,       // 3-letter IATA airport code, e.g. "CDG"
     departureDate: string,     // YYYY-MM-DD
     returnDate?: string,       // YYYY-MM-DD for round trips; omit for one-way
     adults: integer,           // default 1
     cabinClass?: string,       // "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"
     currency?: string          // ISO 4217, default "USD"
   }

Rules:
- Today is ${todayISO(0)}. If dates are vague ("next month", "in June"), pick sensible concrete future dates.
- If only duration is given, assume check-in 30 days from today.
- For flights, YOU must pick the correct 3-letter IATA airport codes — use the most common primary airport for each city (Paris→CDG, New York→JFK, London→LHR, Tokyo→HND, Los Angeles→LAX, Singapore→SIN).
- If 2+ pinned hotels exist and the user asks for a comparison or "which is better", call compare_hotels with their IDs. For single-hotel questions or non-comparison prompts about pinned hotels, call respond. Do NOT call search_hotels unless the user explicitly asks for new options.
- ALWAYS include a tool_call. If ambiguous, make your best guess and explain it in "reasoning".
- Output ONLY the JSON object. No explanations outside the JSON.${pinnedBlock}`;
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

        // "respond" is a virtual tool — treat its text as the final
        // message and skip emitting a tool_result (no UI to render).
        if (name === "respond") {
          emit({ type: "message", text: String(result || "") });
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
