"use client";

import { useState } from "react";

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

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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

  return (
    <main className="min-h-screen px-4 py-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="text-5xl font-bold text-dusk-accent">Duskgo</h1>
          <p className="mt-3 text-dusk-muted">
            Describe your trip. Get real hotels.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "3 nights in Paris for 2 people in early June"'
            rows={3}
            className="w-full rounded-xl bg-dusk-panel p-4 outline-none ring-1 ring-white/10 focus:ring-dusk-accent"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-dusk-accent px-6 py-3 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Find Hotels"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-950 p-4 text-red-200">{error}</div>
        )}

        {data && (
          <section className="mt-10">
            <div className="mb-4 text-sm text-dusk-muted">
              Parsed: <span className="text-white">{data.parsed.destination}</span>{" "}
              · {data.parsed.checkIn} → {data.parsed.checkOut} ·{" "}
              {data.parsed.adults} adult(s)
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.hotels.length === 0 && (
                <div className="text-dusk-muted">No hotels found.</div>
              )}
              {data.hotels.map((h) => (
                <article
                  key={h.id}
                  className="overflow-hidden rounded-xl bg-dusk-panel ring-1 ring-white/10"
                >
                  {h.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.thumbnail}
                      alt={h.name}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold">{h.name}</h3>
                    <p className="mt-1 text-sm text-dusk-muted">
                      {[h.address, h.city, h.country].filter(Boolean).join(", ")}
                    </p>
                    {typeof h.rating === "number" && (
                      <p className="mt-1 text-xs text-dusk-accent">
                        ★ {h.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
