"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchGraph, fetchJournal } from "../lib/api";
import { colorForMood, colorForType, GraphData, JournalEntry } from "../lib/types";
import { MoodStamp, Problem, SectionHeading, TextLink } from "./Postal";

type Load<T> = { data: T | null; error: string | null; loading: boolean };

function useLoad<T>(fn: () => Promise<T>) {
  const [s, setS] = useState<Load<T>>({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    setS((p) => ({ ...p, loading: true, error: null }));
    fn()
      .then((data) => setS({ data, error: null, loading: false }))
      .catch((e: Error) => setS({ data: null, error: e.message ?? "unknown error", loading: false }));
  }, [fn]);
  useEffect(() => {
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, [run]);
  return { ...s, retry: run };
}

const loadGraph = () => fetchGraph();

export function letterDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function shortStamp(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Pending({ children }: { children: string }) {
  return <p className="animate-pulse text-sm text-ink-2">{children}</p>;
}

export default function HomeDesk() {
  const journal = useLoad(fetchJournal);
  const graph = useLoad(loadGraph);

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <LatestLetter {...journal} />
        <StampSheet {...graph} />
      </div>
      <MemoryRegister {...graph} />
    </>
  );
}

function LatestLetter({
  data,
  error,
  loading,
  retry,
}: Load<JournalEntry[]> & { retry: () => void }) {
  const latest = data?.[0];
  const recent = useMemo(() => (data ? data.slice(0, 14).reverse() : []), [data]);

  return (
    <section aria-labelledby="letter-heading" className="lg:col-span-7">
      <SectionHeading
        id="letter-heading"
        action={data && data.length > 0 && <TextLink href="/journal">All {data.length} letters</TextLink>}
      >
        Her latest letter
      </SectionHeading>

      <div className="unfold on-desk">
        <article className="bg-onion px-6 py-7 sm:px-10 sm:py-9">
          {loading && <Pending>Opening her letters…</Pending>}
          {error && <Problem what="the diary" message={error} onRetry={retry} />}
          {!loading && !error && !latest && (
            <p className="font-serif text-lg text-ink-2">
              No letters yet. Aurora writes her first entry after her first reflection.
            </p>
          )}

          {latest && (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-serif text-lg text-ink-2 first-letter:uppercase">
                  {letterDate(latest.timestamp)}
                </p>
                {latest.mood && <MoodStamp mood={latest.mood} />}
              </header>
              <p className="mt-6 max-w-[62ch] font-serif text-[1.3rem] leading-[1.6] whitespace-pre-wrap text-ink">
                {latest.content}
              </p>
              <p className="mt-6 font-serif text-lg text-ink-2 italic">— Aurora</p>

              {recent.length > 1 && (
                <div className="mt-8 border-t border-rule pt-4">
                  <h3 className="text-sm text-ink-2">Moods in her last {recent.length} letters</h3>
                  <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    {recent.map((e) => {
                      const ink = colorForMood(e.mood || "neutral");
                      return (
                        <li
                          key={e.timestamp}
                          title={`${e.mood || "neutral"} · ${shortStamp(e.timestamp)}`}
                          className="postal inline-flex items-center gap-1.5 text-[0.75rem]"
                          style={{ color: ink }}
                        >
                          <span
                            aria-hidden="true"
                            className="size-3.5 rounded-full border-2"
                            style={{ borderColor: ink, boxShadow: `inset 0 0 0 2px var(--onion), inset 0 0 0 10px ${ink}` }}
                          />
                          {e.mood || "neutral"}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function StampSheet({ data, error, loading, retry }: Load<GraphData> & { retry: () => void }) {
  const byType = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const n of data.nodes) counts.set(n.type || "unknown", (counts.get(n.type || "unknown") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <section aria-labelledby="sheet-heading" className="lg:col-span-5">
      <SectionHeading id="sheet-heading" action={data && <TextLink href="/mind">Open memory map</TextLink>}>
        What she remembers
      </SectionHeading>

      <div className="on-desk">
        <div className="bg-aero px-5 py-5 sm:px-6">
          {loading && <Pending>Counting memories…</Pending>}
          {error && <Problem what="the memory graph" message={error} onRetry={retry} />}

          {data && (
            <>
              <p className="postal border-b border-dashed border-rule pb-2 text-[0.8rem] text-ink-2">
                {data.nodes.length.toLocaleString("en")} memories ·{" "}
                {data.edges.length.toLocaleString("en")} links
              </p>

              {byType.length === 0 ? (
                <p className="py-8 text-sm text-ink-2">No memories stored yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-1 py-4 sm:grid-cols-3">
                  {byType.map(([type, count]) => {
                    const ink = colorForType(type);
                    return (
                      <li key={type} className="perforated">
                        <div
                          className="flex aspect-[4/5] flex-col justify-between p-2.5 text-stamp-paper"
                          style={{
                            background: ink,
                            boxShadow: `inset 0 0 0 3px ${ink}, inset 0 0 0 4px color-mix(in srgb, var(--stamp-paper) 40%, transparent)`,
                          }}
                        >
                          <span className="text-[clamp(1.6rem,3.2vw,2.3rem)] leading-none font-bold [font-stretch:75%]">
                            {count.toLocaleString("en")}
                          </span>
                          <span className="postal text-[0.8rem] leading-tight">{type}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="postal border-t border-dashed border-rule pt-2 text-right text-[0.75rem] text-ink-2">
                Read only · Qdrant
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function MemoryRegister({ data, loading }: Load<GraphData>) {
  const newest = useMemo(() => {
    if (!data) return [];
    return data.nodes
      .filter((n) => n.created_at && !Number.isNaN(new Date(n.created_at).getTime()))
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 8);
  }, [data]);

  if (loading || !data || newest.length === 0) return null;

  return (
    <section aria-labelledby="register-heading">
      <SectionHeading id="register-heading" action={<TextLink href="/mind">See how they connect</TextLink>}>
        Newest memories
      </SectionHeading>

      <div className="on-desk">
        <div className="overflow-x-auto bg-onion">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-ink-2">
                <th scope="col" className="py-3 pr-3 pl-4 font-medium sm:px-5">Received</th>
                <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell">Type</th>
                <th scope="col" className="py-3 pr-4 pl-3 font-medium sm:px-5">Memory</th>
              </tr>
            </thead>
            <tbody>
              {newest.map((n) => {
                const ink = colorForType(n.type);
                return (
                  <tr key={n.id} className="border-b border-rule align-top last:border-b-0">
                    <td className="py-3 pr-3 pl-4 text-ink-2 sm:px-5 sm:whitespace-nowrap">{shortStamp(n.created_at)}</td>
                    <td className="hidden px-3 py-3 whitespace-nowrap sm:table-cell">
                      <span className="postal inline-flex items-center gap-2 text-[0.8rem]" style={{ color: ink }}>
                        <span className="size-2.5" style={{ background: ink }} aria-hidden="true" />
                        {n.type || "unknown"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 pl-3 text-ink sm:px-5">
                      <span className="postal mb-1 block text-[0.75rem] sm:hidden" style={{ color: ink }}>
                        {n.type || "unknown"}
                      </span>
                      <p className="line-clamp-2 max-w-[75ch]">{n.content || "(empty)"}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
