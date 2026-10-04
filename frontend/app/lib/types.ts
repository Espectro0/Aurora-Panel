export interface GraphNode {
  id: string;
  type: string;
  content: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  created_at?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface JournalEntry {
  timestamp: string;
  content: string;
  mood: string;
}

export interface HealthStatus {
  status: "ok" | "error";
  collection?: string;
  exists?: boolean;
  error?: string;
}

// Las tintas viven como variables CSS (globals.css) para que cambien con el tema.
// El DOM usa var(...); el canvas del mapa las resuelve con resolveColor.
const MOODS = [
  "neutral", "tranquila", "atenta", "curiosa", "contenta", "satisfecha",
  "entusiasmada", "reflexiva", "preocupada", "triste", "frustrada",
];
const NODE_TYPES = ["person", "conversation", "concept", "event", "reflection", "project"];
const EDGE_TYPES = [
  "participates", "mentions", "relates", "prefers",
  "reflects_on", "leads_to", "sentiment", "similarity",
];

export function colorForMood(mood: string): string {
  const m = mood.toLowerCase();
  return MOODS.includes(m) ? `var(--mood-${m})` : "var(--mood-neutral)";
}

export function colorForType(type: string): string {
  return NODE_TYPES.includes(type) ? `var(--type-${type})` : "var(--type-default)";
}

export function colorForEdgeType(type: string): string {
  return EDGE_TYPES.includes(type) ? `var(--edge-${type})` : "var(--edge-similarity)";
}

// "var(--x)" → valor computado actual; cualquier otro color pasa tal cual
export function resolveColor(color: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(color);
  if (!m || typeof document === "undefined") return color;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || color;
}

// Guard: cada llamada a una skill/herramienta pasa por la aduana de Aurora.
export type GuardDecision = "allow" | "deny" | "confirm";

export interface GuardEntry {
  time: string;
  skill: string;
  server?: string;
  tool?: string;
  args?: unknown;
  decision: GuardDecision;
  reason?: string;
  checks?: Record<string, unknown>;
  duration_ms: number;
  error?: string;
  result_chars?: number;
  attachments?: number;
}

export interface GuardGroupStats {
  name: string;
  total: number;
  allowed: number;
  blocked: number;
  errors: number;
  avg_duration_ms: number;
}

export interface GuardStats {
  since: string;
  total: number;
  allowed: number;
  blocked: number;
  denied: number;
  confirm: number;
  errors: number;
  avg_duration_ms: number;
  by_server: GuardGroupStats[];
  by_skill: GuardGroupStats[];
}

export interface GuardFilter {
  limit?: number;
  decision?: GuardDecision | "";
  server?: string;
  skill?: string;
  since?: string;
}

export type MCPServerState = "connecting" | "ready" | "error" | "disabled";

export interface MCPServer {
  name: string;
  status: MCPServerState;
  error?: string;
  tools?: string[];
  since: string;
  reconnects: number;
}

const DECISION_INK: Record<GuardDecision, string> = {
  allow: "var(--ok)",
  deny: "var(--danger)",
  confirm: "var(--warn)",
};

export function colorForDecision(d: string): string {
  return DECISION_INK[d as GuardDecision] ?? "var(--ink-3)";
}

const MCP_INK: Record<MCPServerState, string> = {
  ready: "var(--ok)",
  connecting: "var(--warn)",
  error: "var(--danger)",
  disabled: "var(--ink-3)",
};

export function colorForMCPStatus(s: string): string {
  return MCP_INK[s as MCPServerState] ?? "var(--ink-3)";
}
