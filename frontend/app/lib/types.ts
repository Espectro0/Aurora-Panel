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

export const NODE_COLORS: Record<string, string> = {
  person: "#00e5ff",
  conversation: "#ff2bd6",
  concept: "#39ff14",
  event: "#ffbe0b",
  reflection: "#b967ff",
  project: "#ff6b35",
};

export const DEFAULT_NODE_COLOR = "#39ff14";

export function colorForType(type: string): string {
  return NODE_COLORS[type] ?? DEFAULT_NODE_COLOR;
}

export const EDGE_COLORS: Record<string, string> = {
  participates: "#00e5ff",
  mentions: "#ffbe0b",
  relates: "#39ff14",
  prefers: "#ff2bd6",
  reflects_on: "#b967ff",
  leads_to: "#ff6b35",
  sentiment: "#ff4d4d",
  similarity: "#5fae7a",
};

export const DEFAULT_EDGE_COLOR = "#5fae7a";

export function colorForEdgeType(type: string): string {
  return EDGE_COLORS[type] ?? DEFAULT_EDGE_COLOR;
}
