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
  if (envelope.error)
    throw new Error(JSON.stringify(envelope.error).slice(0, 200));
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
  const email = url.searchParams.get("email");

  try {
    // Get loyalty program config
    const config = await mcpCall("get_loyalties", {});

    // Get all guests and find by email
    let guest: any = null;
    let points: any = null;
    if (email) {
      try {
        const guestsRes = await mcpCall("get_guests", {});
        const guests: any[] = guestsRes?.data || guestsRes || [];
        guest = (Array.isArray(guests) ? guests : []).find(
          (g: any) =>
            g?.email?.toLowerCase() === email.toLowerCase() ||
            g?.holder?.email?.toLowerCase() === email.toLowerCase()
        );
        if (guest?.id || guest?.guestId) {
          const gid = guest.id || guest.guestId;
          try {
            points = await mcpCall("get_guests_guestid_loyalty_points", {
              guestId: gid,
            });
          } catch {}
        }
      } catch {}
    }

    return NextResponse.json({
      program: {
        enabled: config?.data?.status === "enabled" || config?.status === "enabled",
        cashbackRate: config?.data?.cashbackRate ?? config?.cashbackRate ?? 0,
      },
      guest: guest
        ? {
            id: guest.id || guest.guestId,
            name:
              guest.name ||
              (guest.firstName
                ? `${guest.firstName} ${guest.lastName || ""}`
                : undefined),
            email: guest.email,
          }
        : null,
      points: points?.data || points || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load loyalty", program: null },
      { status: 502 }
    );
  }
}
