import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** Same palettes as the web onboarding (apps/web/src/features/onboarding/WaveCanvas.tsx). */
export const WAVE_PALETTES = [
  { sky: ["#fbf3e2", "#f3dcae"], layers: ["#f0cf8a", "#e2b45f", "#c9953e", "#7d5f14"] },
  { sky: ["#eaf4f4", "#cfe6e8"], layers: ["#8cc7cf", "#4fa3b1", "#277d8c", "#11505c"] },
  { sky: ["#1b1915", "#0d0c0a"], layers: ["#3a3020", "#5a4718", "#8a6a1f", "#c9a246"] },
  { sky: ["#faf8f4", "#f1e8d7"], layers: ["#f3ead8", "#e8d6ae", "#d9b768", "#a87c26"] },
];

/**
 * Layered animated waves. `touch` (x in px, 0..1 energy) pushes a bump through the surface;
 * the water level rises with `step`. Frames are throttled to ~30 fps (JS-driven SVG paths).
 */
export function Waves({ step, total, touch }: { step: number; total: number; touch: { x: number; energy: number } }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [time, setTime] = useState(0);
  const level = useRef(0.13);
  const swell = useRef(0);
  const prevStep = useRef(step);
  const energy = useRef(0);
  const reduce = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduce.current = v));
  }, []);

  useEffect(() => {
    if (step !== prevStep.current) swell.current = 1;
    prevStep.current = step;
  }, [step]);

  useEffect(() => {
    energy.current = Math.max(energy.current, touch.energy);
  }, [touch]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let acc = 0;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      const target = 0.13 + (prevStep.current / Math.max(1, total - 1)) * 0.11;
      level.current += (target - level.current) * Math.min(1, dt * 2.2);
      swell.current *= Math.pow(0.25, dt);
      energy.current *= Math.pow(0.35, dt);
      if (acc > 1 / 30) {
        setTime((t) => t + acc * (reduce.current ? 0.15 : 1));
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const palette = WAVE_PALETTES[step % WAVE_PALETTES.length];
  const { w, h } = size;
  const paths = palette.layers.map((_, i, arr) => {
    if (!w) return "";
    const depth = i / (arr.length - 1);
    const base = h * (1 - level.current - (1 - depth) * 0.11);
    const amp = (8 + depth * 14) * (1 + swell.current * 2.2 + energy.current * 0.8);
    const speed = 0.35 + depth * 0.5;
    const k = (Math.PI * 2) / (w * (0.9 - depth * 0.35));
    let d = `M0 ${h}`;
    for (let x = 0; x <= w + 12; x += 12) {
      let y = base + Math.sin(x * k + time * speed + i * 1.7) * amp + Math.sin(x * k * 2.3 - time * speed * 1.3 + i) * amp * 0.35;
      const dd = (x - touch.x) / 110;
      y -= Math.exp(-dd * dd) * energy.current * 30 * (0.5 + depth) * Math.cos(time * 5 - dd * 2);
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return `${d} L${w} ${h} Z`;
  });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none">
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.sky[0]} />
              <Stop offset="1" stopColor={palette.sky[1]} />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#sky)" />
          {paths.map((d, i) => (
            <Path key={i} d={d} fill={palette.layers[i]} opacity={0.55 + (i / (paths.length - 1)) * 0.45} />
          ))}
        </Svg>
      )}
    </View>
  );
}
