import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import {
  MAX_DATA_ROWS,
  MAX_FILE_BYTES,
  mapColumns,
  matchDrugs,
  parseUpload,
  toUploadRows,
  type CatalogDrug,
} from "../lib/match";
import type { UploadRow } from "../lib/types";

// A small catalog built here, so the test does not read the sample data files.
const catalog: CatalogDrug[] = [
  { id: "atorvastatin-20", name: "Atorvastatin", strength: "20 mg", form: "Tablet", ndc: "00071-0155-23" },
  { id: "lisinopril-10", name: "Lisinopril", strength: "10 mg", form: "Tablet", ndc: "68180-0513-01" },
  { id: "amlodipine-5", name: "Amlodipine", strength: "5 mg", form: "Tablet", ndc: "00069-1530-66" },
  { id: "metformin-500", name: "Metformin", strength: "500 mg", form: "Tablet", ndc: "00093-1048-01" },
  { id: "sertraline-50", name: "Sertraline", strength: "50 mg", form: "Tablet", ndc: "00049-4960-66" },
  { id: "amoxicillin-500", name: "Amoxicillin", strength: "500 mg", form: "Capsule", ndc: "65862-0017-01" },
  { id: "albuterol-90", name: "Albuterol", strength: "90 mcg", form: "Inhaler", ndc: "00173-0682-20" },
  { id: "omeprazole-20", name: "Omeprazole", strength: "20 mg", form: "Capsule", ndc: "00186-5020-31" },
  { id: "levothyroxine-50", name: "Levothyroxine", strength: "50 mcg", form: "Tablet", ndc: "00074-6624-90" },
  { id: "gabapentin-300", name: "Gabapentin", strength: "300 mg", form: "Capsule", ndc: "00071-0805-24" },
];

const demoHeaders = ["Drug Desc", "Str.", "NDC#", "Pkg Sz", "Qty/Mo", "Cost Ea", "Vendor", "Notes"];

const row = (rowIndex: number, drugName: string, extra: Partial<UploadRow> = {}): UploadRow => ({
  rowIndex,
  drugName,
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. mapColumns
// ---------------------------------------------------------------------------

describe("mapColumns with the demo headers", () => {
  const mappings = mapColumns(demoHeaders);

  it("maps each header to the expected field", () => {
    expect(mappings.map((m) => m.source)).toEqual(demoHeaders);
    expect(mappings.map((m) => m.field)).toEqual([
      "drugName",
      "strength",
      "ndc",
      "packageSize",
      "unitsPerMonth",
      "pricePaid",
      "wholesaler",
      null,
    ]);
  });

  it("labels the first seven High and Notes Low with no field", () => {
    for (const m of mappings.slice(0, 7)) {
      expect(m.label).toBe("High");
      expect(m.confidence).toBeGreaterThanOrEqual(90);
    }
    const notes = mappings[7];
    expect(notes.field).toBeNull();
    expect(notes.label).toBe("Low");
  });

  it("never lets two columns claim the same field", () => {
    const claimed = mappings.map((m) => m.field).filter((f) => f !== null);
    expect(new Set(claimed).size).toBe(claimed.length);

    const clash = mapColumns(["Drug Name", "Drug Desc", "Item"]);
    const fields = clash.map((m) => m.field).filter((f) => f !== null);
    expect(new Set(fields).size).toBe(fields.length);
    // "Drug Name" is the exact field name, so it keeps drugName.
    expect(clash[0].field).toBe("drugName");
  });
});

// ---------------------------------------------------------------------------
// 2. matchDrugs on the demo names
// ---------------------------------------------------------------------------

describe("matchDrugs on the demo names", () => {
  const demoNames = [
    "Atorvastatn 20mg tab",
    "Lisinipril 10 MG",
    "Levoxyl 50mcg",
    "Gaba 300",
    "Vit D3 2000IU",
  ];
  const results = matchDrugs(
    demoNames.map((n, i) => row(i, n)),
    catalog,
  );

  it("matches the two misspelled names", () => {
    expect(results[0].status).toBe("matched");
    expect(results[0].drugId).toBe("atorvastatin-20");
    expect(results[1].status).toBe("matched");
    expect(results[1].drugId).toBe("lisinopril-10");
  });

  it("sends the brand name and the short name to review, with the right first suggestion", () => {
    expect(results[2].status).toBe("needs-review");
    expect(results[2].suggestions[0].drugId).toBe("levothyroxine-50");
    expect(results[3].status).toBe("needs-review");
    expect(results[3].suggestions[0].drugId).toBe("gabapentin-300");
  });

  it("leaves the vitamin unmatched", () => {
    expect(results[4].status).toBe("unmatched");
    expect(results[4].drugId).toBeUndefined();
  });

  it("keeps rowIndex and original text", () => {
    results.forEach((r, i) => {
      expect(r.rowIndex).toBe(i);
      expect(r.original).toBe(demoNames[i]);
    });
  });

  it("keeps confidence in 0..100 and consistent with the status", () => {
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
      if (r.status === "matched") expect(r.confidence).toBeGreaterThanOrEqual(90);
      if (r.status === "unmatched") expect(r.confidence).toBeLessThan(80);
    }
    // Needs-review: 80 to 89 (the brand name stays in review even if it scored higher).
    expect(results[3].confidence).toBeGreaterThanOrEqual(80);
    expect(results[3].confidence).toBeLessThanOrEqual(89);
    expect(results[2].confidence).toBeLessThanOrEqual(89);
  });

  it("returns at most 3 suggestions, best first", () => {
    for (const r of results) {
      expect(r.suggestions.length).toBeLessThanOrEqual(3);
      for (let i = 1; i < r.suggestions.length; i++) {
        expect(r.suggestions[i - 1].confidence).toBeGreaterThanOrEqual(r.suggestions[i].confidence);
      }
      for (const s of r.suggestions) {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Known NDC
// ---------------------------------------------------------------------------

describe("matchDrugs with a known NDC", () => {
  it("matches at confidence 100 with dashes and without", () => {
    const [dashed, plain] = matchDrugs(
      [row(0, "something unrelated", { ndc: "00071-0155-23" }), row(1, "", { ndc: "00071015523" })],
      catalog,
    );
    for (const r of [dashed, plain]) {
      expect(r.status).toBe("matched");
      expect(r.confidence).toBe(100);
      expect(r.drugId).toBe("atorvastatin-20");
    }
  });

  it("falls back to the name when the NDC is not in the catalog", () => {
    const [r] = matchDrugs([row(0, "Lisinopril 10 mg", { ndc: "99999-9999-99" })], catalog);
    expect(r.drugId).toBe("lisinopril-10");
  });

  /**
   * Feature: poolrx-backend, Property 5: Known NDC match
   * **Validates: Requirements 4.6**
   */
  it("Property 5: a row carrying a catalog NDC is matched at 100 for any drug name text", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: catalog.length - 1 }),
        fc.string({ maxLength: 60 }),
        fc.boolean(),
        (index, name, dashed) => {
          const drug = catalog[index];
          const ndc = dashed ? drug.ndc! : drug.ndc!.replace(/-/g, "");
          const [r] = matchDrugs([row(0, name, { ndc })], catalog);
          expect(r.status).toBe("matched");
          expect(r.confidence).toBe(100);
          expect(r.drugId).toBe(drug.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 4. parseUpload
// ---------------------------------------------------------------------------

describe("parseUpload", () => {
  const header = demoHeaders.join(",");
  const csv = [
    header,
    "Atorvastatn 20mg tab,20 mg,00071-0155-23,100,120,$0.09,McKesson,fast mover",
    'Lisinipril 10 MG,10 mg,,100,"1,234",$0.05,Cardinal,"note, with comma"',
  ].join("\n");

  it("parses a valid CSV into headers and keyed rows", () => {
    const r = parseUpload(csv, "inventory.csv");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headers).toEqual(demoHeaders);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]["Drug Desc"]).toBe("Atorvastatn 20mg tab");
    expect(r.rows[1]["Qty/Mo"]).toBe("1,234");
    expect(r.rows[1]["Notes"]).toBe("note, with comma");
  });

  it("strips a BOM at the start", () => {
    const r = parseUpload("\uFEFF" + csv, "bom.csv");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headers[0]).toBe("Drug Desc");
  });

  it("rejects an empty string and names the file", () => {
    const r = parseUpload("", "empty.csv");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("empty.csv");
  });

  it("rejects a header-only file and names the file", () => {
    const r = parseUpload(header + "\n", "headers.csv");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("headers.csv");
  });

  it("rejects an unclosed quote and names the file", () => {
    const r = parseUpload(`${header}\n"Atorvastatin 20mg,20 mg,,,,,,`, "broken.csv");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("broken.csv");
  });

  it("rejects more than 10,000 data rows and states the limit", () => {
    const lines = [header];
    for (let i = 0; i < MAX_DATA_ROWS + 1; i++) lines.push(`Drug ${i},10 mg,,,,,,`);
    const r = parseUpload(lines.join("\n"), "big-rows.csv");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("big-rows.csv");
    expect(r.error).toContain("10,000");
  });

  it("accepts exactly 10,000 data rows", () => {
    const lines = [header];
    for (let i = 0; i < MAX_DATA_ROWS; i++) lines.push(`Drug ${i},10 mg,,,,,,`);
    const r = parseUpload(lines.join("\n"), "edge.csv");
    expect(r.ok).toBe(true);
  });

  it("rejects text over 10 MB and states the limit", () => {
    const r = parseUpload("a".repeat(MAX_FILE_BYTES + 1), "big-file.csv");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("big-file.csv");
    expect(r.error).toContain("10 MB");
  });
});

// ---------------------------------------------------------------------------
// 5. End to end
// ---------------------------------------------------------------------------

describe("parseUpload -> mapColumns -> toUploadRows -> matchDrugs", () => {
  const csv = [
    demoHeaders.join(","),
    "Atorvastatn 20mg tab,20 mg,,100,120,$0.0925,McKesson,",
    'Lisinipril 10 MG,,,100,"1,234",$0.05,Cardinal,',
    "Levoxyl 50mcg,,,90,60,$0.31,McKesson,",
    "Gaba 300,,,100,200,0.12,Cardinal,",
    "Vit D3 2000IU,,,100,\"2,500\",\"$1,000.50\",HD Smith,check",
  ].join("\n");

  it("parses numbers and matches every row", () => {
    const parsed = parseUpload(csv, "inventory.csv");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const mappings = mapColumns(parsed.headers);
    const rows = toUploadRows(parsed.rows, mappings);
    expect(rows).toHaveLength(5);

    expect(rows[0]).toMatchObject({
      rowIndex: 0,
      drugName: "Atorvastatn 20mg tab",
      strength: "20 mg",
      packageSize: "100",
      unitsPerMonth: 120,
      pricePaid: 0.0925,
      wholesaler: "McKesson",
    });
    expect(rows[1].unitsPerMonth).toBe(1234);
    expect(rows[1].pricePaid).toBe(0.05);
    expect(rows[1].strength).toBeUndefined();
    expect(rows[3].pricePaid).toBe(0.12);
    expect(rows[4].unitsPerMonth).toBe(2500);
    expect(rows[4].pricePaid).toBe(1000.5);

    const matches = matchDrugs(rows, catalog);
    expect(matches.map((m) => m.status)).toEqual([
      "matched",
      "matched",
      "needs-review",
      "needs-review",
      "unmatched",
    ]);
    expect(matches.map((m) => m.drugId)).toEqual([
      "atorvastatin-20",
      "lisinopril-10",
      "levothyroxine-50",
      "gabapentin-300",
      undefined,
    ]);
  });

  it("skips rows with neither a drug name nor an NDC", () => {
    const rows = toUploadRows(
      [{ "Drug Desc": "", "NDC#": "" }, { "Drug Desc": "Gaba 300", "NDC#": "" }],
      mapColumns(["Drug Desc", "NDC#"]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rowIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. No network
// ---------------------------------------------------------------------------

describe("offline matching", () => {
  it("runs the whole pipeline with fetch stubbed to throw", () => {
    const fetchStub = vi.fn(() => {
      throw new Error("network is not allowed in the matcher");
    });
    vi.stubGlobal("fetch", fetchStub);

    const parsed = parseUpload(
      `${demoHeaders.join(",")}\nAtorvastatn 20mg tab,20 mg,,100,120,$0.09,McKesson,\n`,
      "offline.csv",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rows = toUploadRows(parsed.rows, mapColumns(parsed.headers));
    const matches = matchDrugs(rows, catalog);

    expect(matches[0].status).toBe("matched");
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
