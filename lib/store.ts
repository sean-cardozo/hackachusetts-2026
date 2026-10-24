// Demo state: approved swaps, round opt-ins and the award decision.
// Works in Node (no window) by falling back to memory.

import type { AwardDecision, OptIn, StoreState, SwapDecision } from "./types";

export const STORE_KEY = "pharmapool:state:v1";

export interface Store {
  getState(): StoreState;
  approveSwap(decision: SwapDecision): void;
  revokeSwap(drugId: string): void;
  setOptIn(optIn: OptIn): void;
  removeOptIn(roundId: string): void;
  setAward(award: AwardDecision | null): void;
  reset(): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function defaultState(): StoreState {
  return { swaps: {}, optIns: {}, award: null };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parse a stored string. Returns the default state if it is missing or invalid. */
export function parseState(raw: string | null | undefined): StoreState {
  if (!raw) return defaultState();
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return defaultState();
    const { swaps, optIns, award } = data;
    if (!isRecord(swaps) || !isRecord(optIns)) return defaultState();
    if (award !== null && !isRecord(award)) return defaultState();
    return {
      swaps: swaps as StoreState["swaps"],
      optIns: optIns as StoreState["optIns"],
      award: (award ?? null) as StoreState["award"],
    };
  } catch {
    return defaultState();
  }
}

type Backend = {
  read(): string | null;
  write(value: string): void;
};

function createStore(backend: Backend): Store {
  const listeners = new Set<() => void>();

  const load = (): StoreState => parseState(backend.read());
  const save = (state: StoreState) => {
    backend.write(JSON.stringify(state));
    listeners.forEach((l) => l());
  };

  return {
    getState: load,
    approveSwap(decision) {
      const s = load();
      save({ ...s, swaps: { ...s.swaps, [decision.drugId]: decision } });
    },
    revokeSwap(drugId) {
      const s = load();
      const swaps = { ...s.swaps };
      delete swaps[drugId];
      save({ ...s, swaps });
    },
    setOptIn(optIn) {
      const s = load();
      save({ ...s, optIns: { ...s.optIns, [optIn.roundId]: optIn } });
    },
    removeOptIn(roundId) {
      const s = load();
      const optIns = { ...s.optIns };
      delete optIns[roundId];
      save({ ...s, optIns });
    },
    setAward(award) {
      save({ ...load(), award });
    },
    reset() {
      save(defaultState());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** In-memory store. Used in tests and when localStorage is unavailable. */
export function createMemoryStore(initial?: StoreState): Store {
  let raw: string | null = initial ? JSON.stringify(initial) : null;
  return createStore({
    read: () => raw,
    write: (v) => {
      raw = v;
    },
  });
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    // Probe: some browsers expose localStorage but throw on use (private mode, quota).
    const probe = "__pharmapool_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed store. Falls back to memory when localStorage is
 * unavailable (Node, SSR, blocked storage) or when a write fails.
 */
export function createLocalStore(key: string = STORE_KEY): Store {
  const ls = getLocalStorage();
  if (!ls) return createMemoryStore();

  let memory: string | null = null;
  let useMemory = false;
  return createStore({
    read() {
      if (useMemory) return memory;
      try {
        return ls.getItem(key);
      } catch {
        useMemory = true;
        return memory;
      }
    },
    write(value) {
      memory = value;
      if (useMemory) return;
      try {
        ls.setItem(key, value);
      } catch {
        useMemory = true;
      }
    },
  });
}
