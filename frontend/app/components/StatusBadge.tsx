"use client";

import { useId } from "react";
import type { HealthState } from "../lib/useHealth";

// Matasellos de estado: cada estado tiene su propia forma, no solo su color.
//   loading  → aro punteado y tinta tenue
//   online   → matasellos completo + barras onduladas
//   degraded → matasellos + sello rectangular "collection missing"
//   offline  → sello rojo "undeliverable", sin matasellos

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function stampDate(d: Date | null) {
  if (!d) return { day: "—", time: "" };
  const day = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

function InkFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
      <feColorMatrix
        in="noise"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.55"
        result="speckle"
      />
      <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
      <feDisplacementMap in="inked" in2="noise" scale="1.6" />
    </filter>
  );
}

export function Postmark({
  state,
  collection,
  checkedAt,
}: {
  state: HealthState;
  collection?: string;
  checkedAt: Date | null;
}) {
  const uid = useId().replace(/:/g, "");
  const ink = `ink-${uid}`;
  const top = `top-${uid}`;
  const bottom = `bottom-${uid}`;
  const { day, time } = stampDate(checkedAt);
  const faint = state === "loading";

  if (state === "offline") {
    return (
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="Memory status: offline">
        <defs>
          <InkFilter id={ink} />
        </defs>
        <g filter={`url(#${ink})`} fill="none" stroke="var(--danger)" transform="rotate(-9 120 120)">
          <rect x="8" y="72" width="224" height="96" strokeWidth="5" />
          <rect x="16" y="80" width="208" height="80" strokeWidth="2" />
          <text
            x="120"
            y="124"
            textAnchor="middle"
            fill="var(--danger)"
            stroke="none"
            className="postal"
            style={{ fontSize: 34, fontWeight: 800 }}
          >
            Undeliverable
          </text>
          <text
            x="120"
            y="148"
            textAnchor="middle"
            fill="var(--danger)"
            stroke="none"
            className="postal"
            style={{ fontSize: 13 }}
          >
            Backend unreachable · {time}
          </text>
        </g>
      </svg>
    );
  }

  const word = state === "loading" ? "Checking" : state === "degraded" ? "Degraded" : "Online";

  return (
    <svg
      viewBox="0 0 240 240"
      className="h-full w-full overflow-visible"
      role="img"
      aria-label={`Memory status: ${word}`}
    >
      <defs>
        <InkFilter id={ink} />
        <path id={top} d="M 38,120 A 82,82 0 0 1 202,120" />
        <path id={bottom} d="M 20,120 A 100,100 0 0 0 220,120" />
      </defs>
      <g
        filter={`url(#${ink})`}
        fill="var(--cancel)"
        stroke="var(--cancel)"
        opacity={faint ? 0.4 : 0.92}
      >
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          strokeWidth="5"
          strokeDasharray={faint ? "10 9" : undefined}
        />
        <circle cx="120" cy="120" r="70" fill="none" strokeWidth="2.5" />
        <text stroke="none" className="postal" style={{ fontSize: 17 }}>
          <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
            Memory · {collection ?? "Qdrant"}
          </textPath>
        </text>
        <text stroke="none" className="postal" style={{ fontSize: 15 }}>
          <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
            Checked {time || "—"}
          </textPath>
        </text>
        <line x1="54" x2="186" y1="104" y2="104" strokeWidth="2" />
        <line x1="54" x2="186" y1="146" y2="146" strokeWidth="2" />
        <text
          x="120"
          y="136"
          textAnchor="middle"
          stroke="none"
          className="postal"
          style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.04em" }}
        >
          {word}
        </text>
        <text x="120" y="94" textAnchor="middle" stroke="none" className="postal" style={{ fontSize: 14 }}>
          {day}
        </text>
      </g>
    </svg>
  );
}

// Barras onduladas de la cancelación mecánica; solo cuando todo está en línea.
export function KillerBars() {
  const uid = useId().replace(/:/g, "");
  const waves = Array.from({ length: 6 }, (_, i) => {
    const y = 12 + i * 17;
    let d = `M 0 ${y}`;
    for (let x = 0; x <= 280; x += 20) {
      d += ` Q ${x + 10} ${(x / 20) % 2 === 0 ? y - 6 : y + 6} ${x + 20} ${y}`;
    }
    return d;
  });
  return (
    <svg viewBox="0 0 300 110" className="h-full w-full" aria-hidden="true">
      <defs>
        <InkFilter id={`bars-${uid}`} />
      </defs>
      <g filter={`url(#bars-${uid})`} fill="none" stroke="var(--cancel)" strokeWidth="3.2" opacity="0.88">
        {waves.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

// Sello rectangular del estado degradado.
export function MissingHandstamp({ collection }: { collection?: string }) {
  return (
    <div
      className="postal rotate-[7deg] border-[3px] px-3 py-2 text-center leading-tight"
      style={{
        color: "var(--warn)",
        borderColor: "var(--warn)",
        boxShadow: "inset 0 0 0 2px var(--aero), inset 0 0 0 4px var(--warn)",
      }}
    >
      <span className="block text-lg font-extrabold">Collection missing</span>
      <span className="block text-xs">{collection ?? "memory collection"} not found</span>
    </div>
  );
}
