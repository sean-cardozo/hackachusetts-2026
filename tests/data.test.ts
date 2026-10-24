// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createStateSource,
  selectApprovedSwapDrugIds,
  selectTotalApprovedExtras,
} from "../components/AppState";
import { askInputSchema } from "../lib/ai";
import {
  DRUG_KEY_BY_ID,
  getAskContext,
  getDrugViews,
  getFeedStatus,
  getQuotes,
  getRounds,
  getSummaryInputs,
  getSwapOptions,
} from "../lib/data";
import { createMemoryStore } from "../lib/store";

const SWAP_IDS = ["atorvastatin-20", "lisinopril-10", "amlodipine-5"];
const roundTrip = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("getDrugViews", () => {
  const views = getDrugViews();
  const byId = (id: string) => {
    const v = views.find((d) => d.id === id);
    if (!v) throw new Error(`missing ${id}`);
    return v;
  };

  it("has a view for each of the 10 sample drugs with a mapped key", () => {
    expect(views).toHaveLength(10);
    expect(Object.keys(DRUG_KEY_BY_ID)).toHaveLength(10);
    for (const v of views) expect(v.drugKey).toBe(DRUG_KEY_BY_ID[v.id]);
  });

  it("uses the cache NADAC or the fallback, never an unusable value", () => {
    for (const v of views) {
      expect(v.nadac).not.toBeNull();
      expect(v.nadac as number).toBeGreaterThan(0);
      if (v.nadacSource === "fallback") expect(v.nadac).toBe(v.nadacFallback);
      if (v.nadacSource === "fallback") expect(v.nadacNote).toBeTruthy();
      if (v.nadacSource === "live") expect(v.nadacPricingUnit).toBe("EA");
    }
    // Albuterol is priced per gram in the cache, so the view must use the fallback.
    expect(byId("albuterol-90").nadacSource).toBe("fallback");
  });

  it("falls back to the sample NADAC when the cache folder is missing", () => {
    const fb = getDrugViews({ cacheDir: "/nonexistent/cache" });
    for (const v of fb) {
      expect(v.nadacSource).toBe("fallback");
      expect(v.nadac).toBe(v.nadacFallback);
    }
    // The fallback is the real cache NADAC (0.02858), so the atorvastatin gap is
    // (0.0337 - 0.02858) / 0.02858 = 17.9 %.
    const gap = fb.find((v) => v.id === "atorvastatin-20")?.gapPct as number;
    expect(gap).toBeGreaterThan(17);
    expect(gap).toBeLessThan(19);
  });

  it("gives atorvastatin a sensible positive gap with the cache", () => {
    const gap = byId("atorvastatin-20").gapPct as number;
    console.info(`atorvastatin gap (${byId("atorvastatin-20").nadacSource}): ${gap.toFixed(1)}%`);
    // Price paid is the real NADAC plus an 18 % markup, so the gap is about 18 % (8 to 20 % allowed).
    expect(gap).toBeGreaterThan(8);
    expect(gap).toBeLessThan(20);
  });

  it("flags amoxicillin and albuterol as shortages", () => {
    for (const id of ["amoxicillin-500", "albuterol-90"]) {
      const s = byId(id).shortage;
      console.info(`${id} shortage: current=${s.current} source=${s.source}`);
      expect(s.current).toBe(true);
      expect(["live", "sample"]).toContain(s.source);
    }
    expect(byId("atorvastatin-20").shortage.current).toBe(false);
  });

  it("computes days of supply", () => {
    expect(byId("amoxicillin-500").daysOfSupply).toBe(9);
    expect(byId("sertraline-50").daysOfSupply).toBe(12);
    expect(byId("amoxicillin-500").shortageRisk).toBe("High");
  });

  it("lists the three Cardio swaps as equivalents with extras", () => {
    const expected: Record<string, string> = {
      "atorvastatin-20": "accord",
      "lisinopril-10": "lupin",
      "amlodipine-5": "aurobindo",
    };
    for (const id of SWAP_IDS) {
      const first = byId(id).equivalents[0];
      expect(first.mfr.toLowerCase()).toContain(expected[id]);
      expect(first.extraSavingsYr).toBeGreaterThan(0);
      expect(first.inRoundId).toBe("cardio-generics");
    }
    expect(byId("metformin-500").equivalents.every((e) => e.extraSavingsYr === undefined)).toBe(true);
  });

  it("adds the approved swap extras to that drug's savings exactly", () => {
    const base = byId("atorvastatin-20").savings;
    const withSwap = getDrugViews({ approvedSwapDrugIds: ["atorvastatin-20"] }).find(
      (v) => v.id === "atorvastatin-20",
    )?.savings;
    expect(base && withSwap).toBeTruthy();
    expect((withSwap?.low as number) - (base?.low as number)).toBeCloseTo(11640, 6);
    expect((withSwap?.high as number) - (base?.high as number)).toBeCloseTo(11640, 6);
  });
});

describe("getSummaryInputs", () => {
  it("returns finite figures with dollars and percent", () => {
    const { figures, steps, series } = getSummaryInputs([]);
    expect(figures.totalSpend).toBeGreaterThan(4_050_000);
    expect(figures.totalSpend).toBeLessThan(4_100_000);
    const all = [
      figures.total,
      figures.breakdown.generics.savings,
      figures.breakdown.brand.savings,
      figures.breakdown.otc.savings,
      steps.compare,
      steps.swap,
      steps.join,
    ];
    for (const f of all) {
      expect(f).not.toBeNull();
      for (const n of [f?.low, f?.high, f?.pctLow, f?.pctHigh]) {
        expect(typeof n).toBe("number");
        expect(Number.isFinite(n)).toBe(true);
      }
    }
    expect(series).not.toBeNull();
    expect(series?.points).toHaveLength(24);
    for (const p of series?.points ?? []) expect(Number.isFinite(p.projectedWithout)).toBe(true);
  });

  it("raises the generics savings by exactly the approved extras", () => {
    const none = getSummaryInputs([]);
    const all = getSummaryInputs(SWAP_IDS);
    const extras = 11640 + 6720 + 7860;
    expect(all.approvedExtras).toBe(extras);
    const g0 = none.figures.breakdown.generics.savings;
    const g1 = all.figures.breakdown.generics.savings;
    expect((g1?.low as number) - (g0?.low as number)).toBeCloseTo(extras, 6);
    expect((g1?.high as number) - (g0?.high as number)).toBeCloseTo(extras, 6);
    expect(all.steps.swap.low).toBeCloseTo(extras, 6);
    expect(none.steps.swap.low).toBe(0);
  });
});

describe("rounds, quotes, feeds, swaps", () => {
  it("computes round progress and display status", () => {
    const rounds = getRounds();
    const cardio = rounds.find((r) => r.id === "cardio-generics");
    expect(cardio?.progress).toBeCloseTo((5_650_000 / 6_000_000) * 100, 6);
    expect(cardio?.displayStatus).toBe("Open");
    expect(rounds.find((r) => r.id === "antibiotics-respiratory")?.progress).toBe(108);
    expect(cardio?.anchors.demoNow).toBe("2026-10-24T12:00:00-04:00");
    expect(cardio?.anchors.deadline).toBe("2026-10-26T18:00:00-04:00");
  });

  it("scores the quotes with the default weights, supplier B first", () => {
    const q = getQuotes();
    expect(q.scores.map((s) => s.supplier)).toHaveLength(3);
    expect(q.scores[0].supplier).toBe("B");
    expect(q.defaultWeights).toEqual({ price: 50, delivery: 20, reliability: 30 });
  });

  it("reports the three feeds", () => {
    const feeds = getFeedStatus();
    expect(feeds.map((f) => f.feed)).toEqual(["nadac", "orangebook", "shortages"]);
    for (const f of feeds) expect(["live", "cached"]).toContain(f.status);
    const missing = getFeedStatus({ cacheDir: "/nonexistent/cache" });
    expect(missing.every((f) => f.status === "cached" && f.fetchedAt === null)).toBe(true);
  });

  it("returns the three Cardio swap options", () => {
    const swaps = getSwapOptions();
    expect(swaps.map((s) => s.drugId)).toEqual(SWAP_IDS);
    expect(swaps.map((s) => s.extraSavingsYr)).toEqual([11640, 6720, 7860]);
    expect(swaps.every((s) => s.roundId === "cardio-generics" && s.teCode === "AB")).toBe(true);
  });
});

describe("getAskContext", () => {
  it("validates against askInputSchema", () => {
    const parsed = askInputSchema.safeParse({ question: "Which drugs are in shortage?", context: getAskContext() });
    if (!parsed.success) console.error(JSON.stringify(parsed.error.issues, null, 2));
    expect(parsed.success).toBe(true);
  });
});

describe("JSON round trip", () => {
  it("every getter returns plain JSON", () => {
    const results = [
      getDrugViews({ approvedSwapDrugIds: SWAP_IDS }),
      getRounds(),
      getQuotes(),
      getFeedStatus(),
      getSwapOptions(),
      getSummaryInputs(SWAP_IDS),
      getAskContext(),
    ];
    for (const r of results) expect(roundTrip(r)).toStrictEqual(r);
  });
});

describe("AppState pure helpers", () => {
  it("selects approved ids and the extras total", () => {
    const store = createMemoryStore();
    store.approveSwap({ drugId: "a", toMfr: "X", approved: true, extraSavingsYr: 100, decidedAt: "t" });
    store.approveSwap({ drugId: "b", toMfr: "Y", approved: true, extraSavingsYr: 50, decidedAt: "t" });
    const s = store.getState();
    expect(selectApprovedSwapDrugIds(s)).toEqual(["a", "b"]);
    expect(selectTotalApprovedExtras(s)).toBe(150);
  });

  it("state source starts at the default state, loads on refresh and keeps a stable snapshot", () => {
    const store = createMemoryStore();
    store.approveSwap({ drugId: "a", toMfr: "X", approved: true, extraSavingsYr: 10, decidedAt: "t" });
    const src = createStateSource(store);
    expect(src.getSnapshot()).toBe(src.getServerSnapshot());
    let calls = 0;
    src.subscribe(() => calls++);
    src.refresh();
    expect(Object.keys(src.getSnapshot().swaps)).toEqual(["a"]);
    expect(src.getSnapshot()).toBe(src.getSnapshot());
    expect(calls).toBe(1);
    src.refresh();
    expect(calls).toBe(1);
    store.revokeSwap("a");
    expect(calls).toBe(2);
    expect(src.getSnapshot().swaps).toEqual({});
  });
});
