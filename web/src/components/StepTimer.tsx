import { useEffect, useState } from "react";

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    /* no audio */
  }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StepTimer({ minutes }: { minutes: number }) {
  const total = Math.round(minutes * 60);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(total);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setEndsAt(null);
        setDone(true);
        beep();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't toggle the step's checkbox
    if (endsAt != null) {
      setEndsAt(null);
      setLeft(total);
    } else {
      setDone(false);
      setEndsAt(Date.now() + total * 1000);
    }
  };

  const label = endsAt != null ? `${fmt(left)} · tap to stop` : done ? "Done! Restart" : `Start ${fmt(total)} timer`;
  return (
    <button type="button" className={`timer ${endsAt != null ? "running" : ""} ${done ? "done" : ""}`} onClick={onClick}>
      ⏱ {label}
    </button>
  );
}
