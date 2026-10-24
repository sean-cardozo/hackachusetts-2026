// Pure helpers for the Join page. Safe in client code (no node:fs).
import type { RoundView } from "@/lib/data";

/** "2d 6h", "41h 0m", "35m". Uses the ISO anchors only (no wall clock), so SSR and client agree. */
export function formatCountdown(fromIso: string, toIso: string | null | undefined): string | null {
  if (!toIso) return null;
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "0m";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Add hours to an ISO timestamp. */
export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

/** Savings percent for a dollar amount, measured against the base the round used. null if unknown. */
export function savingsPct(round: RoundView, dollars: number): number | null {
  const base = round.userBrandSpendUsd ?? round.userSpendUsd;
  return base > 0 ? (dollars / base) * 100 : null;
}

export type JoinDrug = {
  id: string;
  name: string;
  strength: string;
  unitsPerMonth: number;
  recommendedCommitment: number | null;
};

export type JoinSwap = {
  drugId: string;
  roundId: string | null;
  toMfr: string;
};
