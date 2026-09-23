"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchJournal } from "../lib/api";
import { colorForMood, JournalEntry } from "../lib/types";
import { letterDate } from "./HomeDesk";
import { Arrow, EtiquetteButton, MoodStamp, Problem } from "./Postal";

function letterTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function letterDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function JournalBook() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchJournal()
      .then((data) => {
        setEntries(data);
        setPage(Math.max(0, data.length - 1)); // abre en la más reciente
      })
      .catch((e: Error) => setError(e.message ?? "failed to load journal"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // el back devuelve más reciente primero; el diario se lee cronológico
  const chronological = useMemo(() => (entries ? [...entries].reverse() : null), [entries]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight" && chronological)
        setPage((p) => Math.min(chronological.length - 1, p + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chronological]);

  const shell = (children: ReactNode) => (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <h1 className="text-[clamp(2rem,4vw,2.8rem)] leading-none font-bold [font-stretch:84%] [word-spacing:0.1em]">
        Aurora’s diary
      </h1>
      {children}
    </div>
  );

  if (loading) return shell(<p className="animate-pulse text-sm text-ink-2">Opening her letters…</p>);

  if (error)
    return shell(
      <div className="bg-onion p-6">
        <Problem what="the diary" message={error} onRetry={load} />
      </div>,
    );

  if (!chronological || chronological.length === 0)
    return shell(
      <p className="font-serif text-lg text-ink-2">
        No letters yet. Aurora writes her first entry after her first reflection.
      </p>,
    );

  const entry = chronological[page];
  const ink = colorForMood(entry.mood || "neutral");
  const isLast = page === chronological.length - 1;

  return shell(
    <>
      <nav aria-label="Letters" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Letter <span className="text-ink">{page + 1}</span> of {chronological.length}
          {isLast && " · the most recent"}
        </p>
        <div className="flex gap-2">
          <EtiquetteButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <Arrow className="rotate-180" /> Earlier
          </EtiquetteButton>
          <EtiquetteButton
            onClick={() => setPage((p) => Math.min(chronological.length - 1, p + 1))}
            disabled={isLast}
          >
            Later <Arrow />
          </EtiquetteButton>
        </div>
      </nav>

      <div key={entry.timestamp} className="unfold on-desk">
        <div className="par-avion p-1.5">
          <article className="relative flex flex-col bg-onion px-6 py-8 sm:px-12 sm:py-11">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-serif text-xl text-ink first-letter:uppercase">
                  {letterDate(entry.timestamp)}
                </p>
                <p className="mt-1 text-sm text-ink-2">{letterTime(entry.timestamp)}</p>
              </div>
              {entry.mood && <MoodStamp mood={entry.mood} className="text-base" />}
            </header>

            <p className="mt-8 max-w-[62ch] font-serif text-[1.3rem] leading-[1.65] whitespace-pre-wrap text-ink">
              {entry.content}
            </p>
            <p className="mt-8 font-serif text-lg text-ink-2 italic">— Aurora</p>

            <ol
              aria-label="Jump to a letter"
              className="mt-10 flex flex-wrap gap-x-4 gap-y-3 border-t border-rule pt-5"
            >
              {chronological.map((e, i) => {
                const c = colorForMood(e.mood || "neutral");
                const current = i === page;
                return (
                  <li key={e.timestamp}>
                    <button
                      type="button"
                      onClick={() => setPage(i)}
                      aria-current={current ? "true" : undefined}
                      title={`${letterDate(e.timestamp)} · ${e.mood || "neutral"}`}
                      className="flex flex-col items-center gap-1 text-[0.7rem] text-ink-2 transition-colors hover:text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className="block size-5 rounded-full border-2"
                      style={{
                        borderColor: c,
                        boxShadow: current
                          ? `inset 0 0 0 20px ${c}`
                          : `inset 0 0 0 2px var(--onion), inset 0 0 0 20px color-mix(in srgb, ${c} 33%, transparent)`,
                        outline: current ? `2px solid ${ink}` : undefined,
                        outlineOffset: 2,
                      }}
                      />
                      <span className="postal" style={{ color: c }}>
                        {e.mood || "neutral"}
                      </span>
                      <span>{letterDay(e.timestamp)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </article>
        </div>
      </div>

      <p className="text-sm text-ink-2">Tip: use the ← and → keys to turn letters.</p>
    </>,
  );
}
