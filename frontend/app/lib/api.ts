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

// Un turno de voz llega como NDJSON: transcript → [confirm → confirm_result]* →
// reply → audio | speech_error, o error en cualquier punto tras transcript.
export type VoiceEvent =
  | { type: "transcript"; text: string; ms: number }
  | {
      type: "confirm";
      id: string;
      text: string; // skill, servidor, argumentos (secretos ocultos) y motivo
      skill: string;
      server?: string;
      sensitive?: boolean;
      audio?: string; // base64 WAV con la pregunta
    }
  | { type: "confirm_result"; id: string; approved?: boolean; text?: "expired" | "cancelled" }
  | { type: "reply"; text: string; ms: number }
  | { type: "audio"; audio: string; ms: number }
  | { type: "speech_error"; error: string }
  | { type: "error"; error: string };

async function voiceError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.error || `backend responded ${res.status}`);
}

export async function streamVoice(clip: Blob, onEvent: (e: VoiceEvent) => void): Promise<void> {
  const res = await fetch(new URL("/api/voice", API_URL).toString(), {
    method: "POST",
    headers: { "Content-Type": clip.type || "application/octet-stream" },
    body: clip,
  });
  if (!res.ok) throw await voiceError(res);
  if (!res.body) throw new Error("the browser can’t read streamed responses");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) pending += value;
    let nl: number;
    while ((nl = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, nl).trim();
      pending = pending.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as VoiceEvent);
    }
    if (done) return;
  }
}

export interface VoiceConfirmResult {
  transcript?: string;
  decision: "yes" | "no" | "unclear";
  audio?: string; // base64 WAV: Aurora vuelve a preguntar
}

// Responde una confirmación con los botones (answer) o con la voz (clip).
export async function confirmVoice(id: string, reply: { answer: "yes" | "no" } | { clip: Blob }): Promise<VoiceConfirmResult> {
  const url = new URL(`/api/voice/confirm/${encodeURIComponent(id)}`, API_URL);
  const init: RequestInit = { method: "POST" };
  if ("answer" in reply) {
    url.searchParams.set("answer", reply.answer);
  } else {
    init.headers = { "Content-Type": reply.clip.type || "application/octet-stream" };
    init.body = reply.clip;
  }
  const res = await fetch(url.toString(), init);
  if (!res.ok) throw await voiceError(res);
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