"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchStatus } from "./api";
import { HealthStatus } from "./types";

export const POLL_MS = 15000;

export type HealthState = "loading" | "online" | "degraded" | "offline";

function toState(h: HealthStatus): HealthState {
  if (h.status !== "ok") return "offline";
  return h.exists ? "online" : "degraded";
}

export function useHealth() {
  const [state, setState] = useState<HealthState>("loading");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = useCallback(
    () =>
      fetchStatus()
        .then((h) => {
          setHealth(h);
          setState(toState(h));
        })
        .catch((e: Error) => {
          setHealth({ status: "error", error: e.message });
          setState("offline");
        })
        .finally(() => setCheckedAt(new Date())),
    [],
  );

  useEffect(() => {
    // la primera revisión corre al montar; el intervalo sigue cada POLL_MS
    const first = setTimeout(check, 0);
    const id = setInterval(check, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [check]);

  return { state, health, checkedAt, recheck: check };
}
