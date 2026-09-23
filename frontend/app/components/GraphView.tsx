"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Network as VisNetwork } from "vis-network";
import { fetchGraph } from "../lib/api";
import {
  colorForEdgeType,
  colorForType,
  GraphData,
  resolveColor,
} from "../lib/types";
import { useTheme } from "../lib/useTheme";
import NodePanel, { neighborsFor, Selection } from "./NodePanel";
import { EtiquetteButton, Problem } from "./Postal";

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<VisNetwork | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [selection, setSelection] = useState<Selection | null>(null);
  const { theme } = useTheme();

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

        // el canvas necesita el nombre real de la fuente que genera next/font
        const fontFace =
          getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() ||
          "system-ui";
        // el canvas no entiende var(): se resuelven las tintas del tema actual
        const paper = resolveColor("var(--stamp-paper)");
        const labelInk = resolveColor("var(--ink-2)");
        const edgeInk = new Map(data.edges.map((e) => [e.type, resolveColor(colorForEdgeType(e.type))]));

        const nodes = new DataSet(
          data.nodes.map((n) => {
            const color = resolveColor(colorForType(n.type));
            return {
              id: n.id,
              label: n.content.length > 28 ? `${n.content.slice(0, 26).trimEnd()}…` : n.content || n.type,
              title: n.content,
              color: {
                background: paper,
                border: color,
                highlight: { background: color, border: color },
                hover: { background: paper, border: color },
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
            // las rutas se dibujan a mano en afterDrawing
            color: { color: "rgba(0,0,0,0)", highlight: "rgba(0,0,0,0)", hover: "rgba(0,0,0,0)" },
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
            font: { color: labelInk, face: fontFace, size: 12 },
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
            smooth: false,
            shadow: false,
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

        // las rutas van detrás de nodos y etiquetas
        network.on("beforeDrawing", (ctx: CanvasRenderingContext2D) => {
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
            ctx.strokeStyle = edgeInk.get(e.type) ?? labelInk;
            ctx.lineWidth = Math.max(1, e.weight * 2);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
          });
        });

        // deja margen para que las etiquetas no se corten en los bordes
        network.once("stabilizationIterationsDone", () => {
          network.fit();
          network.moveTo({ scale: network.getScale() * 0.75 });
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
  }, [data, theme]);

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
  }, [data, theme]);

  const edgeTypesPresent = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.edges.map((e) => e.type)));
  }, [data, theme]);

  const legendRow = (label: string, types: string[], colorFor: (t: string) => string) => (
    <div>
      <h2 className="text-xs text-ink-2">{label}</h2>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {types.map((type) => (
          <li key={type} className="postal flex items-center gap-1.5 text-[0.8rem]" style={{ color: colorFor(type) }}>
            <span className="size-2.5" style={{ background: colorFor(type) }} aria-hidden="true" />
            {type.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-aero"
      style={{
        // módulo de perforación: la misma rejilla de 12px de los sellos
        backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--rule) 45%, transparent) 1.2px, transparent 1.5px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-[1200px] flex-col items-start gap-3 px-4 pt-6 sm:px-6">
        <div>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.4rem)] leading-none font-bold [font-stretch:84%] [word-spacing:0.1em]">
            Memory map
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {data
              ? `${data.nodes.length.toLocaleString("en")} memories · ${data.edges.length.toLocaleString("en")} links`
              : "Connecting…"}
          </p>
        </div>

        {data && (nodeTypesPresent.length > 0 || edgeTypesPresent.length > 0) && (
          <div className="on-desk hidden max-w-[420px] sm:block">
            <div className="flex flex-col gap-3 bg-stamp-paper px-4 py-3">
              {nodeTypesPresent.length > 0 && legendRow("Memories", nodeTypesPresent, colorForType)}
              {edgeTypesPresent.length > 0 && legendRow("Links", edgeTypesPresent, colorForEdgeType)}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6 [&>*]:pointer-events-auto">
        <EtiquetteButton
          onClick={() =>
            networkRef.current?.fit({
              animation: { duration: 500, easingFunction: "easeInOutQuad" },
            })
          }
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="4.5" />
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3" strokeLinecap="round" />
          </svg>
          Fit to screen
        </EtiquetteButton>
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="animate-pulse text-sm text-ink-2">Loading the memory map…</p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="on-desk max-w-md">
            <div className="bg-onion p-6">
              <Problem what="the memory graph" message={error} onRetry={() => load(threshold)} />
            </div>
          </div>
        </div>
      )}

      {data && !loading && data.nodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-sm text-ink-2">No memories stored yet.</p>
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
