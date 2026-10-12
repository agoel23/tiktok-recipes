import { useEffect, useRef, useState } from "react";

/** "Keep screen on" while cooking. Re-acquires the lock when the tab becomes visible again. */
export function useWakeLock() {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [on, setOn] = useState(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!on || !supported) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel.current = await navigator.wakeLock.request("screen");
      } catch {
        if (!cancelled) setOn(false);
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [on, supported]);

  return { supported, on, setOn };
}
