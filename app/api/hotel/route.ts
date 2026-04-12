import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const LITEAPI_MCP_BASE = "https://mcp.liteapi.travel/api/mcp";

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
    throw new Error(`MCP ${tool} ${res.status}`);
  }
  const body = await res.text();
  let envelope: any;
  if (body.trimStart().startsWith("{")) {
    envelope = JSON.parse(body);
  } else {
    const match = body.match(/data: (\{[\s\S]*?\})\s*(?:\r?\n|$)/);
    if (!match) throw new Error(`MCP ${tool}: no data event`);
    envelope = JSON.parse(match[1]);
  }
  if (envelope.error) {
    throw new Error(`MCP ${tool}: ${JSON.stringify(envelope.error).slice(0, 200)}`);
  }
  const text = envelope?.result?.content?.[0]?.text ?? "";
  if (/^Error:/.test(text)) {
    const m = text.match(/"(?:description|message)":"([^"]+)"/);
    throw new Error(`MCP ${tool}: ${m?.[1] || text.split("\n")[0]}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function todayPlus(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function stripHtml(html?: string) {
  if (!html) return undefined;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type Room = {
  name: string;
  description?: string;
  sizeSqm?: number;
  bedTypes?: string;
  maxOccupancy?: number;
  price?: number;
  currency?: string;
  suggestedPrice?: number;
  boardName?: string;
  offerId?: string;
  refundable?: boolean;
};

function normalizeRooms(rates: any, hotelRooms: any[] = []): Room[] {
  const data = rates?.data?.[0];
  if (!data) return [];
  const roomTypes: any[] = data.roomTypes || [];

  // Dedupe by room name, keeping the cheapest offer.
  const byName = new Map<string, Room>();
  for (const rt of roomTypes) {
    const rate = rt?.rates?.[0];
    if (!rate) continue;
    const name = String(rate.name || "Room");
    const priceObj = rt.offerRetailRate;
    const price = typeof priceObj?.amount === "number" ? priceObj.amount : undefined;
    if (price == null) continue;

    const existing = byName.get(name);
    if (existing && typeof existing.price === "number" && existing.price <= price)
      continue;

    // Enrich with static room metadata if available (size, beds).
    const staticMeta = hotelRooms.find(
      (r) => r.roomName === name || r.name === name
    );
    const bedTypes =
      rate.bedTypes ||
      staticMeta?.bedTypes
        ?.map?.((b: any) => b?.description || b?.bedType || b?.name)
        .filter(Boolean)
        .join(", ") ||
      undefined;

    byName.set(name, {
      name,
      description: stripHtml(staticMeta?.description)?.slice(0, 240),
      sizeSqm:
        typeof staticMeta?.roomSizeSquare === "number"
          ? staticMeta.roomSizeSquare
          : undefined,
      bedTypes,
      maxOccupancy:
        typeof rate.maxOccupancy === "number" ? rate.maxOccupancy : undefined,
      price,
      currency: priceObj?.currency || rt.suggestedSellingPrice?.currency || "USD",
      suggestedPrice:
        typeof rt.suggestedSellingPrice?.amount === "number" &&
        rt.suggestedSellingPrice.amount > price
          ? rt.suggestedSellingPrice.amount
          : undefined,
      boardName: rate.boardName || undefined,
      offerId: rt.offerId,
      refundable:
        Array.isArray(rate.cancellationPolicies?.cancelPolicyInfos)
          ? rate.cancellationPolicies.cancelPolicyInfos.some(
              (p: any) => (p?.amount ?? 0) === 0
            )
          : undefined,
    });
  }

  return Array.from(byName.values()).sort(
    (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const checkin = url.searchParams.get("checkin") || todayPlus(30);
  const checkout = url.searchParams.get("checkout") || todayPlus(33);
  const adults = Math.max(1, Number(url.searchParams.get("adults") || 2));
  const currency = url.searchParams.get("currency") || "USD";
  const nationality = url.searchParams.get("nationality") || "US";

  try {
    // Details + rates fire in parallel. Weather needs lat/lng from
    // details so it fires after, but it's fast (~200ms).
    const [detailsRes, ratesRes] = await Promise.allSettled([
      mcpCall("get_data_hotel", { hotelId: id }),
      mcpCall("post_hotels_rates", {
        hotelIds: [id],
        occupancies: [{ adults }],
        currency,
        guestNationality: nationality,
        checkin,
        checkout,
      }),
    ]);

    if (detailsRes.status === "rejected") {
      return NextResponse.json(
        { error: detailsRes.reason?.message || "Failed to load hotel" },
        { status: 502 }
      );
    }

    const raw = detailsRes.value?.data || detailsRes.value;

    // Fire weather via direct REST (more reliable than MCP for this endpoint).
    let weatherRes: PromiseSettledResult<any> = {
      status: "rejected",
      reason: new Error("No coordinates"),
    };
    const lat = raw?.location?.latitude;
    const lng = raw?.location?.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      const apiKey = process.env.LITEAPI_KEY;
      const weatherUrl = new URL("https://api.liteapi.travel/v3.0/data/weather");
      weatherUrl.searchParams.set("latitude", String(lat));
      weatherUrl.searchParams.set("longitude", String(lng));
      weatherUrl.searchParams.set("startDate", checkin);
      weatherUrl.searchParams.set("endDate", checkout);
      weatherUrl.searchParams.set("units", "metric");
      weatherRes = await Promise.allSettled([
        fetch(weatherUrl.toString(), {
          headers: { "X-API-Key": apiKey!, accept: "application/json" },
        }).then(async (r) => {
          if (!r.ok) throw new Error(`Weather ${r.status}`);
          return r.json();
        }),
      ]).then((r) => r[0]);
    }
    const hotelRooms: any[] = Array.isArray(raw?.rooms) ? raw.rooms : [];

    // Amenities (with translated names)
    const facilities: { id?: number; name: string }[] = Array.isArray(
      raw?.facilities
    )
      ? raw.facilities
          .filter((f: any) => f && (f.name || f.facilityName))
          .map((f: any) => ({ id: f.facilityId, name: f.name || f.facilityName }))
      : [];

    // Images: top N, prefer urlHd
    const images: { url: string; caption?: string }[] = Array.isArray(raw?.hotelImages)
      ? raw.hotelImages
          .slice(0, 20)
          .map((img: any) => ({
            url: img.urlHd || img.url,
            caption: img.caption || undefined,
          }))
          .filter((i: any) => i.url)
      : [];

    const sentiment = raw?.sentiment_analysis || null;
    const pros: string[] = Array.isArray(sentiment?.pros) ? sentiment.pros : [];
    const cons: string[] = Array.isArray(sentiment?.cons) ? sentiment.cons : [];

    const checkinTimes = raw?.checkinCheckoutTimes || null;

    const hotel = {
      id: raw?.id || id,
      name: raw?.name,
      description: stripHtml(raw?.hotelDescription),
      address: raw?.address,
      city: raw?.city,
      country: (raw?.country || "").toString().toUpperCase() || undefined,
      zip: raw?.zip,
      phone: raw?.phone || undefined,
      email: raw?.email || undefined,
      stars: typeof raw?.starRating === "number" ? raw.starRating : undefined,
      rating: typeof raw?.rating === "number" ? raw.rating : undefined,
      reviewCount:
        typeof raw?.reviewCount === "number" ? raw.reviewCount : undefined,
      mainPhoto: raw?.main_photo,
      thumbnail: raw?.thumbnail,
      latitude: raw?.location?.latitude,
      longitude: raw?.location?.longitude,
      hotelType: raw?.hotelType,
      airportCode: raw?.airportCode,
      importantInformation: stripHtml(raw?.hotelImportantInformation),
      childAllowed: raw?.childAllowed,
      petsAllowed: raw?.petsAllowed,
      checkin: checkinTimes?.checkin_start || null,
      checkinEnd: checkinTimes?.checkin_end || null,
      checkout: checkinTimes?.checkout || null,
      facilities,
      images,
      pros: pros.slice(0, 6),
      cons: cons.slice(0, 6),
    };

    let rooms: Room[] = [];
    let ratesError: string | null = null;
    if (ratesRes.status === "fulfilled") {
      try {
        rooms = normalizeRooms(ratesRes.value, hotelRooms);
      } catch (e: any) {
        ratesError = e?.message || "Failed to parse rates";
      }
    } else {
      ratesError = ratesRes.reason?.message || "Failed to load rates";
    }

    // --- Weather ---
    type WeatherDay = {
      date: string;
      tempMin?: number;
      tempMax?: number;
      tempAfternoon?: number;
      humidity?: number;
      cloudCover?: number;
      precipitation?: number;
      windSpeed?: number;
      units: string;
    };
    let weather: WeatherDay[] = [];
    if (weatherRes.status === "fulfilled" && weatherRes.value) {
      const wd =
        weatherRes.value?.weatherData ??
        weatherRes.value?.data ??
        (Array.isArray(weatherRes.value) ? weatherRes.value : []);
      weather = (wd as any[])
        .map((item: any) => {
          const dw = item?.dailyWeather ?? item;
          if (!dw?.date) return null;
          return {
            date: dw.date,
            tempMin: dw.temperature?.min,
            tempMax: dw.temperature?.max,
            tempAfternoon: dw.temperature?.afternoon,
            humidity: dw.humidity?.afternoon,
            cloudCover: dw.cloud_cover?.afternoon,
            precipitation: dw.precipitation?.total,
            windSpeed: dw.wind?.max?.speed,
            units: dw.units || "metric",
          } as WeatherDay;
        })
        .filter(Boolean) as WeatherDay[];
    }

    return NextResponse.json({
      hotel,
      rooms,
      ratesError,
      weather,
      search: { checkin, checkout, adults, currency },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
