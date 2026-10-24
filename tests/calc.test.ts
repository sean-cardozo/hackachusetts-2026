import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_WEIGHTS,
  annualSpend,
  atRisk,
  benchmarkSpend,
  daysOfSupply,
  gapPct,
  monthlySeries,
  projectedProgress,
  recommendedCommitment,
  roundProgress,
  savingsByStep,
  savingsRange,
  scoreSuppliers,
  shortageRisk,
  statusAfterOptIn,
  summaryFigures,
  type Weights,
} from "../lib/calc";
import { loadDrugs, loadQuotes } from "../lib/sample";
import type { Quote, Supplier } from "../lib/types";

// ---------------------------------------------------------------------------
// Sample table from .kiro/specs/poolrx/design.md, already scaled x6.
// ---------------------------------------------------------------------------
const SAMPLE = {
  atorvastatin: { paid: 0.092, nadac: 0.0605, unitsPerMonth: 9800 * 6, onHand: 7400 * 6 },
  lisinopril: { paid: 0.048, nadac: 0.0262, unitsPerMonth: 7600 * 6, onHand: 6900 * 6 },
  amlodipine: { paid: 0.039, nadac: 0.0181, unitsPerMonth: 8900 * 6, onHand: 10100 * 6 },
  sertraline: { paid: 0.054, nadac: 0.0379, unitsPerMonth: 5900 * 6, onHand: 2350 * 6 },
  amoxicillin: { paid: 0.118, nadac: 0.0921, unitsPerMonth: 4300 * 6, onHand: 1290 * 6 },
  albuterol: { paid: 26.4, nadac: 21.85, unitsPerMonth: 310 * 6, onHand: 350 * 6 },
} as const;

const SWAP_EXTRAS = [11640, 6720, 7860]; // Accord, Lupin, Aurobindo (x6)
const SWAP_EXTRAS_TOTAL = 26220;

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("spend, benchmark and gap", () => {
  const a = SAMPLE.atorvastatin;

  it("annualSpend = paid x units x 12", () => {
    expect(annualSpend(a.paid, a.unitsPerMonth)).toBeCloseTo(0.092 * 58800 * 12, 6);
    expect(annualSpend(a.paid, a.unitsPerMonth)).toBeCloseTo(64915.2, 6);
  });

  it("benchmarkSpend = NADAC x units x 12", () => {
    expect(benchmarkSpend(a.nadac, a.unitsPerMonth)).toBeCloseTo(0.0605 * 58800 * 12, 6);
    expect(benchmarkSpend(a.nadac, a.unitsPerMonth)).toBeCloseTo(42688.8, 6);
  });

  it("benchmarkSpend is null when NADAC is 0 or missing", () => {
    expect(benchmarkSpend(0, 100)).toBeNull();
    expect(benchmarkSpend(null, 100)).toBeNull();
    expect(benchmarkSpend(undefined, 100)).toBeNull();
  });

  it("gapPct for atorvastatin is about 52.07 percent", () => {
    const g = gapPct(a.paid, a.nadac);
    expect(g).not.toBeNull();
    expect(g!).toBeCloseTo(52.066, 2);
    expect(Math.round(g!)).toBe(52); // demo line "atorvastatin 52% above NADAC"
  });

  it("gapPct is negative when paid is below NADAC and null without NADAC", () => {
    expect(gapPct(0.112, 0.1186)).toBeLessThan(0); // levothyroxine
    expect(gapPct(0.1, 0)).toBeNull();
    expect(gapPct(0.1, undefined)).toBeNull();
  });

  it("generic spend of the 10 sample drugs is $694,348.56 a year (real NADAC plus 8 to 18 percent; the design's hand-typed prices gave $899,848.80)", () => {
    const drugs = loadDrugs().items;
    const spend = drugs.reduce((s, d) => s + annualSpend(d.paid, d.unitsPerMonth)!, 0);
    expect(spend).toBeCloseTo(694_348.56, 1);
  });
});

describe("savingsRange", () => {
  it("is 50 to 85 percent of the gap", () => {
    const r = savingsRange(100_000, 60_000)!;
    expect(r.low).toBeCloseTo(20_000, 6);
    expect(r.high).toBeCloseTo(34_000, 6);
  });

  it("adds swap extras to both ends", () => {
    const r = savingsRange(100_000, 60_000, 1_940)!;
    expect(r.low).toBeCloseTo(21_940, 6);
    expect(r.high).toBeCloseTo(35_940, 6);
  });

  it("gives only the extras when spend is below the benchmark", () => {
    expect(savingsRange(50_000, 60_000, 500)).toEqual({ low: 500, high: 500 });
    expect(savingsRange(50_000, 60_000)).toEqual({ low: 0, high: 0 });
  });

  it("returns null when spend or benchmark is missing", () => {
    expect(savingsRange(100, null)).toBeNull();
    expect(savingsRange(undefined, 100)).toBeNull();
  });

  it("treats negative or non-finite extras as 0", () => {
    expect(savingsRange(100, 50, -10)).toEqual({ low: 25, high: 42.5 });
    expect(savingsRange(100, 50, NaN)).toEqual({ low: 25, high: 42.5 });
  });
});

describe("daysOfSupply", () => {
  it("amoxicillin is 9 days and sertraline is 12 days", () => {
    expect(daysOfSupply(SAMPLE.amoxicillin.onHand, SAMPLE.amoxicillin.unitsPerMonth)).toBe(9);
    expect(daysOfSupply(SAMPLE.sertraline.onHand, SAMPLE.sertraline.unitsPerMonth)).toBe(12);
  });

  it("albuterol is 34 days", () => {
    expect(daysOfSupply(SAMPLE.albuterol.onHand, SAMPLE.albuterol.unitsPerMonth)).toBe(34);
  });

  it("is null when units per month is 0 or on hand is unknown", () => {
    expect(daysOfSupply(100, 0)).toBeNull();
    expect(daysOfSupply(undefined, 100)).toBeNull();
    expect(daysOfSupply(null, 100)).toBeNull();
  });

  it("is 0 for zero or negative on hand", () => {
    expect(daysOfSupply(0, 300)).toBe(0);
    expect(daysOfSupply(-50, 300)).toBe(0);
  });
});

describe("shortageRisk", () => {
  it("is High for amoxicillin (shortage and 9 days)", () => {
    expect(shortageRisk(true, 9)).toBe("High");
  });

  it("is Watch for albuterol (shortage and 34 days)", () => {
    expect(shortageRisk(true, 34)).toBe("Watch");
  });

  it("is Low without a shortage, whatever the days", () => {
    expect(shortageRisk(false, 3)).toBe("Low");
    expect(shortageRisk(false, 40)).toBe("Low");
    expect(shortageRisk(false, null)).toBe("Low");
  });

  it("is Watch for a shortage with no days of supply", () => {
    expect(shortageRisk(true, null)).toBe("Watch");
    expect(shortageRisk(true, undefined)).toBe("Watch");
  });

  it("uses 14 days as the boundary (13 High, 14 Watch)", () => {
    expect(shortageRisk(true, 13)).toBe("High");
    expect(shortageRisk(true, 14)).toBe("Watch");
  });
});

describe("recommendedCommitment", () => {
  it("is 3 x units/month minus the extra stock", () => {
    const a = SAMPLE.atorvastatin; // on hand below monthly use: no extra stock
    expect(recommendedCommitment(a.unitsPerMonth, a.onHand)).toBe(3 * 58800);
    const am = SAMPLE.amlodipine; // on hand 60,600 vs 53,400/month: extra 7,200
    expect(recommendedCommitment(am.unitsPerMonth, am.onHand)).toBe(3 * 53400 - 7200);
  });

  it("is 3 x units/month when onHand is unknown", () => {
    expect(recommendedCommitment(1000)).toBe(3000);
    expect(recommendedCommitment(1000, undefined)).toBe(3000);
    expect(recommendedCommitment(1000, null)).toBe(3000);
  });

  it("is floored at 0 when on hand is huge", () => {
    expect(recommendedCommitment(10, 1000)).toBe(0);
  });

  it("is null when units per month is 0", () => {
    expect(recommendedCommitment(0, 100)).toBeNull();
  });
});

describe("scoreSuppliers with the real quotes", () => {
  const file = loadQuotes();
  const demand = file.groupDemand;
  const byLetter = (list: ReturnType<typeof scoreSuppliers>, s: Supplier) =>
    list.find((x) => x.supplier === s)!;

  it("loads the default weights 50 / 20 / 30", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ price: 50, delivery: 20, reliability: 30 });
    expect(file.defaultWeights).toEqual(DEFAULT_WEIGHTS);
  });

  it("B wins with the default weights and the order is B, C, A", () => {
    const ranked = scoreSuppliers(file.quotes, demand);
    expect(ranked.map((s) => s.supplier)).toEqual(["B", "C", "A"]);
  });

  it("computes the component scores from the design formulas", () => {
    const ranked = scoreSuppliers(file.quotes, demand);
    const A = byLetter(ranked, "A");
    const B = byLetter(ranked, "B");
    const C = byLetter(ranked, "C");
    // A is the cheapest total, so its price score is 100.
    expect(A.price).toBeCloseTo(100, 6);
    expect(B.price).toBeCloseTo((A.total / B.total) * 100, 6);
    expect(C.price).toBeCloseTo((A.total / C.total) * 100, 6);
    // delivery = 100 - (days - 3) x 8
    expect(A.delivery).toBe(52);
    expect(B.delivery).toBe(84);
    expect(C.delivery).toBe(100);
    // reliability is the value in the quote
    expect([A.reliability, B.reliability, C.reliability]).toEqual([62, 96, 81]);
    // weighted score with 50 / 20 / 30
    expect(B.score).toBeCloseTo(0.5 * B.price + 0.2 * 84 + 0.3 * 96, 6);
    expect(B.score).toBeCloseTo(94.64, 1);
    expect(C.score).toBeCloseTo(91.13, 1);
    expect(A.score).toBeCloseTo(79.0, 1);
  });

  it("sums totals as price x group demand", () => {
    const A = byLetter(scoreSuppliers(file.quotes, demand), "A");
    expect(A.total).toBeCloseTo(0.0182 * 2_520_000 + 0.104 * 1_116_000 + 0.0298 * 588_000, 4);
  });

  it("price weight 100 makes the cheapest supplier (A) the winner", () => {
    const w: Weights = { price: 100, delivery: 0, reliability: 0 };
    const ranked = scoreSuppliers(file.quotes, demand, w);
    const cheapest = [...ranked].sort((x, y) => x.total - y.total)[0];
    expect(ranked[0].supplier).toBe(cheapest.supplier);
    expect(ranked[0].supplier).toBe("A");
  });

  it("delivery weight 100 favors C (3 days)", () => {
    const ranked = scoreSuppliers(file.quotes, demand, { price: 0, delivery: 100, reliability: 0 });
    expect(ranked[0].supplier).toBe("C");
  });

  it("reliability weight 100 favors B (96)", () => {
    const ranked = scoreSuppliers(file.quotes, demand, { price: 0, delivery: 0, reliability: 100 });
    expect(ranked[0].supplier).toBe("B");
  });

  it("falls back to the default weights when all weights are 0", () => {
    const zero = scoreSuppliers(file.quotes, demand, { price: 0, delivery: 0, reliability: 0 });
    const def = scoreSuppliers(file.quotes, demand);
    expect(zero.map((s) => s.supplier)).toEqual(def.map((s) => s.supplier));
  });
});

describe("round progress", () => {
  const COMMITTED = 5_650_000;
  const TARGET = 6_000_000;

  it("roundProgress is committed / target x 100, uncapped", () => {
    expect(roundProgress(COMMITTED, TARGET)).toBeCloseTo(94.1667, 3);
    expect(roundProgress(648, 600)).toBeCloseTo(108, 6);
  });

  it("roundProgress is null when target is 0", () => {
    expect(roundProgress(100, 0)).toBeNull();
  });

  it("projectedProgress adds the opt-in units", () => {
    expect(projectedProgress(COMMITTED, TARGET, 350_000)).toBeCloseTo(100, 6);
    expect(projectedProgress(COMMITTED, TARGET, 0)).toBeCloseTo(94.1667, 3);
  });

  it("an opt-in that reaches 100 percent turns an open round into target", () => {
    expect(statusAfterOptIn("open", COMMITTED, TARGET, 350_000)).toBe("target");
    expect(statusAfterOptIn("open", COMMITTED, TARGET, 500_000)).toBe("target");
    expect(statusAfterOptIn("at-risk", COMMITTED, TARGET, 400_000)).toBe("target");
  });

  it("an open round that stays below 100 percent stays open", () => {
    expect(statusAfterOptIn("open", COMMITTED, TARGET, 100_000)).toBe("open");
    expect(statusAfterOptIn("open", COMMITTED, TARGET, 349_999)).toBe("open");
  });

  it("non-collecting statuses are unchanged", () => {
    for (const s of ["target", "quotes", "awarded", "closed", "missed"] as const) {
      expect(statusAfterOptIn(s, COMMITTED, TARGET, 1_000_000)).toBe(s);
    }
  });

  it("stays open when the target is unusable", () => {
    expect(statusAfterOptIn("open", 100, 0, 50)).toBe("open");
  });
});

describe("atRisk", () => {
  it("58 percent of target on pace 81/58 projects about 81 and is at risk", () => {
    const r = atRisk(580, 1000, 81 / 58, 10)!;
    expect(r).not.toBeNull();
    expect(r.projectedPct).toBeCloseTo(81, 6);
    expect(r.atRisk).toBe(true);
    expect(r.pharmaciesNeeded).not.toBeNull();
    expect(r.pharmaciesNeeded!).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(r.pharmaciesNeeded!)).toBe(true);
  });

  it("is not at risk when the projection reaches 100", () => {
    const r = atRisk(800, 1000, 1.3, 10)!;
    expect(r.atRisk).toBe(false);
    expect(r.pharmaciesNeeded).toBe(0);
  });

  it("returns null for bad target or pace, and null pharmacies without an average", () => {
    expect(atRisk(100, 0, 1.2, 5)).toBeNull();
    expect(atRisk(100, 1000, -1, 5)).toBeNull();
    expect(atRisk(100, 1000, NaN, 5)).toBeNull();
    expect(atRisk(100, 1000, 1.2, 0)!.pharmaciesNeeded).toBeNull();
    expect(atRisk(100, 1000, 1.2, undefined)!.pharmaciesNeeded).toBeNull();
  });
});

describe("summary figures, savings by step and monthly series", () => {
  const drugs = loadDrugs().items;
  const gSpend = drugs.reduce((s, d) => s + annualSpend(d.paid, d.unitsPerMonth)!, 0);
  const gBench = drugs.reduce((s, d) => s + benchmarkSpend(d.nadacFallback, d.unitsPerMonth)!, 0);
  const BRAND = 3_100_000;
  const OTC = 280_000;

  const input = {
    generics: { spend: gSpend, benchmark: gBench, swapExtras: SWAP_EXTRAS_TOTAL },
    brand: { spend: BRAND },
    otc: { spend: OTC },
  };

  it("swap extras from the design add up to $26,220 (= $4,370 x 6)", () => {
    expect(SWAP_EXTRAS.reduce((s, x) => s + x, 0)).toBe(SWAP_EXTRAS_TOTAL);
    expect(SWAP_EXTRAS_TOTAL).toBe(4370 * 6);
  });

  it("summaryFigures: total spend is about $4.07M (generics $694k + brand $3.1M + OTC $280k)", () => {
    const f = summaryFigures(input);
    expect(f.totalSpend).toBeCloseTo(gSpend + BRAND + OTC, 4);
    expect(f.totalSpend).toBeGreaterThan(4_050_000);
    expect(f.totalSpend).toBeLessThan(4_100_000);
    expect(f.incomplete).toBe(false);
    expect(f.includedSwapExtras).toBe(SWAP_EXTRAS_TOTAL);
  });

  it("summaryFigures: brand uses 1 to 2.5 percent and OTC uses 8 to 14 percent", () => {
    const f = summaryFigures(input);
    expect(f.breakdown.brand.savings!.low).toBeCloseTo(BRAND * 0.01, 4);
    expect(f.breakdown.brand.savings!.high).toBeCloseTo(BRAND * 0.025, 4);
    expect(f.breakdown.otc.savings!.low).toBeCloseTo(OTC * 0.08, 4);
    expect(f.breakdown.otc.savings!.high).toBeCloseTo(OTC * 0.14, 4);
  });

  it("summaryFigures: generics is 50 to 85 percent of the NADAC gap plus swap extras", () => {
    const f = summaryFigures(input);
    const gap = gSpend - gBench;
    expect(f.breakdown.generics.savings!.low).toBeCloseTo(0.5 * gap + SWAP_EXTRAS_TOTAL, 4);
    expect(f.breakdown.generics.savings!.high).toBeCloseTo(0.85 * gap + SWAP_EXTRAS_TOTAL, 4);
  });

  it("summaryFigures: total is the sum of the types and carries dollars and percent", () => {
    const f = summaryFigures(input);
    const parts = [f.breakdown.generics, f.breakdown.brand, f.breakdown.otc].map((p) => p.savings!);
    expect(f.total!.low).toBeCloseTo(parts.reduce((s, p) => s + p.low, 0), 4);
    expect(f.total!.high).toBeCloseTo(parts.reduce((s, p) => s + p.high, 0), 4);
    expect(f.total!.pctLow).toBeCloseTo((f.total!.low / f.totalSpend) * 100, 6);
    expect(f.total!.pctHigh).toBeCloseTo((f.total!.high / f.totalSpend) * 100, 6);
    for (const p of [...parts, f.total!]) {
      expect(Number.isFinite(p.low)).toBe(true);
      expect(Number.isFinite(p.high)).toBe(true);
      expect(Number.isFinite(p.pctLow)).toBe(true);
      expect(Number.isFinite(p.pctHigh)).toBe(true);
      expect(p.low).toBeLessThanOrEqual(p.high);
    }
  });

  it("summaryFigures: no benchmark leaves generics out and flags incomplete", () => {
    const f = summaryFigures({ ...input, generics: { spend: gSpend, benchmark: null } });
    expect(f.breakdown.generics.savings).toBeNull();
    expect(f.incomplete).toBe(true);
    expect(f.includedSwapExtras).toBe(0);
    expect(f.total).not.toBeNull();
  });

  it("summaryFigures: percent is null when the spend is 0", () => {
    const f = summaryFigures({
      generics: { spend: 0, benchmark: 0 },
      brand: { spend: 0 },
      otc: { spend: 0 },
    });
    expect(f.totalSpend).toBe(0);
    expect(f.total!.pctLow).toBeNull();
    expect(f.total!.pctHigh).toBeNull();
  });

  it("savingsByStep: Compare + Swap equals the generics figure (dollars and percent of total)", () => {
    const f = summaryFigures(input);
    const steps = savingsByStep({
      totalAnnualSpend: f.totalSpend,
      generics: { spend: gSpend, benchmark: gBench },
      approvedSwapExtras: SWAP_EXTRAS_TOTAL,
      potentialSwapExtras: SWAP_EXTRAS_TOTAL,
    });
    const g = f.breakdown.generics.savings!;
    expect(steps.compare!.low + steps.swap.low).toBeCloseTo(g.low, 4);
    expect(steps.compare!.high + steps.swap.high).toBeCloseTo(g.high, 4);
    expect(steps.compare!.pctLow! + steps.swap.pctLow!).toBeCloseTo((g.low / f.totalSpend) * 100, 6);
    expect(steps.compare!.pctHigh! + steps.swap.pctHigh!).toBeCloseTo((g.high / f.totalSpend) * 100, 6);
  });

  it("savingsByStep: every figure has dollars and percent, swap is a fixed amount", () => {
    const steps = savingsByStep({
      totalAnnualSpend: 4_300_000,
      generics: { spend: gSpend, benchmark: gBench },
      approvedSwapExtras: 11_640,
      potentialSwapExtras: SWAP_EXTRAS_TOTAL,
      rounds: [
        { low: 1000, high: 2000 },
        { low: 500, high: 900 },
      ],
    });
    expect(steps.swap.low).toBe(11_640);
    expect(steps.swap.high).toBe(11_640);
    expect(steps.swap.potential.low).toBe(SWAP_EXTRAS_TOTAL);
    expect(steps.join.low).toBe(1500);
    expect(steps.join.high).toBe(2900);
    for (const fig of [steps.compare!, steps.swap, steps.swap.potential, steps.join]) {
      expect(typeof fig.low).toBe("number");
      expect(typeof fig.high).toBe("number");
      expect(typeof fig.pctLow).toBe("number");
      expect(typeof fig.pctHigh).toBe("number");
    }
    expect(steps.join.pctLow).toBeCloseTo((1500 / 4_300_000) * 100, 8);
  });

  it("savingsByStep: compare is null without a benchmark; join is 0 without rounds", () => {
    const steps = savingsByStep({
      totalAnnualSpend: 1000,
      generics: { spend: 500, benchmark: null },
    });
    expect(steps.compare).toBeNull();
    expect(steps.join.low).toBe(0);
    expect(steps.join.high).toBe(0);
  });

  describe("monthlySeries", () => {
    const TOTAL = 4_300_000;
    const series = monthlySeries({
      totalAnnual: TOTAL,
      savingsPctRange: [8, 14],
      startMonth: "2025-11",
    })!;

    it("has 24 points and the Today marker at 12", () => {
      expect(series.points).toHaveLength(24);
      expect(series.todayIndex).toBe(12);
      expect(series.points.map((p) => p.monthIndex)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    });

    it("the 12 actual months sum to totalAnnual", () => {
      const actual = series.points.slice(0, 12);
      expect(actual.every((p) => typeof p.actual === "number")).toBe(true);
      expect(actual.reduce((s, p) => s + p.actual!, 0)).toBeCloseTo(TOTAL, 4);
      expect(series.points.slice(12).every((p) => p.actual === undefined)).toBe(true);
    });

    it("actual months have a zero-width band", () => {
      for (const p of series.points.slice(0, 12)) {
        expect(p.projectedWithLow).toBe(p.projectedWithout);
        expect(p.projectedWithHigh).toBe(p.projectedWithout);
        expect(p.actual).toBe(p.projectedWithout);
      }
    });

    it("with PharmaPool never exceeds without, and high savings is the lowest line", () => {
      for (const p of series.points) {
        expect(p.projectedWithLow).toBeLessThanOrEqual(p.projectedWithout);
        expect(p.projectedWithHigh).toBeLessThanOrEqual(p.projectedWithLow);
      }
      const last = series.points[23];
      expect(last.projectedWithHigh).toBeLessThan(last.projectedWithout);
    });

    it("ramps savings: month 1 saves 1/4, month 4 and later save the full percent", () => {
      const p1 = series.points[12];
      const p4 = series.points[15];
      const p5 = series.points[16];
      expect(1 - p1.projectedWithLow / p1.projectedWithout).toBeCloseTo(0.08 * 0.25, 8);
      expect(1 - p4.projectedWithLow / p4.projectedWithout).toBeCloseTo(0.08, 8);
      expect(1 - p5.projectedWithHigh / p5.projectedWithout).toBeCloseTo(0.14, 8);
    });

    it("projected 12 month savings carries dollars and percent, below the plain range", () => {
      const s = series.projected12MonthSavings;
      expect(s.low).toBeGreaterThan(0);
      expect(s.low).toBeLessThanOrEqual(s.high);
      expect(s.pctLow!).toBeLessThan(8);
      expect(s.pctHigh!).toBeLessThan(14);
      expect(s.pctLow!).toBeGreaterThan(0);
    });

    it("labels months when startMonth is given", () => {
      expect(series.points[0].label).toBe("Nov 2025");
      expect(series.points[2].label).toBe("Jan 2026");
      expect(series.points[23].label).toBe("Oct 2027");
    });

    it("uses an annual savings range in dollars when given", () => {
      const s = monthlySeries({
        totalAnnual: 1_000_000,
        annualSavingsRange: { low: 80_000, high: 140_000 },
      })!;
      const p = s.points[20]; // fully ramped
      expect(1 - p.projectedWithLow / p.projectedWithout).toBeCloseTo(0.08, 8);
      expect(1 - p.projectedWithHigh / p.projectedWithout).toBeCloseTo(0.14, 8);
    });

    it("returns null when totalAnnual is 0, negative or missing", () => {
      expect(monthlySeries({ totalAnnual: 0 })).toBeNull();
      expect(monthlySeries({ totalAnnual: -5 })).toBeNull();
      expect(monthlySeries({ totalAnnual: NaN })).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Property tests (fast-check)
// ---------------------------------------------------------------------------

const RUNS = 200;

describe("property tests", () => {
  // Feature: poolrx-backend, Property 1: Savings range
  // Validates: Requirements 3.11
  it("Property 1: savingsRange is null or {low, high} with 0 <= low <= high", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(finite, finite, finite, (spend, benchmark, extras) => {
        const r = savingsRange(spend, benchmark, extras);
        if (r === null) return true;
        return r.low >= 0 && r.low <= r.high;
      }),
      { numRuns: RUNS },
    );
  });

  // Feature: poolrx-backend, Property 1: Savings range (realistic money values)
  // Validates: Requirements 3.11
  it("Property 1: also holds for realistic money values, with the exact 50/85 percent split", () => {
    const money = fc.double({ min: 0, max: 1e9, noNaN: true });
    fc.assert(
      fc.property(money, money, money, (spend, benchmark, extras) => {
        const r = savingsRange(spend, benchmark, extras)!;
        const gap = Math.max(0, spend - benchmark);
        return (
          r.low >= 0 &&
          r.low <= r.high &&
          Math.abs(r.low - (0.5 * gap + extras)) < 1e-6 &&
          Math.abs(r.high - (0.85 * gap + extras)) < 1e-6
        );
      }),
      { numRuns: RUNS },
    );
  });

  // Feature: poolrx-backend, Property 2: Supplier ranking
  // Validates: Requirements 3.12
  it("Property 2: scores stay in 0..100 and the input order does not change the winner", () => {
    const quoteFor = (supplier: Supplier) =>
      fc.record({
        supplier: fc.constant(supplier),
        prices: fc.record({
          p1: fc.double({ min: 0.001, max: 500, noNaN: true }),
          p2: fc.double({ min: 0.001, max: 500, noNaN: true }),
          p3: fc.double({ min: 0.001, max: 500, noNaN: true }),
        }),
        deliveryDays: fc.integer({ min: 0, max: 30 }),
        minOrder: fc.integer({ min: 0, max: 50_000 }),
        reliability: fc.integer({ min: 0, max: 100 }),
        quotedPct: fc.double({ min: 0, max: 30, noNaN: true }),
      });
    const quotesArb = fc
      .tuple(quoteFor("A"), quoteFor("B"), quoteFor("C"))
      .chain((trio) => fc.shuffledSubarray(trio, { minLength: 1, maxLength: 3 }));
    const demandArb = fc.record({
      p1: fc.integer({ min: 0, max: 5_000_000 }),
      p2: fc.integer({ min: 0, max: 5_000_000 }),
      p3: fc.integer({ min: 0, max: 5_000_000 }),
    });
    const weightArb = fc.record({
      price: fc.double({ min: 0, max: 100, noNaN: true }),
      delivery: fc.double({ min: 0, max: 100, noNaN: true }),
      reliability: fc.double({ min: 0, max: 100, noNaN: true }),
    });

    fc.assert(
      fc.property(
        quotesArb,
        demandArb,
        weightArb,
        fc.infiniteStream(fc.nat()),
        (quotes, demand, weights, rnd) => {
          const ranked = scoreSuppliers(quotes as Quote[], demand, weights);
          for (const s of ranked) {
            for (const v of [s.score, s.price, s.delivery, s.reliability]) {
              if (!(Number.isFinite(v) && v >= 0 && v <= 100)) return false;
            }
          }
          // Fisher-Yates shuffle driven by the generated stream.
          const shuffled = [...quotes];
          const it = rnd[Symbol.iterator]();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = it.next().value % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const again = scoreSuppliers(shuffled as Quote[], demand, weights);
          return (
            ranked.length === again.length &&
            ranked[0].supplier === again[0].supplier &&
            ranked.every((s, i) => s.supplier === again[i].supplier)
          );
        },
      ),
      { numRuns: RUNS },
    );
  });

  // Feature: poolrx-backend, Property 3: Days of supply
  // Validates: Requirements 3.13
  it("Property 3: more units on hand never lowers days of supply", () => {
    const units = fc.double({ min: 0.001, max: 1e7, noNaN: true });
    const stock = fc.double({ min: 0, max: 1e9, noNaN: true });
    fc.assert(
      fc.property(units, stock, stock, (u, x, y) => {
        const lo = Math.min(x, y);
        const hi = Math.max(x, y);
        const dLo = daysOfSupply(lo, u);
        const dHi = daysOfSupply(hi, u);
        return dLo !== null && dHi !== null && dHi >= dLo;
      }),
      { numRuns: RUNS },
    );
  });

  // Feature: poolrx-backend, Property 4: No NaN
  // Validates: Requirements 3.14
  describe("Property 4: no NaN or Infinity", () => {
    const special = fc.constantFrom<number | null | undefined>(
      NaN,
      Infinity,
      -Infinity,
      0,
      -0,
      -1,
      1,
      null,
      undefined,
    );
    // Any value: special ones (NaN, +-Infinity, 0, negatives, null, undefined), plain doubles
    // (which can also be NaN/Infinity) and ordinary magnitudes. Finite values are kept between
    // 1e-6 and 1e9 in size (or exactly 0): overflow and denormal extremes have their own
    // `it.fails` tests at the end of this file.
    const ordinary = fc
      .double({ min: -1e9, max: 1e9, noNaN: true })
      .filter((x) => x === 0 || Math.abs(x) >= 1e-6);
    const weird = fc.oneof(
      special,
      fc.constantFrom(NaN, Infinity, -Infinity),
      ordinary,
      fc.integer({ min: -1_000_000, max: 1_000_000 }),
    );
    const bad = (x: unknown) => x as number;

    /** Fails the property when any number inside `value` is NaN or Infinity. */
    const allFinite = (value: unknown): boolean => {
      if (typeof value === "number") return Number.isFinite(value);
      if (Array.isArray(value)) return value.every(allFinite);
      if (value && typeof value === "object") return Object.values(value).every(allFinite);
      return true;
    };

    it("scalar calc functions return finite numbers or null/strings", () => {
      fc.assert(
        fc.property(weird, weird, weird, weird, (a, b, c, d) => {
          return [
            annualSpend(bad(a), bad(b)),
            benchmarkSpend(a as number, bad(b)),
            gapPct(bad(a), b as number),
            savingsRange(a as number, b as number, bad(c)),
            daysOfSupply(a as number, bad(b)),
            shortageRisk(true, a as number),
            recommendedCommitment(bad(a), b as number),
            roundProgress(bad(a), bad(b)),
            projectedProgress(bad(a), bad(b), bad(c)),
            statusAfterOptIn("open", bad(a), bad(b), bad(c)),
            atRisk(bad(a), bad(b), bad(c), d as number),
          ].every(allFinite);
        }),
        { numRuns: RUNS },
      );
    });

    it("scoreSuppliers returns finite scores on weird quotes, demand and weights", () => {
      fc.assert(
        fc.property(
          weird,
          weird,
          weird,
          weird,
          weird,
          weird,
          weird,
          (price, days, rel, demandQty, w1, w2, w3) => {
            const quotes = (["A", "B"] as Supplier[]).map((supplier) => ({
              supplier,
              prices: { x: bad(price), y: bad(price) },
              deliveryDays: bad(days),
              minOrder: 0,
              reliability: bad(rel),
              quotedPct: 0,
            }));
            const ranked = scoreSuppliers(quotes, { x: bad(demandQty), y: 100 }, {
              price: bad(w1),
              delivery: bad(w2),
              reliability: bad(w3),
            });
            return allFinite(ranked);
          },
        ),
        { numRuns: RUNS },
      );
    });

    it("summaryFigures and savingsByStep return finite numbers or null", () => {
      fc.assert(
        fc.property(weird, weird, weird, weird, weird, weird, (a, b, c, d, e, f) => {
          const sf = summaryFigures({
            generics: { spend: bad(a), benchmark: b as number, swapExtras: bad(c) },
            brand: { spend: bad(d), pctRange: [bad(e), bad(f)] },
            otc: { spend: bad(e), pctRange: [bad(f), bad(a)] },
          });
          const steps = savingsByStep({
            totalAnnualSpend: bad(a),
            generics: { spend: bad(b), benchmark: c as number },
            approvedSwapExtras: bad(d),
            potentialSwapExtras: bad(e),
            rounds: [{ low: bad(f), high: bad(a) }],
          });
          return allFinite(sf) && allFinite(steps);
        }),
        { numRuns: RUNS },
      );
    });

    it("monthlySeries returns finite numbers or null on weird inputs", () => {
      // months is kept small: a huge finite value would just build a huge array.
      const smallCount = fc.oneof(special, fc.integer({ min: -5, max: 60 }), fc.double({ min: -5, max: 60, noNaN: true }));
      fc.assert(
        fc.property(
          weird,
          smallCount,
          weird,
          weird,
          smallCount,
          weird,
          weird,
          (total, today, lo, hi, months, season, drift) => {
            const s1 = monthlySeries({
              totalAnnual: bad(total),
              todayIndex: bad(today),
              savingsPctRange: [bad(lo), bad(hi)],
              months: bad(months),
              seasonalityPct: bad(season),
              annualDriftPct: bad(drift),
            });
            const s2 = monthlySeries({
              totalAnnual: bad(total),
              annualSavingsRange: { low: bad(lo), high: bad(hi) },
              months: bad(months),
            });
            return allFinite(s1) && allFinite(s2);
          },
        ),
        { numRuns: RUNS },
      );
    });

    it("handles missing (undefined / null) inputs without throwing or returning NaN", () => {
      expect(allFinite(daysOfSupply(undefined, 100))).toBe(true);
      expect(allFinite(recommendedCommitment(100, undefined))).toBe(true);
      expect(allFinite(atRisk(100, 1000, 1.2, undefined))).toBe(true);
      expect(allFinite(savingsRange(null, undefined))).toBe(true);
      expect(allFinite(gapPct(1, null))).toBe(true);
      expect(allFinite(benchmarkSpend(undefined, 10))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Extreme magnitudes. These are REAL gaps against Requirement 3.14 (never NaN or Infinity)
// found by fast-check. lib/calc.ts is owned elsewhere, so they are marked `it.fails`:
// the suite stays green now and these will flip to "unexpected pass" once calc.ts is fixed
// (then change `it.fails` to `it`).
// ---------------------------------------------------------------------------
describe("extreme magnitudes (known gaps in lib/calc.ts)", () => {
  const finiteOrNull = (value: unknown): boolean => {
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(finiteOrNull);
    if (value && typeof value === "object") return Object.values(value).every(finiteOrNull);
    return true;
  };

  // Guarded: annualSpend returns null when the product overflows.
  it("annualSpend(1e200, 1e200) should not be Infinity", () => {
    expect(finiteOrNull(annualSpend(1e200, 1e200))).toBe(true);
  });

  // Guarded: pharmaciesNeeded is null when the quotient overflows.
  it("atRisk with a denormal average units per pharmacy should not return Infinity", () => {
    expect(finiteOrNull(atRisk(0, 1, 1, 1e-320))).toBe(true);
  });

  // Guarded: an overflowing total makes the quote incomplete (price score 0), no NaN.
  it("scoreSuppliers with prices near 1e306 should not return NaN", () => {
    const q = (supplier: Supplier): Quote => ({
      supplier,
      prices: { x: 1.797693134862316e306, y: 1.797693134862316e306 },
      deliveryDays: 0,
      minOrder: 0,
      reliability: 0,
      quotedPct: 0,
    });
    expect(finiteOrNull(scoreSuppliers([q("A"), q("B")], { x: 0, y: 100 }))).toBe(true);
  });

  // Guarded: a percent that overflows is null.
  it("summaryFigures with a denormal total spend should not return an Infinity percent", () => {
    const f = summaryFigures({
      generics: { spend: 0, benchmark: -1 },
      brand: { spend: 1e-320 },
      otc: { spend: 0 },
    });
    expect(finiteOrNull(f)).toBe(true);
  });

  // Guarded: percent ranges are clamped to 0..100.
  it("monthlySeries with a savings percent near 1e308 should not return Infinity", () => {
    const s = monthlySeries({
      totalAnnual: 1200,
      todayIndex: 0,
      savingsPctRange: [0, 1.7976931348623155e308],
      months: 1,
    });
    expect(finiteOrNull(s)).toBe(true);
  });

  // Guarded: annual drift is clamped to -99..100 percent.
  it("monthlySeries with an enormous annual drift should not return Infinity or NaN", () => {
    expect(finiteOrNull(monthlySeries({ totalAnnual: 1200, annualDriftPct: 1e300 }))).toBe(true);
  });
});
