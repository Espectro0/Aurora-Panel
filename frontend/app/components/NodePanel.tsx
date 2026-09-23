"use client";

import type { ReactNode } from "react";
import { Arrow, etiquetteClass } from "./Postal";
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

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={`absolute top-0 right-0 z-20 h-full w-full bg-onion transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:w-[420px] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{
        borderLeft: "1px solid var(--rule)",
        boxShadow: open ? "-10px 0 24px rgb(var(--shadow) / 0.18)" : "none",
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
    <h2 className="mt-6 mb-1.5 text-sm text-ink-2">
      {children}
    </h2>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className={etiquetteClass()}
    >
      Close
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
      className="w-full border border-rule bg-stamp-paper px-3 py-2.5 text-left transition-colors hover:border-airmail-blue"
    >
      <span
        className="postal text-[0.8rem]"
        style={{ color }}
      >
        {node.type || "unknown"}
      </span>
      <p className="mt-1 line-clamp-2 text-xs text-ink">
        {node.content}
      </p>
      <p className="mt-1 truncate text-[10px] text-ink-2">{node.id}</p>
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
    <div className="flex h-full flex-col overflow-y-auto p-6 text-sm text-ink">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="postal inline-block px-2 py-1 text-[0.8rem] leading-none text-stamp-paper"
            style={{ background: color }}
          >
            {node.type || "unknown"}
          </span>
          <p className="mt-2 break-all text-[10px] text-ink-2">{node.id}</p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <SectionLabel>timestamp</SectionLabel>
      <p>
        {formatDate(node.created_at)}
      </p>

      <SectionLabel>content</SectionLabel>
      <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap text-ink">
        {node.content || "(empty)"}
      </p>

      <SectionLabel>metadata</SectionLabel>
      <pre className="overflow-x-auto border border-rule bg-stamp-paper p-3 text-xs text-ink">
        {node.metadata && Object.keys(node.metadata).length > 0
          ? JSON.stringify(node.metadata, null, 2)
          : "{}"}
      </pre>

      <SectionLabel>connections ({neighbors.length})</SectionLabel>
      <ul className="flex flex-col gap-2">
        {neighbors.length === 0 && (
          <li className="text-ink-2">no linked memories</li>
        )}
        {neighbors
          .sort((a, b) => b.edge.weight - a.edge.weight)
          .map(({ node: n, edge }) => (
            <li key={n.id}>
              <button
                onClick={() => onSelectNode(n.id)}
                className="w-full border border-rule bg-stamp-paper px-3 py-2.5 text-left transition-colors hover:border-airmail-blue"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="postal text-[0.8rem]"
                    style={{ color: colorForEdgeType(edge.type) }}
                  >
                    {edgeTypeLabel(edge.type)}
                  </span>
                  <span className="text-[10px] text-ink-2">
                    {(edge.weight * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-ink-2">
                  <Arrow className="mr-1" /> {n.content ? n.id.slice(0, 8) : n.id}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-ink">
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
    <div className="flex h-full flex-col overflow-y-auto p-6 text-sm text-ink">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="postal inline-block px-2 py-1 text-[0.8rem] leading-none text-stamp-paper"
            style={{ background: color }}
          >
            connection
          </span>
          <p className="mt-2 text-xl font-semibold" style={{ color }}>
            {edgeTypeLabel(edge.type)}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <SectionLabel>strength</SectionLabel>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden border border-rule bg-stamp-paper">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, edge.weight * 100)}%`,
              background: color,
            }}
          />
        </div>
        <span className="text-xs text-ink">
          {(edge.weight * 100).toFixed(1)}%
        </span>
      </div>

      {edge.created_at && (
        <>
          <SectionLabel>formed</SectionLabel>
          <p>{formatDate(edge.created_at)}</p>
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