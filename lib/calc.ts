// PharmaPool calculator. Pure functions with plain inputs, no I/O.
// Formulas come from .kiro/specs/poolrx/design.md, section "Calculations (lib/calc.ts)".
//
// NOT-AVAILABLE STYLE (Requirement 3.14)
// Any figure that cannot be computed (units per month is 0, NADAC is 0 or missing,
// target is 0, on-hand is unknown, ...) is returned as `null`. Functions never
// return NaN or Infinity. Callers show "n/a" (or similar) when they get `null`.
//
// Money is kept in dollars and is NOT rounded here, except where a formula says
// "round" (days of supply). Rounding for display lives in lib/format.ts.

import type { Quote, RoundStatus, Supplier, SupplierScore } from "./types";

/** A number that can be used in a formula (not NaN, not Infinity). */
function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** A NADAC value that can be used as a divisor / benchmark (finite and above 0). */
function isUsableNadac(x: unknown): x is number {
  return isNum(x) && x > 0;
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * Overflow guard (Req 3.14): returns the number when it is finite, else null.
 * Used after a product or quotient, because two finite numbers can still give Infinity
 * (for example 1e200 × 1e200) or NaN (Infinity ÷ Infinity).
 */
function fin(x: number): number | null {
  return Number.isFinite(x) ? x : null;
}

/** Keeps a sum finite: Infinity becomes the largest finite number, NaN becomes 0. */
function cap(x: number): number {
  if (Number.isFinite(x)) return x;
  if (Number.isNaN(x)) return 0;
  return x > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
}

// ---------------------------------------------------------------------------
// Spend, benchmark, gap
// ---------------------------------------------------------------------------

/** annualSpend = unit price paid × units per month × 12. Returns null for non-finite input or an overflowing result. */
export function annualSpend(paid: number, unitsPerMonth: number): number | null {
  if (!isNum(paid) || !isNum(unitsPerMonth)) return null;
  return fin(paid * unitsPerMonth * 12);
}

/**
 * benchmarkSpend = NADAC × units per month × 12.
 * null when NADAC is 0 or missing (Req 3.14). A zero units/month gives 0, which is a real value.
 */
export function benchmarkSpend(
  nadac: number | null | undefined,
  unitsPerMonth: number,
): number | null {
  if (!isUsableNadac(nadac) || !isNum(unitsPerMonth)) return null;
  return fin(nadac * unitsPerMonth * 12);
}

/** gapPct = (paid − NADAC) ÷ NADAC × 100. null when NADAC is 0 or missing. May be negative. */
export function gapPct(paid: number, nadac: number | null | undefined): number | null {
  if (!isNum(paid) || !isUsableNadac(nadac)) return null;
  return fin(((paid - nadac) / nadac) * 100);
}

// ---------------------------------------------------------------------------
// Savings range
// ---------------------------------------------------------------------------

export const SAVINGS_LOW_RATE = 0.5;
export const SAVINGS_HIGH_RATE = 0.85;

export type SavingsRange = { low: number; high: number };

/**
 * Estimated savings range in dollars per year:
 *   low  = 0.50 × max(0, spend − benchmark) + swapExtras
 *   high = 0.85 × max(0, spend − benchmark) + swapExtras
 *
 * Own rules (design does not say):
 * - `swapExtras` is the sum of approved swap extras (per year). A negative or
 *   non-finite value is treated as 0 so the range is never negative.
 * - Returns null when spend or benchmark is not available (e.g. NADAC missing).
 */
export function savingsRange(
  spend: number | null | undefined,
  benchmark: number | null | undefined,
  swapExtras: number = 0,
): SavingsRange | null {
  if (!isNum(spend) || !isNum(benchmark)) return null;
  const gap = Math.max(0, spend - benchmark);
  const extras = isNum(swapExtras) ? Math.max(0, swapExtras) : 0;
  const low = SAVINGS_LOW_RATE * gap + extras;
  const high = SAVINGS_HIGH_RATE * gap + extras;
  // Overflow guard (Req 3.14): a gap or sum beyond the largest number is "not available".
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

// ---------------------------------------------------------------------------
// Inventory: days of supply, shortage risk, recommended commitment
// ---------------------------------------------------------------------------

/**
 * daysOfSupply = round(onHand ÷ (unitsPerMonth ÷ 30)).
 * null when units per month is 0 or less (Req 3.14), or when on-hand is unknown.
 * Own rule: a negative on-hand count is treated as 0.
 */
export function daysOfSupply(
  onHand: number | null | undefined,
  unitsPerMonth: number,
): number | null {
  if (!isNum(onHand) || !isNum(unitsPerMonth) || unitsPerMonth <= 0) return null;
  // Overflow guard: a denormal units per month makes the quotient Infinity.
  return fin(Math.round(Math.max(0, onHand) / (unitsPerMonth / 30)));
}

export type ShortageRisk = "High" | "Watch" | "Low";

/**
 * High if FDA shortage AND days of supply < 14; Watch if shortage; else Low.
 * Own rule: when there is a shortage but days of supply is not available (null),
 * the result is "Watch" because High cannot be confirmed.
 */
export function shortageRisk(hasShortage: boolean, dos: number | null | undefined): ShortageRisk {
  if (!hasShortage) return "Low";
  if (isNum(dos) && dos < 14) return "High";
  return "Watch";
}

/**
 * recommendedCommitment = 3 × unitsPerMonth − max(0, onHand − unitsPerMonth).
 * When onHand is undefined the extra stock is treated as 0.
 * null when units per month is 0 or less (Req 3.14).
 * Own rule: result is floored at 0 (a commitment cannot be negative when on-hand is huge).
 */
export function recommendedCommitment(
  unitsPerMonth: number,
  onHand?: number | null,
): number | null {
  if (!isNum(unitsPerMonth) || unitsPerMonth <= 0) return null;
  const extraStock = isNum(onHand) ? Math.max(0, onHand - unitsPerMonth) : 0;
  return fin(Math.max(0, 3 * unitsPerMonth - extraStock));
}

// ---------------------------------------------------------------------------
// Supplier scores
// ---------------------------------------------------------------------------

export type Weights = { price: number; delivery: number; reliability: number };

export const DEFAULT_WEIGHTS: Weights = { price: 50, delivery: 20, reliability: 30 };

/**
 * Score every quote and return the list sorted best first.
 *
 * - total       = Σ over products of (quoted price × group demand for that product).
 * - price       = minTotal ÷ total × 100
 * - delivery    = 100 − (deliveryDays − 3) × 8
 * - reliability = the value given in the quote
 * - score       = Σ(weight × component) ÷ Σweights
 *
 * Own rules:
 * - Each component is clamped to 0..100, and the final score too, so totals stay in 0..100.
 * - Only products with demand > 0 count. A quote that has no price for one of
 *   those products is incomplete: its price score is 0 and it is left out of minTotal
 *   (its `total` only sums the prices it has).
 * - If the best complete total is 0 (nothing to buy), complete quotes get price 100.
 * - Negative / non-finite weights count as 0. If all weights are 0, the defaults are used.
 * - If the same supplier letter appears twice, the first one in input order is used,
 *   so the winner does not depend on the order only when letters are unique (normal case).
 * - Sort: score descending; ties broken by supplier letter ascending (A before B before C).
 */
export function scoreSuppliers(
  quotes: Quote[],
  demand: Record<string, number>,
  weights: Weights = DEFAULT_WEIGHTS,
): SupplierScore[] {
  // Fixed product order so sums do not depend on object key order.
  const products = Object.keys(demand)
    .filter((id) => isNum(demand[id]) && demand[id] > 0)
    .sort();

  const w = normalizeWeights(weights);
  const weightSum = w.price + w.delivery + w.reliability;

  // Totals per quote.
  const rows = quotes.map((q) => {
    let total = 0;
    let complete = true;
    for (const id of products) {
      const p = q.prices[id];
      if (isNum(p) && p >= 0) {
        const next = total + p * demand[id];
        // Overflow guard (Req 3.14): a non-finite total makes the quote incomplete
        // (price score 0) and keeps the last finite total, so no NaN reaches the scores.
        if (Number.isFinite(next)) total = next;
        else complete = false;
      } else complete = false;
    }
    return { q, total, complete };
  });

  const completeTotals = rows.filter((r) => r.complete).map((r) => r.total);
  const minTotal = completeTotals.length ? Math.min(...completeTotals) : 0;

  const scores: SupplierScore[] = rows.map(({ q, total, complete }) => {
    let price = 0;
    if (complete) {
      price = total <= 0 ? 100 : (minTotal / total) * 100;
    }
    price = clamp(price, 0, 100);
    const delivery = clamp(
      isNum(q.deliveryDays) ? 100 - (q.deliveryDays - 3) * 8 : 0,
      0,
      100,
    );
    const reliability = clamp(isNum(q.reliability) ? q.reliability : 0, 0, 100);
    let score = (w.price * price + w.delivery * delivery + w.reliability * reliability) / weightSum;
    if (!Number.isFinite(score)) {
      // Overflow guard: enormous weights. Rescale by the largest weight (same ratios).
      const top = Math.max(w.price, w.delivery, w.reliability);
      const f = { price: w.price / top, delivery: w.delivery / top, reliability: w.reliability / top };
      score =
        (f.price * price + f.delivery * delivery + f.reliability * reliability) /
        (f.price + f.delivery + f.reliability);
    }
    score = clamp(score, 0, 100);
    return { supplier: q.supplier, total, price, delivery, reliability, score };
  });

  // Keep the first entry per supplier letter.
  const seen = new Set<Supplier>();
  const unique = scores.filter((s) => (seen.has(s.supplier) ? false : (seen.add(s.supplier), true)));

  return unique.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.supplier.localeCompare(b.supplier),
  );
}

function normalizeWeights(w: Weights): Weights {
  const fix = (x: number) => (isNum(x) && x > 0 ? x : 0);
  const out = { price: fix(w.price), delivery: fix(w.delivery), reliability: fix(w.reliability) };
  return out.price + out.delivery + out.reliability > 0 ? out : { ...DEFAULT_WEIGHTS };
}

// ---------------------------------------------------------------------------
// Round progress
// ---------------------------------------------------------------------------

/**
 * Round progress as a percent: committed ÷ target × 100 (not capped, so 108 is possible).
 * null when target is 0 or less (Req 3.14).
 */
export function roundProgress(committed: number, target: number): number | null {
  if (!isNum(committed) || !isNum(target) || target <= 0) return null;
  return fin((committed / target) * 100);
}

/** Projected progress percent after a pharmacy opts in with `optInUnits` more units. */
export function projectedProgress(
  committed: number,
  target: number,
  optInUnits: number,
): number | null {
  if (!isNum(optInUnits)) return null;
  return roundProgress(committed + Math.max(0, optInUnits), target);
}

/**
 * Round status after an opt-in. It becomes "target" (target reached) when the
 * projected progress is 100 or more. Own rule: only rounds that are still
 * collecting ("open" or "at-risk") can change; every other status is returned as is.
 */
export function statusAfterOptIn(
  status: RoundStatus,
  committed: number,
  target: number,
  optInUnits: number,
): RoundStatus {
  if (status !== "open" && status !== "at-risk") return status;
  const projected = projectedProgress(committed, target, optInUnits);
  return projected !== null && projected >= 100 ? "target" : status;
}

export type AtRiskResult = {
  /** True when the projected percentage at close is below 100. */
  atRisk: boolean;
  /** Projected percentage at close = current progress % × pace. */
  projectedPct: number;
  /** Extra pharmacies needed to reach the target; 0 when not at risk. null if the average is unknown. */
  pharmaciesNeeded: number | null;
};

/**
 * At-risk check for a round that may miss its target.
 *
 * Rule (own, since the design only gives the example "58% of target, on pace for 81%"):
 * - `pace` is a multiplier supplied by the caller. It is the expected final
 *   committed units divided by the current committed units (81 ÷ 58 ≈ 1.4 in the demo).
 * - projectedPct = (committed ÷ target × 100) × pace
 * - shortfallUnits = max(0, target − committed × pace)
 * - pharmaciesNeeded = ceil(shortfallUnits ÷ averageUnitsPerPharmacy)
 *
 * null when target is 0 or less, or pace is negative / not finite (Req 3.14).
 * pharmaciesNeeded is null when averageUnitsPerPharmacy is 0 or missing.
 */
export function atRisk(
  committed: number,
  target: number,
  pace: number,
  averageUnitsPerPharmacy: number | null | undefined,
): AtRiskResult | null {
  if (!isNum(committed) || !isNum(target) || target <= 0) return null;
  if (!isNum(pace) || pace < 0) return null;

  // Overflow guards (Req 3.14): products and quotients can overflow even for finite input.
  const projectedUnits = committed * pace;
  const projectedPct = (projectedUnits / target) * 100;
  const shortfall = Math.max(0, target - projectedUnits);
  if (!Number.isFinite(projectedPct) || !Number.isFinite(shortfall)) return null;

  let pharmaciesNeeded: number | null = null;
  if (isNum(averageUnitsPerPharmacy) && averageUnitsPerPharmacy > 0) {
    // A denormal average makes the quotient Infinity; that is "not available" (null).
    pharmaciesNeeded = fin(Math.ceil(shortfall / averageUnitsPerPharmacy));
  }

  return { atRisk: projectedPct < 100, projectedPct, pharmaciesNeeded };
}

// ---------------------------------------------------------------------------
// Summary figures (Requirement 3.10)
// Source: .kiro/specs/poolrx/design.md, sections "Spend mix" and "Calculations".
//
// Every savings figure carries BOTH dollars and percent (BRIEF non-negotiable).
// Percent values are plain percent numbers (11.2 means 11.2%), not fractions.
// Percent is `null` when the spend it is measured against is 0 or not usable.
// ---------------------------------------------------------------------------

/** A savings amount in dollars per year and the same amount as a percent of some spend. */
export type SavingsFigure = {
  low: number;
  high: number;
  pctLow: number | null;
  pctHigh: number | null;
};

/** Default savings percent range (of spend) for Brand: 1 to 2.5 percent. */
export const BRAND_PCT_RANGE: [number, number] = [1, 2.5];
/** Default savings percent range (of spend) for OTC & supplies: 8 to 14 percent. */
export const OTC_PCT_RANGE: [number, number] = [8, 14];

/** value ÷ spend × 100, or null when spend is not above 0 or either value is not finite. */
function pctOf(value: number, spend: number): number | null {
  if (!isNum(value) || !isNum(spend) || spend <= 0) return null;
  // Overflow guard (Req 3.14): a denormal spend makes the quotient Infinity.
  return fin((value / spend) * 100);
}

function figure(low: number, high: number, spend: number): SavingsFigure {
  return { low, high, pctLow: pctOf(low, spend), pctHigh: pctOf(high, spend) };
}

/** Money / spend amounts: non-finite or negative becomes 0. */
function money(x: unknown): number {
  return isNum(x) ? Math.max(0, x) : 0;
}

/**
 * A percent range [lo, hi]. Non-finite values fall back to the default, values are
 * clamped to 0..100, and a reversed pair is put in order (low ≤ high).
 */
function cleanPctRange(
  range: [number, number] | undefined,
  fallback: [number, number],
): [number, number] {
  const r = range ?? fallback;
  // Percents are kept within 0..100 (a saving cannot be more than the spend).
  const a = isNum(r[0]) ? clamp(r[0], 0, 100) : fallback[0];
  const b = isNum(r[1]) ? clamp(r[1], 0, 100) : fallback[1];
  return a <= b ? [a, b] : [b, a];
}

export type SummaryFiguresInput = {
  /** Generics: annual spend, NADAC benchmark spend (null when NADAC is missing), approved swap extras per year. */
  generics: { spend: number; benchmark: number | null; swapExtras?: number };
  /** Brand: annual spend and savings percent range of that spend (default 1 to 2.5). */
  brand: { spend: number; pctRange?: [number, number] };
  /** OTC & supplies: annual spend and savings percent range (default 8 to 14). */
  otc: { spend: number; pctRange?: [number, number] };
};

export type SpendTypeBreakdown = {
  spend: number;
  /** null when the savings cannot be computed (generics without a NADAC benchmark). */
  savings: SavingsFigure | null;
};

export type SummaryFigures = {
  /** Generics + Brand + OTC spend. */
  totalSpend: number;
  /** Total savings range in dollars and percent of total spend. null when no type has a figure. */
  total: SavingsFigure | null;
  /** True when at least one type has no savings figure (so `total` is a partial sum). */
  incomplete: boolean;
  /** Approved swap extras included in the generics figure ("Includes $X from approved swaps"). */
  includedSwapExtras: number;
  breakdown: { generics: SpendTypeBreakdown; brand: SpendTypeBreakdown; otc: SpendTypeBreakdown };
};

/**
 * Summary savings split across all purchases.
 *
 * - Generics: savingsRange(spend, benchmark, swapExtras), i.e. 50 to 85 percent of the
 *   NADAC gap plus approved swap extras. Percent is of the generics spend.
 * - Brand / OTC: spend × pct range ÷ 100. Defaults are 1 to 2.5 percent (Brand) and
 *   8 to 14 percent (OTC & supplies) from the design's Spend mix.
 * - Total = sum of the type figures. Percent is of the total spend (sum of all three spends).
 *
 * Own rules:
 * - Spend values that are negative or not finite count as 0.
 * - A bad pct range is cleaned (see cleanPctRange): non-finite uses the default,
 *   negative becomes 0, reversed is put in order.
 * - If generics has no benchmark, its savings is null and it is left out of the total;
 *   `incomplete` is then true. The total is null only if no type has a figure.
 */
export function summaryFigures(input: SummaryFiguresInput): SummaryFigures {
  const gSpend = money(input.generics.spend);
  const bSpend = money(input.brand.spend);
  const oSpend = money(input.otc.spend);
  const totalSpend = cap(gSpend + bSpend + oSpend);

  const swapExtras = isNum(input.generics.swapExtras) ? Math.max(0, input.generics.swapExtras) : 0;
  const gRange = savingsRange(gSpend, input.generics.benchmark, swapExtras);
  const generics: SpendTypeBreakdown = {
    spend: gSpend,
    savings: gRange ? figure(gRange.low, gRange.high, gSpend) : null,
  };

  const byPct = (spend: number, range: [number, number] | undefined, fb: [number, number]) => {
    const [lo, hi] = cleanPctRange(range, fb);
    return figure(cap((spend * lo) / 100), cap((spend * hi) / 100), spend);
  };
  const brand: SpendTypeBreakdown = {
    spend: bSpend,
    savings: byPct(bSpend, input.brand.pctRange, BRAND_PCT_RANGE),
  };
  const otc: SpendTypeBreakdown = {
    spend: oSpend,
    savings: byPct(oSpend, input.otc.pctRange, OTC_PCT_RANGE),
  };

  const parts = [generics, brand, otc].filter((p) => p.savings !== null);
  const total =
    parts.length === 0
      ? null
      : figure(
          cap(parts.reduce((s, p) => s + (p.savings as SavingsFigure).low, 0)),
          cap(parts.reduce((s, p) => s + (p.savings as SavingsFigure).high, 0)),
          totalSpend,
        );

  return {
    totalSpend,
    total,
    incomplete: parts.length < 3,
    includedSwapExtras: gRange ? swapExtras : 0,
    breakdown: { generics, brand, otc },
  };
}

// ---------------------------------------------------------------------------
// Savings by step: Compare, Swap, Join
// ---------------------------------------------------------------------------

export type SavingsByStepInput = {
  /** Total annual spend (all types). Every percent in the result is of this number. */
  totalAnnualSpend: number;
  /** Generics annual spend and NADAC benchmark spend (null when NADAC is missing). */
  generics: { spend: number; benchmark: number | null };
  /** Sum of approved swap extras per year. */
  approvedSwapExtras?: number;
  /** Sum of extras for all available swaps (approved or not). Never less than the approved sum. */
  potentialSwapExtras?: number;
  /** Estimated savings range in dollars per year for each round (opt-in or quoted). */
  rounds?: SavingsRange[];
};

export type SavingsByStep = {
  /** Generics savings from comparing to NADAC (no swaps). null when NADAC is missing. */
  compare: SavingsFigure | null;
  /** Approved swap extras (low = high, a fixed amount), plus the potential of all available swaps. */
  swap: SavingsFigure & { potential: SavingsFigure };
  /** Sum of the round-based savings ranges. 0 when there are no rounds. */
  join: SavingsFigure;
};

/**
 * Savings by step cards (Summary).
 *
 * Own rules:
 * - Compare = the generics savings range from savingsRange(spend, benchmark) with NO swap
 *   extras (50 to 85 percent of the NADAC gap). null when the benchmark is missing.
 * - Swap = sum of approved swap extras. It is a fixed amount, so low = high.
 *   `potential` = all available swaps (at least the approved amount).
 * - Join = sum of the per-round ranges in dollars. A round with a bad range is cleaned
 *   (negative or non-finite becomes 0, reversed is put in order).
 * - Percent is of `totalAnnualSpend` (null when that is 0 or not finite).
 * - Compare + Swap equals the generics figure of summaryFigures when the same inputs are used.
 */
export function savingsByStep(input: SavingsByStepInput): SavingsByStep {
  const total = money(input.totalAnnualSpend);

  const cmp = savingsRange(money(input.generics.spend), input.generics.benchmark, 0);
  const compare = cmp ? figure(cmp.low, cmp.high, total) : null;

  const approved = money(input.approvedSwapExtras);
  const potential = Math.max(approved, money(input.potentialSwapExtras));
  const swap = { ...figure(approved, approved, total), potential: figure(potential, potential, total) };

  let jLow = 0;
  let jHigh = 0;
  for (const r of input.rounds ?? []) {
    const a = money(r?.low);
    const b = money(r?.high);
    jLow = cap(jLow + Math.min(a, b));
    jHigh = cap(jHigh + Math.max(a, b));
  }

  return { compare, swap, join: figure(jLow, jHigh, total) };
}

// ---------------------------------------------------------------------------
// 24-month series
// ---------------------------------------------------------------------------

export type MonthlySeriesInput = {
  /** Total purchases over the last 12 actual months, in dollars. */
  totalAnnual: number;
  /** Number of actual months before the Today marker. Default 12. */
  todayIndex?: number;
  /** Savings as a percent range of spend, e.g. [8, 14]. Ignored when annualSavingsRange is given. */
  savingsPctRange?: [number, number];
  /** Savings as a range in dollars per year (turned into a percent of totalAnnual). Wins over savingsPctRange. */
  annualSavingsRange?: SavingsRange;
  /** Number of points. Default 24. */
  months?: number;
  /** Seasonality amplitude in percent. Default 3. */
  seasonalityPct?: number;
  /** Drift in percent per year. Default 3. */
  annualDriftPct?: number;
  /** Optional first month as "YYYY-MM"; when given, each point gets a label like "Nov 2025". */
  startMonth?: string;
};

export type SeriesPoint = {
  /** 0-based. Points with monthIndex < todayIndex are actual; the rest are projected. */
  monthIndex: number;
  label?: string;
  /** Actual purchases. Only set for actual months. */
  actual?: number;
  /** Projected purchases without PharmaPool. Equals `actual` for actual months. */
  projectedWithout: number;
  /** Purchases with PharmaPool, low savings. Equals `actual` for actual months. */
  projectedWithLow: number;
  /** Purchases with PharmaPool, high savings (lowest spend line is the high-savings one). Equals `actual` for actual months. */
  projectedWithHigh: number;
};

export type MonthlySeries = {
  points: SeriesPoint[];
  /** The Today marker sits between index todayIndex − 1 (last actual) and todayIndex (first projected). */
  todayIndex: number;
  /** Savings summed over the projected months, in dollars and percent of projected spend without PharmaPool. */
  projected12MonthSavings: SavingsFigure;
};

/** Largest number of points monthlySeries will build (10 years). Larger `months` values are capped to this. */
export const MAX_SERIES_MONTHS = 120;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Savings ramp for the nth projected month (1 = first): min(1, n ÷ 4). 0 for months before. */
export function savingsRamp(projectedMonthNumber: number): number {
  if (!isNum(projectedMonthNumber) || projectedMonthNumber <= 0) return 0;
  return Math.min(1, projectedMonthNumber / 4);
}

/**
 * Monthly purchases for the Summary chart: actual months, then projected months
 * without and with PharmaPool.
 *
 * Rule (design: "monthly = total/12 with ±3% seasonality, +3%/yr drift; savings ramp min(1, month/4)"):
 * - raw(i) = (1 + seasonality × sin(2π × (i mod 12) ÷ 12)) × (1 + drift)^(i ÷ 12).
 *   The sine is a fixed 12-month pattern (no randomness), so output is repeatable.
 * - The series is scaled so the 12 months before the Today marker add up to exactly
 *   `totalAnnual` (the sine adds to 0 over any 12 months, so the average is totalAnnual ÷ 12).
 * - Projected without PharmaPool continues the same formula (drift keeps growing).
 * - Savings for the nth projected month (n = 1 for the first one) = projectedWithout × savings
 *   percent × min(1, n ÷ 4). With = without − savings; Low uses the low percent, High the high percent.
 *   So projectedWithLow ≥ projectedWithHigh (high savings means lower spend).
 * - Actual months have no savings: projectedWithout/Low/High all equal `actual`.
 * - projected12MonthSavings sums the (up to 12) projected months. Percent = that sum ÷ the
 *   sum of projectedWithout over the same months × 100. Because of the ramp it is below the
 *   plain annual percent range (average ramp over 12 months is 0.875).
 *
 * Own rules:
 * - todayIndex is rounded and clamped to 0..months. months is rounded, floored at 1 and
 *   capped at MAX_SERIES_MONTHS (120).
 * - Seasonality and drift: non-finite use the defaults; seasonality is clamped to 0..100;
 *   drift is clamped to −99..100 (percent per year).
 * - Savings fractions are clamped to 0..1 (savings never exceed spend).
 * - Savings percent: from annualSavingsRange ÷ totalAnnual × 100, else savingsPctRange, else 0.
 *   Negative becomes 0 and a reversed pair is put in order.
 * - Returns null when totalAnnual is not above 0 or not finite, or when an extreme total
 *   makes any point overflow (Req 3.14).
 */
export function monthlySeries(input: MonthlySeriesInput): MonthlySeries | null {
  if (!isNum(input.totalAnnual) || input.totalAnnual <= 0) return null;
  const total = input.totalAnnual;

  // `months` is capped at MAX_SERIES_MONTHS so a huge value cannot freeze the app.
  const months = isNum(input.months)
    ? Math.min(MAX_SERIES_MONTHS, Math.max(1, Math.round(input.months)))
    : 24;
  const todayIndex = clamp(isNum(input.todayIndex) ? Math.round(input.todayIndex) : 12, 0, months);
  // Seasonality is kept within 0..100 percent and drift within -99..100 percent per year,
  // so the growth factor stays finite and positive (Req 3.14).
  const season = isNum(input.seasonalityPct) ? clamp(input.seasonalityPct, 0, 100) / 100 : 0.03;
  const drift = isNum(input.annualDriftPct) ? clamp(input.annualDriftPct, -99, 100) / 100 : 0.03;

  // Savings fractions (0.08 means 8%).
  let fracLow = 0;
  let fracHigh = 0;
  if (input.annualSavingsRange) {
    const a = money(input.annualSavingsRange.low);
    const b = money(input.annualSavingsRange.high);
    // A saving cannot be more than the spend, so the fractions stay within 0..1.
    fracLow = clamp(Math.min(a, b) / total, 0, 1);
    fracHigh = clamp(Math.max(a, b) / total, 0, 1);
  } else if (input.savingsPctRange) {
    const [lo, hi] = cleanPctRange(input.savingsPctRange, [0, 0]);
    fracLow = lo / 100;
    fracHigh = hi / 100;
  }

  const raw = (i: number): number => {
    const m = ((i % 12) + 12) % 12;
    return (1 + season * Math.sin((2 * Math.PI * m) / 12)) * Math.pow(1 + drift, i / 12);
  };

  // Scale so the 12 months ending at the Today marker add up to totalAnnual.
  let rawYear = 0;
  for (let i = todayIndex - 12; i < todayIndex; i++) rawYear += raw(i);
  const scale = total / rawYear;
  if (!Number.isFinite(scale)) return null;

  const startParts = input.startMonth ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input.startMonth) : null;
  const startYear = startParts ? Number(startParts[1]) : 0;
  const startMonth0 = startParts ? Number(startParts[2]) - 1 : 0;

  const points: SeriesPoint[] = [];
  let sumLow = 0;
  let sumHigh = 0;
  let sumWithout = 0;

  for (let i = 0; i < months; i++) {
    const without = scale * raw(i);
    const point: SeriesPoint = {
      monthIndex: i,
      projectedWithout: without,
      projectedWithLow: without,
      projectedWithHigh: without,
    };
    if (startParts) {
      const abs = startMonth0 + i;
      point.label = `${MONTH_NAMES[abs % 12]} ${startYear + Math.floor(abs / 12)}`;
    }
    if (i < todayIndex) {
      point.actual = without;
    } else {
      const ramp = savingsRamp(i - todayIndex + 1);
      const savLow = without * fracLow * ramp;
      const savHigh = without * fracHigh * ramp;
      point.projectedWithLow = without - savLow;
      point.projectedWithHigh = without - savHigh;
      if (i - todayIndex < 12) {
        sumLow += savLow;
        sumHigh += savHigh;
        sumWithout += without;
      }
    }
    points.push(point);
  }

  // Overflow guard (Req 3.14): an extreme total can still overflow in the loop; report "not available".
  const allFinite = points.every(
    (p) =>
      Number.isFinite(p.projectedWithout) &&
      Number.isFinite(p.projectedWithLow) &&
      Number.isFinite(p.projectedWithHigh) &&
      (p.actual === undefined || Number.isFinite(p.actual)),
  );
  if (!allFinite || !Number.isFinite(sumLow) || !Number.isFinite(sumHigh) || !Number.isFinite(sumWithout)) {
    return null;
  }

  return {
    points,
    todayIndex,
    projected12MonthSavings: figure(sumLow, sumHigh, sumWithout),
  };
}
