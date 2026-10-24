import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEED_NAMES, FEED_SCHEMAS, TRACKED_DRUGS } from "../lib/feed-types";
import { readFeed } from "../lib/feeds";
import { GET } from "../app/api/feeds/[feed]/route";

const cacheDir = path.join(process.cwd(), "data", "cache");
const allDrugKeys = TRACKED_DRUGS.map((d) => d.drugKey);

describe("cache files", () => {
  for (const feed of FEED_NAMES) {
    it(`${feed}.json parses with the right shape`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(cacheDir, `${feed}.json`), "utf8"));
      expect(FEED_SCHEMAS[feed].safeParse(raw).success).toBe(true);
    });

    it(`${feed}.json stays small (under 1 MB)`, () => {
      expect(fs.statSync(path.join(cacheDir, `${feed}.json`)).size).toBeLessThan(1_000_000);
    });

    it(`${feed}.json only uses tracked drug keys`, () => {
      const { data } = readFeed(feed);
      const keys = new Set<string>();
      if (data.feed === "nadac") data.items.forEach((i) => keys.add(i.drugKey));
      if (data.feed === "orangebook") data.products.forEach((p) => keys.add(p.drugKey));
      if (data.feed === "shortages") data.items.forEach((s) => keys.add(s.drugKey));
      Array.from(keys).forEach((key) => expect(allDrugKeys).toContain(key));
    });
  }
});

describe("NADAC", () => {
  const { data } = readFeed("nadac");

  it("has items, and every NDC is exactly 11 digits", () => {
    expect(data.items.length).toBeGreaterThan(0);
    for (const item of data.items) expect(item.ndc).toMatch(/^\d{11}$/);
  });

  it("has a representative price for all 11 drugs (10 tracked + glipizide)", () => {
    expect(allDrugKeys).toHaveLength(11);
    for (const key of allDrugKeys) {
      expect(data.byDrug[key], `missing byDrug entry for ${key}`).toBeDefined();
      expect(data.byDrug[key].nadac).toBeGreaterThan(0);
      expect(data.byDrug[key].ndcCount).toBeGreaterThan(0);
    }
  });

  it("byDrug count matches the generic NDCs in items", () => {
    for (const key of allDrugKeys) {
      const generic = data.items.filter((i) => i.drugKey === key && i.classification === "G");
      expect(data.byDrug[key].ndcCount).toBe(generic.length);
    }
  });
});

describe("Orange Book", () => {
  const { data } = readFeed("orangebook");

  it("lists equivalents with an A TE code for every tracked drug", () => {
    for (const key of allDrugKeys) {
      expect(data.equivalents.some((e) => e.drugKey === key), `no equivalents for ${key}`).toBe(true);
    }
    for (const e of data.equivalents) expect(e.teCode.startsWith("A")).toBe(true);
  });

  it("lists each manufacturer once per drug", () => {
    for (const key of allDrugKeys) {
      const names = data.equivalents.filter((e) => e.drugKey === key).map((e) => e.mfr);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("Shortages", () => {
  const { data } = readFeed("shortages");

  it("has a history entry for every tracked drug", () => {
    for (const key of allDrugKeys) expect(data.history[key]).toBeDefined();
  });

  it("history counts match the items", () => {
    for (const key of allDrugKeys) {
      const mine = data.items.filter((s) => s.drugKey === key);
      expect(data.history[key].currentCount).toBe(mine.filter((s) => s.status === "current").length);
      expect(data.history[key].last3yCount).toBeLessThanOrEqual(mine.length);
    }
  });
});

describe("readFeed", () => {
  it("returns the feed status taken from the file", () => {
    const { data, feedStatus } = readFeed("nadac");
    expect(feedStatus).toEqual({
      feed: "nadac",
      cadence: "weekly",
      fetchedAt: data.fetchedAt,
      effectiveDate: data.effectiveDate,
      status: data.status,
    });
  });
});

describe("GET /api/feeds/[feed]", () => {
  it("returns the cache for a known feed", async () => {
    const response = GET(new Request("http://localhost/api/feeds/nadac"), { params: { feed: "nadac" } });
    expect(response.status).toBe(200);
    expect((await response.json()).feed).toBe("nadac");
  });

  it("returns 404 for an unknown feed", () => {
    const response = GET(new Request("http://localhost/api/feeds/nope"), { params: { feed: "nope" } });
    expect(response.status).toBe(404);
  });
});
