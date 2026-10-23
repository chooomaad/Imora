"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** One color theme per onboarding step (back → front layers). */
export const WAVE_PALETTES: { sky: [string, string]; layers: string[] }[] = [
  // Golden dunes at sunset
  { sky: ["#fbf3e2", "#f3dcae"], layers: ["#f0cf8a", "#e2b45f", "#c9953e", "#7d5f14"] },
  // Atlantic ocean (Nouadhibou / Nouakchott coast)
  { sky: ["#eaf4f4", "#cfe6e8"], layers: ["#8cc7cf", "#4fa3b1", "#277d8c", "#11505c"] },
  // Desert night with gold accents
  { sky: ["#1b1915", "#0d0c0a"], layers: ["#3a3020", "#5a4718", "#8a6a1f", "#c9a246"] },
  // Cream & ink — Imora brand
  { sky: ["#faf8f4", "#f1e8d7"], layers: ["#f3ead8", "#e8d6ae", "#d9b768", "#a87c26"] },
];

export interface WaveHandle {
  /** Big swell when the step changes. */
  swell: () => void;
}

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

/**
 * Interactive layered waves: the water level rises with each step, the colors morph between
 * palettes, and the pointer pushes ripples through the surface. Respects prefers-reduced-motion.
 */
export const WaveCanvas = forwardRef<WaveHandle, { step: number; total: number }>(function WaveCanvas({ step, total }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    step, from: step, mixT: 1, level: 0, swell: 0,
    pointer: { x: -9999, y: 0, energy: 0, vx: 0 },
    ripples: [] as { x: number; t: number; power: number }[],
    particles: [] as { x: number; y: number; vy: number; r: number; life: number }[],
  });

  useImperativeHandle(ref, () => ({
    swell: () => {
      state.current.swell = 1;
    },
  }));

  useEffect(() => {
    const s = state.current;
    if (step !== s.step) {
      s.from = s.step;
      s.step = step;
      s.mixT = 0;
      s.swell = 1;
    }
  }, [step]);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now(), time = 0;
    const s = state.current;

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const v = x - (s.pointer.x < -1000 ? x : s.pointer.x);
      s.pointer = { x, y: e.clientY - r.top, energy: Math.min(1.4, s.pointer.energy + Math.abs(v) / 120), vx: v };
    };
    const onDown = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      s.ripples.push({ x: e.clientX - r.left, t: 0, power: 1 });
      for (let i = 0; i < 14; i++) {
        s.particles.push({ x: e.clientX - r.left + (Math.random() - 0.5) * 60, y: e.clientY - r.top, vy: -0.6 - Math.random() * 1.4, r: 1 + Math.random() * 2.5, life: 1 });
      }
    };
    const target = el.parentElement ?? el;
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerdown", onDown);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += reduce ? dt * 0.15 : dt;

      // Smooth state toward the current step
      s.mixT = Math.min(1, s.mixT + dt * 1.4);
      const targetLevel = 0.13 + (s.step / Math.max(1, total - 1)) * 0.11; // water rises step by step
      s.level += (targetLevel - s.level) * Math.min(1, dt * 2.2);
      s.swell *= Math.pow(0.25, dt);
      s.pointer.energy *= Math.pow(0.35, dt);
      s.ripples = s.ripples.filter((r) => (r.t += dt) < 2.6);

      const from = WAVE_PALETTES[s.from % WAVE_PALETTES.length];
      const to = WAVE_PALETTES[s.step % WAVE_PALETTES.length];
      const e = s.mixT * s.mixT * (3 - 2 * s.mixT); // smoothstep

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, mix(from.sky[0], to.sky[0], e));
      sky.addColorStop(1, mix(from.sky[1], to.sky[1], e));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sun / moon glow following the pointer a little
      const gx = w * 0.72 + (s.pointer.x > -1000 ? (s.pointer.x - w / 2) * 0.05 : 0);
      const glow = ctx.createRadialGradient(gx, h * 0.28, 0, gx, h * 0.28, Math.max(w, h) * 0.45);
      glow.addColorStop(0, s.step === 2 ? "rgba(232,198,109,0.22)" : "rgba(255,255,255,0.55)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const layers = to.layers.length;
      for (let i = 0; i < layers; i++) {
        const depth = i / (layers - 1); // 0 = back, 1 = front
        const base = h * (1 - s.level - (1 - depth) * 0.11);
        const amp = (10 + depth * 16) * (1 + s.swell * 2.2 + s.pointer.energy * 0.8);
        const speed = 0.35 + depth * 0.5;
        const k = (Math.PI * 2) / (w * (0.9 - depth * 0.35));

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) {
          let y = base
            + Math.sin(x * k + time * speed + i * 1.7) * amp
            + Math.sin(x * k * 2.3 - time * speed * 1.3 + i) * amp * 0.35;
          // Pointer push: a travelling bump around the cursor
          if (s.pointer.x > -1000) {
            const d = (x - s.pointer.x) / 140;
            y -= Math.exp(-d * d) * s.pointer.energy * 34 * (0.5 + depth) * Math.cos(time * 5 - d * 2);
          }
          // Tap ripples spreading outwards
          for (const r of s.ripples) {
            const dist = Math.abs(x - r.x) - r.t * 260;
            y += Math.exp(-(dist * dist) / 2400) * 26 * r.power * (1 - r.t / 2.6) * Math.sin(dist / 18) * (0.4 + depth);
          }
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, base - amp, 0, h);
        const col = mix(from.layers[i], to.layers[i], e);
        fill.addColorStop(0, col);
        fill.addColorStop(1, mix(from.layers[Math.min(i + 1, layers - 1)], to.layers[Math.min(i + 1, layers - 1)], e));
        ctx.globalAlpha = 0.55 + depth * 0.45;
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Gold dust / foam particles
      if (!reduce && Math.random() < 0.25) {
        s.particles.push({ x: Math.random() * w, y: h * (1 - s.level), vy: -0.3 - Math.random() * 0.6, r: 0.8 + Math.random() * 1.8, life: 1 });
      }
      s.particles = s.particles.filter((p) => (p.life -= dt * 0.45) > 0).slice(-160);
      for (const p of s.particles) {
        p.y += p.vy * 60 * dt;
        p.x += Math.sin(time * 2 + p.y / 30) * 0.3;
        ctx.globalAlpha = p.life * 0.8;
        ctx.fillStyle = s.step === 1 ? "#ffffff" : "#e8c66d";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerdown", onDown);
    };
  }, [total]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />;
});
