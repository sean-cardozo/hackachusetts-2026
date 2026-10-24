// Data layer for the screens. Server-safe (no 'use client').
//
// It reads the sample files (lib/sample.ts, no fs) and the live-feed cache (lib/feeds.ts,
// which uses node:fs). So: import the FUNCTIONS of this file only from server components,
// route handlers and tests. Client components receive the results as props. Importing the
// TYPES from a client component is fine (`import type` is erased).
//
// Every result is plain JSON (numbers, strings, booleans, null, arrays, objects). No Date,
// no functions, no `undefined` values (optional keys are left out instead).
//
// All math lives in lib/calc.ts. This file only gathers inputs and joins the data.

import {
  DEFAULT_WEIGHTS,
  annualSpend,
  benchmarkSpend,
  daysOfSupply,
  gapPct,
  monthlySeries,
  recommendedCommitment,
  roundProgress,
  savingsByStep,
  savingsRange,
  scoreSuppliers,
  shortageRisk,
  summaryFigures,
} from "./calc";
import type {
  MonthlySeries,
  SavingsByStep,
  SavingsRange,
  ShortageRisk,
  SummaryFigures,
  Weights,
} from "./calc";
import { FEED_NAMES } from "./feed-types";
import type { FeedName } from "./feed-types";
import { readFeed } from "./feeds";
import { loadSample } from "./sample";
import type { SwapExtra } from "./sample";
import type { Drug, Quote, Round, RoundStatus, SupplierScore } from "./types";

// ---------------------------------------------------------------------------
// Constants and the drug key mapping
// ---------------------------------------------------------------------------

/**
 * Sample drug id -> drugKey used in data/cache/*.json (see TRACKED_DRUGS in lib/feed-types.ts).
 * All 10 keys exist in nadac.json `byDrug`, orangebook.json and shortages.json `history`.
 */
export const DRUG_KEY_BY_ID: Record<string, string> = {
  "atorvastatin-20": "atorvastatin-20mg-tablet",
  "lisinopril-10": "lisinopril-10mg-tablet",
  "amlodipine-5": "amlodipine-5mg-tablet",
  "metformin-500": "metformin-500mg-tablet",
  "sertraline-50": "sertraline-50mg-tablet",
  "amoxicillin-500": "amoxicillin-500mg-capsule",
  "albuterol-90": "albuterol-90mcg-inhalation-aerosol",
  "omeprazole-20": "omeprazole-20mg-dr-capsule",
  "levothyroxine-50": "levothyroxine-50mcg-tablet",
  "gabapentin-300": "gabapentin-300mg-capsule",
};

/** Design "Spend mix": Brand about $3.1M per year, OTC & supplies $280k per year. */
export const BRAND_SPEND = 3_100_000;
export const OTC_SPEND = 280_000;

/** Cache NADAC that differs from the sample reference by more than this percent is not used. */
export const NADAC_FALLBACK_DIFF_PCT = 100;
/** Cache vs sample differences above this percent are reported in `nadacDiffPct` consumers. */
export const NADAC_REPORT_DIFF_PCT = 10;

const GROUP_ROUND_ID_FOR_QUOTES = "diabetes-thyroid";

/** Labels for quote products that are not one of the 10 sample drugs. */
const EXTRA_PRODUCT_NAMES: Record<string, string> = { glipizide: "Glipizide 5 mg tab" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataOptions = {
  /** Drug ids whose swap is approved. Their extras are added to the savings range. */
  approvedSwapDrugIds?: string[];
  /** Override the cache folder (tests). */
  cacheDir?: string;
};

export type EquivalentView = {
  mfr: string;
  teCode: string;
  applNo: string;
  extraSavingsYr?: number;
  inRoundId?: string;
  /** True when the entry comes from the sample swap extras and is not in the Orange Book cache. */
  sampleExtra?: boolean;
};

export type ShortageView = {
  current: boolean;
  source: "live" | "sample";
  /** ISO date of the latest live shortage record. */
  updated?: string;
  last3yCount?: number;
};

export type DrugView = Drug & {
  drugKey: string;
  /** Effective NADAC unit price in dollars (live cache or sample fallback). null if neither is usable. */
  nadac: number | null;
  nadacSource: "live" | "fallback";
  /** ISO date of the NADAC week. null when the fallback is used. */
  nadacEffectiveDate: string | null;
  /** "EA" for each. The fallback is always "EA". */
  nadacPricingUnit: string;
  /** Why the fallback was used (only set when nadacSource is "fallback" and a cache value existed or was missing). */
  nadacNote?: string;
  /** Raw cache NADAC, even when it was not used. null when the cache has none. */
  nadacCache: number | null;
  /** (cache - fallback) / fallback x 100. null when the cache has no value. */
  nadacDiffPct: number | null;
  /** (paid - NADAC) / NADAC x 100. null when NADAC is not available. */
  gapPct: number | null;
  annualSpend: number | null;
  benchmarkSpend: number | null;
  /** Savings range per year; includes the approved swap extra for this drug. null when NADAC is missing. */
  savings: SavingsRange | null;
  daysOfSupply: number | null;
  shortage: ShortageView;
  shortageRisk: ShortageRisk;
  recommendedCommitment: number | null;
  equivalents: EquivalentView[];
};

export type RoundView = Round & {
  /** Percent of target. null when the target is unknown and the design gives no percent. */
  progress: number | null;
  /** Label for the status chip. */
  displayStatus: string;
  /** Your annual spend on the drugs of the round, from the sample drugs. */
  userSpendUsd: number;
  /** Estimated savings in dollars per year for the round. null when there is no basis. */
  estSavingsUsd: SavingsRange | null;
  /** Plain-words rule behind estSavingsUsd. */
  savingsBasis: string;
  /** ISO anchors for countdowns. Screens compute "2d 6h" from demoNow. */
  anchors: { demoNow: string; deadline: string | null; confirmDeadline: string | null };
};

export type QuotesView = {
  kind: "sample";
  roundId: string;
  quotes: Quote[];
  groupDemand: Record<string, number>;
  yourShare: Record<string, number>;
  defaultWeights: Weights;
  /** Scores with the default weights, best first. */
  scores: SupplierScore[];
  /** Product id -> label. */
  products: { id: string; name: string }[];
};

export type FeedStatusView = {
  feed: FeedName;
  source: string;
  cadence: "daily" | "weekly" | "monthly" | null;
  fetchedAt: string | null;
  effectiveDate: string | null;
  status: "live" | "cached";
};

export type SwapOption = {
  drugId: string;
  drugName: string;
  category: string;
  nowMfr: string;
  toMfr: string;
  teCode: string;
  /** Effective NADAC unit price. null when not available. */
  benchmarkPrice: number | null;
  paid: number;
  extraSavingsYr: number;
  roundId: string | null;
};

export type RoundRange = { roundId: string; low: number; high: number; basis: string };

export type SummaryInputs = {
  figures: SummaryFigures;
  steps: SavingsByStep;
  /** null only when the total purchases are not above 0. */
  series: MonthlySeries | null;
  roundRanges: RoundRange[];
  /** Sum of the approved swap extras that were included. */
  approvedExtras: number;
};

export type AskContext = {
  drugs: {
    id: string;
    drugName: string;
    strength: string;
    paid: number;
    unitsPerMonth: number;
    onHand?: number;
    hasShortage: boolean;
  }[];
  benchmarks: { drugId: string; nadac: number }[];
  rounds: {
    id: string;
    title: string;
    status: string;
    committedUnits: number | null;
    targetUnits: number | null;
  }[];
  quotes: Quote[];
  demand: Record<string, number>;
  weights: Weights;
  userShare: Record<string, number>;
  sources: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Feed access (server only). Missing or broken cache files give null, never throw.
// ---------------------------------------------------------------------------

function tryFeed<K extends FeedName>(feed: K, cacheDir?: string) {
  try {
    return readFeed(feed, cacheDir);
  } catch {
    return null;
  }
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

// ---------------------------------------------------------------------------
// getDrugViews
// ---------------------------------------------------------------------------

function sameMfr(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x.length > 0 && y.length > 0 && (x === y || x.startsWith(`${y} `) || x.includes(y));
}

function extrasFor(extras: SwapExtra[], drugId: string): SwapExtra | undefined {
  return extras.find((e) => e.drugId === drugId);
}

function roundIdForDrug(rounds: Round[], drugId: string): string | undefined {
  return rounds.find((r) => r.drugs.includes(drugId))?.id;
}

export function getDrugViews(opts: DataOptions = {}): DrugView[] {
  const sample = loadSample();
  const approved = new Set(opts.approvedSwapDrugIds ?? []);
  const nadacFeed = tryFeed("nadac", opts.cacheDir);
  const obFeed = tryFeed("orangebook", opts.cacheDir);
  const shFeed = tryFeed("shortages", opts.cacheDir);

  return sample.drugs.map((drug): DrugView => {
    const drugKey = DRUG_KEY_BY_ID[drug.id] ?? drug.id;

    // --- NADAC: live cache when it looks sane, else the sample fallback ---------------
    const cacheEntry = nadacFeed?.data.byDrug[drugKey];
    const cacheValue =
      cacheEntry && Number.isFinite(cacheEntry.nadac) && cacheEntry.nadac > 0 ? cacheEntry.nadac : null;
    const fallbackValue = drug.nadacFallback > 0 ? drug.nadacFallback : null;
    const diffPct =
      cacheValue !== null && fallbackValue !== null
        ? round(((cacheValue - fallbackValue) / fallbackValue) * 100, 1)
        : null;

    let nadac: number | null;
    let nadacSource: "live" | "fallback";
    let nadacNote: string | undefined;
    let nadacPricingUnit = "EA";
    let nadacEffectiveDate: string | null = null;

    if (cacheValue === null) {
      nadacSource = "fallback";
      nadac = fallbackValue;
      nadacNote = nadacFeed
        ? "No usable NADAC value in the live cache for this drug, so the sample reference price is used."
        : "The live NADAC cache is not available, so the sample reference price is used.";
    } else if (cacheEntry && cacheEntry.pricingUnit !== "EA") {
      nadacSource = "fallback";
      nadac = fallbackValue;
      nadacNote =
        `Live NADAC is priced per ${cacheEntry.pricingUnit} (${cacheValue}), not per each, ` +
        `so it cannot be compared with the price paid per unit. The sample reference price is used.`;
    } else if (diffPct !== null && Math.abs(diffPct) > NADAC_FALLBACK_DIFF_PCT) {
      nadacSource = "fallback";
      nadac = fallbackValue;
      nadacNote =
        `Live NADAC (${cacheValue}) differs from the sample reference (${fallbackValue}) by ` +
        `${Math.abs(diffPct)} percent, a likely unit mismatch, so the sample reference price is used.`;
    } else {
      nadacSource = "live";
      nadac = cacheValue;
      nadacPricingUnit = cacheEntry?.pricingUnit ?? "EA";
      nadacEffectiveDate = nadacFeed?.data.effectiveDate ?? null;
    }

    // --- Spend, savings, inventory ----------------------------------------------------
    const spend = annualSpend(drug.paid, drug.unitsPerMonth);
    const bench = benchmarkSpend(nadac, drug.unitsPerMonth);
    const swap = extrasFor(sample.swapExtras, drug.id);
    const swapExtra = swap && approved.has(drug.id) ? swap.extraSavingsYr : 0;
    const dos = daysOfSupply(drug.onHand, drug.unitsPerMonth);

    // --- Shortage: live record first, else the sample flag ----------------------------
    const liveItems = (shFeed?.data.items ?? []).filter(
      (s) => s.drugKey === drugKey && s.status === "current",
    );
    const history = shFeed?.data.history[drugKey];
    let shortage: ShortageView;
    if (liveItems.length > 0) {
      const updated = liveItems.map((s) => s.updated).sort().at(-1);
      shortage = { current: true, source: "live", ...(updated ? { updated } : {}) };
    } else if (drug.hasShortage) {
      shortage = { current: true, source: "sample" };
    } else {
      shortage = { current: false, source: shFeed ? "live" : "sample" };
    }
    if (history) shortage.last3yCount = history.last3yCount;

    // --- Equivalents (Orange Book) + sample swap extras --------------------------------
    const equivalents: EquivalentView[] = [];
    const seen = new Set<string>();
    for (const e of obFeed?.data.equivalents ?? []) {
      if (e.drugKey !== drugKey) continue;
      const id = `${e.mfr}|${e.applNo}`;
      if (seen.has(id)) continue;
      seen.add(id);
      equivalents.push({ mfr: e.mfr, teCode: e.teCode, applNo: e.applNo });
    }
    if (swap) {
      const roundId = roundIdForDrug(sample.rounds, drug.id);
      const hit = equivalents.find((e) => sameMfr(e.mfr, swap.toMfr));
      if (hit) {
        hit.extraSavingsYr = swap.extraSavingsYr;
        if (roundId) hit.inRoundId = roundId;
      } else {
        equivalents.push({
          mfr: swap.toMfr,
          teCode: swap.teCode,
          applNo: "",
          extraSavingsYr: swap.extraSavingsYr,
          ...(roundId ? { inRoundId: roundId } : {}),
          sampleExtra: true,
        });
      }
    }
    // Swap targets first, then by name.
    equivalents.sort((a, b) => {
      const ax = a.extraSavingsYr !== undefined ? 0 : 1;
      const bx = b.extraSavingsYr !== undefined ? 0 : 1;
      return ax !== bx ? ax - bx : a.mfr.localeCompare(b.mfr);
    });

    return {
      ...drug,
      drugKey,
      nadac,
      nadacSource,
      nadacEffectiveDate,
      nadacPricingUnit,
      ...(nadacNote ? { nadacNote } : {}),
      nadacCache: cacheValue,
      nadacDiffPct: diffPct,
      gapPct: gapPct(drug.paid, nadac),
      annualSpend: spend,
      benchmarkSpend: bench,
      savings: savingsRange(spend, bench, swapExtra),
      daysOfSupply: dos,
      shortage,
      shortageRisk: shortageRisk(shortage.current, dos),
      recommendedCommitment: recommendedCommitment(drug.unitsPerMonth, drug.onHand),
      equivalents,
    };
  });
}

// ---------------------------------------------------------------------------
// getRounds
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<RoundStatus, string> = {
  open: "Open",
  target: "Target reached",
  quotes: "Quotes in",
  awarded: "Awarded",
  closed: "Closed",
  "at-risk": "At risk",
  missed: "Target missed",
};

/** User annual spend on the given drug ids (sample drugs only). */
function userSpend(drugs: Drug[], ids: string[]): number {
  let total = 0;
  for (const id of ids) {
    const d = drugs.find((x) => x.id === id);
    if (!d) continue;
    total += annualSpend(d.paid, d.unitsPerMonth) ?? 0;
  }
  return total;
}

/**
 * Round savings rule (dollars per year), first match wins:
 * 1. Round has an estimate range (estRange) and a brand spend: brand spend x range percent.
 * 2. Round is awarded with a percent: your spend on its drugs x awarded percent (low = high).
 * 3. Round has quotes (status "quotes"): your spend on its drugs x the lowest and highest quoted percent.
 * 4. Otherwise null (no basis in the design, nothing is invented).
 */
function roundSavings(
  round: Round,
  spend: number,
  quotePcts: [number, number] | null,
): { range: SavingsRange | null; basis: string } {
  if (round.estRange && round.userBrandSpendUsd !== undefined) {
    const [lo, hi] = round.estRange;
    return {
      range: { low: (round.userBrandSpendUsd * lo) / 100, high: (round.userBrandSpendUsd * hi) / 100 },
      basis: `Your brand spend x estimated ${lo}-${hi}%`,
    };
  }
  if (round.awardedPct !== undefined && spend > 0) {
    const v = (spend * round.awardedPct) / 100;
    return { range: { low: v, high: v }, basis: `Your spend on the round's drugs x awarded ${round.awardedPct}%` };
  }
  if (round.status === "quotes" && quotePcts && spend > 0) {
    return {
      range: { low: (spend * quotePcts[0]) / 100, high: (spend * quotePcts[1]) / 100 },
      basis: `Your spend on the round's drugs x quoted ${quotePcts[0]}-${quotePcts[1]}%`,
    };
  }
  return { range: null, basis: "No estimate in the sample data" };
}

function quotedPctRange(): [number, number] | null {
  const pcts = loadSample().quotes.quotes.map((q) => q.quotedPct);
  return pcts.length ? [Math.min(...pcts), Math.max(...pcts)] : null;
}

export function getRounds(): RoundView[] {
  const sample = loadSample();
  const quotePcts = quotedPctRange();
  return sample.rounds.map((r): RoundView => {
    const progress =
      r.targetUnits !== null && r.committedUnits !== null
        ? roundProgress(r.committedUnits, r.targetUnits)
        : (r.progressPct ?? null);
    const spend = userSpend(sample.drugs, r.drugs);
    const { range, basis } = roundSavings(r, spend, quotePcts);
    // An open round that already reached its target is shown as "Target reached".
    const label =
      r.status === "open" && progress !== null && progress >= 100
        ? STATUS_LABEL.target
        : STATUS_LABEL[r.status];
    return {
      ...r,
      progress,
      displayStatus: label,
      userSpendUsd: spend,
      estSavingsUsd: range,
      savingsBasis: basis,
      anchors: {
        demoNow: sample.demoNow,
        deadline: r.deadline,
        confirmDeadline: r.confirmDeadline ?? null,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// getQuotes
// ---------------------------------------------------------------------------

export function getQuotes(): QuotesView {
  const { quotes: file, drugs } = loadSample();
  const ids = Object.keys(file.groupDemand);
  const name = (id: string) => drugs.find((d) => d.id === id)?.name ?? EXTRA_PRODUCT_NAMES[id] ?? id;
  return {
    kind: "sample",
    roundId: GROUP_ROUND_ID_FOR_QUOTES,
    quotes: file.quotes,
    groupDemand: file.groupDemand,
    yourShare: file.yourShare,
    defaultWeights: file.defaultWeights,
    scores: scoreSuppliers(file.quotes, file.groupDemand, file.defaultWeights),
    products: ids.map((id) => ({ id, name: name(id) })),
  };
}

// ---------------------------------------------------------------------------
// getFeedStatus
// ---------------------------------------------------------------------------

export function getFeedStatus(opts: { cacheDir?: string } = {}): FeedStatusView[] {
  return FEED_NAMES.map((feed): FeedStatusView => {
    const f = tryFeed(feed, opts.cacheDir);
    if (!f) {
      return {
        feed,
        source: "Cache file not available",
        cadence: null,
        fetchedAt: null,
        effectiveDate: null,
        status: "cached",
      };
    }
    return {
      feed,
      source: f.data.source,
      cadence: f.feedStatus.cadence,
      fetchedAt: f.feedStatus.fetchedAt,
      effectiveDate: f.feedStatus.effectiveDate,
      status: f.feedStatus.status,
    };
  });
}

// ---------------------------------------------------------------------------
// getSwapOptions
// ---------------------------------------------------------------------------

export function getSwapOptions(opts: { cacheDir?: string } = {}): SwapOption[] {
  const sample = loadSample();
  const views = getDrugViews({ cacheDir: opts.cacheDir });
  const out: SwapOption[] = [];
  for (const e of sample.swapExtras) {
    const v = views.find((d) => d.id === e.drugId);
    if (!v) continue;
    out.push({
      drugId: v.id,
      drugName: v.name,
      category: v.category,
      nowMfr: v.mfr,
      toMfr: e.toMfr,
      teCode: e.teCode,
      benchmarkPrice: v.nadac,
      paid: v.paid,
      extraSavingsYr: e.extraSavingsYr,
      roundId: roundIdForDrug(sample.rounds, v.id) ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// getSummaryInputs
// ---------------------------------------------------------------------------

/** "YYYY-MM" twelve months before the month of an ISO timestamp (start of the 24 month chart). */
function chartStartMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  const y = m ? Number(m[1]) : 2026;
  const mo = m ? Number(m[2]) : 10;
  const idx = y * 12 + (mo - 1) - 12;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function getSummaryInputs(
  approvedSwapDrugIds: string[] = [],
  opts: { cacheDir?: string } = {},
): SummaryInputs {
  const sample = loadSample();
  const views = getDrugViews({ cacheDir: opts.cacheDir });
  const approved = new Set(approvedSwapDrugIds);

  // Generics: the 10 sample drugs. A drug without NADAC makes the whole benchmark null.
  const spend = views.reduce((s, v) => s + (v.annualSpend ?? 0), 0);
  const benches = views.map((v) => v.benchmarkSpend);
  const benchmark = benches.some((b) => b === null)
    ? null
    : benches.reduce<number>((s, b) => s + (b ?? 0), 0);

  const approvedExtras = sample.swapExtras
    .filter((e) => approved.has(e.drugId))
    .reduce((s, e) => s + e.extraSavingsYr, 0);
  const potentialExtras = sample.swapExtras.reduce((s, e) => s + e.extraSavingsYr, 0);

  const quotePcts = quotedPctRange();
  const roundRanges: RoundRange[] = [];
  for (const r of sample.rounds) {
    const { range, basis } = roundSavings(r, userSpend(sample.drugs, r.drugs), quotePcts);
    if (range) roundRanges.push({ roundId: r.id, low: range.low, high: range.high, basis });
  }

  const figures = summaryFigures({
    generics: { spend, benchmark, swapExtras: approvedExtras },
    brand: { spend: BRAND_SPEND },
    otc: { spend: OTC_SPEND },
  });

  const steps = savingsByStep({
    totalAnnualSpend: figures.totalSpend,
    generics: { spend, benchmark },
    approvedSwapExtras: approvedExtras,
    potentialSwapExtras: potentialExtras,
    rounds: roundRanges.map((r) => ({ low: r.low, high: r.high })),
  });

  const series = monthlySeries({
    totalAnnual: figures.totalSpend,
    todayIndex: 12,
    months: 24,
    startMonth: chartStartMonth(sample.demoNow),
    ...(figures.total ? { annualSavingsRange: { low: figures.total.low, high: figures.total.high } } : {}),
  });

  return { figures, steps, series, roundRanges, approvedExtras };
}

// ---------------------------------------------------------------------------
// getAskContext
// ---------------------------------------------------------------------------

/** Context for POST /api/ai/ask. Matches askInputSchema.context in lib/ai.ts. */
export function getAskContext(opts: { cacheDir?: string } = {}): AskContext {
  const sample = loadSample();
  const views = getDrugViews({ cacheDir: opts.cacheDir });
  const nadacFeed = tryFeed("nadac", opts.cacheDir);
  const usedLive = views.some((v) => v.nadacSource === "live");
  const nadacDate = nadacFeed?.data.effectiveDate;

  return {
    drugs: views.map((v) => ({
      id: v.id,
      drugName: v.name,
      strength: v.strength,
      paid: v.paid,
      unitsPerMonth: v.unitsPerMonth,
      ...(v.onHand !== undefined ? { onHand: v.onHand } : {}),
      hasShortage: v.shortage.current,
    })),
    benchmarks: views.flatMap((v) => (v.nadac !== null ? [{ drugId: v.id, nadac: v.nadac }] : [])),
    rounds: sample.rounds.map((r) => ({
      id: r.id,
      title: r.name,
      status: r.status,
      committedUnits: r.committedUnits,
      targetUnits: r.targetUnits,
    })),
    quotes: sample.quotes.quotes,
    demand: sample.quotes.groupDemand,
    weights: sample.quotes.defaultWeights ?? DEFAULT_WEIGHTS,
    userShare: sample.quotes.yourShare,
    sources: {
      drugs: "Sample member data",
      benchmarks:
        usedLive && nadacDate ? `CMS NADAC, effective ${nadacDate}` : "Sample NADAC reference prices",
      shortages: "openFDA drug shortages",
      quotes: "Sample supplier quotes",
      rounds: "Sample buying rounds",
    },
  };
}
