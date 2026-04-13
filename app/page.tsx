"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

/* ============================ types =========================== */

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

type CompareRow = {
  id: string;
  name: string;
  error?: string;
  address?: string;
  city?: string;
  country?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
  thumbnail?: string;
  hotelType?: string;
  description?: string;
  topFacilities: string[];
  pros: string[];
  cons: string[];
  childAllowed?: boolean;
  petsAllowed?: boolean;
};

type ToolCall =
  | { name: "search_hotels"; args: { destination: string; countryCode: string } }
  | { name: "get_hotel_details"; args: { hotelId: string } }
  | { name: "compare_hotels"; args: { hotelIds: string[] } }
  | {
      name: "search_flights";
      args: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        adults: number;
      };
    }
  | { name: "respond"; args: { text?: string } }
  | { name: "get_destination_weather"; args: { city: string; countryCode: string; startDate?: string; endDate?: string } };

type UserMessage = { id: string; role: "user"; content: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  status: "streaming" | "done" | "error";
  reasoning?: string;
  toolCall?: ToolCall;
  toolResult?: {
    hotels?: Hotel[];
    hotel?: Hotel;
    flights?: Flight[];
    comparison?: CompareRow[];
    weather?: {
      city: string;
      days: WeatherDay[];
    };
  };
  images?: { hotelName: string; url: string }[];
  message?: string;
  error?: string;
};
type Message = UserMessage | AssistantMessage;

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type CartHotelItem = {
  kind: "hotel";
  id: string;
  addedAt: number;
  hotel: Hotel;
};
type CartFlightItem = {
  kind: "flight";
  id: string;
  addedAt: number;
  flight: Flight;
};
type CartRoomItem = {
  kind: "room";
  id: string;
  addedAt: number;
  hotelId: string;
  hotelName: string;
  hotelThumbnail?: string;
  roomName: string;
  price: number;
  currency: string;
  boardName?: string;
};
type CartItem = CartHotelItem | CartFlightItem | CartRoomItem;

type ApiMessage = { role: "user" | "assistant"; content: string };

const BOOKING_SUGGESTIONS = [
  "3 nights in Paris for 2 people in early June",
  "Flights from NYC to Tokyo next month",
  "Beach hotel in Bali for a week",
  "Hotels in Rome for 5 days in July",
];

const RESEARCH_SUGGESTIONS = [
  "Best European cities for a first-time couple's trip?",
  "What's the weather like in Bali in August?",
  "Is Barcelona or Rome better for food lovers?",
  "Safest neighborhoods to stay in Mexico City",
];

const LS_CHATS = "duskgo.chats.v1";
const LS_CURRENT = "duskgo.current.v1";
const LS_CART = "duskgo.cart.v1";
const LS_PINNED = "duskgo.pinned.v1";
const LS_PROFILE = "duskgo.profile.v1";

type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/* ============================ icons =========================== */

const svg = (props: React.SVGProps<SVGSVGElement>) => ({
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});
const ArrowUp = (p: any) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...svg(p)} strokeWidth={2.5}>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);
const Spinner = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" {...svg(p)} strokeWidth={2.5}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const SearchIcon = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const Chevron = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const Check = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)} strokeWidth={2.5}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Plus = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const X = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const ShoppingBag = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const User = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const Menu = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...svg(p)}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const MessageSquarePlus = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="12" y1="8" x2="12" y2="14" />
    <line x1="9" y1="11" x2="15" y2="11" />
  </svg>
);
const Pin = (p: any) => (
  <svg width="12" height="12" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M12 17v5M9 2h6l-1 7 4 4v2H6v-2l4-4z" />
  </svg>
);
const Plane = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
const Bed = (p: any) => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...svg(p)}>
    <path d="M2 4v16M22 8v12M2 20h20M2 14h20M10 14v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
  </svg>
);
const Star = (p: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...p}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ============================ utils =========================== */

function formatDateRange(a?: string, b?: string) {
  if (!a) return "";
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const first = fmt.format(new Date(a));
    if (!b) return first;
    return `${first} → ${fmt.format(new Date(b))}`;
  } catch {
    return b ? `${a} → ${b}` : a;
  }
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatPrice(amount?: number, currency?: string) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

/* --------------------- tiny markdown renderer -------------------- */

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on bold/italic/code tokens while preserving them.
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const match = token.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      parts.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:no-underline"
        >
          {match[1]}
        </a>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: React.ReactNode[] = [];

  blocks.forEach((block, bIdx) => {
    const lines = block.split("\n");

    // Bullet list: every non-empty line starts with - or *
    if (
      lines.length > 0 &&
      lines.every((l) => l.trim() === "" || /^\s*[-*]\s+/.test(l))
    ) {
      const items = lines
        .filter((l) => l.trim() !== "")
        .map((l) => l.replace(/^\s*[-*]\s+/, ""));
      if (items.length > 0) {
        out.push(
          <ul
            key={bIdx}
            className="my-1 list-disc space-y-1 pl-5 marker:text-muted-foreground"
          >
            {items.map((it, i) => (
              <li key={i}>{renderInline(it)}</li>
            ))}
          </ul>
        );
        return;
      }
    }

    // Numbered list
    if (
      lines.length > 0 &&
      lines.every((l) => l.trim() === "" || /^\s*\d+[.)]\s+/.test(l))
    ) {
      const items = lines
        .filter((l) => l.trim() !== "")
        .map((l) => l.replace(/^\s*\d+[.)]\s+/, ""));
      if (items.length > 0) {
        out.push(
          <ol
            key={bIdx}
            className="my-1 list-decimal space-y-1 pl-5 marker:text-muted-foreground"
          >
            {items.map((it, i) => (
              <li key={i}>{renderInline(it)}</li>
            ))}
          </ol>
        );
        return;
      }
    }

    // Heading
    const hMatch = block.match(/^(#{1,3})\s+(.*)/);
    if (hMatch && lines.length === 1) {
      const level = hMatch[1].length;
      const content = hMatch[2];
      const cls =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
          ? "text-base font-semibold"
          : "text-sm font-semibold";
      out.push(
        <p key={bIdx} className={cls}>
          {renderInline(content)}
        </p>
      );
      return;
    }

    // Paragraph — handle soft line breaks
    const frags: React.ReactNode[] = [];
    lines.forEach((l, i) => {
      if (i > 0) frags.push(<br key={`br-${i}`} />);
      frags.push(...renderInline(l));
    });
    out.push(
      <p key={bIdx} className="leading-relaxed">
        {frags}
      </p>
    );
  });

  return out;
}

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/* ===================== message sub-components ================ */

function useTypewriter(text: string, done: boolean, charsPerTick = 4, tickMs = 14) {
  const [shown, setShown] = useState(0);
  const prevText = useRef("");

  useEffect(() => {
    if (text !== prevText.current) {
      prevText.current = text;
      setShown(0);
    }
  }, [text]);

  useEffect(() => {
    if (done) {
      setShown(text.length);
      return;
    }
    if (!text || shown >= text.length) return;
    const id = setTimeout(() => {
      setShown((s) => Math.min(text.length, s + charsPerTick));
    }, tickMs);
    return () => clearTimeout(id);
  }, [text, shown, done, charsPerTick, tickMs]);

  return shown >= text.length ? text : text.slice(0, shown);
}

function ReasoningSection({
  text,
  streaming,
  done,
}: {
  text: string;
  streaming: boolean;
  done: boolean;
}) {
  const [open, setOpen] = useState(true);
  const displayed = useTypewriter(text, done);
  const fullyRevealed = displayed.length === text.length;

  useEffect(() => {
    if (done && fullyRevealed) setOpen(false);
  }, [done, fullyRevealed]);

  const stillRevealing = !done && (streaming || !fullyRevealed);

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-left"
      >
        <span className="flex size-4 items-center justify-center">
          <span
            className={`size-1.5 rounded-full bg-muted-foreground ${
              stillRevealing ? "animate-pulse" : ""
            }`}
          />
        </span>
        <span
          className={`text-xs font-medium ${
            stillRevealing ? "cot-shimmer" : "text-foreground"
          }`}
        >
          {stillRevealing ? "Thinking…" : "Thoughts"}
        </span>
        <Chevron
          className={`text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open && (
        <div className="ml-[7px] mt-2 border-l pl-4">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {displayed}
            {!fullyRevealed && (
              <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-pulse bg-muted-foreground align-middle" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function ToolCallRow({
  call,
  status,
  resultCount,
}: {
  call: ToolCall;
  status: "running" | "done" | "error";
  resultCount?: number;
}) {
  let icon: React.ReactNode;
  let label: React.ReactNode;
  if (call.name === "search_hotels") {
    icon = <Bed />;
    label = (
      <>
        <span className="font-medium">search_hotels</span>
        <span className="truncate text-muted-foreground">
          {call.args.destination}, {call.args.countryCode}
        </span>
      </>
    );
  } else if (call.name === "get_hotel_details") {
    icon = <SearchIcon />;
    label = (
      <>
        <span className="font-medium">get_hotel_details</span>
        <span className="truncate text-muted-foreground">
          {call.args.hotelId}
        </span>
      </>
    );
  } else if (call.name === "compare_hotels") {
    icon = <Bed />;
    label = (
      <>
        <span className="font-medium">compare_hotels</span>
        <span className="truncate text-muted-foreground">
          {call.args.hotelIds?.length ?? 0} hotels
        </span>
      </>
    );
  } else if (call.name === "get_destination_weather") {
    icon = <SearchIcon />;
    label = (
      <>
        <span className="font-medium">get_weather</span>
        <span className="truncate text-muted-foreground">
          {(call as any).args?.city || ""}
        </span>
      </>
    );
  } else if (call.name === "respond") {
    icon = <MessageSquarePlus />;
    label = (
      <>
        <span className="font-medium">respond</span>
        <span className="truncate text-muted-foreground">direct answer</span>
      </>
    );
  } else {
    icon = <Plane />;
    label = (
      <>
        <span className="font-medium">search_flights</span>
        <span className="truncate text-muted-foreground">
          {call.args.origin} → {call.args.destination} ·{" "}
          {formatDateRange(call.args.departureDate, call.args.returnDate)}
        </span>
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex size-4 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      {label}
      <span className="ml-auto flex items-center gap-1.5">
        {status === "running" && (
          <>
            <Spinner />
            <span className="text-muted-foreground">Working…</span>
          </>
        )}
        {status === "done" && (
          <>
            <Check className="text-green-500" />
            <span className="text-green-600 dark:text-green-400">
              {resultCount ?? 0} results
            </span>
          </>
        )}
        {status === "error" && <span className="text-red-500">Failed</span>}
      </span>
    </div>
  );
}

function HotelCardSkeleton() {
  return (
    <div className="flex h-56 flex-col justify-end overflow-hidden rounded-2xl">
      <div className="skeleton h-full w-full" />
    </div>
  );
}

function FlightCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <div className="skeleton h-4 w-14 rounded" />
              <div className="skeleton h-3 w-10 rounded" />
            </div>
            <div className="skeleton h-px flex-1" />
            <div className="space-y-1">
              <div className="skeleton h-4 w-14 rounded" />
              <div className="skeleton h-3 w-10 rounded" />
            </div>
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="skeleton ml-auto h-5 w-20 rounded" />
          <div className="skeleton ml-auto h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function HotelCard({
  h,
  onOpen,
  onAddChat,
  pinned,
}: {
  h: Hotel;
  onOpen: () => void;
  onAddChat: () => void;
  pinned: boolean;
}) {
  return (
    <article
      className="group relative flex h-56 cursor-pointer flex-col justify-end overflow-hidden rounded-2xl transition hover:shadow-lg"
      onClick={onOpen}
      style={
        h.thumbnail
          ? {
              backgroundImage: `url(${h.thumbnail})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "hsl(var(--muted))" }
      }
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition group-hover:from-black/85" />

      {/* Top-right: Add to chat */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddChat();
        }}
        disabled={pinned}
        aria-label={pinned ? "Pinned to chat" : "Add to chat"}
        className="absolute right-2.5 top-2.5 z-10 flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
      >
        {pinned ? (
          <>
            <Check /> Pinned
          </>
        ) : (
          <>
            <MessageSquarePlus /> Chat
          </>
        )}
      </button>

      {/* Rating badge top-left */}
      {typeof h.rating === "number" && (
        <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          ★ {h.rating.toFixed(1)}
        </span>
      )}

      {/* Bottom text overlay */}
      <div className="relative z-10 p-4">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
              {h.name}
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-white/70">
              {[h.city, h.country].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
          {typeof h.stars === "number" && h.stars > 0 && (
            <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
              {Array.from({ length: Math.round(h.stars) }).map((_, i) => (
                <Star key={i} className="text-amber-300" />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/30"
          >
            View rooms →
          </button>
          {h.reviewCount ? (
            <span className="text-[10px] text-white/50">
              {h.reviewCount.toLocaleString()} reviews
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function formatDuration(min?: number) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function FlightCard({
  f,
  onAdd,
  inCart,
}: {
  f: Flight;
  onAdd: () => void;
  inCart: boolean;
}) {
  return (
    <article className="rounded-xl border bg-card p-4 transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Left — airline + route */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {f.airlineLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.airlineLogo}
                alt={f.airline || f.airlineCode || ""}
                className="h-5 w-5 shrink-0 rounded"
              />
            ) : (
              <Plane className="shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">
              {f.airline || f.airlineCode || "Flight"}
            </span>
            {f.stops != null && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                {f.stops === 0
                  ? "Nonstop"
                  : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="text-center">
              <div className="text-base font-bold tabular-nums leading-tight">
                {formatTime(f.departureTime)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {f.origin || "—"}
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5">
              {f.durationMinutes ? (
                <span className="text-[10px] text-muted-foreground">
                  {formatDuration(f.durationMinutes)}
                </span>
              ) : null}
              <div className="flex w-full items-center gap-0.5">
                <div className="h-px flex-1 bg-border" />
                <Plane className="shrink-0 text-muted-foreground" />
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold tabular-nums leading-tight">
                {formatTime(f.arrivalTime)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {f.destination || "—"}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {f.cabin && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {f.cabin}
              </span>
            )}
            {f.hasCarryOn && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Carry-on
              </span>
            )}
            {f.hasCheckedBag && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Checked bag
              </span>
            )}
            {f.refundable != null &&
              (f.refundable ? (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  Refundable
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  Non-refundable
                </span>
              ))}
            {typeof f.seatsRemaining === "number" && f.seatsRemaining <= 5 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {f.seatsRemaining} left
              </span>
            )}
          </div>
        </div>

        {/* Right — price + add */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums">
              {formatPrice(f.price, f.currency)}
            </div>
            <div className="text-[10px] text-muted-foreground">total</div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={inCart}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {inCart ? (
              <>
                <Check /> In cart
              </>
            ) : (
              <>
                <Plus /> Add to cart
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/* weather helper icons */
function weatherIcon(cloud?: number, precip?: number) {
  if (precip != null && precip > 5) return "🌧";
  if (cloud != null && cloud > 70) return "☁️";
  if (cloud != null && cloud > 30) return "⛅";
  return "☀️";
}

function WeatherStrip({ days }: { days: WeatherDay[] }) {
  if (days.length === 0) return null;
  const fmtDay = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <section className="animate-fade-in-up -mx-4 mt-8 md:-mx-0">
      <div className="px-4 md:px-0">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Weather during your stay
        </h2>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 md:px-0">
        {days.map((d, i) => {
          const icon = weatherIcon(d.cloudCover, d.precipitation);
          return (
            <div
              key={d.date}
              className="animate-fade-in-up flex w-36 shrink-0 flex-col rounded-2xl border bg-card p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="text-[11px] font-medium text-muted-foreground">
                {fmtDay(d.date)}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-3xl leading-none">{icon}</span>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums leading-tight">
                    {typeof d.tempMax === "number"
                      ? `${Math.round(d.tempMax)}°F`
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {typeof d.tempMin === "number"
                      ? `${Math.round(d.tempMin)}°F`
                      : "—"}{" "}
                    low
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                {typeof d.humidity === "number" && (
                  <span className="flex items-center gap-1">
                    💧 {Math.round(d.humidity)}%
                  </span>
                )}
                {typeof d.windSpeed === "number" && (
                  <span className="flex items-center gap-1">
                    💨 {d.windSpeed.toFixed(0)} mph
                  </span>
                )}
              </div>
              {typeof d.precipitation === "number" && d.precipitation > 0 && (
                <div className="mt-1 text-[10px] text-blue-500">
                  {d.precipitation.toFixed(1)}″ precip
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComparisonTable({ rows }: { rows: CompareRow[] }) {
  const valid = rows.filter((r) => !r.error);
  if (valid.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
        Couldn't load the hotels to compare.
      </div>
    );
  }

  type Field = { label: string; render: (r: CompareRow) => React.ReactNode };
  const fields: Field[] = [
    {
      label: "Stars",
      render: (r) =>
        typeof r.stars === "number" && r.stars > 0 ? (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.round(r.stars) }).map((_, i) => (
              <Star key={i} className="text-amber-400" />
            ))}
          </div>
        ) : (
          "—"
        ),
    },
    {
      label: "Guest rating",
      render: (r) =>
        typeof r.rating === "number" ? (
          <div>
            <div className="text-sm font-semibold">★ {r.rating.toFixed(1)}</div>
            {r.reviewCount ? (
              <div className="text-[10px] text-muted-foreground">
                {r.reviewCount.toLocaleString()} reviews
              </div>
            ) : null}
          </div>
        ) : (
          "—"
        ),
    },
    {
      label: "Location",
      render: (r) =>
        [r.address, r.city, r.country].filter(Boolean).join(", ") || "—",
    },
    { label: "Type", render: (r) => r.hotelType || "—" },
    {
      label: "Top amenities",
      render: (r) =>
        r.topFacilities.length > 0 ? (
          <ul className="space-y-0.5">
            {r.topFacilities.slice(0, 5).map((f, i) => (
              <li key={i} className="flex gap-1.5">
                <Check className="mt-0.5 shrink-0 text-muted-foreground" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
    {
      label: "Guests love",
      render: (r) =>
        r.pros.length > 0 ? (
          <ul className="space-y-0.5">
            {r.pros.map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-0.5 shrink-0 text-green-500">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
    {
      label: "Considerations",
      render: (r) =>
        r.cons.length > 0 ? (
          <ul className="space-y-0.5">
            {r.cons.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-0.5 shrink-0 text-amber-500">!</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
    {
      label: "Policies",
      render: (r) => (
        <div className="space-y-0.5 text-[11px]">
          <div>Children: {r.childAllowed ? "welcome" : "n/a"}</div>
          <div>Pets: {r.petsAllowed ? "welcome" : "not allowed"}</div>
        </div>
      ),
    },
  ];

  const colWidth = 220;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b">
            <th className="sticky left-0 z-10 w-32 bg-card p-3 text-left align-bottom text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Hotel
            </th>
            {valid.map((r) => (
              <th
                key={r.id}
                className="border-l p-3 text-left align-bottom"
                style={{ width: colWidth, minWidth: colWidth }}
              >
                {r.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.thumbnail}
                    alt={r.name}
                    className="mb-2 h-24 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="line-clamp-2 text-sm font-semibold">
                  {r.name}
                </div>
                <div className="line-clamp-1 text-[11px] text-muted-foreground">
                  {[r.city, r.country].filter(Boolean).join(", ")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.label} className="border-t">
              <td className="sticky left-0 z-10 w-32 bg-card p-3 align-top text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {field.label}
              </td>
              {valid.map((r) => (
                <td
                  key={r.id}
                  className="border-l p-3 align-top leading-relaxed"
                  style={{ width: colWidth, minWidth: colWidth }}
                >
                  {field.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssistantMessageView({
  msg,
  cart,
  pinnedIds,
  onAddHotelChat,
  onAddFlight,
  onOpenHotel,
}: {
  msg: AssistantMessage;
  cart: CartItem[];
  pinnedIds: Set<string>;
  onAddHotelChat: (h: Hotel) => void;
  onAddFlight: (f: Flight) => void;
  onOpenHotel: (h: Hotel) => void;
}) {
  const streaming = msg.status === "streaming";
  const toolStatus: "running" | "done" | "error" = msg.error
    ? "error"
    : msg.toolResult
    ? "done"
    : "running";

  const cartIds = useMemo(() => new Set(cart.map((c) => c.id)), [cart]);
  const count =
    msg.toolResult?.hotels?.length ?? msg.toolResult?.flights?.length ?? 0;

  return (
    <div className="animate-fade-in-up space-y-4">
      {msg.reasoning && (
        <ReasoningSection
          text={msg.reasoning}
          streaming={streaming && !msg.toolResult}
          done={msg.status === "done"}
        />
      )}

      {msg.toolCall && (
        <ToolCallRow
          call={msg.toolCall}
          status={toolStatus}
          resultCount={count}
        />
      )}

      {msg.toolCall &&
        !msg.toolResult &&
        !msg.error &&
        msg.toolCall.name === "search_hotels" && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <HotelCardSkeleton />
              </div>
            ))}
          </div>
        )}

      {msg.toolCall &&
        !msg.toolResult &&
        !msg.error &&
        msg.toolCall.name === "compare_hotels" && (
          <div className="animate-fade-in-up skeleton h-56 rounded-xl" />
        )}

      {msg.toolCall &&
        !msg.toolResult &&
        !msg.error &&
        msg.toolCall.name === "search_flights" && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <FlightCardSkeleton />
              </div>
            ))}
          </div>
        )}

      {msg.toolResult?.weather && msg.toolResult.weather.days.length > 0 && (
        <div className="animate-fade-in-up">
          <WeatherStrip days={msg.toolResult.weather.days} />
        </div>
      )}

      {msg.toolResult?.comparison && msg.toolResult.comparison.length > 0 && (
        <div className="animate-fade-in-up">
          <ComparisonTable rows={msg.toolResult.comparison} />
        </div>
      )}

      {msg.toolResult?.hotels && msg.toolResult.hotels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {msg.toolResult.hotels.map((h, i) => (
            <div
              key={h.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <HotelCard
                h={h}
                onOpen={() => onOpenHotel(h)}
                onAddChat={() => onAddHotelChat(h)}
                pinned={pinnedIds.has(h.id)}
              />
            </div>
          ))}
        </div>
      )}

      {msg.toolResult?.flights && msg.toolResult.flights.length > 0 && (
        <div className="space-y-3">
          {msg.toolResult.flights.map((f, i) => (
            <div
              key={f.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <FlightCard
                f={f}
                onAdd={() => onAddFlight(f)}
                inCart={cartIds.has(f.id)}
              />
            </div>
          ))}
        </div>
      )}

      {msg.images && msg.images.length > 0 && (
        <div className="no-scrollbar -mx-1 flex animate-fade-in-up gap-2 overflow-x-auto px-1 pb-1">
          {msg.images.map((img, i) => (
            <div
              key={i}
              className="animate-fade-in-up relative shrink-0 overflow-hidden rounded-xl"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.hotelName}
                className="h-36 w-48 object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
                <span className="line-clamp-1 text-[10px] font-medium text-white">
                  {img.hotelName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg.message && (
        <div className="animate-fade-in space-y-3 text-sm leading-relaxed text-foreground [&>h1]:mt-4 [&>h1]:text-lg [&>h2]:mt-3 [&>h2]:text-base [&>p]:mt-1 [&>ul]:mt-1 [&>ol]:mt-1">
          {renderMarkdown(msg.message)}
        </div>
      )}

      {msg.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {msg.error}
        </div>
      )}

      {streaming && !msg.reasoning && !msg.toolCall && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner />
          <span className="animate-pulse">Thinking…</span>
        </div>
      )}
    </div>
  );
}

/* ============================= sheets ========================= */

function Sheet({
  open,
  onClose,
  side,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`absolute top-0 ${
          side === "right" ? "right-0 animate-slide-in-right" : "left-0 animate-slide-in-left"
        } flex h-full w-full max-w-md flex-col border bg-background shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type HotelDetailsFull = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  zip?: string;
  phone?: string;
  email?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
  mainPhoto?: string;
  thumbnail?: string;
  latitude?: number;
  longitude?: number;
  hotelType?: string;
  airportCode?: string;
  importantInformation?: string;
  childAllowed?: boolean;
  petsAllowed?: boolean;
  checkin?: string;
  checkinEnd?: string;
  checkout?: string;
  facilities: { id?: number; name: string }[];
  images: { url: string; caption?: string }[];
  pros: string[];
  cons: string[];
};

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

type DetailPayload = {
  hotel: HotelDetailsFull;
  rooms: Room[];
  ratesError: string | null;
  weather: WeatherDay[];
  search: { checkin: string; checkout: string; adults: number; currency: string };
};

function HotelDetailModal({
  hotel,
  onClose,
  onAddRoom,
  onAddChat,
  pinned,
  cartRoomIds,
}: {
  hotel: Hotel | null;
  onClose: () => void;
  onAddRoom: (
    hotelId: string,
    hotelName: string,
    hotelThumbnail: string | undefined,
    room: Room
  ) => void;
  onAddChat: (h: Hotel) => void;
  pinned: boolean;
  cartRoomIds: Set<string>;
}) {
  const [details, setDetails] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!hotel) {
      setDetails(null);
      setError(null);
      setActiveImage(0);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [hotel, onClose]);

  useEffect(() => {
    if (!hotel) return;
    setDetails(null);
    setError(null);
    setActiveImage(0);
    setPaused(false);
    setLoading(true);
    const ac = new AbortController();
    fetch(`/api/hotel?id=${encodeURIComponent(hotel.id)}`, { signal: ac.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load");
        setDetails(json);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [hotel?.id]);

  const totalImages = details?.hotel.images.length ?? 0;

  // Auto-cycle gallery every 4.5s; pause when user clicks a thumbnail.
  useEffect(() => {
    if (paused || totalImages <= 1) return;
    const id = setInterval(() => {
      setActiveImage((i) => (i + 1) % totalImages);
    }, 4500);
    return () => clearInterval(id);
  }, [paused, totalImages]);

  // Resume auto-cycle 10s after a manual pause.
  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => setPaused(false), 10000);
    return () => clearTimeout(t);
  }, [paused]);

  if (!hotel) return null;

  const h: HotelDetailsFull =
    details?.hotel || {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city,
      country: hotel.country,
      stars: hotel.stars,
      rating: hotel.rating,
      reviewCount: hotel.reviewCount,
      mainPhoto: hotel.mainPhoto || hotel.thumbnail,
      thumbnail: hotel.thumbnail,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      facilities: [],
      images: hotel.mainPhoto ? [{ url: hotel.mainPhoto }] : [],
      pros: [],
      cons: [],
    };

  const loc = [h.address, h.city, h.country].filter(Boolean).join(", ");
  const heroImage = h.images[activeImage]?.url || h.mainPhoto;

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-in-bottom flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{h.name}</div>
          {loc && (
            <div className="truncate text-xs text-muted-foreground">{loc}</div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Hero image with in-image counter */}
        <div className="relative">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={heroImage}
              src={heroImage}
              alt={h.name}
              className="h-[40vh] max-h-[520px] w-full animate-fade-in object-cover"
            />
          ) : (
            <div className="flex h-[30vh] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              {loading ? (
                <div className="skeleton h-full w-full" />
              ) : (
                "No image available"
              )}
            </div>
          )}
          {h.images.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              {activeImage + 1} / {h.images.length}
            </span>
          )}
        </div>

        {/* Image gallery strip */}
        {h.images.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-3">
            {h.images.slice(0, 12).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setActiveImage(i);
                  setPaused(true);
                }}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition ${
                  i === activeImage
                    ? "ring-2 ring-foreground"
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || `Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* Title block */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{h.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{loc || "—"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {typeof h.stars === "number" && h.stars > 0 && (
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: Math.round(h.stars) }).map((_, i) => (
                      <Star key={i} className="text-amber-400" />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {h.stars}-star
                    </span>
                  </span>
                )}
                {typeof h.rating === "number" && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    ★ {h.rating.toFixed(1)}
                    {h.reviewCount ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({h.reviewCount.toLocaleString()})
                      </span>
                    ) : null}
                  </span>
                )}
                {h.hotelType && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {h.hotelType}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && !details && (
            <div className="mt-8 space-y-6">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="space-y-2">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-11/12 rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="skeleton h-20 rounded-xl" />
                <div className="skeleton h-20 rounded-xl" />
              </div>
              <div className="skeleton h-4 w-20 rounded" />
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-24 rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Pros / Cons */}
          {(h.pros.length > 0 || h.cons.length > 0) && (
            <section className="mt-8 animate-fade-in-up grid gap-4 sm:grid-cols-2">
              {h.pros.length > 0 && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                    What guests love
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {h.pros.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 shrink-0 text-green-500" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {h.cons.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Guest considerations
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {h.cons.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Description */}
          {h.description && (
            <section className="mt-8 animate-fade-in-up">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                About
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {h.description}
              </p>
            </section>
          )}

          {/* Rooms + pricing */}
          <section className="mt-10 animate-fade-in-up">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Rooms
              </h2>
              {details?.search && (
                <span className="text-xs text-muted-foreground">
                  {formatDateRange(details.search.checkin, details.search.checkout)}
                  {" · "}
                  {details.search.adults}{" "}
                  {details.search.adults === 1 ? "adult" : "adults"}
                </span>
              )}
            </div>

            {loading && !details && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="skeleton h-28 rounded-xl"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}

            {details && details.rooms.length === 0 && !details.ratesError && (
              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                No rooms available for these dates.
              </div>
            )}

            {details && details.ratesError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
                Couldn't load live rates: {details.ratesError}
              </div>
            )}

            {details && details.rooms.length > 0 && (
              <div className="space-y-3">
                {details.rooms.map((r, i) => {
                  const cartId = `${h.id}::${r.offerId || r.name}`;
                  return (
                    <RoomRow
                      key={r.offerId || `${r.name}-${i}`}
                      room={r}
                      index={i}
                      inCart={cartRoomIds.has(cartId)}
                      onAdd={() =>
                        onAddRoom(h.id, h.name, h.thumbnail || h.mainPhoto, r)
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Weather forecast */}
          {details?.weather && details.weather.length > 0 && (
            <WeatherStrip days={details.weather} />
          )}

          {/* Amenities */}
          {h.facilities.length > 0 && (
            <section className="mt-10 animate-fade-in-up">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Amenities ({h.facilities.length})
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {h.facilities.slice(0, 30).map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-foreground/80"
                  >
                    <Check className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
              </div>
              {h.facilities.length > 30 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  + {h.facilities.length - 30} more
                </div>
              )}
            </section>
          )}

          {/* Check-in / check-out + important info */}
          {(h.checkin || h.checkout || h.importantInformation) && (
            <section className="mt-10 animate-fade-in-up grid gap-4 sm:grid-cols-2">
              {(h.checkin || h.checkout) && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hours & policies
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {h.checkin && (
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Check-in
                        </div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">
                          {h.checkin}
                        </div>
                        {h.checkinEnd && (
                          <div className="text-[11px] text-muted-foreground">
                            until {h.checkinEnd}
                          </div>
                        )}
                      </div>
                    )}
                    {h.checkout && (
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Check-out
                        </div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">
                          {h.checkout}
                        </div>
                      </div>
                    )}
                  </div>
                  {(h.childAllowed != null || h.petsAllowed != null) && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3">
                      {h.childAllowed != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            h.childAllowed
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Children {h.childAllowed ? "welcome" : "not allowed"}
                        </span>
                      )}
                      {h.petsAllowed != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            h.petsAllowed
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Pets {h.petsAllowed ? "welcome" : "not allowed"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {h.importantInformation && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Good to know
                  </div>
                  <div className="mt-3 space-y-2 text-xs leading-relaxed text-foreground/90 [&>p]:leading-relaxed">
                    {renderMarkdown(h.importantInformation)}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Location + embedded map */}
          {typeof h.latitude === "number" && typeof h.longitude === "number" && (
            <section className="mt-10 animate-fade-in-up">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Location
                </h2>
                <a
                  className="text-xs text-muted-foreground hover:text-foreground"
                  href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps →
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border bg-card">
                <iframe
                  key={`${h.latitude},${h.longitude}`}
                  title={`Map of ${h.name}`}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    h.longitude - 0.008
                  }%2C${h.latitude - 0.004}%2C${h.longitude + 0.008}%2C${
                    h.latitude + 0.004
                  }&layer=mapnik&marker=${h.latitude}%2C${h.longitude}`}
                />
                <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="truncate">{loc || "—"}</span>
                  {h.airportCode && (
                    <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5">
                      {h.airportCode}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent pb-4 pt-10">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4">
          {(() => {
            const wlUrl = buildHotelWLUrl(
              h.id,
              details?.search?.checkin,
              details?.search?.checkout,
              details?.search?.adults
            );
            return wlUrl ? (
              <a
                href={wlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-medium transition hover:bg-muted"
              >
                View on booking site →
              </a>
            ) : null;
          })()}
          <button
            type="button"
            onClick={() => onAddChat(hotel)}
            disabled={pinned}
            className="flex flex-[1.2] items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition hover:opacity-90 disabled:opacity-50"
          >
            {pinned ? (
              <>
                <Check /> Pinned to chat
              </>
            ) : (
              <>
                <MessageSquarePlus /> Ask about this hotel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const WL_DOMAIN = process.env.NEXT_PUBLIC_WL_DOMAIN || "";

function buildBookingUrl(offerId: string, currency = "USD") {
  if (!WL_DOMAIN) return null;
  const url = new URL(`https://${WL_DOMAIN}/booking`);
  url.searchParams.set("offerId", offerId);
  url.searchParams.set("currency", currency);
  url.searchParams.set("language", "en");
  const p = loadLS<UserProfile | null>(LS_PROFILE, null);
  if (p?.email) {
    url.searchParams.set("clientReference", p.email);
  }
  return url.toString();
}

function buildHotelWLUrl(
  hotelId: string,
  checkin?: string,
  checkout?: string,
  adults = 2
) {
  if (!WL_DOMAIN) return null;
  const url = new URL(`https://${WL_DOMAIN}/hotels/${hotelId}`);
  if (checkin) url.searchParams.set("checkin", checkin);
  if (checkout) url.searchParams.set("checkout", checkout);
  try {
    url.searchParams.set(
      "occupancies",
      btoa(JSON.stringify([{ adults, children: [] }]))
    );
  } catch {}
  return url.toString();
}

function RoomRow({
  room,
  index,
  inCart,
  onAdd,
}: {
  room: Room;
  index: number;
  inCart: boolean;
  onAdd: () => void;
}) {
  const savings =
    room.suggestedPrice && room.price
      ? Math.round(
          ((room.suggestedPrice - room.price) / room.suggestedPrice) * 100
        )
      : 0;

  return (
    <article
      className="animate-fade-in-up rounded-xl border bg-card p-4 transition hover:shadow-md"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{room.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {room.bedTypes && <span>{room.bedTypes}</span>}
            {typeof room.sizeSqm === "number" && room.sizeSqm > 0 && (
              <span>{room.sizeSqm} m²</span>
            )}
            {typeof room.maxOccupancy === "number" && (
              <span>Sleeps {room.maxOccupancy}</span>
            )}
            {room.boardName && <span>{room.boardName}</span>}
          </div>
          {room.description && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {room.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            {room.refundable != null &&
              (room.refundable ? (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-600 dark:text-green-400">
                  Refundable
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                  Non-refundable
                </span>
              ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            {room.suggestedPrice && savings > 0 && (
              <div className="text-xs text-muted-foreground line-through">
                {formatPrice(room.suggestedPrice, room.currency)}
              </div>
            )}
            <div className="text-lg font-semibold">
              {formatPrice(room.price, room.currency)}
            </div>
            {savings > 0 && (
              <div className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                Save {savings}%
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">total</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              disabled={inCart}
              className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
            >
              {inCart ? (
                <>
                  <Check className="text-green-500" /> Saved
                </>
              ) : (
                <>
                  <Plus /> Save
                </>
              )}
            </button>
            {room.offerId && buildBookingUrl(room.offerId, room.currency) ? (
              <a
                href={buildBookingUrl(room.offerId, room.currency)!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                Book now →
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  alert(
                    room.offerId
                      ? "Set NEXT_PUBLIC_WL_DOMAIN to enable booking via white-label checkout."
                      : "No offer ID available for this room."
                  )
                }
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                Book now →
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ProfileModal({
  open,
  onClose,
  profile,
  onSave,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (p: UserProfile) => void;
  onSignOut: () => void;
}) {
  const [first, setFirst] = useState(profile?.firstName || "");
  const [last, setLast] = useState(profile?.lastName || "");
  const [loyalty, setLoyalty] = useState<any>(null);
  const [email, setEmail] = useState(profile?.email || "");

  useEffect(() => {
    if (open) {
      setFirst(profile?.firstName || "");
      setLast(profile?.lastName || "");
      setEmail(profile?.email || "");
      if (profile?.email) {
        fetch(`/api/loyalty?email=${encodeURIComponent(profile.email)}`)
          .then((r) => r.json())
          .then((d) => setLoyalty(d))
          .catch(() => {});
      }
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const canSave =
    first.trim().length > 0 &&
    last.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-in-bottom flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <X />
        </button>
        <span className="text-sm font-semibold">
          {profile ? "Your profile" : "Sign in"}
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <User className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">
            {profile
              ? `${profile.firstName} ${profile.lastName}`
              : "Create your profile"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {profile
              ? "Your info is used to pre-fill hotel bookings."
              : "Your name and email will pre-fill checkout when you book a hotel."}
          </p>
          {profile && loyalty?.program?.enabled && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Star className="text-amber-400" />
              {loyalty.points?.available != null
                ? `${loyalty.points.available.toLocaleString()} points`
                : "Loyalty member"}
              {loyalty.program.cashbackRate > 0 && (
                <span className="text-[10px] font-normal text-amber-500/70">
                  · {Math.round(loyalty.program.cashbackRate * 100)}% cashback
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                First name
              </label>
              <input
                type="text"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="John"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Last name
              </label>
              <input
                type="text"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              onSave({
                firstName: first.trim(),
                lastName: last.trim(),
                email: email.trim(),
              });
              onClose();
            }}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition hover:opacity-90 disabled:opacity-40"
          >
            {profile ? "Update profile" : "Save profile"}
          </button>
          {profile && (
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="w-full rounded-2xl border py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              Sign out
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          Stored locally in your browser. No account created.
        </p>
      </div>
    </div>
  );
}

type BookingRecord = {
  bookingId: string;
  status: string;
  hotelName?: string;
  hotelConfirmationCode?: string;
  checkin?: string;
  checkout?: string;
  currency?: string;
  totalPrice?: number;
  guestName?: string;
  email?: string;
  createdAt?: string;
};

function TripModal({
  open,
  onClose,
  cart,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const hotels = cart.filter((c) => c.kind === "hotel") as CartHotelItem[];
  const rooms = cart.filter((c) => c.kind === "room") as CartRoomItem[];
  const flights = cart.filter((c) => c.kind === "flight") as CartFlightItem[];
  const total = [...rooms, ...flights].reduce((sum, c) => {
    if (c.kind === "room") return sum + c.price;
    if (c.kind === "flight" && typeof c.flight.price === "number")
      return sum + c.flight.price;
    return sum;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-in-bottom flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <X />
        </button>
        <div className="flex-1">
          <span className="text-sm font-semibold">My Trip</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {cart.length} {cart.length === 1 ? "item" : "items"}
          </span>
        </div>
        {total > 0 && (
          <div className="text-sm font-semibold">{formatPrice(total, "USD")}</div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Plane className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">
              Your trip is empty. Search for hotels and flights to build your
              itinerary.
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-6">
            {/* Flights section */}
            {flights.length > 0 && (
              <section className="mb-8 animate-fade-in-up">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Plane /> Flights ({flights.length})
                </h2>
                <div className="space-y-3">
                  {flights.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">
                          {item.flight.origin} → {item.flight.destination}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.flight.airline || item.flight.airlineCode || "Flight"}
                          {item.flight.departureTime &&
                            ` · ${formatTime(item.flight.departureTime)}`}
                        </div>
                        {typeof item.flight.price === "number" && (
                          <div className="mt-1 text-sm font-semibold">
                            {formatPrice(item.flight.price, item.flight.currency)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Hotels section */}
            {hotels.length > 0 && (
              <section className="mb-8 animate-fade-in-up">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bed /> Hotels ({hotels.length})
                </h2>
                <div className="space-y-3">
                  {hotels.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4"
                    >
                      {item.hotel.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.hotel.thumbnail}
                          alt={item.hotel.name}
                          className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {item.hotel.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.hotel.city}, {item.hotel.country}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Rooms section */}
            {rooms.length > 0 && (
              <section className="mb-8 animate-fade-in-up">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bed /> Rooms ({rooms.length})
                </h2>
                <div className="space-y-3">
                  {rooms.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-4"
                    >
                      {item.hotelThumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.hotelThumbnail}
                          alt={item.hotelName}
                          className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {item.hotelName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.roomName}
                          {item.boardName ? ` · ${item.boardName}` : ""}
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatPrice(item.price, item.currency)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trip summary */}
            {total > 0 && (
              <section className="animate-fade-in-up rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Estimated total
                  </span>
                  <span className="text-xl font-bold">
                    {formatPrice(total, "USD")}
                  </span>
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground">
                  Book each item individually using the "Book now" buttons in
                  hotel details. Prices are estimates and may change.
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingsModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile?.email) return;
    setLoading(true);
    setError(null);
    fetch(
      `/api/bookings?clientReference=${encodeURIComponent(profile.email)}`
    )
      .then(async (r) => {
        const json = await r.json();
        if (json.error) setError(json.error);
        setBookings(json.bookings || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, profile?.email]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const manageUrl = (b: BookingRecord) => {
    if (!WL_DOMAIN || !b.bookingId) return null;
    const url = new URL(
      `https://${WL_DOMAIN}/manage-bookings/${b.bookingId}`
    );
    if (b.email) url.searchParams.set("email", b.email);
    return url.toString();
  };

  const statusColor = (s: string) => {
    if (/confirm|active/i.test(s))
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    if (/cancel/i.test(s))
      return "bg-red-500/10 text-red-500";
    if (/pending/i.test(s))
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-in-bottom flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <X />
        </button>
        <span className="text-sm font-semibold">My Bookings</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!profile && (
          <div className="p-16 text-center text-sm text-muted-foreground">
            Sign in to see your bookings.
          </div>
        )}

        {profile && loading && (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton h-24 rounded-xl"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}

        {profile && !loading && error && (
          <div className="p-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          </div>
        )}

        {profile && !loading && !error && bookings.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Bed className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">
              No bookings found for {profile.email}
            </div>
            <div className="text-xs text-muted-foreground">
              Bookings made via the "Book now" button will appear here.
            </div>
          </div>
        )}

        {profile && !loading && bookings.length > 0 && (
          <ul className="mx-auto max-w-2xl divide-y">
            {bookings.map((b, i) => {
              const link = manageUrl(b);
              return (
                <li
                  key={b.bookingId || i}
                  className="animate-fade-in-up p-4"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">
                          {b.hotelName || `Booking ${b.bookingId}`}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {b.checkin && b.checkout && (
                          <span>
                            {formatDateRange(b.checkin, b.checkout)}
                          </span>
                        )}
                        {b.guestName && <span>{b.guestName}</span>}
                        {b.hotelConfirmationCode && (
                          <span className="font-mono">
                            #{b.hotelConfirmationCode}
                          </span>
                        )}
                      </div>
                      {typeof b.totalPrice === "number" && (
                        <div className="mt-1 text-sm font-semibold">
                          {formatPrice(b.totalPrice, b.currency)}
                        </div>
                      )}
                    </div>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                      >
                        Manage →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CartModal({
  open,
  onClose,
  cart,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemove: (id: string) => void;
}) {
  const total = cart.reduce((sum, c) => {
    if (c.kind === "flight" && typeof c.flight.price === "number")
      return sum + c.flight.price;
    if (c.kind === "room") return sum + c.price;
    return sum;
  }, 0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-in-bottom flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X />
        </button>
        <div className="flex-1">
          <span className="text-sm font-semibold">Cart</span>
          {cart.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {cart.length} {cart.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="text-sm font-semibold">
            {formatPrice(total, "USD")}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-28">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">
              Your cart is empty. Add rooms or flights from search results.
            </div>
          </div>
        ) : (
          <ul className="mx-auto max-w-2xl divide-y">
            {cart.map((item, i) => (
              <li
                key={item.id}
                className="animate-fade-in-up flex gap-4 p-4"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {item.kind === "hotel" ? (
                  <>
                    {item.hotel.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.hotel.thumbnail}
                        alt={item.hotel.name}
                        className="h-20 w-28 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Bed /> Hotel
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {item.hotel.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.hotel.city}, {item.hotel.country}
                      </div>
                    </div>
                  </>
                ) : item.kind === "room" ? (
                  <>
                    {item.hotelThumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.hotelThumbnail}
                        alt={item.hotelName}
                        className="h-20 w-28 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Bed />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Bed /> Room
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {item.hotelName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.roomName}
                        {item.boardName ? ` · ${item.boardName}` : ""}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatPrice(item.price, item.currency)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Plane />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Plane /> Flight
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {item.flight.origin} → {item.flight.destination}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatPrice(item.flight.price, item.flight.currency)}
                      </div>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Remove"
                >
                  <X />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent pb-4 pt-10">
          <div className="mx-auto max-w-2xl px-4">
            {total > 0 && (
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold">
                  {formatPrice(total, "USD")}
                </span>
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition hover:opacity-90"
              onClick={() =>
                alert(
                  "Checkout is a demo — wire up LiteAPI prebook/book next."
                )
              }
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistorySheet({
  open,
  onClose,
  chats,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  chats: Chat[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} side="left" title="Conversations">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2.5 text-sm font-medium hover:bg-muted"
        >
          <Plus /> New chat
        </button>
      </div>
      {chats.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No conversations yet.
        </div>
      ) : (
        <ul className="divide-y">
          {chats.map((c) => (
            <li
              key={c.id}
              className={`group flex items-center gap-2 px-4 py-3 hover:bg-muted ${
                c.id === currentId ? "bg-muted" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm">{c.title || "New chat"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleString()}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this chat?")) onDelete(c.id);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
                aria-label="Delete"
              >
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/* ============================ input ========================== */

type InputCardProps = {
  query: string;
  setQuery: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  loading: boolean;
  autosize: (el: HTMLTextAreaElement) => void;
  placeholder?: string;
  mode: "research" | "booking";
  onToggleMode: () => void;
};

const InputCard = forwardRef<HTMLTextAreaElement, InputCardProps>(
  function InputCard(
    { query, setQuery, onKeyDown, loading, autosize, placeholder, mode, onToggleMode },
    ref
  ) {
    return (
      <div className="group relative rounded-3xl border bg-card shadow-sm transition focus-within:border-foreground/40 focus-within:shadow-md">
        <textarea
          ref={ref}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            autosize(e.currentTarget);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder || "Ask for hotels, flights, or a whole trip…"}
          rows={1}
          className="block w-full resize-none rounded-3xl bg-transparent px-5 pb-12 pt-4 pr-14 text-[15px] leading-6 placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="absolute bottom-2.5 left-3 right-14 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMode}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              mode === "research"
                ? "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <SearchIcon />
            {mode === "research" ? "Research" : "Research"}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          aria-label="Send"
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Spinner /> : <ArrowUp />}
        </button>
      </div>
    );
  }
);

function CyclingSuggestion({
  items,
  onSelect,
}: {
  items: string[];
  onSelect: (s: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(cycle);
  }, [items.length]);

  return (
    <button
      type="button"
      onClick={() => onSelect(items[index])}
      className="group mt-4 flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <span className="text-xs">Try:</span>
      <span
        className={`transition-all duration-300 ${
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
      >
        &ldquo;{items[index]}&rdquo;
      </span>
      <span className="text-xs opacity-0 transition group-hover:opacity-100">
        →
      </span>
    </button>
  );
}

function PinnedChips({
  pinned,
  onUnpin,
}: {
  pinned: Hotel[];
  onUnpin: (id: string) => void;
}) {
  if (pinned.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Pin /> Pinned
      </span>
      {pinned.map((h) => (
        <span
          key={h.id}
          className="flex animate-scale-in items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-xs"
        >
          <span className="max-w-[180px] truncate">{h.name}</span>
          {h.city && (
            <span className="text-muted-foreground">· {h.city}</span>
          )}
          <button
            type="button"
            onClick={() => onUnpin(h.id)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Unpin ${h.name}`}
          >
            <X />
          </button>
        </span>
      ))}
    </div>
  );
}

/* ============================== page ========================== */

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pinned, setPinned] = useState<Hotel[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"research" | "booking">("booking");
  const [cartOpen, setCartOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailHotel, setDetailHotel] = useState<Hotel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // hydrate from localStorage on mount
  useEffect(() => {
    setChats(loadLS<Chat[]>(LS_CHATS, []));
    setCurrentId(loadLS<string | null>(LS_CURRENT, null));
    setCart(loadLS<CartItem[]>(LS_CART, []));
    setPinned(loadLS<Hotel[]>(LS_PINNED, []));
    setProfile(loadLS<UserProfile | null>(LS_PROFILE, null));
  }, []);

  useEffect(() => {
    saveLS(LS_CHATS, chats);
  }, [chats]);
  useEffect(() => {
    saveLS(LS_CURRENT, currentId);
  }, [currentId]);
  useEffect(() => {
    saveLS(LS_CART, cart);
  }, [cart]);
  useEffect(() => {
    saveLS(LS_PINNED, pinned);
  }, [pinned]);
  useEffect(() => {
    saveLS(LS_PROFILE, profile);
  }, [profile]);

  const pinnedIds = useMemo(
    () => new Set(pinned.map((h) => h.id)),
    [pinned]
  );

  function pinHotel(h: Hotel) {
    setPinned((prev) => (prev.some((p) => p.id === h.id) ? prev : [...prev, h]));
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function unpinHotel(id: string) {
    setPinned((prev) => prev.filter((h) => h.id !== id));
  }

  function askAboutHotel(h: Hotel) {
    setPinned((prev) =>
      prev.some((p) => p.id === h.id) ? prev : [...prev, h]
    );
    setDetailHotel(null);
    runChat(
      `Give me a detailed rundown of ${h.name}. Structure the answer with a short headline, then bullets for: **Vibe**, **Best for**, **Standout features**, and **Things to note**. Use concrete facts from the pinned context.`,
      [h]
    );
  }

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentId) || null,
    [chats, currentId]
  );
  const messages = currentChat?.messages ?? [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  function updateCurrent(mutator: (m: Message[]) => Message[]) {
    setChats((prev) => {
      const next = [...prev];
      const idx = next.findIndex((c) => c.id === currentId);
      if (idx === -1) return prev;
      next[idx] = {
        ...next[idx],
        messages: mutator(next[idx].messages),
        updatedAt: Date.now(),
      };
      return next;
    });
  }

  function startNewChat(): string {
    const id = uid();
    const chat: Chat = {
      id,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setChats((prev) => [chat, ...prev]);
    setCurrentId(id);
    return id;
  }

  function deleteChat(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentId === id) setCurrentId(null);
  }

  async function runChat(content: string, extraPinned: Hotel[] = []) {
    if (!content.trim() || loading) return;

    let chatId = currentId;
    if (!chatId) chatId = startNewChat();

    const userMsg: UserMessage = {
      id: uid(),
      role: "user",
      content: content.trim(),
    };
    const assistantMsg: AssistantMessage = {
      id: uid(),
      role: "assistant",
      status: "streaming",
    };

    setChats((prev) => {
      const next = [...prev];
      const idx = next.findIndex((c) => c.id === chatId);
      if (idx === -1) return prev;
      const chat = next[idx];
      next[idx] = {
        ...chat,
        title:
          chat.messages.length === 0
            ? content.trim().slice(0, 60)
            : chat.title,
        messages: [...chat.messages, userMsg, assistantMsg],
        updatedAt: Date.now(),
      };
      return next;
    });
    setQuery("");
    setLoading(true);

    const history: ApiMessage[] = [...messages, userMsg].map((m) =>
      m.role === "user"
        ? { role: "user", content: m.content }
        : {
            role: "assistant",
            content:
              (m as AssistantMessage).message ??
              (m as AssistantMessage).reasoning ??
              "",
          }
    );

    const patch = (fn: (a: AssistantMessage) => AssistantMessage) => {
      setChats((prev) => {
        const next = [...prev];
        const idx = next.findIndex((c) => c.id === chatId);
        if (idx === -1) return prev;
        next[idx] = {
          ...next[idx],
          messages: next[idx].messages.map((m) =>
            m.id === assistantMsg.id && m.role === "assistant" ? fn(m) : m
          ),
          updatedAt: Date.now(),
        };
        return next;
      });
    };

    try {
      const seen = new Set<string>();
      const pinnedPayload = [...pinned, ...extraPinned]
        .filter((h) => {
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        })
        .map((h) => ({
          id: h.id,
          name: h.name,
          city: h.city,
          country: h.country,
          stars: h.stars,
          rating: h.rating,
          reviewCount: h.reviewCount,
          description: h.description?.slice(0, 400),
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, pinned: pinnedPayload, mode }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          switch (evt.type) {
            case "reasoning":
              patch((a) => ({ ...a, reasoning: evt.text }));
              break;
            case "tool_call":
              patch((a) => ({
                ...a,
                toolCall: { name: evt.name, args: evt.args } as ToolCall,
              }));
              break;
            case "tool_result": {
              const name = evt.name as ToolCall["name"];
              const result = evt.result;
              patch((a) => ({
                ...a,
                toolResult:
                  name === "search_hotels"
                    ? { hotels: result }
                    : name === "get_hotel_details"
                    ? { hotel: result, hotels: [result] }
                    : name === "compare_hotels"
                    ? { comparison: result }
                    : name === "search_flights"
                    ? { flights: result }
                    : name === "get_destination_weather"
                    ? { weather: { city: result?.city, days: result?.days || [] } }
                    : {},
              }));
              break;
            }
            case "images":
              patch((a) => ({ ...a, images: evt.images }));
              break;
            case "message":
              patch((a) => ({ ...a, message: evt.text }));
              break;
            case "done":
              patch((a) => ({ ...a, status: "done" }));
              break;
            case "error":
              patch((a) => ({
                ...a,
                status: "error",
                error: evt.text,
              }));
              break;
          }
        }
      }
    } catch (err: any) {
      patch((a) => ({
        ...a,
        status: "error",
        error: err?.message || "Request failed",
      }));
    } finally {
      setLoading(false);
    }
  }

  function addHotelToCart(h: Hotel) {
    setCart((prev) =>
      prev.some((c) => c.id === h.id)
        ? prev
        : [{ kind: "hotel", id: h.id, addedAt: Date.now(), hotel: h }, ...prev]
    );
  }
  function addFlightToCart(f: Flight) {
    setCart((prev) =>
      prev.some((c) => c.id === f.id)
        ? prev
        : [{ kind: "flight", id: f.id, addedAt: Date.now(), flight: f }, ...prev]
    );
  }
  function addRoomToCart(
    hotelId: string,
    hotelName: string,
    hotelThumbnail: string | undefined,
    room: Room
  ) {
    const id = `${hotelId}::${room.offerId || room.name}`;
    setCart((prev) =>
      prev.some((c) => c.id === id)
        ? prev
        : [
            {
              kind: "room",
              id,
              addedAt: Date.now(),
              hotelId,
              hotelName,
              hotelThumbnail,
              roomName: room.name,
              price: room.price ?? 0,
              currency: room.currency || "USD",
              boardName: room.boardName,
            },
            ...prev,
          ]
    );
  }
  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runChat(query);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  }
  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      {/* Sticky top-right cart + login — always visible */}
      <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/90 px-3 text-xs font-medium backdrop-blur transition hover:bg-muted"
        >
          <User />
          <span className="hidden sm:inline">
            {profile ? profile.firstName : "Sign in"}
          </span>
        </button>
        {profile && (
          <button
            type="button"
            onClick={() => setBookingsOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full border bg-card/90 px-3 text-xs font-medium backdrop-blur transition hover:bg-muted"
          >
            <Bed />
            <span className="hidden sm:inline">Bookings</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative flex h-9 items-center gap-1.5 rounded-full border bg-card/90 px-3 text-xs font-medium backdrop-blur transition hover:bg-muted"
        >
          <Plane />
          <span className="hidden sm:inline">My Trip</span>
          {cart.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <header className="flex items-center gap-2 py-5 pr-36">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Conversations"
        >
          <Menu />
        </button>
        {hasMessages && (
          <button
            type="button"
            onClick={() => startNewChat()}
            className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            New chat
          </button>
        )}
      </header>

      {!hasMessages && (
        <section className="flex flex-1 flex-col items-center justify-center pb-24">
          <div className="mb-8 text-center">
            {mode === "research" ? (
              <>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <SearchIcon /> Research Mode
                </div>
                <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                  Explore before you book
                </h1>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                  Ask about destinations, weather, neighborhoods, budgets — get
                  thorough research before deciding.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                  Where to next?
                </h1>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                  Describe your trip. Search hotels, flights, and compare options.
                </p>
              </>
            )}
          </div>

          <form onSubmit={onSubmit} className="w-full">
            <PinnedChips pinned={pinned} onUnpin={unpinHotel} />
            <InputCard
              ref={inputRef}
              query={query}
              setQuery={setQuery}
              onKeyDown={onKeyDown}
              loading={loading}
              autosize={autosize}
              mode={mode}
              onToggleMode={() =>
                setMode((m) => (m === "research" ? "booking" : "research"))
              }
              placeholder={
                mode === "research"
                  ? "Ask about destinations, weather, budget, safety…"
                  : "Search hotels, flights, or describe your trip…"
              }
            />
          </form>

          <CyclingSuggestion
            items={
              mode === "research"
                ? RESEARCH_SUGGESTIONS
                : BOOKING_SUGGESTIONS
            }
            onSelect={(s) => runChat(s)}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(mode === "research" ? RESEARCH_SUGGESTIONS : BOOKING_SUGGESTIONS).map((s) => (
              <button
                key={s}
                onClick={() => runChat(s)}
                disabled={loading}
                className="rounded-full border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:shadow-sm disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <footer className="mt-12 text-center text-xs text-muted-foreground">
            Hotels · Flights · Details via{" "}
            <span className="font-medium">LiteAPI MCP</span>
          </footer>
        </section>
      )}

      {hasMessages && (
        <>
          <section className="flex-1 pb-40 pt-4">
            <div className="space-y-10">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className="flex animate-fade-in-up justify-end"
                  >
                    <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessageView
                    key={m.id}
                    msg={m}
                    cart={cart}
                    pinnedIds={pinnedIds}
                    onAddHotelChat={pinHotel}
                    onAddFlight={addFlightToCart}
                    onOpenHotel={setDetailHotel}
                  />
                )
              )}
              <div ref={bottomRef} />
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 px-4 pb-4 pt-10">
            <div className="pointer-events-none absolute inset-x-0 -top-2 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent" />
            <form onSubmit={onSubmit} className="relative">
              <PinnedChips pinned={pinned} onUnpin={unpinHotel} />
              <div className="rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/40">
                <InputCard
                  ref={inputRef}
                  query={query}
                  setQuery={setQuery}
                  onKeyDown={onKeyDown}
                  loading={loading}
                  autosize={autosize}
                  mode={mode}
                  onToggleMode={() =>
                    setMode((m) =>
                      m === "research" ? "booking" : "research"
                    )
                  }
                />
              </div>
            </form>
          </div>
        </>
      )}

      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        chats={chats}
        currentId={currentId}
        onSelect={(id) => {
          setCurrentId(id);
          setHistoryOpen(false);
        }}
        onNew={() => {
          startNewChat();
          setHistoryOpen(false);
        }}
        onDelete={deleteChat}
      />
      <TripModal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
      />
      <HotelDetailModal
        hotel={detailHotel}
        onClose={() => setDetailHotel(null)}
        onAddRoom={addRoomToCart}
        onAddChat={(h) => askAboutHotel(h)}
        pinned={!!detailHotel && pinnedIds.has(detailHotel.id)}
        cartRoomIds={
          new Set(
            cart.filter((c) => c.kind === "room").map((c) => c.id)
          )
        }
      />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSave={(p) => setProfile(p)}
        onSignOut={() => setProfile(null)}
      />
      <BookingsModal
        open={bookingsOpen}
        onClose={() => setBookingsOpen(false)}
        profile={profile}
      />
    </main>
  );
}
