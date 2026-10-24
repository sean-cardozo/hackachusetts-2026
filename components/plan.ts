// The pharmacy's plan: what it chose on Re-negotiate, Swap and Join, and the estimated
// savings per year of each choice. Pure function, shared by the Summary and Award pages.

export type PlanDrug = { id: string; name: string; savingsLow: number | null; savingsHigh: number | null };
export type PlanSwap = { drugId: string; drugName: string; toMfr: string; extraSavingsYr: number };
export type PlanRound = {
  id: string;
  name: string;
  estLow: number | null;
  estHigh: number | null;
  /** Your spend on the round's products; used with ROUND_FALLBACK_PCT when there is no estimate. */
  userSpendUsd: number | null;
};

/** Estimated round range before quotes arrive (same 8-14% the Summary recommendations use). */
export const ROUND_FALLBACK_PCT: [number, number] = [8, 14];

function roundRange(r: PlanRound): { low: number; high: number } | null {
  if (r.estLow !== null && r.estHigh !== null) return { low: r.estLow, high: r.estHigh };
  if (r.userSpendUsd && r.userSpendUsd > 0) {
    return { low: (r.userSpendUsd * ROUND_FALLBACK_PCT[0]) / 100, high: (r.userSpendUsd * ROUND_FALLBACK_PCT[1]) / 100 };
  }
  return null;
}

export type PlanLine = { id: string; label: string; low: number; high: number };
export type PlanPart = { low: number; high: number; items: PlanLine[] };

export type PlanSummary = {
  negotiate: PlanPart;
  swap: PlanPart;
  join: PlanPart;
  total: { low: number; high: number };
  count: number;
};

function part(items: PlanLine[]): PlanPart {
  return {
    low: items.reduce((s, i) => s + i.low, 0),
    high: items.reduce((s, i) => s + i.high, 0),
    items,
  };
}

export function computePlan(input: {
  drugs: PlanDrug[];
  negotiated: string[];
  swaps: PlanSwap[];
  approvedSwapIds: string[];
  rounds: PlanRound[];
  joinedRoundIds: string[];
}): PlanSummary {
  const neg = new Set(input.negotiated);
  const approved = new Set(input.approvedSwapIds);
  const joined = new Set(input.joinedRoundIds);

  const negotiate = part(
    input.drugs
      .filter((d) => neg.has(d.id) && (d.savingsHigh ?? 0) > 0)
      .map((d) => ({ id: d.id, label: d.name, low: d.savingsLow ?? 0, high: d.savingsHigh ?? 0 })),
  );
  const swap = part(
    input.swaps
      .filter((s) => approved.has(s.drugId))
      .map((s) => ({ id: s.drugId, label: `${s.drugName} → ${s.toMfr}`, low: s.extraSavingsYr, high: s.extraSavingsYr })),
  );
  const join = part(
    input.rounds.flatMap((r) => {
      const range = joined.has(r.id) ? roundRange(r) : null;
      return range ? [{ id: r.id, label: r.name, low: range.low, high: range.high }] : [];
    }),
  );

  return {
    negotiate,
    swap,
    join,
    total: { low: negotiate.low + swap.low + join.low, high: negotiate.high + swap.high + join.high },
    count: negotiate.items.length + swap.items.length + join.items.length,
  };
}
