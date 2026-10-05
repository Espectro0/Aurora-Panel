"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmVoice, streamVoice, VoiceEvent } from "../lib/api";
import { etiquetteClass, EtiquetteButton, SectionHeading } from "./Postal";
import VoiceOrb, { OrbState } from "./VoiceOrb";

const OPUS_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"];

type Support = "checking" | "ok" | "insecure" | "unsupported";

type Outcome = "approved" | "rejected" | "expired" | "cancelled";

type Asked = { id: string; skill: string; server?: string; outcome?: Outcome };

type Turn = {
  id: number;
  you?: string;
  aurora?: string;
  error?: string;
  speechError?: string;
  asked: Asked[];
  timings: { transcribe_ms?: number; reply_ms?: number; speech_ms?: number };
};

type Pending = {
  id: string;
  turnId: number;
  skill: string;
  server?: string;
  text: string;
  sensitive?: boolean;
  busy: boolean;
  note?: string;
};

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: "The browser blocked the microphone. Allow it in the site settings and try again.",
  NotFoundError: "No microphone was found.",
  NotReadableError: "The microphone is busy in another app.",
};

const THINKING = [
  "Aurora is thinking…",
  "Consulting the council of tiny gremlins…",
  "Brewing a reply…",
  "Googling it…",
  "Bribing the server with extra RAM…",
  "Untangling the spaghetti…",
  "Thinking very hard. Do not disturb.",
  "Asking the cat. The cat said no.",
  "Spinning up the hamster wheel…",
  "Almost there. Probably. Maybe.",
  "Hallucinating…",
  "Convulsing…",
  "Combobulating…",
  "Discombobulating…",
  "Recombobulating…",
  "Flibbertigibbeting…",
  "Spelunking…",
  "Overthinking…",
  "Doodling…",
  "Dilly-dallying…",
  "Shenaniganing…",
  "Lollygagging…",
  "Bamboozling…",
  "Hornswoggling…",
  "Kerfuffling…",
  "Befuddling…",
  "Frolicking…",
  "Gallivanting…",
  "Moseying…",
  "Wibbling…",
  "Wobbling…",
  "Transmogrifying…",
];

const THINKING_MS = 3000;

const STATUS: Record<OrbState, string> = {
  idle: "Press talk and speak to Aurora.",
  listening: "Listening… press send when you finish.",
  thinking: THINKING[0],
  confirming: "Aurora needs your OK. Say yes or no, or use the buttons.",
  speaking: "Aurora is speaking.",
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  approved: "approved",
  rejected: "rejected",
  expired: "expired without an answer",
  cancelled: "cancelled",
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
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thought, setThought] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const playingRef = useRef<AudioBufferSourceNode | null>(null);
  // analizador propio del micrófono: va aparte del de Aurora para no sonar por los parlantes
  const micRef = useRef<{ node: AnalyserNode; src: MediaStreamAudioSourceNode; buf: Uint8Array<ArrayBuffer> } | null>(
    null,
  );
  const nextId = useRef(0);
  const pendingRef = useRef<Pending | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

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

useEffect(() => {
  if (state !== "thinking") return;
  const t = setInterval(
    () =>
      setThought((i) => {
        const j = Math.floor(Math.random() * (THINKING.length - 1));
        return j >= i ? j + 1 : j;
      }),
    THINKING_MS,
  );
  return () => {
    clearInterval(t);
    setThought(0);
  };
}, [state]);

  const rest = useCallback((): OrbState => {
    if (pendingRef.current) return "confirming";
    return inFlightRef.current ? "thinking" : "idle";
  }, []);

  const settleState = useCallback(() => {
    setState((s) => (s === "listening" || s === "speaking" ? s : rest()));
  }, [rest]);

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

  // volumen RMS de tu voz mientras grabas
  const micLevel = useCallback(() => {
    const m = micRef.current;
    if (!m) return 0;
    m.node.getByteTimeDomainData(m.buf);
    let sum = 0;
    for (let i = 0; i < m.buf.length; i++) {
      const v = (m.buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / m.buf.length);
  }, []);

  const settle =useCallback((id: number, patch: (t: Turn) => Partial<Turn>) => {
    setTurns((p) => p.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)));
  }, []);

  const openPending = useCallback((p: Pending | null) => {
    pendingRef.current = p;
    setPending(p);
  }, []);

  const play = useCallback(
    async (wavB64: string) => {
      const { ctx, analyser } = audio();
      const buffer = await ctx.decodeAudioData(base64ToBuffer(wavB64));
      playingRef.current?.stop();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      src.onended = () => {
        src.disconnect();
        if (playingRef.current !== src) return;
        analyser.disconnect();
        playingRef.current = null;
        setState((s) => (s === "speaking" ? rest() : s));
      };
      playingRef.current = src;
      setState("speaking");
      src.start();
    },
    [audio, rest],
  );

  const speak = useCallback(
    (wavB64: string | undefined, turnId: number) => {
      if (!wavB64) return;
      play(wavB64).catch((e: Error) =>
        settle(turnId, () => ({ speechError: `couldn’t play Aurora’s voice: ${e.message}` })),
      );
    },
    [play, settle],
  );

  const onEvent = useCallback(
    (turnId: number, e: VoiceEvent) => {
      switch (e.type) {
        case "transcript":
          settle(turnId, (t) => ({ you: e.text, timings: { ...t.timings, transcribe_ms: e.ms } }));
          break;
        case "confirm":
          openPending({
            id: e.id,
            turnId,
            skill: e.skill,
            server: e.server,
            text: e.text,
            sensitive: e.sensitive,
            busy: false,
          });
          settle(turnId, (t) => ({ asked: [...t.asked, { id: e.id, skill: e.skill, server: e.server }] }));
          if (e.audio) speak(e.audio, turnId);
          else settleState();
          break;
        case "confirm_result": {
          const outcome: Outcome =
            e.approved === true ? "approved" : e.approved === false ? "rejected" : e.text === "expired" ? "expired" : "cancelled";
          if (pendingRef.current?.id === e.id) openPending(null);
          settle(turnId, (t) => ({ asked: t.asked.map((a) => (a.id === e.id ? { ...a, outcome } : a)) }));
          settleState();
          break;
        }
        case "reply":
          settle(turnId, (t) => ({ aurora: e.text, timings: { ...t.timings, reply_ms: e.ms } }));
          break;
        case "audio":
          settle(turnId, (t) => ({ timings: { ...t.timings, speech_ms: e.ms } }));
          speak(e.audio, turnId);
          break;
        case "speech_error":
          settle(turnId, () => ({ speechError: e.error }));
          break;
        case "error":
          settle(turnId, () => ({ error: e.error }));
          break;
      }
    },
    [openPending, settle, settleState, speak],
  );

  const deliver = useCallback(
    (clip: Blob) => {
      const id = nextId.current++;
      setTurns([{ id, asked: [], timings: {} }]);
      inFlightRef.current = true;
      setState("thinking");

      streamVoice(clip, (e) => onEvent(id, e))
        .catch((e: Error) => settle(id, () => ({ error: e.message })))
        .finally(() => {
          inFlightRef.current = false;
          if (pendingRef.current?.turnId === id) openPending(null);
          settleState();
        });
    },
    [onEvent, openPending, settle, settleState],
  );

  const answer = useCallback(
    (reply: { answer: "yes" | "no" } | { clip: Blob }) => {
      const p = pendingRef.current;
      if (!p) return;
      openPending({ ...p, busy: true, note: "clip" in reply ? "Checking your answer…" : undefined });
      setState("confirming");

      confirmVoice(p.id, reply)
        .then((r) => {
          if (pendingRef.current?.id !== p.id) return;
          if (r.decision === "unclear") {
            openPending({
              ...p,
              busy: false,
              note: `Didn’t catch a clear yes or no${r.transcript ? ` (heard “${r.transcript}”)` : ""}.`,
            });
            speak(r.audio, p.turnId);
            return;
          }
          openPending({ ...p, busy: true, note: r.decision === "yes" ? "Approved, running it…" : "Rejected." });
        })
        .catch((e: Error) => {
          if (pendingRef.current?.id === p.id) openPending({ ...p, busy: false, note: e.message });
        });
    },
    [openPending, speak],
  );

  const talk = useCallback(async () => {
    const mimeType = opusType();
    if (!mimeType) return;
    setError(null);
    playingRef.current?.stop();
    const { ctx } = audio();

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

    // el micrófono solo entra al analizador, nunca a ctx.destination
    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    node.smoothingTimeConstant = 0.6;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(node);
    micRef.current = { node, src, buf: new Uint8Array(node.fftSize) };

    const rec = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      src.disconnect();
      if (micRef.current?.src === src) micRef.current = null;
      stream.getTracks().forEach((t) => t.stop());
      const clip = chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null;
      if (pendingRef.current) {
        if (clip) answer({ clip });
        else setState("confirming");
      } else if (clip) deliver(clip);
      else setState(rest());
    };

    recRef.current = rec;
    rec.start();
    setState("listening");
  }, [answer, audio, deliver, rest]);

  const send = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const hush = useCallback(() => {
    playingRef.current?.stop();
  }, []);

  const listening = state === "listening";
  const onButton = listening ? send : state === "speaking" ? hush : talk;
  const buttonLabel = listening ? "Send" : state === "speaking" ? "Stop" : pending ? "Answer" : "Talk";

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
            <VoiceOrb state={state} level={level} mic={micLevel} />
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
              <p aria-live="polite" className="text-center font-serif text-lg text-ink-2 italic">
                {state === "thinking" ? THINKING[thought] : STATUS[state]}
              </p>
              <button
                type="button"
                onClick={onButton}
                disabled={state === "thinking" || (pending?.busy && !listening)}
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

          {pending && <ConfirmCard pending={pending} onAnswer={(a) => answer({ answer: a })} />}

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
                    {t.asked.map((a) => (
                      <p key={a.id} className="text-sm text-ink-2">
                        <span className="postal mr-2 text-[0.75rem] text-warn">Guard</span>
                        Asked to run <span className="font-mono text-ink">{a.skill}</span>
                        {a.server && <> on {a.server}</>} · {a.outcome ? OUTCOME_LABEL[a.outcome] : "waiting for you"}
                      </p>
                    ))}
                    {t.aurora && (
                      <p className="font-serif text-lg whitespace-pre-wrap text-ink">
                        <span className="postal mr-2 font-sans text-[0.75rem] text-airmail-blue">Aurora</span>
                        {t.aurora}
                      </p>
                    )}
                    {t.speechError && <p className="text-sm text-danger">No voice: {t.speechError}</p>}
                    {t.timings.reply_ms !== undefined && (
                      <p className="text-[0.75rem] text-ink-2">
                        heard in {secs(t.timings.transcribe_ms ?? 0)} · replied in {secs(t.timings.reply_ms)}
                        {t.timings.speech_ms !== undefined && ` · voiced in ${secs(t.timings.speech_ms)}`}
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

function ConfirmCard({ pending, onAnswer }: { pending: Pending; onAnswer: (a: "yes" | "no") => void }) {
  return (
    <div role="alertdialog" aria-labelledby="confirm-heading" className="on-desk w-full max-w-[560px]">
      <div className="flex flex-col gap-3 border-l-4 border-warn bg-onion px-5 py-4">
        <h2 id="confirm-heading" className="text-ink">
          <span className="postal mr-2 text-[0.75rem] text-warn">Needs your OK</span>
          Run <span className="font-mono">{pending.skill}</span>
          {pending.server && <> on {pending.server}</>}?
        </h2>
        <pre className="max-h-64 overflow-auto border border-rule bg-stamp-paper p-3 font-mono text-[0.78rem] whitespace-pre-wrap break-words text-ink">
          {pending.text}
        </pre>
        {pending.sensitive && (
          <p className="text-sm text-ink-2">The arguments contain sensitive data, so they’re hidden.</p>
        )}
        {pending.note && (
          <p aria-live="polite" className="text-sm text-ink-2">
            {pending.note}
          </p>
        )}
        <div className="flex gap-2">
          <EtiquetteButton onClick={() => onAnswer("yes")} disabled={pending.busy}>
            Approve
          </EtiquetteButton>
          <EtiquetteButton onClick={() => onAnswer("no")} disabled={pending.busy}>
            Reject
          </EtiquetteButton>
        </div>
      </div>
    </div>
  );
}