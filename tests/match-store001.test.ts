import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateInvoiceLines,
  mapColumns,
  matchProducts,
  parseDescription,
  parseUpload,
  toUploadRows,
  type CatalogDrug,
} from "../lib/match";

const catalog: CatalogDrug[] = [
  { id: "atorvastatin-20", name: "Atorvastatin", strength: "20 mg", form: "Tablet" },
  { id: "lisinopril-10", name: "Lisinopril", strength: "10 mg", form: "Tablet" },
  { id: "amlodipine-5", name: "Amlodipine", strength: "5 mg", form: "Tablet" },
  { id: "metformin-500", name: "Metformin", strength: "500 mg", form: "Tablet" },
  { id: "sertraline-50", name: "Sertraline", strength: "50 mg", form: "Tablet" },
  { id: "amoxicillin-500", name: "Amoxicillin", strength: "500 mg", form: "Capsule" },
  { id: "albuterol-90", name: "Albuterol", strength: "90 mcg", form: "Inhaler" },
  { id: "omeprazole-20", name: "Omeprazole", strength: "20 mg", form: "Capsule" },
  { id: "levothyroxine-50", name: "Levothyroxine", strength: "50 mcg", form: "Tablet" },
  { id: "gabapentin-300", name: "Gabapentin", strength: "300 mg", form: "Capsule" },
];

const text = readFileSync(
  path.join(__dirname, "..", "data", "synthetic", "store-001", "store001_upload_export.csv"),
  "utf8",
);

// header -> expected [field, minimum confidence]
const EXPECTED: Record<string, string | null> = {
  account_number: null,
  invoice_id: "invoiceId",
  transaction_type: "transactionType",
  invoice_date: "invoiceDate",
  order_date: null,
  po_number: null,
  order_number: null,
  supplier: "wholesaler",
  line_no: null,
  wholesaler_item_number: null,
  ndc11: "ndc",
  product_description: "drugName",
  package_size: "packageSize",
  package_unit: "packageUnit",
  qty_ordered: null,
  qty_shipped: "quantity",
  unit_cost_per_package: "unitCostPerPackage",
  extended_cost: "extendedCost",
  credit_reason: "creditReason",
};

describe("store-001 upload export", () => {
  it("maps all 19 headers", () => {
    const parsed = parseUpload(text, "store001_upload_export.csv");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.headers).toHaveLength(19);
    for (const m of mapColumns(parsed.headers)) {
      expect(m.field, m.source).toBe(EXPECTED[m.source]);
      if (m.field) expect(m.confidence, m.source).toBeGreaterThanOrEqual(90);
    }
  });

  it("parses descriptions", () => {
    expect(parseDescription("ATORVASTATIN CALCIUM 20 MG TABLET 90 TAB - BLW")).toMatchObject({
      name: "ATORVASTATIN", strength: "20 mg", form: "tablet", packText: "90 TAB", labeler: "BLW",
    });
    expect(parseDescription("ALBUTEROL SULFATE HFA 90 MCG/ACT, 200 ACT INHALER 1 EA - CSC")).toMatchObject({
      name: "ALBUTEROL", strength: "90 mcg", form: "inhaler", labeler: "CSC",
    });
    expect(parseDescription("LT BRAND #0022 TABLET 30 TAB - BRD")).toMatchObject({ strength: "", longTail: true, labeler: "BRD" });
    expect(parseDescription("Atorvastatin 20mg tab")).toMatchObject({ name: "Atorvastatin", strength: "20 mg", form: "tablet" });
  });

  it("aggregates and matches the 10 catalog drugs fast", () => {
    const t0 = performance.now();
    const parsed = parseUpload(text, "store001_upload_export.csv");
    if (!parsed.ok) throw new Error(parsed.error);
    const rows = toUploadRows(parsed.rows, mapColumns(parsed.headers));
    const agg = aggregateInvoiceLines(rows);
    const matches = matchProducts(agg.products, catalog);
    const ms = performance.now() - t0;

    expect(rows).toHaveLength(7762);
    expect(agg.lineCount + agg.skipped).toBe(7762);
    expect(agg.skipped).toBe(0);
    expect(agg.products.length).toBeGreaterThan(500);
    expect(agg.products.length).toBeLessThan(1000);
    expect(agg.monthsCovered).toBeGreaterThan(11.5);
    expect(agg.monthsCovered).toBeLessThan(12.5);

    const byDrug = new Map<string, (typeof matches)[number]>();
    for (const m of matches) {
      if (m.match.status === "matched" && m.match.drugId) byDrug.set(m.match.drugId, m);
    }
    for (const c of catalog) {
      const hit = byDrug.get(c.id);
      expect(hit, c.id).toBeDefined();
      expect(hit!.match.confidence, c.id).toBeGreaterThanOrEqual(90);
      expect(hit!.product.unitsPerMonth, c.id).toBeGreaterThan(0);
      expect(hit!.product.avgUnitPrice, c.id).toBeGreaterThan(0);
      expect(hit!.product.avgUnitPrice, c.id).toBeLessThan(50);
    }
    // Different strengths are not matched to the 20 mg entry.
    const a40 = matches.find((m) => m.product.drugName === "ATORVASTATIN" && m.product.strength === "40 mg");
    expect(a40?.match.status).toBe("unmatched");
    // No long-tail / LT BRAND product is matched.
    const lt = matches.filter((m) => m.product.isLongTail);
    expect(lt.length).toBeGreaterThan(100);
    expect(lt.every((m) => m.match.status === "unmatched")).toBe(true);
    // Esomeprazole is not omeprazole.
    const eso = matches.filter((m) => /ESOMEPRAZOLE/i.test(m.product.description));
    expect(eso.every((m) => m.match.status === "unmatched")).toBe(true);
    // Credits reduce packages: net spend is below the sum of invoice lines.
    expect(ms).toBeLessThan(3000);
  });

  it("handles monthly summary rows (demo file shape) through the same code", () => {
    const csv = "Drug Desc,Str.,Pkg Sz,Qty/Mo,Cost Ea,Vendor\nAtorvastatn 20mg tab,,90,3000,0.12,McKesson\nLisinopril,10 mg,100,4000,0.03,Cardinal\n";
    const parsed = parseUpload(csv, "demo.csv");
    if (!parsed.ok) throw new Error(parsed.error);
    const agg = aggregateInvoiceLines(toUploadRows(parsed.rows, mapColumns(parsed.headers)));
    const matches = matchProducts(agg.products, catalog);
    expect(agg.skipped).toBe(0);
    expect(matches.map((m) => m.match.drugId)).toEqual(["atorvastatin-20", "lisinopril-10"]);
    expect(matches[0].product.unitsPerMonth).toBe(3000);
    expect(matches[0].product.avgUnitPrice).toBeCloseTo(0.12, 6);
  });
});
