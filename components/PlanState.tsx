"use client";

// Plan state: whether the pharmacy has uploaded its purchases, and which drugs it chose to
// re-negotiate on the Re-negotiate (Compare) page. Kept in localStorage next to the App State.
// Server render and first client render use the default (nothing uploaded), so no insights
// flash before the stored state loads.

import { useCallback, useSyncExternalStore } from "react";

export const PLAN_KEY = "pharmapool.plan.v1";
const EVENT = "pharmapool-plan";

export type PlanState = { uploaded: boolean; negotiated: string[] };

const DEFAULT: PlanState = { uploaded: false, negotiated: [] };

let cacheJson = "";
let cache: PlanState = DEFAULT;

function read(): PlanState {
  let json = "";
  try {
    json = window.localStorage.getItem(PLAN_KEY) ?? "";
  } catch {
    json = "";
  }
  if (json === cacheJson) return cache;
  cacheJson = json;
  try {
    const p = JSON.parse(json) as Partial<PlanState>;
    cache = {
      uploaded: p.uploaded === true,
      negotiated: Array.isArray(p.negotiated) ? p.negotiated.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    cache = DEFAULT;
  }
  return cache;
}

function write(next: PlanState) {
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the change still applies to this page view through the event below.
    cacheJson = JSON.stringify(next);
    cache = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PLAN_KEY) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePlan() {
  const plan = useSyncExternalStore(subscribe, read, () => DEFAULT);

  const setUploaded = useCallback((uploaded: boolean) => {
    const cur = read();
    if (cur.uploaded !== uploaded) write({ ...cur, uploaded });
  }, []);

  const setNegotiated = useCallback((drugId: string, on: boolean) => {
    const cur = read();
    const set = new Set(cur.negotiated);
    if (on) set.add(drugId);
    else set.delete(drugId);
    write({ ...cur, negotiated: Array.from(set) });
  }, []);

  const negotiateAll = useCallback((drugIds: string[]) => {
    const cur = read();
    write({ ...cur, negotiated: Array.from(new Set([...cur.negotiated, ...drugIds])) });
  }, []);

  const clearPlan = useCallback(() => write(DEFAULT), []);

  return { plan, setUploaded, setNegotiated, negotiateAll, clearPlan };
}
