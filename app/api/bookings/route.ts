import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LITEAPI_MCP_BASE = "https://mcp.liteapi.travel/api/mcp";

function mcpUrl() {
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("LITEAPI_KEY not set");
  return `${LITEAPI_MCP_BASE}?apiKey=${encodeURIComponent(key)}`;
}

async function mcpCall(
  tool: string,
  args: Record<string, unknown>
): Promise<any> {
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
  if (!res.ok) throw new Error(`MCP ${tool} ${res.status}`);
  const body = await res.text();
  let envelope: any;
  if (body.trimStart().startsWith("{")) {
    envelope = JSON.parse(body);
  } else {
    const match = body.match(/data: (\{[\s\S]*?\})\s*(?:\r?\n|$)/);
    if (!match) throw new Error(`MCP ${tool}: no data`);
    envelope = JSON.parse(match[1]);
  }
  if (envelope.error) throw new Error(JSON.stringify(envelope.error).slice(0, 200));
  const text = envelope?.result?.content?.[0]?.text ?? "";
  if (/^Error:/.test(text)) {
    const m = text.match(/"(?:description|message)":"([^"]+)"/);
    throw new Error(m?.[1] || text.split("\n")[0]);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientRef = url.searchParams.get("clientReference");

  try {
    const args: Record<string, unknown> = {};
    if (clientRef) args.clientReference = clientRef;

    const res = await mcpCall("listBookings", args);
    const raw: any[] = res?.data || res || [];

    const bookings = (Array.isArray(raw) ? raw : []).map((b: any) => ({
      bookingId: b.bookingId ?? b.id ?? b.booking_id,
      status: b.status ?? "unknown",
      hotelName: b.hotelName ?? b.hotel?.name ?? b.hotel_name ?? undefined,
      hotelConfirmationCode:
        b.hotelConfirmationCode ?? b.confirmationCode ?? undefined,
      checkin: b.checkin ?? b.checkIn ?? b.check_in ?? undefined,
      checkout: b.checkout ?? b.checkOut ?? b.check_out ?? undefined,
      currency: b.currency ?? undefined,
      totalPrice:
        typeof b.totalPrice === "number"
          ? b.totalPrice
          : typeof b.price === "number"
          ? b.price
          : undefined,
      guestName:
        b.holder?.firstName && b.holder?.lastName
          ? `${b.holder.firstName} ${b.holder.lastName}`
          : b.guestName ?? undefined,
      email: b.holder?.email ?? b.email ?? undefined,
      createdAt: b.createdAt ?? b.created_at ?? undefined,
    }));

    return NextResponse.json({ bookings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load bookings", bookings: [] },
      { status: 502 }
    );
  }
}
