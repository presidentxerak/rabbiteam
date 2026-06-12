"use client";

/**
 * Musique d'ambiance cristalline GÉNÉRÉE (Web Audio API, zéro asset).
 * Un pad doux en fond + des notes de cloche égrenées sur une gamme
 * pentatonique majeure, avec réverbération. L'autoplay étant bloqué par les
 * navigateurs, le son ne démarre qu'au clic du bouton (geste utilisateur).
 */
import { useEffect, useRef, useState } from "react";

// Pentatonique majeure de Do (fréquences, Hz) - toujours consonant.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export default function AmbientMusic() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef<{ stop: () => void }[]>([]);

  function buildReverb(ctx: AudioContext): ConvolverNode {
    // Réverbe « cristalline » : impulse response synthétique (decay exponentiel).
    const len = ctx.sampleRate * 2.4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function bell(ctx: AudioContext, dest: AudioNode, freq: number, when: number, gain: number): void {
    const osc = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    o2.type = "triangle";
    osc.frequency.value = freq;
    o2.frequency.value = freq * 2.01; // léger battement = scintillement
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 3.2);
    osc.connect(g);
    o2.connect(g);
    g.connect(dest);
    osc.start(when);
    o2.start(when);
    osc.stop(when + 3.3);
    o2.stop(when + 3.3);
  }

  function start(): void {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
    const reverb = buildReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);
    masterRef.current = master;

    // Pad drone très doux (deux oscillateurs détunés).
    const padG = ctx.createGain();
    padG.gain.value = 0.05;
    padG.connect(master);
    [130.81, 196.0].forEach((f, i) => {
      const p = ctx.createOscillator();
      p.type = "sine";
      p.frequency.value = f * (i === 0 ? 1 : 1.003);
      p.connect(padG);
      p.start();
      nodesRef.current.push({ stop: () => p.stop() });
    });

    // Notes de cloche égrenées à intervalles aléatoires.
    const scheduleNote = () => {
      if (!ctxRef.current) return;
      const freq = NOTES[Math.floor(Math.random() * NOTES.length)] ?? 523.25;
      bell(ctx, reverb, freq, ctx.currentTime + 0.05, 0.18);
      if (Math.random() > 0.5) bell(ctx, reverb, (NOTES[Math.floor(Math.random() * NOTES.length)] ?? 659.25), ctx.currentTime + 0.4, 0.1);
      timerRef.current = setTimeout(scheduleNote, 1800 + Math.random() * 2600);
    };
    scheduleNote();
  }

  function stop(): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        nodesRef.current.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* déjà arrêté */
          }
        });
        nodesRef.current = [];
        ctx.close().catch(() => undefined);
      }, 700);
    }
    ctxRef.current = null;
    masterRef.current = null;
  }

  useEffect(() => () => stop(), []);

  function toggle(): void {
    if (on) {
      stop();
      setOn(false);
    } else {
      start();
      setOn(true);
    }
  }

  return (
    <button
      className="music-toggle"
      onClick={toggle}
      aria-label={on ? "Turn ambient music off" : "Turn ambient music on"}
      title={on ? "Ambient music: on" : "Ambient music: off"}
    >
      <span className={`music-icon${on ? " playing" : ""}`}>
        <span />
        <span />
        <span />
      </span>
      {on ? "Music on" : "Music"}
    </button>
  );
}
