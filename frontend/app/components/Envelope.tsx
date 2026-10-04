"use client";

import Image from "next/image";
import { POLL_MS, useHealth } from "../lib/useHealth";
import { EtiquetteButton } from "./Postal";
import { KillerBars, MissingHandstamp, Postmark } from "./StatusBadge";

const HEADLINE = {
  loading: "Checking her memory…",
  online: "Her memory is online.",
  degraded: "Her memory collection is missing.",
  offline: "Can’t reach her memory.",
} as const;

function clock(d: Date | null) {
  return d ? d.toLocaleTimeString("en-GB") : "—";
}

export default function Envelope() {
  const { state, health, checkedAt, recheck } = useHealth();
  const collection = health?.collection;

  return (
    <section aria-labelledby="status-heading" className="on-desk">
      <div className="par-avion p-2">
        <div className="relative grid gap-8 bg-aero px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_420px] lg:items-center">
          {/* Remitente */}
          <p className="text-sm leading-snug text-ink-2 lg:absolute lg:top-8 lg:left-8">
            <span className="font-semibold text-ink">From: Aurora</span>
            <br />
            Companion bot on Discord and Telegram
          </p>

          {/* Destinatario: el detalle del estado */}
          <div className="order-last flex flex-col gap-4 lg:order-none lg:pt-16" aria-live="polite">
            <h1
              id="status-heading"
              className="text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.02] font-bold text-ink [font-stretch:84%] [word-spacing:0.1em] [text-wrap:balance]"
            >
              {HEADLINE[state]}
            </h1>

            <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 border-t border-rule pt-3 text-sm">
              <dt className="text-ink-2">Memory</dt>
              <dd className="text-ink">
                {collection ? (
                  <>
                    {collection}
                    <span className="text-ink-2">
                      {" "}
                      · {state === "degraded" ? "collection not found in Qdrant" : "Qdrant reachable"}
                    </span>
                  </>
                ) : state === "loading" ? (
                  "—"
                ) : (
                  <span className="text-ink-2">unknown</span>
                )}
              </dd>
              <dt className="text-ink-2">Last check</dt>
              <dd className="text-ink">
                {clock(checkedAt)}
                <span className="text-ink-2"> · every {POLL_MS / 1000} s</span>
              </dd>
              {state === "offline" && health?.error && (
                <>
                  <dt className="text-ink-2">Error</dt>
                  <dd className="break-words text-danger">{health.error}</dd>
                </>
              )}
            </dl>

            {(state === "offline" || state === "degraded") && (
              <div>
                <EtiquetteButton onClick={recheck}>Check again</EtiquetteButton>
              </div>
            )}
          </div>

          {/* Sello con el retrato, cancelado por el matasellos */}
          <div className="relative mx-auto aspect-[420/300] w-full max-w-[420px]">
            <div className="on-desk absolute top-0 right-0 w-[42%]">
              <div className="perforated">
                <div className="relative aspect-[4/5] overflow-hidden border-2 border-airmail-blue bg-airmail-blue">
                  <Image
                    src="/aurora.png"
                    alt="Aurora’s portrait"
                    fill
                    sizes="180px"
                    className="object-cover"
                    priority
                  />
                </div>
                <p className="postal pt-1.5 text-center text-sm font-bold text-airmail-blue">
                  Aurora
                </p>
              </div>
            </div>

            {state === "online" && (
              <div className="pointer-events-none absolute top-[45%] left-0 h-[28%] w-[24%]">
                <KillerBars />
              </div>
            )}

            <div
              key={`${state}-${checkedAt?.getTime() ?? 0}`}
              className="strike pointer-events-none absolute top-[24%] left-[18%] w-[50%] -rotate-[8deg]"
            >
              <Postmark state={state} collection={collection} checkedAt={checkedAt} />
            </div>

            {state === "degraded" && (
              <div className="absolute right-[2%] bottom-0">
                <MissingHandstamp collection={collection} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
