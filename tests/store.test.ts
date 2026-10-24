import { afterEach, describe, expect, it } from "vitest";
import {
  STORE_KEY,
  createLocalStore,
  createMemoryStore,
  defaultState,
  parseState,
} from "../lib/store";
import type { OptIn, SwapDecision } from "../lib/types";

const swap: SwapDecision = {
  drugId: "atorvastatin-20",
  toMfr: "Accord",
  approved: true,
  extraSavingsYr: 1940,
  decidedAt: "2026-10-24T10:00:00.000Z",
};
const optIn: OptIn = {
  roundId: "cardio",
  units: 255_600,
  optedAt: "2026-10-24T10:05:00.000Z",
  confirmed: false,
};

function fakeStorage(initial: Record<string, string> = {}, failWrites = false) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error("quota");
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

function installWindow(storage: ReturnType<typeof fakeStorage>) {
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("memory store", () => {
  it("starts with the default state", () => {
    expect(createMemoryStore().getState()).toEqual(defaultState());
  });

  it("persists swaps, opt-ins and the award decision", () => {
    const s = createMemoryStore();
    s.approveSwap(swap);
    s.setOptIn(optIn);
    s.setAward({ roundId: "mental-gi", supplier: "B", decidedAt: "2026-10-24T11:00:00.000Z" });
    const state = s.getState();
    expect(state.swaps["atorvastatin-20"]).toEqual(swap);
    expect(state.optIns.cardio).toEqual(optIn);
    expect(state.award?.supplier).toBe("B");
  });

  it("revokes, removes and resets", () => {
    const s = createMemoryStore();
    s.approveSwap(swap);
    s.setOptIn(optIn);
    s.revokeSwap("atorvastatin-20");
    s.removeOptIn("cardio");
    expect(s.getState()).toEqual(defaultState());
    s.approveSwap(swap);
    s.reset();
    expect(s.getState()).toEqual(defaultState());
  });

  it("notifies subscribers until they unsubscribe", () => {
    const s = createMemoryStore();
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.setOptIn(optIn);
    off();
    s.setOptIn(optIn);
    expect(calls).toBe(1);
  });
});

describe("parseState", () => {
  it("returns the default state for unparseable or wrongly shaped values", () => {
    expect(parseState(null)).toEqual(defaultState());
    expect(parseState("{not json")).toEqual(defaultState());
    expect(parseState("[]")).toEqual(defaultState());
    expect(parseState('{"swaps":1,"optIns":{},"award":null}')).toEqual(defaultState());
  });
});

describe("local store", () => {
  it("falls back to memory when window is undefined (Node)", () => {
    expect(typeof window).toBe("undefined");
    const s = createLocalStore();
    s.setOptIn(optIn);
    expect(s.getState().optIns.cardio).toEqual(optIn);
  });

  it("persists to localStorage", () => {
    const storage = fakeStorage();
    installWindow(storage);
    createLocalStore().approveSwap(swap);
    expect(JSON.parse(storage.data[STORE_KEY]).swaps["atorvastatin-20"]).toEqual(swap);
    // A new store instance reads the persisted value.
    expect(createLocalStore().getState().swaps["atorvastatin-20"]).toEqual(swap);
  });

  it("ignores a corrupt stored value and returns the default state", () => {
    installWindow(fakeStorage({ [STORE_KEY]: "}{ broken" }));
    expect(createLocalStore().getState()).toEqual(defaultState());
  });

  it("falls back to memory when localStorage throws on write", () => {
    installWindow(fakeStorage({}, true));
    const s = createLocalStore();
    s.setOptIn(optIn);
    expect(s.getState().optIns.cardio).toEqual(optIn);
  });
});
