"use client";
import { useEffect } from "react";

// Reports active time (tab visible) for signed-in users, once a minute.
export function Heartbeat() {
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const seconds = Math.round((now - last) / 1000);
      last = now;
      if (document.visibilityState === "visible" && seconds > 0) {
        fetch("/api/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seconds: Math.min(seconds, 60) }),
        }).catch(() => {});
      }
    };
    const id = setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") last = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
