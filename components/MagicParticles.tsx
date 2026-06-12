"use client";

/**
 * Champ de particules magiques : petites étincelles pastel qui montent
 * lentement en scintillant. Canvas plein écran, pointer-events none, derrière
 * le contenu. Respecte prefers-reduced-motion (statique alors).
 */
import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  hue: number;
}

const COLORS = ["#FF9EB5", "#FFD93D", "#6BCB77", "#4D96FF", "#9B5DE5", "#FFB347", "#F15BB5"];

export default function MagicParticles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const count = Math.min(70, Math.floor((w * h) / 26000));
    const sparks: Spark[] = Array.from({ length: count }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 2.4,
      speed: 0.1 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      hue: Math.floor(Math.random() * COLORS.length),
    }));

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const s of sparks) {
        if (!reduce) {
          s.y -= s.speed;
          s.x += s.drift + Math.sin(t + s.phase) * 0.2;
          if (s.y < -10) {
            s.y = h + 10;
            s.x = Math.random() * w;
          }
        }
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + s.phase));
        const color = COLORS[s.hue] ?? "#FFD93D";
        ctx.globalAlpha = twinkle * 0.5;
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="magic-particles" aria-hidden="true" />;
}
