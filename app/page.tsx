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
};

type ToolCall =
  | { name: "search_hotels"; args: { destination: string; countryCode: string } }
  | { name: "get_hotel_details"; args: { hotelId: string } }
  | {
      name: "search_flights";
      args: {
        origin: string;
        destination: string;
        departureDate: string;
        returnDate?: string;
        adults: number;
      };
    };

type UserMessage = { id: string; role: "user"; content: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  status: "streaming" | "done" | "error";
  reasoning?: string;
  toolCall?: ToolCall;
  toolResult?: { hotels?: Hotel[]; hotel?: Hotel; flights?: Flight[] };
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
type CartItem = CartHotelItem | CartFlightItem;

type ApiMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "3 nights in Paris for 2 people in early June",
  "Flights from NYC to Tokyo next month",
  "Beach hotel in Bali for a week",
  "Hotels in Rome for 5 days in July",
];

const LS_CHATS = "duskgo.chats.v1";
const LS_CURRENT = "duskgo.current.v1";
const LS_CART = "duskgo.cart.v1";
const LS_PINNED = "duskgo.pinned.v1";

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

function useTypewriter(text: string, charsPerTick = 4, tickMs = 14) {
  const [shown, setShown] = useState(0);
  const prevText = useRef("");

  useEffect(() => {
    if (text !== prevText.current) {
      prevText.current = text;
      setShown(0);
    }
  }, [text]);

  useEffect(() => {
    if (!text || shown >= text.length) return;
    const id = setTimeout(() => {
      setShown((s) => Math.min(text.length, s + charsPerTick));
    }, tickMs);
    return () => clearTimeout(id);
  }, [text, shown, charsPerTick, tickMs]);

  return shown >= text.length ? text : text.slice(0, shown);
}

function ReasoningSection({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(true);
  const displayed = useTypewriter(text);
  const fullyRevealed = displayed.length === text.length;

  useEffect(() => {
    if (!streaming && fullyRevealed) setOpen(false);
  }, [streaming, fullyRevealed]);

  const stillRevealing = streaming || !fullyRevealed;

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
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="skeleton h-40 w-full" />
      <div className="space-y-2 p-4 pb-3">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="skeleton h-3 w-12 rounded" />
        <div className="skeleton h-6 w-24 rounded-full" />
      </div>
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
  onAddCart,
  onAddChat,
  inCart,
  pinned,
}: {
  h: Hotel;
  onOpen: () => void;
  onAddCart: () => void;
  onAddChat: () => void;
  inCart: boolean;
  pinned: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl border bg-card transition hover:shadow-md">
      <button
        type="button"
        onClick={onAddCart}
        aria-label={inCart ? "Added to cart" : "Add to cart"}
        disabled={inCart}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur transition hover:bg-background disabled:opacity-60"
      >
        {inCart ? (
          <Check className="text-green-500" />
        ) : (
          <ShoppingBag />
        )}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        {h.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.thumbnail}
            alt={h.name}
            className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 flex-1 text-sm font-medium">{h.name}</h3>
            {typeof h.stars === "number" && h.stars > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                {Array.from({ length: Math.round(h.stars) }).map((_, i) => (
                  <Star key={i} className="text-amber-400" />
                ))}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {[h.address, h.city, h.country].filter(Boolean).join(", ") || "—"}
          </p>
          {typeof h.rating === "number" && (
            <p className="mt-2 text-xs font-medium">
              ★ {h.rating.toFixed(1)}
              {h.reviewCount ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  ({h.reviewCount.toLocaleString()} reviews)
                </span>
              ) : null}
            </p>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Details
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onAddChat}
          disabled={pinned}
          className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
        >
          {pinned ? (
            <>
              <Check className="text-green-500" /> Pinned
            </>
          ) : (
            <>
              <MessageSquarePlus /> Add to chat
            </>
          )}
        </button>
      </div>
    </article>
  );
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
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plane className="text-muted-foreground" />
            {f.airline || f.airlineCode || "Flight"}
            {f.stops != null && (
              <span className="text-xs font-normal text-muted-foreground">
                · {f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <div>
              <div className="font-semibold">{formatTime(f.departureTime)}</div>
              <div className="text-xs text-muted-foreground">{f.origin || "—"}</div>
            </div>
            <div className="flex-1 border-t border-dashed" />
            <div>
              <div className="font-semibold">{formatTime(f.arrivalTime)}</div>
              <div className="text-xs text-muted-foreground">{f.destination || "—"}</div>
            </div>
          </div>
          {f.cabin && (
            <div className="mt-2 text-xs text-muted-foreground">{f.cabin}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">
            {formatPrice(f.price, f.currency)}
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={inCart}
            className="mt-2 flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs transition hover:bg-muted disabled:opacity-50"
          >
            {inCart ? (
              <>
                <Check className="text-green-500" /> In cart
              </>
            ) : (
              <>
                <Plus /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function AssistantMessageView({
  msg,
  cart,
  pinnedIds,
  onAddHotelCart,
  onAddHotelChat,
  onAddFlight,
  onOpenHotel,
}: {
  msg: AssistantMessage;
  cart: CartItem[];
  pinnedIds: Set<string>;
  onAddHotelCart: (h: Hotel) => void;
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
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <HotelCardSkeleton />
              </div>
            ))}
          </div>
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

      {msg.toolResult?.hotels && msg.toolResult.hotels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {msg.toolResult.hotels.map((h, i) => (
            <div
              key={h.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <HotelCard
                h={h}
                onOpen={() => onOpenHotel(h)}
                onAddCart={() => onAddHotelCart(h)}
                onAddChat={() => onAddHotelChat(h)}
                inCart={cartIds.has(h.id)}
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

      {msg.message && (
        <p className="animate-fade-in whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {msg.message}
        </p>
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

type DetailPayload = {
  hotel: HotelDetailsFull;
  rooms: Room[];
  ratesError: string | null;
  search: { checkin: string; checkout: string; adults: number; currency: string };
};

function HotelDetailModal({
  hotel,
  onClose,
  onAddCart,
  onAddChat,
  inCart,
  pinned,
}: {
  hotel: Hotel | null;
  onClose: () => void;
  onAddCart: (h: Hotel) => void;
  onAddChat: (h: Hotel) => void;
  inCart: boolean;
  pinned: boolean;
}) {
  const [details, setDetails] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

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
        <button
          type="button"
          onClick={() => onAddCart(hotel)}
          disabled={inCart}
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-muted disabled:opacity-60"
          aria-label={inCart ? "Added to cart" : "Add to cart"}
        >
          {inCart ? <Check className="text-green-500" /> : <ShoppingBag />}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Hero image */}
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

        {/* Image gallery strip */}
        {h.images.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
            {h.images.slice(0, 12).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
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
                {details.rooms.map((r, i) => (
                  <RoomRow
                    key={r.offerId || `${r.name}-${i}`}
                    room={r}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>

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
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Check-in / out
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    {h.checkin && (
                      <div>
                        <span className="text-muted-foreground">Check-in:</span>{" "}
                        {h.checkin}
                        {h.checkinEnd ? ` – ${h.checkinEnd}` : ""}
                      </div>
                    )}
                    {h.checkout && (
                      <div>
                        <span className="text-muted-foreground">Check-out:</span>{" "}
                        {h.checkout}
                      </div>
                    )}
                    {h.childAllowed != null && (
                      <div className="text-muted-foreground">
                        Children: {h.childAllowed ? "welcome" : "not allowed"}
                      </div>
                    )}
                    {h.petsAllowed != null && (
                      <div className="text-muted-foreground">
                        Pets: {h.petsAllowed ? "welcome" : "not allowed"}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {h.importantInformation && (
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Good to know
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {h.importantInformation}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Location card */}
          <section className="mt-10 animate-fade-in-up">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </div>
              <div className="mt-2 text-sm">{loc || "—"}</div>
              {typeof h.latitude === "number" &&
                typeof h.longitude === "number" && (
                  <a
                    className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps →
                  </a>
                )}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onAddCart(hotel)}
            disabled={inCart}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {inCart ? (
              <>
                <Check className="text-green-500" /> In cart
              </>
            ) : (
              <>
                <ShoppingBag /> Add to cart
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onAddChat(hotel)}
            disabled={pinned}
            className="flex flex-[1.2] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {pinned ? (
              <>
                <Check /> Pinned to chat
              </>
            ) : (
              <>
                <MessageSquarePlus /> Ask about this
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomRow({ room, index }: { room: Room; index: number }) {
  const savings =
    room.suggestedPrice && room.price
      ? Math.round(
          ((room.suggestedPrice - room.price) / room.suggestedPrice) * 100
        )
      : 0;

  return (
    <article
      className="animate-fade-in-up rounded-xl border bg-card p-4"
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
        <div className="shrink-0 text-right">
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
      </div>
    </article>
  );
}

function CartSheet({
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
    return sum;
  }, 0);

  return (
    <Sheet open={open} onClose={onClose} side="right" title={`Cart (${cart.length})`}>
      {cart.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Your cart is empty. Add hotels or flights from a search result.
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y">
            {cart.map((item) => (
              <li key={item.id} className="flex gap-3 p-4">
                {item.kind === "hotel" ? (
                  <>
                    {item.hotel.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.hotel.thumbnail}
                        alt={item.hotel.name}
                        className="h-16 w-20 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Bed />
                        Hotel
                      </div>
                      <div className="truncate text-sm font-medium">
                        {item.hotel.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.hotel.city}, {item.hotel.country}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Plane />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Plane />
                        Flight
                      </div>
                      <div className="truncate text-sm font-medium">
                        {item.flight.origin} → {item.flight.destination}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(item.flight.price, item.flight.currency)}
                      </div>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove"
                >
                  <X />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t p-4">
            {total > 0 && (
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Flights total</span>
                <span className="font-semibold">{formatPrice(total, "USD")}</span>
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              onClick={() =>
                alert("Checkout is a demo — wire up LiteAPI prebook/book next.")
              }
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </Sheet>
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
};

const InputCard = forwardRef<HTMLTextAreaElement, InputCardProps>(
  function InputCard({ query, setQuery, onKeyDown, loading, autosize }, ref) {
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
          placeholder="Ask for hotels, flights, or a whole trip…"
          rows={1}
          className="block w-full resize-none rounded-3xl bg-transparent px-5 py-4 pr-14 text-[15px] leading-6 placeholder:text-muted-foreground focus:outline-none"
        />
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
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
      `Tell me about ${h.name} — its vibe, what it's known for, who it's best for, and any standout features. Keep it concise.`,
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
        body: JSON.stringify({ messages: history, pinned: pinnedPayload }),
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
                    : { flights: result },
              }));
              break;
            }
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
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Conversations"
          >
            <Menu />
          </button>
          <div className="h-6 w-6 rounded-md bg-foreground" />
          <span className="text-sm font-semibold tracking-tight">Duskgo</span>
        </div>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              type="button"
              onClick={() => {
                startNewChat();
              }}
              className="hidden rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground sm:block"
            >
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition hover:bg-muted"
          >
            <ShoppingBag />
            Cart
            {cart.length > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {!hasMessages && (
        <section className="flex flex-1 flex-col items-center justify-center pb-24">
          <div className="mb-8 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Where to next?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Describe your trip. Duskgo searches hotels, flights, and details
              via the LiteAPI MCP server.
            </p>
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
            />
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
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
                    onAddHotelCart={addHotelToCart}
                    onAddHotelChat={pinHotel}
                    onAddFlight={addFlightToCart}
                    onOpenHotel={setDetailHotel}
                  />
                )
              )}
              <div ref={bottomRef} />
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-background/80 px-4 pb-4 pt-3 backdrop-blur">
            <form onSubmit={onSubmit}>
              <PinnedChips pinned={pinned} onUnpin={unpinHotel} />
              <InputCard
                ref={inputRef}
                query={query}
                setQuery={setQuery}
                onKeyDown={onKeyDown}
                loading={loading}
                autosize={autosize}
              />
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
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
      />
      <HotelDetailModal
        hotel={detailHotel}
        onClose={() => setDetailHotel(null)}
        onAddCart={(h) => addHotelToCart(h)}
        onAddChat={(h) => askAboutHotel(h)}
        inCart={!!detailHotel && cart.some((c) => c.id === detailHotel.id)}
        pinned={!!detailHotel && pinnedIds.has(detailHotel.id)}
      />
    </main>
  );
}
