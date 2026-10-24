import { describe, expect, it } from "vitest";
import { annualSpend, daysOfSupply, scoreSuppliers } from "../lib/calc";
import {
  SampleError,
  loadDrugs,
  loadQuotes,
  loadRounds,
  loadSample,
  loadUploadDemo,
  parseDrugs,
  parseQuotes,
  parseRounds,
  parseUploadDemo,
} from "../lib/sample";

describe("sample files load and validate", () => {
  it("loads all four files", () => {
    const s = loadSample();
    expect(s.drugs).toHaveLength(10);
    expect(s.rounds.length).toBeGreaterThanOrEqual(5);
    expect(s.quotes.quotes).toHaveLength(3);
    expect(s.upload.items.length).toBeGreaterThan(0);
    expect(s.swapExtras).toHaveLength(3);
    expect(s.demoNow).toBe("2026-10-24T12:00:00-04:00");
  });

  it("labels every file with kind sample", () => {
    expect(loadDrugs().kind).toBe("sample");
    expect(loadRounds().kind).toBe("sample");
    expect(loadQuotes().kind).toBe("sample");
    expect(loadUploadDemo().kind).toBe("sample");
  });
});

describe("drugs", () => {
  const drugs = loadDrugs().items;
  const byId = (id: string) => drugs.find((d) => d.id === id)!;

  it("flags only amoxicillin-500 and albuterol-90 as shortage", () => {
    const flagged = drugs.filter((d) => d.hasShortage).map((d) => d.id).sort();
    expect(flagged).toEqual(["albuterol-90", "amoxicillin-500"]);
    expect(byId("amoxicillin-500").hasShortage).toBe(true);
    expect(byId("albuterol-90").hasShortage).toBe(true);
    for (const d of drugs.filter((x) => x.id !== "amoxicillin-500" && x.id !== "albuterol-90")) {
      expect(d.hasShortage).toBe(false);
    }
  });

  it("gives amoxicillin 9 days of supply and sertraline 12", () => {
    const a = byId("amoxicillin-500");
    const s = byId("sertraline-50");
    expect(Math.round(a.onHand! / (a.unitsPerMonth / 30))).toBe(9);
    expect(Math.round(s.onHand! / (s.unitsPerMonth / 30))).toBe(12);
    expect(daysOfSupply(a.onHand, a.unitsPerMonth)).toBe(9);
    expect(daysOfSupply(s.onHand, s.unitsPerMonth)).toBe(12);
  });

  it("scaled annual spend of the 10 drugs is about $920k", () => {
    // The design says "≈ $920k/yr". The design's own table values give $899,848.80
    // (2.2% below 920k), so the tolerance is 3%, not 2%.
    const total = drugs.reduce((sum, d) => sum + annualSpend(d.paid, d.unitsPerMonth)!, 0);
    expect(total).toBeCloseTo(899_848.8, 1);
    expect(Math.abs(total - 920_000) / 920_000).toBeLessThanOrEqual(0.03);
  });
});

describe("rounds", () => {
  it("has the Cardio round totals from the design", () => {
    const cardio = loadRounds().items.find((r) => r.id === "cardio-generics")!;
    expect(cardio.status).toBe("open");
    expect(cardio.targetUnits).toBe(6_000_000);
    expect(cardio.committedUnits).toBe(5_650_000);
  });
});

describe("quotes", () => {
  const q = loadQuotes();

  it("has the group demand and your share from the design", () => {
    expect(q.groupDemand).toEqual({
      "metformin-500": 2_520_000,
      "levothyroxine-50": 1_116_000,
      glipizide: 588_000,
    });
    expect(q.yourShare).toEqual({
      "metformin-500": 255_600,
      "levothyroxine-50": 111_600,
      glipizide: 0,
    });
  });

  it("scaled values are exactly 6 times the unscaled block", () => {
    for (const id of Object.keys(q.unscaled.groupDemand)) {
      expect(q.groupDemand[id]).toBe(q.unscaled.groupDemand[id] * 6);
    }
    for (const id of Object.keys(q.unscaled.yourShare)) {
      expect(q.yourShare[id]).toBe(q.unscaled.yourShare[id] * 6);
    }
    expect(Object.keys(q.groupDemand).sort()).toEqual(Object.keys(q.unscaled.groupDemand).sort());
    expect(Object.keys(q.yourShare).sort()).toEqual(Object.keys(q.unscaled.yourShare).sort());
  });

  it("supplier B wins with the default weights", () => {
    const scores = scoreSuppliers(q.quotes, q.groupDemand, q.defaultWeights);
    expect(scores[0].supplier).toBe("B");
  });
});

describe("validation failures", () => {
  it("rejects a drugs file with no kind and names the file and field", () => {
    const { kind: _kind, ...bad } = loadDrugs();
    void _kind;
    expect(() => parseDrugs(bad)).toThrow(SampleError);
    expect(() => parseDrugs(bad)).toThrow(/drugs\.json/);
    expect(() => parseDrugs(bad)).toThrow(/kind/);
  });

  it("names the file and nested field path for each file", () => {
    const rounds = structuredClone(loadRounds()) as unknown as { items: { status: string }[] };
    rounds.items[1].status = "bogus";
    try {
      parseRounds(rounds);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SampleError);
      expect((e as SampleError).file).toBe("rounds.json");
      expect((e as SampleError).message).toContain("items[1].status");
    }

    const quotes = structuredClone(loadQuotes()) as unknown as { kind: string };
    quotes.kind = "live";
    expect(() => parseQuotes(quotes)).toThrow(/quotes\.json.*kind/);

    expect(() => parseUploadDemo({ kind: "sample" })).toThrow(/upload-demo\.json/);
  });

  it("rejects unknown fields (typo catching)", () => {
    const drugs = structuredClone(loadDrugs()) as unknown as Record<string, unknown>;
    drugs.surprise = 1;
    expect(() => parseDrugs(drugs)).toThrow(/drugs\.json.*surprise/);
  });
});
