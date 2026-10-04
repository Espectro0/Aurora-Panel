"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Esfera de vidrio con un cielo nocturno dentro. Las estrellas viven en una
// bola unitaria que gira en 3D; solo la voz de Aurora (nivel 0..1) la hace
// latir, acelera el giro y aviva la nebulosa y el borde iridiscente.
// Mientras el usuario habla o Aurora piensa, la esfera queda en reposo.

type Star = { x: number; y: number; z: number; size: number; tw: number; bright: boolean };
type Fleck = { a: number; lat: number; hue: number; len: number };

const STARS = 520;
const FLECKS = 150;

function makeStars(): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < STARS; i++) {
    // dirección uniforme; un tercio pegadas a la cáscara, el resto en el volumen
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

function makeFlecks(): Fleck[] {
  const hues = [0, 120, 215, 50, 300];
  return Array.from({ length: FLECKS }, () => ({
    a: Math.random() * Math.PI * 2,
    lat: Math.random() * 2 - 1,
    hue: hues[Math.floor(Math.random() * hues.length)],
    len: Math.random() * 2.5 + 1,
  }));
}

export default function VoiceOrb({ state, level }: { state: OrbState; level: () => number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);

  useEffect(() => {
    stateRef.current = state;
    levelRef.current = level;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const stars = makeStars();
    const flecks = makeFlecks();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    let raf = 0;
    let last = performance.now();
    let spin = 0;
    let smooth = 0; // nivel suavizado: sube rápido, baja despacio
    let pulse = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = stateRef.current;

      const raw = st === "speaking" ? Math.min(1, levelRef.current() * 3.2) : 0;
      smooth += (raw - smooth) * (raw > smooth ? 0.35 : 0.08);
      const energy = smooth;
      pulse += (energy - pulse) * 0.2;

      spin += dt * (reduced ? 0.03 : 0.12 + energy * 0.9);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.4 * (1 + pulse * 0.07);

      ctx.clearRect(0, 0, w, h);

      // halo exterior
      // halo exterior: solo existe mientras Aurora habla
      if (pulse > 0.01) {
        const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (1.35 + pulse * 0.25));
        halo.addColorStop(0, `rgba(168,140,255,${pulse * 0.4})`);
        halo.addColorStop(1, "rgba(168,140,255,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // fondo: noche profunda, un poco más clara hacia el borde
      const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      base.addColorStop(0, "#07070f");
      base.addColorStop(0.75, "#0d0b1c");
      base.addColorStop(1, "#1d1838");
      ctx.fillStyle = base;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      // nebulosa: manchas violetas que orbitan despacio
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
        g.addColorStop(0, `rgba(${b.c},${0.16 + energy * 0.22})`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // estrellas: rotación en Y con una leve inclinación en X
      const cy_ = Math.cos(spin);
      const sy_ = Math.sin(spin);
      const tilt = 0.35;
      const ct = Math.cos(tilt);
      const stl = Math.sin(tilt);
      for (const s of stars) {
        const x1 = s.x * cy_ + s.z * sy_;
        const z1 = -s.x * sy_ + s.z * cy_;
        const y2 = s.y * ct - z1 * stl;
        const z2 = s.y * stl + z1 * ct;
        const depth = (z2 + 1) / 2; // 0 atrás, 1 delante
        const twinkle = 0.75 + 0.25 * Math.sin(now / 380 + s.tw);
        const alpha = (0.18 + depth * 0.82) * twinkle * (0.85 + energy * 0.3);
        const px = cx + x1 * R;
        const py = cy + y2 * R;
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
      ctx.globalCompositeOperation = "source-over";

      // cáscara de vidrio: el borde se aclara como una burbuja
      const shell = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
      shell.addColorStop(0, "rgba(255,255,255,0)");
      shell.addColorStop(0.85, `rgba(200,195,255,${0.06 + energy * 0.08})`);
      shell.addColorStop(1, `rgba(235,230,255,${0.32 + energy * 0.25})`);
      ctx.fillStyle = shell;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      // reflejo superior izquierdo
      const spec = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 0.6);
      spec.addColorStop(0, "rgba(255,255,255,0.13)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      // destellos cromáticos sobre el borde, como la dispersión de un prisma
      ctx.globalCompositeOperation = "lighter";
      for (const f of flecks) {
        const a = f.a + spin * 0.5;
        // solo se ven los que caen cerca del contorno visible
        const edge = Math.sqrt(1 - f.lat * f.lat);
        const front = Math.cos(a * 1.3 + f.lat);
        const vis = Math.max(0, front) * edge;
        if (vis < 0.15) continue;
        const rr = R * (0.965 + f.lat * 0.02);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        const tx = -Math.sin(a);
        const ty = Math.cos(a);
        const len = f.len * (1 + energy * 1.5);
        ctx.strokeStyle = `hsla(${f.hue},100%,62%,${vis * (0.55 + energy * 0.45)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px - tx * len, py - ty * len);
        ctx.lineTo(px + tx * len, py + ty * len);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      // contorno fino
      ctx.strokeStyle = `rgba(220,215,255,${0.35 + energy * 0.3})`;
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
