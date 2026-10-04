"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchGuard, fetchGuardStats, fetchMCPServers, guardStreamURL } from "../lib/api";
import {
  colorForDecision,
  colorForMCPStatus,
  GuardDecision,
  GuardEntry,
  GuardStats,
  MCPServer,
} from "../lib/types";
import { etiquetteClass, EtiquetteButton, Problem, SectionHeading } from "./Postal";

const PERIODS = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const LIMIT = 100;
const STATS_POLL_MS = 30_000;
const MCP_POLL_MS = 15_000;

// Aurora decide; el panel lo nombra como la aduana
const DECISION_LABEL: Record<GuardDecision, string> = {
  allow: "Allowed",
  deny: "Denied",
  confirm: "Held",
};

type Load<T> = { data: T | null; error: string | null; loading: boolean };

// carga con reintento; con every>0 vuelve a pedir sin volver a "loading"
function usePoll<T>(fn: () => Promise<T>, every = 0) {
  const [s, setS] = useState<Load<T>>({ data: null, error: null, loading: true });
  const run = useCallback(
    (quiet = false) => {
      if (!quiet) setS((p) => ({ ...p, loading: true, error: null }));
      fn()
        .then((data) => setS({ data, error: null, loading: false }))
        .catch((e: Error) =>
          setS((p) => ({ data: quiet ? p.data : null, error: e.message ?? "unknown error", loading: false })),
        );
    },
    [fn],
  );
  useEffect(() => {
    const t = setTimeout(() => run(), 0);
    const id = every > 0 ? setInterval(() => run(true), every) : undefined;
    return () => {
      clearTimeout(t);
      if (id) clearInterval(id);
    };
  }, [run, every]);
  return { ...s, retry: () => run(), refresh: () => run(true) };
}

type Live = "connecting" | "live" | "lost";

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ago(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function ms(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

function Pending({ children }: { children: string }) {
  return <p className="animate-pulse text-sm text-ink-2">{children}</p>;
}

export function DecisionStamp({ decision }: { decision: string }) {
  const ink = colorForDecision(decision);
  return (
    <span
      className="postal inline-block -rotate-2 border-2 px-1.5 py-0.5 text-[0.72rem] leading-none whitespace-nowrap"
      style={{ color: ink, borderColor: ink }}
    >
      {DECISION_LABEL[decision as GuardDecision] ?? decision}
    </span>
  );
}

export default function GuardDesk() {
  const [period, setPeriod] = useState<Period>("24h");
  const [decision, setDecision] = useState<GuardDecision | "">("");
  const [server, setServer] = useState("");
  const [skill, setSkill] = useState("");

  const loadStats = useCallback(() => fetchGuardStats(period), [period]);
  const stats = usePoll(loadStats, STATS_POLL_MS);
  const mcp = usePoll(fetchMCPServers, MCP_POLL_MS);

  const loadLog = useCallback(
    () => fetchGuard({ limit: LIMIT, since: period, decision, server, skill }),
    [period, decision, server, skill],
  );
  const log = usePoll(loadLog);

  // entradas llegadas por SSE, más recientes primero, encima del registro cargado
  const [fresh, setFresh] = useState<GuardEntry[]>([]);
  const [live, setLive] = useState<Live>("connecting");
  const filterRef = useRef({ decision, server, skill });
  const refreshStats = useRef(stats.refresh);
  useEffect(() => {
    filterRef.current = { decision, server, skill };
    refreshStats.current = stats.refresh;
  });

  // un filtro nuevo trae su propio registro; lo en vivo empieza de cero
  useEffect(() => {
    const t = setTimeout(() => setFresh([]), 0);
    return () => clearTimeout(t);
  }, [log.data]);

  useEffect(() => {
    const es = new EventSource(guardStreamURL());
    let statsTimer: ReturnType<typeof setTimeout> | undefined;
    es.onopen = () => setLive("live");
    es.onerror = () => setLive(es.readyState === EventSource.CLOSED ? "lost" : "connecting");
    es.addEventListener("entry", (ev) => {
      let e: GuardEntry;
      try {
        e = JSON.parse((ev as MessageEvent).data);
      } catch {
        return;
      }
      const f = filterRef.current;
      const match =
        (!f.decision || e.decision === f.decision) &&
        (!f.server || e.server === f.server) &&
        (!f.skill || e.skill === f.skill);
      if (match) setFresh((p) => [e, ...p].slice(0, LIMIT));
      // agrupa ráfagas en una sola recarga de totales
      clearTimeout(statsTimer);
      statsTimer = setTimeout(() => refreshStats.current(), 1500);
    });
    return () => {
      clearTimeout(statsTimer);
      es.close();
    };
  }, []);

  const entries = useMemo(() => [...fresh, ...(log.data ?? [])].slice(0, LIMIT), [fresh, log.data]);

  // "aurora" en las stats es el grupo de skills locales (server vacío): no filtra
  const serverOptions = useMemo(() => {
    const names = new Set<string>();
    mcp.data?.forEach((s) => names.add(s.name));
    stats.data?.by_server.forEach((g) => g.name !== "aurora" && names.add(g.name));
    if (server) names.add(server);
    return [...names].sort();
  }, [mcp.data, stats.data, server]);

  const skillOptions = useMemo(() => {
    const names = new Set(stats.data?.by_skill.map((g) => g.name).filter(Boolean));
    if (skill) names.add(skill);
    return [...names].sort();
  }, [stats.data, skill]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-14 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2rem,4vw,2.8rem)] leading-none font-bold [font-stretch:84%] [word-spacing:0.1em]">
            Guard
          </h1>
          <p className="mt-2 max-w-[60ch] text-ink-2">
            Every skill and tool call Aurora makes is inspected here first: allowed through, held for your
            confirmation, or denied.
          </p>
        </div>
        <div role="group" aria-label="Period" className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={etiquetteClass(period === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <Totals {...stats} period={period} />
        <Servers {...mcp} />
      </div>

      <section aria-labelledby="register-heading">
        <SectionHeading id="register-heading" action={<LiveTag state={live} />}>
          Inspection register
        </SectionHeading>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select label="Decision" value={decision} onChange={(v) => setDecision(v as GuardDecision | "")}>
            <option value="">All</option>
            <option value="allow">Allowed</option>
            <option value="confirm">Held</option>
            <option value="deny">Denied</option>
          </Select>
          <Select label="Server" value={server} onChange={setServer}>
            <option value="">All</option>
            {serverOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select label="Skill" value={skill} onChange={setSkill}>
            <option value="">All</option>
            {skillOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          {(decision || server || skill) && (
            <EtiquetteButton
              onClick={() => {
                setDecision("");
                setServer("");
                setSkill("");
              }}
            >
              Clear filters
            </EtiquetteButton>
          )}
        </div>

        <Register entries={entries} freshCount={fresh.length} {...log} />
      </section>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-2">
      <span className="postal text-[0.72rem]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[9rem] border-2 border-rule bg-onion px-2 py-1.5 text-ink focus-visible:border-airmail-blue"
      >
        {children}
      </select>
    </label>
  );
}

function LiveTag({ state }: { state: Live }) {
  const ink = state === "live" ? "var(--ok)" : state === "lost" ? "var(--danger)" : "var(--warn)";
  const label = state === "live" ? "Live" : state === "lost" ? "Stream lost" : "Connecting";
  return (
    <span role="status" className="postal inline-flex items-center gap-2 text-[0.8rem]" style={{ color: ink }}>
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${state === "connecting" ? "animate-pulse" : ""}`}
        style={{ background: ink }}
      />
      {label}
    </span>
  );
}

function Totals({
  data,
  error,
  loading,
  retry,
  period,
}: Load<GuardStats> & { retry: () => void; period: Period }) {
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;
  const tiles = data
    ? [
        { label: "Inspected", value: data.total.toLocaleString("en"), ink: "var(--airmail-blue)" },
        { label: "Allowed", value: data.allowed.toLocaleString("en"), ink: "var(--ok)" },
        { label: "Held", value: data.confirm.toLocaleString("en"), ink: "var(--warn)" },
        { label: "Denied", value: data.denied.toLocaleString("en"), ink: "var(--danger)" },
        { label: "Failed", value: data.errors.toLocaleString("en"), ink: "var(--airmail-red)" },
        { label: "Avg time", value: ms(data.avg_duration_ms), ink: "var(--ink-3)" },
      ]
    : [];
  const maxServer = Math.max(1, ...(data?.by_server.map((g) => g.total) ?? [1]));

  return (
    <section aria-labelledby="totals-heading" className="lg:col-span-7">
      <SectionHeading id="totals-heading">Last {periodLabel}</SectionHeading>
      <div className="on-desk">
        <div className="bg-aero px-5 py-5 sm:px-6">
          {loading && !data && <Pending>Counting inspections…</Pending>}
          {error && !data && <Problem what="guard totals" message={error} onRetry={retry} />}

          {data && (
            <>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {tiles.map((t) => (
                  <li key={t.label} className="perforated">
                    <div
                      className="flex aspect-[5/4] flex-col justify-between p-2.5 text-stamp-paper"
                      style={{
                        background: t.ink,
                        boxShadow: `inset 0 0 0 3px ${t.ink}, inset 0 0 0 4px color-mix(in srgb, var(--stamp-paper) 40%, transparent)`,
                      }}
                    >
                      <span className="text-[clamp(1.5rem,3vw,2.2rem)] leading-none font-bold [font-stretch:75%]">
                        {t.value}
                      </span>
                      <span className="postal text-[0.8rem] leading-tight">{t.label}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {data.by_server.length > 0 && (
                <div className="mt-6 border-t border-dashed border-rule pt-4">
                  <h3 className="text-sm text-ink-2">By server</h3>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {data.by_server.map((g) => (
                      <li key={g.name} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                        <span className="postal truncate text-[0.8rem] text-ink" title={g.name}>
                          {g.name}
                        </span>
                        <span
                          className="flex h-3 overflow-hidden bg-onion"
                          role="img"
                          aria-label={`${g.allowed} allowed, ${g.blocked} blocked of ${g.total}`}
                        >
                          <span style={{ width: `${(g.allowed / maxServer) * 100}%`, background: "var(--ok)" }} />
                          <span style={{ width: `${(g.blocked / maxServer) * 100}%`, background: "var(--danger)" }} />
                        </span>
                        <span className="text-ink-2">
                          {g.total}
                          {g.blocked > 0 && <span className="text-danger"> · {g.blocked} blocked</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.total === 0 && (
                <p className="mt-4 text-sm text-ink-2">No calls inspected in this period.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Servers({ data, error, loading, retry }: Load<MCPServer[]> & { retry: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section aria-labelledby="mcp-heading" className="lg:col-span-5">
      <SectionHeading id="mcp-heading">MCP servers</SectionHeading>
      <div className="on-desk">
        <div className="bg-onion">
          {loading && !data && (
            <div className="px-5 py-5">
              <Pending>Calling the servers…</Pending>
            </div>
          )}
          {error && !data && (
            <div className="px-5 py-5">
              <Problem what="MCP servers" message={error} onRetry={retry} />
            </div>
          )}
          {data && data.length === 0 && (
            <p className="px-5 py-5 text-sm text-ink-2">Aurora has no MCP servers configured.</p>
          )}

          {data && data.length > 0 && (
            <ul>
              {data.map((s) => {
                const ink = colorForMCPStatus(s.status);
                const tools = s.tools ?? [];
                const expanded = open === s.name;
                return (
                  <li key={s.name} className="border-b border-rule px-5 py-4 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{s.name}</p>
                        <p className="mt-0.5 text-sm text-ink-2">
                          {tools.length} {tools.length === 1 ? "tool" : "tools"} · {s.status} for {ago(s.since)}
                          {s.reconnects > 0 && ` · ${s.reconnects} reconnects`}
                        </p>
                      </div>
                      <span
                        className="postal shrink-0 rotate-2 border-2 px-2 py-1 text-[0.72rem] leading-none"
                        style={{ color: ink, borderColor: ink }}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.error && <p className="mt-2 text-sm break-words text-danger">{s.error}</p>}
                    {tools.length > 0 && (
                      <>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : s.name)}
                          className="mt-2 text-sm text-airmail-blue underline decoration-airmail-blue/40 hover:decoration-airmail-blue"
                        >
                          {expanded ? "Hide tools" : "Show tools"}
                        </button>
                        {expanded && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {tools.map((t) => (
                              <li key={t} className="border border-rule bg-aero px-1.5 py-0.5 font-mono text-[0.75rem] text-ink">
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Register({
  entries,
  freshCount,
  data,
  error,
  loading,
  retry,
}: Load<GuardEntry[]> & { retry: () => void; entries: GuardEntry[]; freshCount: number }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="on-desk">
      <div className="overflow-x-auto bg-onion">
        {loading && !data && (
          <div className="px-5 py-5">
            <Pending>Reading the register…</Pending>
          </div>
        )}
        {error && (
          <div className="px-5 py-5">
            <Problem what="the guard register" message={error} onRetry={retry} />
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="px-5 py-5 text-sm text-ink-2">Nothing matches. New calls appear here as they happen.</p>
        )}

        {entries.length > 0 && (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-ink-2">
                <th scope="col" className="py-3 pr-3 pl-4 font-medium sm:px-5">Time</th>
                <th scope="col" className="px-3 py-3 font-medium">Decision</th>
                <th scope="col" className="px-3 py-3 font-medium">Call</th>
                <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Reason</th>
                <th scope="col" className="py-3 pr-4 pl-3 text-right font-medium sm:px-5">Took</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const key = `${e.time}-${e.skill}-${e.tool ?? ""}-${i}`;
                const id = `${e.time}-${e.skill}-${e.tool ?? ""}`;
                const expanded = open === id;
                return (
                  <Fragment key={key}>
                    <tr
                      className={`cursor-pointer border-b border-rule align-top hover:bg-aero ${i < freshCount ? "strike" : ""}`}
                      onClick={() => setOpen(expanded ? null : id)}
                    >
                      <td className="py-3 pr-3 pl-4 whitespace-nowrap text-ink-2 sm:px-5">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          className="text-left"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setOpen(expanded ? null : id);
                          }}
                        >
                          {stamp(e.time)}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <DecisionStamp decision={e.decision} />
                      </td>
                      <td className="px-3 py-3 text-ink">
                        <span className="font-medium">{e.skill}</span>
                        {(e.server || e.tool) && (
                          <span className="block font-mono text-[0.75rem] text-ink-2">
                            {e.server ?? "aurora"}
                            {e.tool && ` › ${e.tool}`}
                          </span>
                        )}
                        {e.error && <span className="mt-1 block text-[0.8rem] text-danger">Failed: {e.error}</span>}
                      </td>
                      <td className="hidden max-w-[40ch] px-3 py-3 text-ink-2 md:table-cell">
                        <p className="line-clamp-2">{e.reason || "—"}</p>
                      </td>
                      <td className="py-3 pr-4 pl-3 text-right whitespace-nowrap text-ink-2 sm:px-5">
                        {ms(e.duration_ms)}
                      </td>
                    </tr>
                    {expanded && <EntryDetail entry={e} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EntryDetail({ entry: e }: { entry: GuardEntry }) {
  const rows: [string, ReactNode][] = [];
  if (e.reason) rows.push(["Reason", e.reason]);
  if (e.error) rows.push(["Error", <span key="err" className="text-danger">{e.error}</span>]);
  if (e.args !== undefined) rows.push(["Arguments", <Json key="args" value={e.args} />]);
  if (e.checks && Object.keys(e.checks).length > 0) rows.push(["Checks", <Json key="checks" value={e.checks} />]);
  if (e.result_chars) rows.push(["Result", `${e.result_chars.toLocaleString("en")} characters`]);
  if (e.attachments) rows.push(["Attachments", String(e.attachments)]);

  return (
    <tr className="border-b border-rule bg-aero">
      <td colSpan={5} className="px-4 py-4 sm:px-5">
        {rows.length === 0 ? (
          <p className="text-ink-2">No further details recorded.</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]">
            {rows.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="postal text-[0.75rem] text-ink-2">{k}</dt>
                <dd className="min-w-0 text-ink">{v}</dd>
              </Fragment>
            ))}
          </dl>
        )}
      </td>
    </tr>
  );
}

function Json({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-64 overflow-auto border border-rule bg-onion p-2 font-mono text-[0.78rem] whitespace-pre-wrap break-words">
      {text}
    </pre>
  );
}
