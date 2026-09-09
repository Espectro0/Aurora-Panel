"use client";

import type { ReactNode } from "react";
import {
  colorForEdgeType,
  colorForType,
  GraphEdge,
  GraphNode,
} from "../lib/types";

export type Selection =
  | { kind: "node"; node: GraphNode }
  | { kind: "edge"; edge: GraphEdge; source: GraphNode; target: GraphNode };

interface Props {
  selection: Selection | null;
  neighbors: { node: GraphNode; edge: GraphEdge }[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function edgeTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export default function NodePanel({
  selection,
  neighbors,
  onClose,
  onSelectNode,
}: Props) {
  const open = selection !== null;
  const color =
    selection?.kind === "node"
      ? colorForType(selection.node.type)
      : selection?.kind === "edge"
      ? colorForEdgeType(selection.edge.type)
      : "#39ff14";

  return (
    <aside
      className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-20 transform transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{
        background: "rgba(5, 8, 6, 0.96)",
        borderLeft: `1px solid ${color}55`,
        boxShadow: open ? `-24px 0 60px -20px ${color}66` : "none",
      }}
    >
      {selection?.kind === "node" && (
        <NodeDetail
          node={selection.node}
          neighbors={neighbors}
          onClose={onClose}
          onSelectNode={onSelectNode}
        />
      )}
      {selection?.kind === "edge" && (
        <EdgeDetail
          edge={selection.edge}
          source={selection.source}
          target={selection.target}
          onClose={onClose}
          onSelectNode={onSelectNode}
        />
      )}
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-5 text-xs uppercase tracking-widest text-[#5fae7a]">
      {children}
    </h2>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="shrink-0 rounded border border-[#39ff1444] px-2 py-1 text-xs text-[#39ff14] hover:bg-[#39ff1422] transition-colors"
    >
      ✕ close
    </button>
  );
}

function NodeMiniCard({
  node,
  onClick,
}: {
  node: GraphNode;
  onClick: () => void;
}) {
  const color = colorForType(node.type);
  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-[#39ff1433] px-3 py-2 text-left hover:border-[#39ff14aa] hover:bg-[#39ff1411] transition-colors"
    >
      <span
        className="text-xs uppercase tracking-wide"
        style={{ color }}
      >
        {node.type || "unknown"}
      </span>
      <p className="mt-1 line-clamp-2 text-xs text-[#c9ffd6]">
        {node.content}
      </p>
      <p className="mt-1 truncate text-[10px] text-[#5fae7a]">{node.id}</p>
    </button>
  );
}

function NodeDetail({
  node,
  neighbors,
  onClose,
  onSelectNode,
}: {
  node: GraphNode;
  neighbors: { node: GraphNode; edge: GraphEdge }[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const color = colorForType(node.type);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 font-mono text-sm text-[#c9ffd6]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="inline-block rounded px-2 py-0.5 text-xs uppercase tracking-widest"
            style={{
              color,
              border: `1px solid ${color}88`,
              textShadow: `0 0 8px ${color}aa`,
            }}
          >
            {node.type || "unknown"}
          </span>
          <p className="mt-2 break-all text-[10px] text-[#5fae7a]">{node.id}</p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <SectionLabel>timestamp</SectionLabel>
      <p className="mt-1" style={{ textShadow: `0 0 6px ${color}66` }}>
        {formatDate(node.created_at)}
      </p>

      <SectionLabel>content</SectionLabel>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[#e8fff0]">
        {node.content || "(empty)"}
      </p>

      <SectionLabel>metadata</SectionLabel>
      <pre className="mt-1 overflow-x-auto rounded border border-[#39ff1433] bg-black/40 p-3 text-xs text-[#8fffb0]">
        {node.metadata && Object.keys(node.metadata).length > 0
          ? JSON.stringify(node.metadata, null, 2)
          : "{}"}
      </pre>

      <SectionLabel>connections ({neighbors.length})</SectionLabel>
      <ul className="mt-1 flex flex-col gap-2">
        {neighbors.length === 0 && (
          <li className="text-[#5fae7a]">no linked memories</li>
        )}
        {neighbors
          .sort((a, b) => b.edge.weight - a.edge.weight)
          .map(({ node: n, edge }) => (
            <li key={n.id}>
              <button
                onClick={() => onSelectNode(n.id)}
                className="w-full rounded border border-[#39ff1433] px-3 py-2 text-left hover:border-[#39ff14aa] hover:bg-[#39ff1411] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs uppercase tracking-wide"
                    style={{ color: colorForEdgeType(edge.type) }}
                  >
                    {edgeTypeLabel(edge.type)}
                  </span>
                  <span className="text-[10px] text-[#5fae7a]">
                    {(edge.weight * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-[#5fae7a]">
                  → {n.id}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[#c9ffd6]">
                  {n.content}
                </p>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function EdgeDetail({
  edge,
  source,
  target,
  onClose,
  onSelectNode,
}: {
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}) {
  const color = colorForEdgeType(edge.type);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 font-mono text-sm text-[#c9ffd6]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="inline-block rounded px-2 py-0.5 text-xs uppercase tracking-widest"
            style={{
              color,
              border: `1px solid ${color}88`,
              textShadow: `0 0 8px ${color}aa`,
            }}
          >
            connection
          </span>
          <p className="mt-2 text-lg" style={{ color, textShadow: `0 0 10px ${color}88` }}>
            {edgeTypeLabel(edge.type)}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <SectionLabel>strength</SectionLabel>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40 border border-[#39ff1433]">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, edge.weight * 100)}%`,
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </div>
        <span className="text-xs text-[#c9ffd6]">
          {(edge.weight * 100).toFixed(1)}%
        </span>
      </div>

      {edge.created_at && (
        <>
          <SectionLabel>formed</SectionLabel>
          <p className="mt-1">{formatDate(edge.created_at)}</p>
        </>
      )}

      <SectionLabel>source node</SectionLabel>
      <NodeMiniCard node={source} onClick={() => onSelectNode(source.id)} />

      <SectionLabel>target node</SectionLabel>
      <NodeMiniCard node={target} onClick={() => onSelectNode(target.id)} />
    </div>
  );
}

export function neighborsFor(
  node: GraphNode,
  nodes: GraphNode[],
  edgeList: GraphEdge[]
): { node: GraphNode; edge: GraphEdge }[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result: { node: GraphNode; edge: GraphEdge }[] = [];

  for (const e of edgeList) {
    if (e.source === node.id && byId.has(e.target)) {
      result.push({ node: byId.get(e.target)!, edge: e });
    } else if (e.target === node.id && byId.has(e.source)) {
      result.push({ node: byId.get(e.source)!, edge: e });
    }
  }

  return result;
}