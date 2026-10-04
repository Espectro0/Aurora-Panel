"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendVoice } from "../lib/api";
import { etiquetteClass, SectionHeading } from "./Postal";
import VoiceOrb, { OrbState } from "./VoiceOrb";

// Opus en WebM (Chrome, Brave, Edge, Firefox) o en Ogg (Firefox antiguo)
const OPUS_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"];

type Support = "checking" | "ok" | "insecure" | "unsupported";

type Turn = {
  id: number;
  at: string;
  you?: string;
  aurora?: string;
  error?: string;
  speechError?: string;
  timings?: { transcribe_ms: number; reply_ms: number; speech_ms: number };
};

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: "The browser blocked the microphone. Allow it in the site settings and try again.",
  NotFoundError: "No microphone was found.",
  NotReadableError: "The microphone is busy in another app.",
};

const STATUS: Record<OrbState, string> = {
  idle: "Press talk and speak to Aurora.",
  listening: "Listening… press send when you finish.",
  thinking: "Aurora is thinking…",
  speaking: "Aurora is speaking.",
};

function opusType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return OPUS_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function secs(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function VoiceDesk() {
  const [support, setSupport] = useState<Support>("checking");
  const [state, setState] = useState<OrbState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const playingRef = useRef<AudioBufferSourceNode | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!window.isSecureContext || !navigator.mediaDevices) setSupport("insecure");
      else if (!opusType()) setSupport("unsupported");
      else setSupport("ok");
    }, 0);
    return () => {
      clearTimeout(t);
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
        rec.stream.getTracks().forEach((tr) => tr.stop());
      }
      playingRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  // un solo AudioContext, creado con el clic del usuario para que el navegador deje sonar
  const audio = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(analyser.fftSize);
    }
    void audioCtxRef.current.resume();
    return { ctx: audioCtxRef.current, analyser: analyserRef.current! };
  }, []);

  // volumen RMS de lo que pase por el analizador: tu micrófono o la voz de Aurora
  const level = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return 0;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }, []);

  const settle = useCallback((id: number, patch: Partial<Turn>) => {
    setTurns((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const play = useCallback(
    async (wavB64: string) => {
      const { ctx, analyser } = audio();
      const buffer = await ctx.decodeAudioData(base64ToBuffer(wavB64));
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      src.onended = () => {
        src.disconnect();
        analyser.disconnect();
        if (playingRef.current === src) playingRef.current = null;
        setState((s) => (s === "speaking" ? "idle" : s));
      };
      playingRef.current = src;
      setState("speaking");
      src.start();
    },
    [audio],
  );

  const deliver = useCallback(
    (clip: Blob) => {
      const id = nextId.current++;
      setTurns((p) => [...p, { id, at: new Date().toISOString() }].slice(-30));
      setState("thinking");

      sendVoice(clip)
        .then(async (turn) => {
          settle(id, {
            you: turn.transcript,
            aurora: turn.reply,
            speechError: turn.speech_error,
            timings: turn.timings,
          });
          if (turn.audio) {
            try {
              await play(turn.audio);
              return;
            } catch (e) {
              settle(id, { speechError: `couldn’t play the reply: ${(e as Error).message}` });
            }
          }
          setState("idle");
        })
        .catch((e: Error) => {
          settle(id, { error: e.message });
          setState("idle");
        });
    },
    [play, settle],
  );

  const talk = useCallback(async () => {
    const mimeType = opusType();
    if (!mimeType) return;
    setError(null);
    // hablar encima de Aurora la interrumpe
    playingRef.current?.stop();
    audio();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      const name = (e as DOMException).name;
      setError(MIC_ERRORS[name] ?? `Couldn’t open the microphone: ${(e as Error).message}`);
      return;
    }

    const rec = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      // suelta el micrófono para que el navegador apague su indicador
      stream.getTracks().forEach((t) => t.stop());
      if (chunks.length > 0) deliver(new Blob(chunks, { type: mimeType }));
      else setState("idle");
    };

    recRef.current = rec;
    rec.start();
    setState("listening");
  }, [audio, deliver]);

  const send = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const hush = useCallback(() => {
    playingRef.current?.stop();
  }, []);

  const listening = state === "listening";
  const onButton = listening ? send : state === "speaking" ? hush : talk;
  const buttonLabel = listening ? "Send" : state === "speaking" ? "Stop" : "Talk";

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-10 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
      <div>
        <h1 className="text-[clamp(2rem,4vw,2.8rem)] leading-none font-bold [font-stretch:84%] [word-spacing:0.1em]">
          Voice
        </h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          Talk to Aurora out loud. She hears you, answers with her own memory, and speaks the reply.
        </p>
      </div>

      <section aria-label="Voice conversation">
        <div className="flex flex-col items-center gap-5">
          <div className="aspect-[16/10] w-full max-w-[560px]">
            <VoiceOrb state={state} level={level} />
          </div>

          {support === "insecure" && (
            <p role="alert" className="max-w-[60ch] text-center text-sm text-ink-2">
              <span className="font-semibold text-danger">The microphone needs a secure page.</span> In Brave
              or Chrome, add <span className="font-mono">http://192.168.1.10:3001</span> to the{" "}
              <span className="font-mono">unsafely-treat-insecure-origin-as-secure</span> flag, or serve the panel
              over HTTPS.
            </p>
          )}
          {support === "unsupported" && (
            <p role="alert" className="max-w-[60ch] text-center text-sm text-ink-2">
              <span className="font-semibold text-danger">This browser can’t record Opus audio.</span> Use
              Brave, Chrome, Edge or Firefox.
            </p>
          )}

          {support === "ok" && (
            <>
              <p aria-live="polite" className="font-serif text-lg text-ink-2 italic">
                {STATUS[state]}
              </p>
              <button
                type="button"
                onClick={onButton}
                disabled={state === "thinking"}
                aria-pressed={listening}
                className={`${etiquetteClass(listening)} min-w-[8rem]`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${listening ? "animate-pulse" : ""}`}
                  style={{ background: listening ? "var(--danger)" : "currentColor" }}
                />
                {buttonLabel}
              </button>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="talk-heading">
        <SectionHeading id="talk-heading">Conversation</SectionHeading>
        <div className="on-desk">
          <div className="bg-onion">
            {turns.length === 0 ? (
              <p className="px-5 py-5 text-sm text-ink-2">Nothing said yet. Each exchange appears here.</p>
            ) : (
              <ol aria-live="polite">
                {turns.map((t) => (
                  <li key={t.id} className="flex flex-col gap-3 border-b border-rule px-5 py-4 last:border-b-0">
                    {!t.you && !t.error && <p className="animate-pulse text-sm text-ink-2">Aurora is listening…</p>}
                    {t.error && <p className="text-sm text-danger">Couldn’t talk to Aurora: {t.error}</p>}
                    {t.you && (
                      <p className="text-ink">
                        <span className="postal mr-2 text-[0.75rem] text-ink-2">You</span>
                        {t.you}
                      </p>
                    )}
                    {t.aurora && (
                      <p className="font-serif text-lg whitespace-pre-wrap text-ink">
                        <span className="postal mr-2 font-sans text-[0.75rem] text-airmail-blue">Aurora</span>
                        {t.aurora}
                      </p>
                    )}
                    {t.speechError && <p className="text-sm text-danger">No voice: {t.speechError}</p>}
                    {t.timings && (
                      <p className="text-[0.75rem] text-ink-2">
                        heard in {secs(t.timings.transcribe_ms)} · replied in {secs(t.timings.reply_ms)}
                        {t.timings.speech_ms > 0 && ` · voiced in ${secs(t.timings.speech_ms)}`}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
