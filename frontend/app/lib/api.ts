import {
  GraphData,
  GuardEntry,
  GuardFilter,
  GuardStats,
  HealthStatus,
  JournalEntry,
  MCPServer,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// el back envuelve los errores de Aurora como {error}; se muestra ese mensaje
async function getJSON<T>(url: URL): Promise<T> {
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `backend responded ${res.status}`);
  }
  return res.json();
}

export function fetchGuard(filter: GuardFilter = {}): Promise<GuardEntry[]> {
  const url = new URL("/api/guard", API_URL);
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return getJSON(url);
}

export function fetchGuardStats(since?: string): Promise<GuardStats> {
  const url = new URL("/api/guard/stats", API_URL);
  if (since) url.searchParams.set("since", since);
  return getJSON(url);
}

export function fetchMCPServers(): Promise<MCPServer[]> {
  return getJSON(new URL("/api/mcp/servers", API_URL));
}

export function guardStreamURL(): string {
  return new URL("/api/guard/stream", API_URL).toString();
}

export interface VoiceTurn {
  transcript: string;
  reply: string;
  audio?: string; // base64 WAV
  speech_error?: string;
  timings: { transcribe_ms: number; reply_ms: number; speech_ms: number };
}

export async function sendVoice(clip: Blob): Promise<VoiceTurn> {
  const res = await fetch(new URL("/api/voice", API_URL).toString(), {
    method: "POST",
    headers: { "Content-Type": clip.type || "application/octet-stream" },
    body: clip,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `backend responded ${res.status}`);
  }
  return res.json();
}

export async function fetchGraph(threshold?: number): Promise<GraphData> {
  const url = new URL("/api/graph", API_URL);
  if (threshold) {
    url.searchParams.set("threshold", String(threshold));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`backend responded ${res.status}`);
  }

  return res.json();
}

export async function fetchJournal(): Promise<JournalEntry[]> {
  const url = new URL("/api/journal", API_URL);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`backend responded ${res.status}`);
  }
  return res.json();
}

export async function fetchStatus(): Promise<HealthStatus> {
  const url = new URL("/api/health", API_URL);
  const res = await fetch(url.toString(), { cache: "no-store" });
  // el back responde 503 con {status:"error", error} cuando Qdrant falla
  if (!res.ok && res.status !== 503) {
    throw new Error(`backend responded ${res.status}`);
  }
  return res.json();
}