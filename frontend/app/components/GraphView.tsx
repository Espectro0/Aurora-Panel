"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Network as VisNetwork } from "vis-network";
import { fetchGraph } from "../lib/api";
import {
  colorForEdgeType,
  colorForType,
  EDGE_COLORS,
  GraphData,
  NODE_COLORS,
} from "../lib/types";
import NodePanel, { neighborsFor, Selection } from "./NodePanel";

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<VisNetwork | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [selection, setSelection] = useState<Selection | null>(null);

  const load = useCallback((t: number) => {
    setLoading(true);
    setError(null);
    fetchGraph(t)
      .then(setData)
      .catch((e: Error) => setError(e.message ?? "failed to load graph"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    let cancelled = false;

    Promise.all([import("vis-network"), import("vis-data")]).then(
      ([{ Network }, { DataSet }]) => {
        if (cancelled || !containerRef.current) return;

        const nodes = new DataSet(
          data.nodes.map((n) => {
            const color = colorForType(n.type);
            return {
              id: n.id,
              label: n.id.slice(0, 8),
              title: n.content,
              color: {
                background: "#000000",
                border: color,
                highlight: { background: "#000000", border: color },
                hover: { background: "#000000", border: color },
              },
            };
          }),
        );

        const edges = new DataSet(
          data.edges.map((e, i) => ({
            id: i,
            from: e.source,
            to: e.target,
            width: Math.max(1, e.weight * 3),
            color: "#000000",
          })),
        );

        const options = {
          physics: {
            stabilization: true,
            barnesHut: { gravitationalConstant: -4000, springLength: 80 },
          },
          interaction: {
            hover: true,
            dragNodes: true,
            dragView: false,
            zoomView: true,
          },
          nodes: {
            shape: "dot",
            size: 10,
            borderWidth: 2,
            font: { color: "#8fffb0", face: "monospace" },
            chosen: {
              node: (values: any, id: any, selected: boolean) => {
                if (selected) {
                  values.size = 16;
                  values.borderWidth = 3;
                }
              },
              label: true,
            },
          },
          edges: {
            color: "#39ff1466",
            smooth: false,
            shadow: { enabled: true, size: 8 },
          },
        };

        networkRef.current?.destroy();

        const network = new Network(
          containerRef.current,
          { nodes, edges },
          options,
        );

        let dashOffset = 0;
        function animateEdges() {
          dashOffset -= 0.06;
          network.redraw();
          animationFrameRef.current = requestAnimationFrame(animateEdges);
        }

        network.once("afterDrawing", () => {
          animationFrameRef.current = requestAnimationFrame(animateEdges);
        });

        network.on("afterDrawing", (ctx: CanvasRenderingContext2D) => {
          const positions = network.getPositions();
          const selectedIds = new Set(network.getSelectedNodes() as string[]);

          data.edges.forEach((e) => {
            const from = positions[e.source];
            const to = positions[e.target];
            if (!from || !to) return;

            const fromRadius = selectedIds.has(e.source) ? 16 : 10;
            const toRadius = selectedIds.has(e.target) ? 16 : 10;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;

            const ux = dx / dist;
            const uy = dy / dist;
            const startX = from.x + ux * fromRadius;
            const startY = from.y + uy * fromRadius;
            const endX = to.x - ux * toRadius;
            const endY = to.y - uy * toRadius;

            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = dashOffset;
            ctx.strokeStyle = colorForEdgeType(e.type);
            ctx.lineWidth = Math.max(1, e.weight * 2);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
          });
        });

        network.on("click", (params) => {
          if (params.nodes.length > 0) {
            const id = params.nodes[0] as string;
            const original = data.nodes.find((n) => n.id === id) ?? null;
            if (original) setSelection({ kind: "node", node: original });
          } else {
            setSelection(null);
          }
        });

        networkRef.current = network;
      },
    );

    return () => {
      cancelled = true;
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [data]);

  useEffect(() => {
    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, []);

  const neighbors = useMemo(() => {
    if (!data || selection?.kind !== "node") return [];
    return neighborsFor(selection.node, data.nodes, data.edges);
  }, [selection, data]);

  const selectNodeById = useCallback(
    (id: string) => {
      const n = data?.nodes.find((n) => n.id === id) ?? null;
      setSelection(n ? { kind: "node", node: n } : null);
    },
    [data],
  );

  const nodeTypesPresent = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.nodes.map((n) => n.type)));
  }, [data]);

  const edgeTypesPresent = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.edges.map((e) => e.type)));
  }, [data]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 z-20 flex flex-col gap-3 p-5 font-mono">
        <div>
          <h1
            className="text-xl tracking-[0.3em] text-[#39ff14]"
            style={{
              textShadow:
                "0 0 5px #39ff14, 0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14, 0 0 80px #39ff14, 2px 2px 4px rgba(0,0,0,1)",
            }}
          >
            AURORA :: MIND GRAPH
          </h1>
          <p className="mt-1 text-xs text-[#5fae7a]">
            {data
              ? `${data.nodes.length} nodes / ${data.edges.length} links`
              : "connecting..."}
          </p>
        </div>

        <div className="flex flex-row flex-wrap gap-3 rounded border border-[#39ff1444] bg-black/60 px-3 py-2 text-xs">
          <span>Node Info</span>
          {nodeTypesPresent.map((type) => {
            const color = colorForType(type);
            return (
              <span
                key={type}
                className="flex items-center gap-2"
                style={{ color }}
              >
                <span
                  className="h-2 w-2 rounded-full border"
                  style={{ borderColor: color, boxShadow: `0 0 6px ${color}` }}
                />
                {type}
              </span>
            );
          })}
        </div>

        <div className="flex flex-row flex-wrap gap-3 rounded border border-[#39ff1444] bg-black/60 px-3 py-2 text-xs">
          <span>Edge Info</span>
          {edgeTypesPresent.map((type) => {
            const color = colorForEdgeType(type);
            return (
              <span
                key={type}
                className="flex items-center gap-2"
                style={{ color }}
              >
                <span
                  className="h-2 w-2 rounded-full border"
                  style={{ borderColor: color, boxShadow: `0 0 6px ${color}` }}
                />
                {type}
              </span>
            );
          })}
        </div>
      </div>

      <button
        onClick={() =>
          networkRef.current?.fit({
            animation: { duration: 500, easingFunction: "easeInOutQuad" },
          })
        }
        className="pointer-events-auto absolute bottom-5 left-5 z-20 rounded border border-[#39ff1444] bg-black/60 px-3 py-2 font-mono text-xs text-[#39ff14] hover:bg-[#39ff1422]"
      >
        ⌖ Center
      </button>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center font-mono text-sm text-[#39ff14]">
          <p className="animate-pulse tracking-widest">Loading Graph...</p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center font-mono text-sm text-red-400">
          <div className="rounded border border-red-500/50 bg-black/80 px-6 py-4">
            <p>Error loading graph: {error}</p>
            <button
              onClick={() => load(threshold)}
              className="mt-3 rounded border border-red-500/60 px-3 py-1 text-xs hover:bg-red-500/10"
            >
              retry
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />

      <NodePanel
        selection={selection}
        neighbors={neighbors}
        onClose={() => {
          networkRef.current?.unselectAll();
          setSelection(null);
        }}
        onSelectNode={selectNodeById}
      />
    </div>
  );
}
