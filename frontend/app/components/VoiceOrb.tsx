"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "confirming" | "speaking";

type Star = { x: number; y: number; z: number; size: number; tw: number; bright: boolean };
type Link = [a: number, b: number, phase: number];
type RGB = [number, number, number];
type Band = { rgb: RGB; y: number; amp: number; k: number; sp: number; h: number; ph: number };

const STARS = 520;
const LINKS = 70;

const AU = 96;

const BANDS: Band[] = [
  { rgb: [70, 255, 160], y: 0.68, amp: 0.06, k: 1.3, sp: 0.35, h: 0.44, ph: 0 },
  { rgb: [60, 190, 255], y: 0.56, amp: 0.08, k: 1.0, sp: -0.22, h: 0.36, ph: 2.1 },
  { rgb: [180, 100, 255], y: 0.44, amp: 0.05, k: 1.7, sp: 0.18, h: 0.3, ph: 4.3 },
];

const AMBER: RGB = [255, 170, 70];

const AURORA: Record<OrbState, number> = {
  idle: 0.45,
  listening: 0.5,
  thinking: 0.3,
  confirming: 0.55,
  speaking: 0.6,
};

const IRIS: [number, number][] = [
  [190, 0],
  [250, 0.5],
  [310, 0.15],
  [170, 0.55],
  [120, 0.1],
  [215, 0.45],
  [290, 0.2],
  [190, 0],
];

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

function makeStars(): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < STARS; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = i % 3 === 0 ? 0.97 : Math.cbrt(Math.random()) * 0.95;
    out.push({
      x: s * Math.cos(th) * r,
      y: u * r,
      z: s * Math.sin(th) * r,
      size: Math.random() ** 3 * 1.6 + 0.35,
      tw: Math.random() * Math.PI * 2,
      bright: Math.random() < 0.05,
    });
  }
  return out;
}

function makeLinks(stars: Star[]): Link[] {
  const out: Link[] = [];
  for (let n = 0; n < LINKS; n++) {
    const i = Math.floor(Math.random() * stars.length);
    const a = stars[i];
    let best = -1;
    let bd = 0.09; 
    for (let j = 0; j < stars.length; j++) {
      if (j === i) continue;
      const b = stars[j];
      const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
      if (d < bd && d > 0.004) {
        bd = d;
        best = j;
      }
    }
    if (best >= 0) out.push([i, best, Math.random() * Math.PI * 2]);
  }
  return out;
}

export default function VoiceOrb({
  state,
  level,
  mic,
}: {
  state: OrbState;
  level: () => number;
  mic?: () => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  const micRef = useRef(mic);

  useEffect(() => {
    stateRef.current = state;
    levelRef.current = level;
    micRef.current = mic;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const aur = document.createElement("canvas");
    aur.width = AU;
    aur.height = AU;
    const actx = aur.getContext("2d");
    if (!actx) return;

    const stars = makeStars();
    const links = makeLinks(stars);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sx = new Float32Array(STARS);
    const sy = new Float32Array(STARS);
    const sd = new Float32Array(STARS);

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawAurora = (t: number, strength: number, warm: number) => {
      actx.globalCompositeOperation = "source-over";
      actx.clearRect(0, 0, AU, AU);
      actx.globalCompositeOperation = "lighter";
      const tt = reduced ? t * 0.15 : t;
      const s = Math.min(1, strength);
      for (const b of BANDS) {
        const c = `${mix(b.rgb[0], AMBER[0], warm)},${mix(b.rgb[1], AMBER[1], warm)},${mix(b.rgb[2], AMBER[2], warm)}`;
        for (let x = 0; x < AU; x += 2) {
          const u = x / AU;
          const wave =
            Math.sin(u * b.k * Math.PI * 2 + tt * b.sp + b.ph) * b.amp +
            Math.sin(u * 9.3 - tt * 0.5 + b.ph) * b.amp * 0.35;
          const base = (b.y + wave) * AU;
          const fold = 0.55 + 0.45 * Math.sin(u * 14 + tt * 0.8 + b.ph * 2);
          const ht = b.h * fold * (0.7 + strength * 0.5) * AU;
          const a = s * 0.8 * (0.35 + 0.65 * fold);
          const g = actx.createLinearGradient(0, base, 0, base - ht);
          g.addColorStop(0, `rgba(${c},0)`);
          g.addColorStop(0.08, `rgba(${c},${a})`);
          g.addColorStop(0.35, `rgba(${c},${a * 0.45})`);
          g.addColorStop(1, `rgba(${c},0)`);
          actx.fillStyle = g;
          actx.fillRect(x, base - ht, 2, ht + 1);
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    let spin = 0;
    let smooth = 0; 
    let pulse = 0;
    let micE = 0; 
    let think = 0; 
    let warm = 0; 
    let glow = AURORA.idle;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = stateRef.current;

      const raw = st === "speaking" ? Math.min(1, levelRef.current() * 3.2) : 0;
      smooth += (raw - smooth) * (raw > smooth ? 0.35 : 0.08);
      const energy = smooth;
      pulse += (energy - pulse) * 0.2;

      const rawMic = st === "listening" ? Math.min(1, (micRef.current?.() ?? 0) * 4) : 0;
      micE += (rawMic - micE) * (rawMic > micE ? 0.3 : 0.06);

      const ease = 1 - Math.exp(-dt * 5);
      think += ((st === "thinking" ? 1 : 0) - think) * ease;
      warm += ((st === "confirming" ? 1 : 0) - warm) * ease;
      glow += (AURORA[st] - glow) * ease;
      const aurE = glow + micE * 0.7 + energy * 0.6;

      spin += dt * (reduced ? 0.03 : 0.12 + energy * 0.9 + think * 0.12);
      const breathe = reduced ? 0 : Math.sin(t * 1.57) * 0.008;

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.4 * (1 + pulse * 0.07 + breathe);

      ctx.clearRect(0, 0, w, h);

      const haloA = pulse * 0.4 + warm * 0.16 + micE * 0.15;
      if (haloA > 0.01) {
        const hc = `${mix(168, AMBER[0], warm)},${mix(140, AMBER[1], warm)},${mix(255, AMBER[2], warm)}`;
        const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (1.35 + pulse * 0.25));
        halo.addColorStop(0, `rgba(${hc},${haloA})`);
        halo.addColorStop(1, `rgba(${hc},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      base.addColorStop(0, "#07070f");
      base.addColorStop(0.75, "#0d0b1c");
      base.addColorStop(1, "#1d1838");
      ctx.fillStyle = base;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      ctx.globalCompositeOperation = "lighter";
      const blobs = [
        { a: spin * 0.6, d: 0.45, r: 0.75, c: "120,80,200" },
        { a: spin * 0.6 + 2.2, d: 0.55, r: 0.6, c: "170,120,230" },
        { a: -spin * 0.4 + 4.1, d: 0.35, r: 0.55, c: "90,70,170" },
      ];
      for (const b of blobs) {
        const bx = cx + Math.cos(b.a) * R * b.d;
        const by = cy + Math.sin(b.a * 0.8) * R * b.d * 0.7;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, R * b.r);
        g.addColorStop(0, `rgba(${b.c},${0.12 + energy * 0.18})`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      drawAurora(t, aurE, warm);
      ctx.globalAlpha = 0.6;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(aur, cx - R, cy - R, R * 2, R * 2);
      ctx.globalAlpha = 1;

      const cs = Math.cos(spin);
      const ss = Math.sin(spin);
      const tilt = 0.35;
      const ct = Math.cos(tilt);
      const stl = Math.sin(tilt);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const x1 = s.x * cs + s.z * ss;
        const z1 = -s.x * ss + s.z * cs;
        const y2 = s.y * ct - z1 * stl;
        const z2 = s.y * stl + z1 * ct;
        const depth = (z2 + 1) / 2; 
        const twinkle = 0.75 + 0.25 * Math.sin(now / 380 + s.tw);
        const alpha = (0.18 + depth * 0.82) * twinkle * (0.85 + energy * 0.3);
        const px = cx + x1 * R;
        const py = cy + y2 * R;
        sx[i] = px;
        sy[i] = py;
        sd[i] = depth;
        const size = s.size * (0.55 + depth * 0.75) * (1 + energy * 0.35);
        if (s.bright) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, size * 5);
          g.addColorStop(0, `rgba(255,255,255,${alpha})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(px - size * 5, py - size * 5, size * 10, size * 10);
        }
        ctx.fillStyle = `rgba(235,235,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (think > 0.01) {
        ctx.lineWidth = 0.75;
        for (const [i, j, ph] of links) {
          const on = Math.max(0, Math.sin(t * 0.9 + ph));
          const a = think * on * Math.min(sd[i], sd[j]) * 0.55;
          if (a < 0.02) continue;
          ctx.strokeStyle = `rgba(205,215,255,${a})`;
          ctx.beginPath();
          ctx.moveTo(sx[i], sy[i]);
          ctx.lineTo(sx[j], sy[j]);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";

      const sc = `${mix(235, 255, warm)},${mix(230, 205, warm)},${mix(255, 160, warm)}`;
      const shell = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
      shell.addColorStop(0, `rgba(${sc},0)`);
      shell.addColorStop(0.85, `rgba(${sc},${0.06 + energy * 0.08})`);
      shell.addColorStop(1, `rgba(${sc},${0.32 + energy * 0.25 + warm * 0.08})`);
      ctx.fillStyle = shell;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      const spec = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 0.6);
      spec.addColorStop(0, "rgba(255,255,255,0.13)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      ctx.globalCompositeOperation = "lighter";
      const iris = ctx.createConicGradient(spin * 0.5, cx, cy);
      const ia = Math.max(0, 0.45 + energy * 0.5 - warm * 0.2);
      IRIS.forEach(([hue, a], k) => iris.addColorStop(k / (IRIS.length - 1), `hsla(${hue},95%,70%,${a * ia})`));
      ctx.strokeStyle = iris;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 1.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = `rgba(${sc},${0.35 + energy * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}