"use client";

import { useRef, useState } from "react";

type Hotel = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  rating?: number;
  thumbnail?: string;
};

type SearchResponse = {
  parsed: {
    destination: string;
    checkIn: string;
    checkOut: string;
    adults: number;
  };
  hotels: Hotel[];
};

const SUGGESTIONS = [
  "3 nights in Paris for 2 people in early June",
  "Beach hotel in Bali for a week next month",
  "Cheap stay in Tokyo, April, solo traveler",
  "Family-friendly hotel in Rome, 5 days in July",
];

function ArrowUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function Spinner(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function runSearch(q: string) {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    runSearch(query.trim());
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

  const hasResults = !!data || !!error || loading;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-foreground" />
          <span className="text-sm font-semibold tracking-tight">Duskgo</span>
        </div>
        <a
          href="https://github.com/LSDWor/Duskgo"
          className="text-xs text-muted-foreground transition hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </header>

      <section
        className={`flex flex-1 flex-col ${
          hasResults ? "pt-6" : "items-center justify-center pb-20"
        }`}
      >
        {!hasResults && (
          <div className="mb-8 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Where to next?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Describe your trip. Get real hotels instantly.
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="w-full">
          <div className="group relative rounded-2xl border bg-card shadow-sm transition focus-within:border-foreground/40 focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                autosize(e.currentTarget);
              }}
              onKeyDown={onKeyDown}
              placeholder="e.g. 3 nights in Paris for 2 people in early June"
              rows={1}
              className="block w-full resize-none rounded-2xl bg-transparent px-5 py-4 pr-14 text-[15px] leading-6 placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              aria-label="Search"
              className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? <Spinner /> : <ArrowUp />}
            </button>
          </div>
        </form>

        {!hasResults && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  runSearch(s);
                }}
                className="rounded-full border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border bg-card"
              >
                <div className="h-40 w-full bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {data && (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border bg-card px-2.5 py-1 text-foreground">
                {data.parsed.destination}
              </span>
              <span className="rounded-full border bg-card px-2.5 py-1">
                {data.parsed.checkIn} → {data.parsed.checkOut}
              </span>
              <span className="rounded-full border bg-card px-2.5 py-1">
                {data.parsed.adults} {data.parsed.adults === 1 ? "adult" : "adults"}
              </span>
              <span className="ml-auto">{data.hotels.length} results</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {data.hotels.length === 0 && (
                <div className="col-span-full rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  No hotels found for this search.
                </div>
              )}
              {data.hotels.map((h) => (
                <article
                  key={h.id}
                  className="group overflow-hidden rounded-xl border bg-card transition hover:shadow-md"
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
                  <div className="p-4">
                    <h3 className="line-clamp-1 text-sm font-medium">{h.name}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {[h.address, h.city, h.country].filter(Boolean).join(", ") ||
                        "—"}
                    </p>
                    {typeof h.rating === "number" && (
                      <p className="mt-2 text-xs font-medium">
                        ★ {h.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 pb-8 text-center text-xs text-muted-foreground">
          Hotels via LiteAPI · Parsing via OpenRouter
        </footer>
      </section>
    </main>
  );
}
