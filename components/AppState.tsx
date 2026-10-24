"use client";

// App State: approved swaps, round opt-ins and the award decision, kept in localStorage
// through createLocalStore() (lib/store.ts).
//
// Hydration safety: the server render and the first client render both use the default
// state (getServerSnapshot). After mount, useEffect loads the stored state and the
// component tree re-renders with it. The store is also watched for changes made by
// this tab (store.subscribe) and by other tabs (the "storage" event).
//
// This file has no JSX on purpose, so the pure helpers below can be imported in node tests.

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { createLocalStore, defaultState, STORE_KEY } from "../lib/store";
import type { Store } from "../lib/store";
import type { StoreState, Supplier } from "../lib/types";

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)
// ---------------------------------------------------------------------------

/** Drug ids with an approved swap. */
export function selectApprovedSwapDrugIds(state: StoreState): string[] {
  return Object.values(state.swaps)
    .filter((s) => s.approved)
    .map((s) => s.drugId);
}

/** Sum of the extra savings per year of the approved swaps, in dollars. */
export function selectTotalApprovedExtras(state: StoreState): number {
  return Object.values(state.swaps)
    .filter((s) => s.approved)
    .reduce((sum, s) => sum + (Number.isFinite(s.extraSavingsYr) ? s.extraSavingsYr : 0), 0);
}

export type StateSource = {
  /** Stable reference until the state really changes (required by useSyncExternalStore). */
  getSnapshot: () => StoreState;
  /** Always the default state: used by the server and by the first client render. */
  getServerSnapshot: () => StoreState;
  subscribe: (listener: () => void) => () => void;
  /** Reads the store again. Notifies listeners only when the state changed. */
  refresh: () => void;
};

/** Wraps a Store so React gets a cached snapshot. Starts with the default state. */
export function createStateSource(store: Store): StateSource {
  const initial = defaultState();
  let snapshot = initial;
  let snapshotJson = JSON.stringify(initial);
  const listeners = new Set<() => void>();

  const refresh = () => {
    const next = store.getState();
    const json = JSON.stringify(next);
    if (json === snapshotJson) return;
    snapshot = next;
    snapshotJson = json;
    listeners.forEach((l) => l());
  };

  // Changes made through the store (this tab) refresh the snapshot.
  store.subscribe(refresh);

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type SwapInput = { drugId: string; toMfr: string; extraSavingsYr: number };

export type AppState = {
  state: StoreState;
  approveSwap: (drugId: string, toMfr: string, extraSavingsYr: number) => void;
  approveAllSwaps: (list: SwapInput[]) => void;
  undoSwap: (drugId: string) => void;
  optIn: (roundId: string, units: number) => void;
  removeOptIn: (roundId: string) => void;
  confirmOptIn: (roundId: string) => void;
  setAward: (roundId: string, supplier: Supplier) => void;
  clearAward: () => void;
  reset: () => void;
  approvedSwapDrugIds: string[];
  totalApprovedExtras: number;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // One store and one snapshot cache per provider. On the server this is a memory store.
  const [source] = useState(() => {
    const store = createLocalStore();
    return { store, src: createStateSource(store) };
  });
  const { store, src } = source;

  const state = useSyncExternalStore(src.subscribe, src.getSnapshot, src.getServerSnapshot);

  // After mount: load the stored state, and follow changes from other tabs.
  useEffect(() => {
    src.refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORE_KEY) src.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [src]);

  const approveSwap = useCallback(
    (drugId: string, toMfr: string, extraSavingsYr: number) => {
      store.approveSwap({
        drugId,
        toMfr,
        approved: true,
        extraSavingsYr,
        decidedAt: new Date().toISOString(),
      });
    },
    [store],
  );

  const approveAllSwaps = useCallback(
    (list: SwapInput[]) => {
      for (const s of list) approveSwap(s.drugId, s.toMfr, s.extraSavingsYr);
    },
    [approveSwap],
  );

  const undoSwap = useCallback((drugId: string) => store.revokeSwap(drugId), [store]);

  const optIn = useCallback(
    (roundId: string, units: number) => {
      store.setOptIn({ roundId, units, optedAt: new Date().toISOString(), confirmed: false });
    },
    [store],
  );

  const removeOptIn = useCallback((roundId: string) => store.removeOptIn(roundId), [store]);

  const confirmOptIn = useCallback(
    (roundId: string) => {
      const current = store.getState().optIns[roundId];
      if (current) store.setOptIn({ ...current, confirmed: true });
    },
    [store],
  );

  const setAward = useCallback(
    (roundId: string, supplier: Supplier) => {
      store.setAward({ roundId, supplier, decidedAt: new Date().toISOString() });
    },
    [store],
  );

  const clearAward = useCallback(() => store.setAward(null), [store]);
  const reset = useCallback(() => store.reset(), [store]);

  const value = useMemo<AppState>(
    () => ({
      state,
      approveSwap,
      approveAllSwaps,
      undoSwap,
      optIn,
      removeOptIn,
      confirmOptIn,
      setAward,
      clearAward,
      reset,
      approvedSwapDrugIds: selectApprovedSwapDrugIds(state),
      totalApprovedExtras: selectTotalApprovedExtras(state),
    }),
    [
      state,
      approveSwap,
      approveAllSwaps,
      undoSwap,
      optIn,
      removeOptIn,
      confirmOptIn,
      setAward,
      clearAward,
      reset,
    ],
  );

  return createElement(AppStateContext.Provider, { value }, children);
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
