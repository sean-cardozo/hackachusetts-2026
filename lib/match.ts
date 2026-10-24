// Upload matcher for PharmaPool.
//
// Three steps, all rule-based and offline (this file never calls the network):
//   1. parseUpload   - read a CSV with Papaparse, enforce size limits.
//   2. mapColumns    - map each header to a standard field with a confidence.
//   3. matchDrugs    - match each drug row to a catalog drug, with a status and
//                      up to 3 suggestions.
// toUploadRows glues steps 1 and 2 to step 3.
//
// The catalog is passed in as a plain argument, so this module does not read
// any data files.

import Papa from "papaparse";
import type {
  ColumnMapping,
  ConfidenceLabel,
  Drug,
  DrugMatch,
  MatchStatus,
  StandardField,
  UploadRow,
} from "./types";

// ---------------------------------------------------------------------------
// Public types and limits
// ---------------------------------------------------------------------------

/** The part of a Drug the matcher needs. */
export type CatalogDrug = Pick<Drug, "id" | "name" | "strength" | "form" | "ndc">;

/** One uploaded data row, keyed by header text. */
export type RawRow = Record<string, string>;

export type UploadParseResult =
  | { ok: true; headers: string[]; rows: RawRow[] }
  | { ok: false; error: string };

export const MAX_DATA_ROWS = 10_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

/** Confidence Label: High >= 90, Medium 80 to 89, Low < 80. */
function labelFor(confidence: number): ConfidenceLabel {
  if (confidence >= 90) return "High";
  if (confidence >= 80) return "Medium";
  return "Low";
}

/**
 * Edit distance (Levenshtein plus adjacent transpositions), written by hand
 * so the matcher needs no extra package.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(
        rows[i - 1][j] + 1, // deletion
        rows[i][j - 1] + 1, // insertion
        rows[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2][j - 2] + 1); // transposition
      }
      rows[i][j] = d;
    }
  }
  return rows[a.length][b.length];
}

/** Similarity from 0 to 1 based on edit distance. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

// ---------------------------------------------------------------------------
// 1. parseUpload
// ---------------------------------------------------------------------------

/**
 * Parse CSV text with Papaparse. Returns headers and raw rows, or an error
 * message that names the file and says how to fix it.
 */
export function parseUpload(text: string, filename: string): UploadParseResult {
  const name = `"${filename}"`;

  if (text.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `${name} is larger than the 10 MB limit. Split the file into smaller parts (limit: 10 MB and ${MAX_DATA_ROWS.toLocaleString("en-US")} rows) and upload again.`,
    };
  }

  const clean = text.replace(/^\uFEFF/, ""); // strip a byte-order mark
  if (clean.trim() === "") {
    return {
      ok: false,
      error: `${name} is empty. Export your inventory as a CSV with a header row and at least one data row, then upload it again.`,
    };
  }
  if (clean.includes("\u0000")) {
    return {
      ok: false,
      error: `${name} does not look like a CSV text file. Export it again as "CSV (comma delimited)" and upload it again.`,
    };
  }

  let parsed: Papa.ParseResult<string[]>;
  try {
    parsed = Papa.parse<string[]>(clean, { header: false, skipEmptyLines: "greedy" });
  } catch {
    return {
      ok: false,
      error: `${name} could not be parsed. Open it in a spreadsheet and save it again as "CSV (comma delimited)".`,
    };
  }

  // Quote errors mean the file is damaged. Delimiter and field-count notes are
  // only warnings: short rows are padded below.
  if (parsed.errors.some((e) => e.type === "Quotes")) {
    return {
      ok: false,
      error: `${name} could not be parsed because a quoted value is not closed. Fix the unmatched quote and upload it again.`,
    };
  }

  const table = parsed.data;
  if (table.length === 0) {
    return {
      ok: false,
      error: `${name} has no readable rows. Check that it is a CSV file with a header row, then upload it again.`,
    };
  }

  // Header row: trim, name blank headers, and make duplicates unique.
  const seen = new Map<string, number>();
  const headers = table[0].map((cell, i) => {
    const base = (cell ?? "").trim() || `Column ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });

  const dataRows = table.slice(1);
  if (dataRows.length === 0) {
    return {
      ok: false,
      error: `${name} has a header row but no data rows. Add at least one drug row below the headers and upload it again.`,
    };
  }
  if (dataRows.length > MAX_DATA_ROWS) {
    return {
      ok: false,
      error: `${name} has ${dataRows.length.toLocaleString("en-US")} data rows, which is over the limit of ${MAX_DATA_ROWS.toLocaleString("en-US")} rows. Split the file into smaller parts and upload again.`,
    };
  }

  const rows: RawRow[] = dataRows.map((cells) => {
    const row: RawRow = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });

  return { ok: true, headers, rows };
}

// ---------------------------------------------------------------------------
// 2. mapColumns
// ---------------------------------------------------------------------------

/** Normalize header text: lowercase, drop punctuation and spaces. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Known synonyms per field, already normalized. Three tiers set the
 * confidence of an exact hit:
 *   strong = 95 (clear wording), weak = 85 (short generic words),
 *   guess = 75 (could mean something else, so a person should look).
 * An exact match on the field's own name scores 100.
 */
const SYNONYMS: Record<
  StandardField,
  { canonical: string; strong: string[]; weak: string[]; guess: string[] }
> = {
  drugName: {
    canonical: "drugname",
    strong: ["drugdesc", "drugdescription", "productname", "itemname", "itemdescription", "productdescription", "medicationname", "drugitem"],
    weak: ["drug", "name", "item", "product", "medication", "medicine", "description", "desc", "productdesc", "itemdesc"],
    guess: ["med"],
  },
  strength: {
    canonical: "strength",
    strong: ["str", "strn", "drugstrength", "dosage", "dose", "potency"],
    weak: ["strg", "dosagestrength"],
    guess: [],
  },
  ndc: {
    canonical: "ndc",
    strong: ["ndcnumber", "ndccode", "ndcno", "ndc10", "ndc11", "nationaldrugcode"],
    weak: [],
    guess: [],
  },
  packageSize: {
    canonical: "packagesize",
    strong: ["pkgsize", "pkgsz", "packsize", "packsz", "packagesz", "pkgsizeqty"],
    weak: ["pkg", "package", "pack", "size"],
    guess: [],
  },
  unitsPerMonth: {
    canonical: "unitspermonth",
    strong: ["qtymo", "qtypermonth", "qtymonth", "monthlyqty", "monthlyunits", "monthlyusage", "monthlyquantity", "unitsmonth", "unitsmo", "usagepermonth", "avgmonthlyusage", "quantitypermonth"],
    weak: ["monthlyuse", "usage"],
    guess: ["qty", "quantity", "units"],
  },
  pricePaid: {
    canonical: "pricepaid",
    strong: ["costea", "costeach", "unitcost", "unitprice", "priceea", "priceeach", "costperunit", "priceperunit", "purchaseprice", "acquisitioncost", "paidprice"],
    weak: ["price", "cost", "paid"],
    guess: [],
  },
  wholesaler: {
    canonical: "wholesaler",
    strong: ["vendor", "supplier", "distributor", "purchasedfrom", "vendorname", "suppliername"],
    weak: ["source", "mfr"],
    guess: [],
  },
  onHand: {
    canonical: "onhand",
    strong: ["qoh", "qtyonhand", "quantityonhand", "unitsonhand", "onhandqty", "currentstock", "stockonhand"],
    weak: ["stock", "instock", "inventory"],
    guess: [],
  },
  countDate: {
    canonical: "countdate",
    strong: ["lastcount", "lastcounted", "datecounted", "inventorydate", "countedon", "countdt", "lastcountdate"],
    weak: ["asof", "asofdate"],
    guess: [],
  },
  quantity: {
    canonical: "quantityshipped",
    strong: ["qtyshipped", "shippedqty", "qtyshp", "packagesshipped", "unitsshipped", "qtyreceived", "quantityreceived", "shipqty", "shippedquantity"],
    weak: [],
    guess: [],
  },
  invoiceDate: {
    canonical: "invoicedate",
    strong: ["invdate", "dateinvoiced", "invoicedt", "purchasedate", "dateofinvoice"],
    weak: [],
    guess: [],
  },
  packageUnit: {
    canonical: "packageunit",
    strong: ["pkgunit", "packunit", "packageuom", "pkguom", "uom", "unitofmeasure"],
    weak: [],
    guess: [],
  },
  unitCostPerPackage: {
    canonical: "unitcostperpackage",
    strong: ["costperpackage", "priceperpackage", "unitpriceperpackage", "costperpkg", "unitcostperpkg", "pkgcost", "packagecost", "packageprice", "pkgprice"],
    weak: [],
    guess: [],
  },
  extendedCost: {
    canonical: "extendedcost",
    strong: ["extcost", "extendedprice", "extprice", "extendedamount", "linetotal", "linecost", "lineamount", "totalcost"],
    weak: [],
    guess: [],
  },
  transactionType: {
    canonical: "transactiontype",
    strong: ["transtype", "trxtype", "txntype", "linetype", "documenttype", "doctype", "invoicetype"],
    weak: [],
    guess: [],
  },
  creditReason: {
    canonical: "creditreason",
    strong: ["returnreason", "creditmemoreason", "reasoncode", "creditcode"],
    weak: [],
    guess: [],
  },
  invoiceId: {
    canonical: "invoiceid",
    strong: ["invoicenumber", "invoiceno", "invoicenum", "invno", "invoiceref"],
    weak: ["invoice"],
    guess: [],
  },
  expirationDate: {
    canonical: "expirationdate",
    strong: ["expdate", "expiry", "expirydate", "expiration", "expires", "expirationdt", "expiredate"],
    weak: ["exp"],
    guess: [],
  },
};

const FIELDS = Object.keys(SYNONYMS) as StandardField[];

/**
 * Headers (normalized) that exist in wholesaler exports but carry nothing the
 * matcher uses. They are mapped to "no field" so near-hit spelling rules cannot
 * attach them to a real field (for example "qty_ordered" must not compete with
 * "qty_shipped", and "wholesaler_item_number" is not the wholesaler name).
 */
const IGNORED_HEADERS = new Set([
  "qtyordered", "quantityordered", "orderedqty", "orderdate", "ponumber", "pono",
  "ordernumber", "orderno", "accountnumber", "accountno", "acctnumber", "lineno",
  "linenumber", "wholesaleritemnumber", "wholesaleritemno", "itemnumber",
]);

/** Best field guess for one header, or null when nothing is close. */
function guessField(header: string): { field: StandardField; confidence: number } | null {
  const norm = normalizeHeader(header);
  if (!norm || IGNORED_HEADERS.has(norm)) return null;

  let best: { field: StandardField; confidence: number } | null = null;
  const offer = (field: StandardField, confidence: number) => {
    if (!best || confidence > best.confidence) best = { field, confidence };
  };

  for (const field of FIELDS) {
    const s = SYNONYMS[field];
    // Exact hits.
    if (norm === s.canonical) offer(field, 100);
    else if (s.strong.includes(norm)) offer(field, 95);
    else if (s.weak.includes(norm)) offer(field, 85);
    else if (s.guess.includes(norm)) offer(field, 75);

    // Near hits: a long synonym inside the header, or a close spelling.
    for (const syn of [s.canonical, ...s.strong]) {
      if (syn.length < 5 || syn === norm) continue;
      if (norm.includes(syn)) {
        offer(field, 85);
      } else {
        const sim = similarity(norm, syn);
        if (sim >= 0.8) offer(field, Math.min(89, Math.round(sim * 100)));
      }
    }
  }
  return best;
}

/**
 * Map each header to a standard field with a confidence and a label.
 * A field is used by at most one column: if two headers claim the same field,
 * the one with the higher confidence keeps it and the other is left unmapped.
 */
export function mapColumns(headers: string[]): ColumnMapping[] {
  const guesses = headers.map((h) => guessField(h));

  // Resolve clashes: the first-highest confidence wins each field.
  const winner = new Map<StandardField, number>();
  guesses.forEach((g, i) => {
    if (!g) return;
    const current = winner.get(g.field);
    if (current === undefined || g.confidence > guesses[current]!.confidence) {
      winner.set(g.field, i);
    }
  });

  return headers.map((source, i) => {
    const g = guesses[i];
    if (!g || winner.get(g.field) !== i) {
      return { source, field: null, confidence: 0, label: "Low" as const };
    }
    return { source, field: g.field, confidence: g.confidence, label: labelFor(g.confidence) };
  });
}

// ---------------------------------------------------------------------------
// toUploadRows
// ---------------------------------------------------------------------------

/** Parse a number from text like "$1,234.50". Returns undefined if not a number. */
function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turn raw rows into UploadRows using the column mappings.
 * rowIndex is the 0-based position in rawRows. Rows with neither a drug name
 * nor an NDC are skipped.
 */
export function toUploadRows(rawRows: RawRow[], mappings: ColumnMapping[]): UploadRow[] {
  const sourceFor = new Map<StandardField, string>();
  for (const m of mappings) {
    if (m.field && !sourceFor.has(m.field)) sourceFor.set(m.field, m.source);
  }
  const text = (raw: RawRow, field: StandardField): string | undefined => {
    const source = sourceFor.get(field);
    const v = source === undefined ? undefined : raw[source]?.trim();
    return v ? v : undefined;
  };

  const out: UploadRow[] = [];
  rawRows.forEach((raw, rowIndex) => {
    const drugName = text(raw, "drugName") ?? "";
    const ndc = text(raw, "ndc");
    if (!drugName && !ndc) return;

    const row: UploadRow = { rowIndex, drugName };
    const strength = text(raw, "strength");
    if (strength) row.strength = strength;
    if (ndc) row.ndc = ndc;
    const packageSize = text(raw, "packageSize");
    if (packageSize) row.packageSize = packageSize;
    const unitsPerMonth = toNumber(text(raw, "unitsPerMonth"));
    if (unitsPerMonth !== undefined) row.unitsPerMonth = unitsPerMonth;
    const pricePaid = toNumber(text(raw, "pricePaid"));
    if (pricePaid !== undefined) row.pricePaid = pricePaid;
    const wholesaler = text(raw, "wholesaler");
    if (wholesaler) row.wholesaler = wholesaler;
    const onHand = toNumber(text(raw, "onHand"));
    if (onHand !== undefined) row.onHand = onHand;
    const countDate = text(raw, "countDate");
    if (countDate) row.countDate = countDate;
    const expirationDate = text(raw, "expirationDate");
    if (expirationDate) row.expirationDate = expirationDate;
    const quantity = toNumber(text(raw, "quantity"));
    if (quantity !== undefined) row.quantity = quantity;
    const invoiceDate = text(raw, "invoiceDate");
    if (invoiceDate) row.invoiceDate = invoiceDate;
    const packageUnit = text(raw, "packageUnit");
    if (packageUnit) row.packageUnit = packageUnit;
    const unitCostPerPackage = toNumber(text(raw, "unitCostPerPackage"));
    if (unitCostPerPackage !== undefined) row.unitCostPerPackage = unitCostPerPackage;
    const extendedCost = toNumber(text(raw, "extendedCost"));
    if (extendedCost !== undefined) row.extendedCost = extendedCost;
    const transactionType = text(raw, "transactionType");
    if (transactionType) row.transactionType = transactionType;
    const creditReason = text(raw, "creditReason");
    if (creditReason) row.creditReason = creditReason;
    const invoiceId = text(raw, "invoiceId");
    if (invoiceId) row.invoiceId = invoiceId;
    out.push(row);
  });
  return out;
}

// ---------------------------------------------------------------------------
// 3. matchDrugs
// ---------------------------------------------------------------------------

/** Brand names and the generic ingredient they stand for (lowercase). */
const BRAND_TO_GENERIC: Record<string, string> = {
  lipitor: "atorvastatin",
  zestril: "lisinopril",
  prinivil: "lisinopril",
  norvasc: "amlodipine",
  glucophage: "metformin",
  zoloft: "sertraline",
  synthroid: "levothyroxine",
  levoxyl: "levothyroxine",
  unithroid: "levothyroxine",
  neurontin: "gabapentin",
  prilosec: "omeprazole",
  ventolin: "albuterol",
  proair: "albuterol",
  proventil: "albuterol",
  amoxil: "amoxicillin",
};

/** Words that describe the product but are not the drug name. */
const NOISE_WORDS = new Set([
  "tablet", "capsule", "mg", "mcg", "g", "ml", "iu", "unit", "units",
  "dr", "er", "xr", "sr", "hfa", "inhalation", "inhaler", "aerosol", "oral",
  "solution", "suspension", "cream", "ointment", "hcl", "puff", "puffs",
  "ct", "count", "bottle", "bottles", "of", "the", "and", "with", "delayed", "release",
  "extended", "spray", "powder", "injection",
]);

/** Abbreviations expanded to a standard word. */
const ABBREVIATIONS: Record<string, string> = {
  tab: "tablet",
  tabs: "tablet",
  tablets: "tablet",
  cap: "capsule",
  caps: "capsule",
  capsules: "capsule",
  soln: "solution",
  susp: "suspension",
  milligram: "mg",
  milligrams: "mg",
  mgs: "mg",
  microgram: "mcg",
  micrograms: "mcg",
  mcgs: "mcg",
  ug: "mcg",
  "µg": "mcg",
  gram: "g",
  grams: "g",
};

const MASS_TO_MCG: Record<string, number> = { mcg: 1, mg: 1000, g: 1_000_000 };

/** Break text into lowercase tokens, splitting "20mg" into "20" and "mg". */
function tokenize(text: string): string[] {
  const spaced = text
    .toLowerCase()
    .replace(/(\d)([a-zµ])/g, "$1 $2")
    .replace(/([a-zµ])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9µ.]+/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " "); // keep dots only inside numbers like 0.5
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t);
}

type Strength = { value: number; unit?: string };

/** Pull every number (with its unit when one follows) out of the tokens. */
function extractStrengths(tokens: string[]): Strength[] {
  const found: Strength[] = [];
  tokens.forEach((t, i) => {
    if (!/^\d+(\.\d+)?$/.test(t)) return;
    const next = tokens[i + 1];
    const isUnit = next !== undefined && (next in MASS_TO_MCG || next === "iu" || next === "ml");
    found.push({ value: Number(t), unit: isUnit ? next : undefined });
  });
  return found;
}

/** Do the uploaded strengths contain the catalog strength? */
function strengthAgrees(row: Strength[], catalog: Strength | undefined): boolean {
  if (!catalog) return false;
  return row.some((r) => {
    if (r.unit && catalog.unit) {
      // Compare mass units on one scale (mg vs mcg); other units must be equal.
      const rf = MASS_TO_MCG[r.unit];
      const cf = MASS_TO_MCG[catalog.unit];
      if (rf !== undefined && cf !== undefined) {
        return Math.abs(r.value * rf - catalog.value * cf) < 1e-9;
      }
      return r.unit === catalog.unit && r.value === catalog.value;
    }
    return r.value === catalog.value; // no unit written: compare the number
  });
}

/** Prepared form of a catalog drug, built once per matchDrugs call. */
type PreparedDrug = {
  drug: CatalogDrug;
  nameKey: string; // normalized name, e.g. "atorvastatin"
  nameTokens: string[];
  strength?: Strength;
  display: string; // e.g. "Atorvastatin 20 mg"
  ndc?: string;
  formWords: string[];
};

function normalizeNdc(ndc: string): string {
  return ndc.replace(/[\s-]/g, "");
}

function prepareCatalog(catalog: CatalogDrug[]): PreparedDrug[] {
  return catalog.map((drug) => {
    const nameTokens = tokenize(drug.name).filter((t) => !NOISE_WORDS.has(t) && !/^\d/.test(t));
    return {
      drug,
      nameKey: nameTokens.join(" "),
      nameTokens,
      strength: extractStrengths(tokenize(drug.strength))[0],
      display: [drug.name, drug.strength].filter(Boolean).join(" ").trim(),
      ndc: drug.ndc ? normalizeNdc(drug.ndc) : undefined,
      formWords: tokenize(drug.form),
    };
  });
}

// Tuning values for the score (all in confidence points).
const STRENGTH_BONUS = 8; // uploaded strength matches the catalog strength
const STRENGTH_PENALTY = 15; // uploaded strength is given but does not match
const FORM_BONUS = 2; // "tab"/"cap" agrees with the catalog form
const FORM_PENALTY = 10; // "tab" vs a capsule, and so on
const BRAND_BASE = 80; // a known brand of a catalog generic
const PREFIX_BASE = 72; // "Gaba" for gabapentin (grows with the prefix length)
const PREFIX_SPAN = 18;
const REVIEW_CAP = 89; // brand and shortened names always need a person's look
const MAX_NAME_CONFIDENCE = 99; // 100 is reserved for an NDC hit
const SUGGESTION_FLOOR = 40; // suggestions must be above this

type Scored = { prepared: PreparedDrug; confidence: number; viaBrand: boolean };

/** Score one uploaded text against one catalog drug. */
function scoreAgainst(
  nameTokens: string[],
  rowStrengths: Strength[],
  rowForms: string[],
  brandGenerics: string[],
  p: PreparedDrug,
): Scored {
  const rowName = nameTokens.join(" ");

  // 1. Spelling similarity: whole text, or any single word of it.
  let fuzzy = 0;
  if (rowName && p.nameKey) fuzzy = similarity(rowName, p.nameKey);
  for (const t of nameTokens) {
    if (t.length >= 4 && p.nameKey) fuzzy = Math.max(fuzzy, similarity(t, p.nameKey));
  }
  const fuzzyScore = fuzzy * 100;

  // 2. Shortened name: a word of 4+ letters that starts the catalog name.
  let prefixScore = 0;
  for (const t of nameTokens) {
    if (t.length >= 4 && t.length < p.nameKey.length && p.nameKey.startsWith(t)) {
      prefixScore = Math.max(prefixScore, PREFIX_BASE + PREFIX_SPAN * (t.length / p.nameKey.length));
    }
  }

  // 3. Brand name of this generic.
  const brandScore = brandGenerics.includes(p.nameKey) ? BRAND_BASE : 0;

  const base = Math.max(fuzzyScore, prefixScore, brandScore);
  const viaBrand = brandScore > 0 && brandScore >= fuzzyScore && brandScore >= prefixScore;
  const needsReview = viaBrand || (prefixScore > fuzzyScore && prefixScore >= brandScore);

  let confidence = base;
  if (base >= 60) {
    // Strength and form only help (or hurt) when the name is already close.
    if (rowStrengths.length > 0 && p.strength) {
      // A matching strength only adds confidence when the name is already a
      // close spelling (so "esomeprazole 20 mg" does not climb to "omeprazole 20 mg").
      if (strengthAgrees(rowStrengths, p.strength)) {
        if (fuzzyScore >= 80 || prefixScore > 0 || brandScore > 0) confidence += STRENGTH_BONUS;
      } else {
        confidence -= STRENGTH_PENALTY;
      }
    }
    if (rowForms.length > 0 && p.formWords.length > 0) {
      confidence += rowForms.some((f) => p.formWords.includes(f)) ? FORM_BONUS : -FORM_PENALTY;
    }
  }
  confidence = Math.min(confidence, needsReview ? REVIEW_CAP : MAX_NAME_CONFIDENCE);
  confidence = Math.max(0, Math.round(confidence));
  return { prepared: p, confidence, viaBrand };
}

/**
 * Match each uploaded row to a catalog drug.
 *
 * - Known NDC (found in the catalog): matched, confidence 100.
 * - Otherwise score by spelling, shortened name, brand name and strength:
 *     confidence >= 90        -> matched
 *     80 to 89, or a brand    -> needs-review
 *     anything else           -> unmatched
 * - Up to 3 suggestions (confidence above 40), best first, for every status.
 */
export function matchDrugs(rows: UploadRow[], catalog: CatalogDrug[]): DrugMatch[] {
  const prepared = prepareCatalog(catalog);
  const byNdc = new Map<string, PreparedDrug>();
  for (const p of prepared) {
    if (p.ndc) byNdc.set(p.ndc, p);
  }

  return rows.map((row): DrugMatch => {
    const original = row.drugName;

    // Known NDC always wins.
    if (row.ndc) {
      const hit = byNdc.get(normalizeNdc(row.ndc));
      if (hit) {
        return {
          rowIndex: row.rowIndex,
          original,
          corrected: hit.display,
          status: "matched",
          confidence: 100,
          drugId: hit.drug.id,
          suggestions: [{ drugId: hit.drug.id, name: hit.display, confidence: 100 }],
        };
      }
    }

    // Name matching on the drug name plus the strength column, if any.
    const tokens = tokenize(`${row.drugName} ${row.strength ?? ""}`);
    const nameTokens = tokens.filter((t) => !NOISE_WORDS.has(t) && !/^\d/.test(t));
    const rowStrengths = extractStrengths(tokens);
    const rowForms = tokens.filter((t) => t === "tablet" || t === "capsule");

    // Brand names found in the text (exact, or one typo away for longer names).
    const brandGenerics: string[] = [];
    for (const t of nameTokens) {
      for (const [brand, generic] of Object.entries(BRAND_TO_GENERIC)) {
        if (t === brand || (t.length >= 6 && similarity(t, brand) >= 0.85)) brandGenerics.push(generic);
      }
    }

    const scored = prepared
      .map((p) => scoreAgainst(nameTokens, rowStrengths, rowForms, brandGenerics, p))
      .sort((a, b) => b.confidence - a.confidence);

    const suggestions = scored
      .filter((s) => s.confidence > SUGGESTION_FLOOR)
      .slice(0, 3)
      .map((s) => ({ drugId: s.prepared.drug.id, name: s.prepared.display, confidence: s.confidence }));

    const top = scored[0];
    let status: MatchStatus = "unmatched";
    if (top && top.confidence > SUGGESTION_FLOOR) {
      if (top.viaBrand) status = "needs-review";
      else if (top.confidence >= 90) status = "matched";
      else if (top.confidence >= 80) status = "needs-review";
    }

    if (status === "unmatched" || !top) {
      return {
        rowIndex: row.rowIndex,
        original,
        corrected: "",
        status: "unmatched",
        confidence: top ? top.confidence : 0,
        suggestions,
      };
    }
    return {
      rowIndex: row.rowIndex,
      original,
      corrected: top.prepared.display,
      status,
      confidence: top.confidence,
      drugId: top.prepared.drug.id,
      suggestions,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Invoice-line description parsing and aggregation
// ---------------------------------------------------------------------------

/** Salt and formulation words that do not change which drug a product is. */
const SALT_WORDS = new Set([
  "CALCIUM", "HYDROCHLORIDE", "HCL", "SODIUM", "HYCLATE", "MALEATE", "BESYLATE", "SULFATE",
  "MAGNESIUM", "POTASSIUM", "TARTRATE", "SUCCINATE", "MESYLATE", "PHOSPHATE", "ACETATE",
  "HYDROBROMIDE", "HBR", "MONOHYDRATE", "TRIHYDRATE", "DIHYDRATE", "FUMARATE", "CITRATE",
  "BROMIDE", "DR", "HFA", "OPHTHALMIC",
]);
/** Extended-release markers. These change the product, so they are kept as a flag. */
const EXTENDED_WORDS = new Set(["ER", "XR", "SR", "CR", "XL", "LA", "ODT"]);
const FORM_WORDS: Record<string, string> = {
  TABLET: "tablet", TABLETS: "tablet", TAB: "tablet", TABS: "tablet",
  CAPSULE: "capsule", CAPSULES: "capsule", CAP: "capsule", CAPS: "capsule",
  INHALER: "inhaler", SOLUTION: "solution", SUSPENSION: "suspension", CREAM: "cream",
  OINTMENT: "ointment", GEL: "gel", PATCH: "patch", PEN: "pen", SPRAY: "spray",
  INJECTION: "injection", POWDER: "powder", DROPS: "drops", SYRUP: "syrup", KIT: "kit",
};

export type ParsedDescription = {
  /** Drug name with salt words and the extended-release marker removed, e.g. "ATORVASTATIN". */
  name: string;
  /** Drug name as written before the strength, e.g. "ATORVASTATIN CALCIUM". */
  rawName: string;
  /** Normalized strength such as "20 mg" or "90 mcg", or "" when none was found. */
  strength: string;
  /** Normalized form such as "tablet" or "capsule", or "" when none was found. */
  form: string;
  /** Pack text such as "90 TAB", "" when none was found. */
  packText: string;
  /** Labeler code after " - ", such as "BLW", "" when none was found. */
  labeler: string;
  /** True for ER, XR, SR and similar products. */
  extended: boolean;
  /** True for the "LT BRAND #0022" and "LONG-TAIL GENERIC #0220" placeholders. */
  longTail: boolean;
};

/**
 * Split a wholesaler description such as
 * "ATORVASTATIN CALCIUM 20 MG TABLET 90 TAB - BLW" into its parts.
 * Works on short names too ("Atorvastatin 20mg tab", "Lisinopril").
 */
export function parseDescription(text: string): ParsedDescription {
  let s = (text ?? "").trim().replace(/\s+/g, " ");
  let labeler = "";
  const lm = /\s-\s([A-Za-z0-9]{2,6})$/.exec(s);
  if (lm) {
    labeler = lm[1].toUpperCase();
    s = s.slice(0, lm.index).trim();
  }
  const longTail = /^(LT BRAND|LONG-TAIL)\b/i.test(s);

  let strength = "";
  let before = s;
  let after = "";
  const sm = /(\d+(?:\.\d+)?)\s*(mg|mcg|ug|g|ml|iu|%)(?![a-z])(?:\s*\/\s*(?:act|actuation|ml|hr|g|dose)\b)?/i.exec(s);
  if (sm) {
    const unit = sm[2].toLowerCase() === "ug" ? "mcg" : sm[2].toLowerCase();
    strength = unit === "%" ? `${sm[1]}%` : `${sm[1]} ${unit}`;
    before = s.slice(0, sm.index).trim();
    after = s.slice(sm.index + sm[0].length);
  }

  // Form: first form word after the strength (or anywhere when there is no strength).
  let form = "";
  let packText = "";
  const scan = sm ? after : s;
  const fm = /\b(tablets?|tabs?|capsules?|caps?|inhaler|solution|suspension|cream|ointment|gel|patch|pen|spray|injection|powder|drops|syrup|kit)\b/i.exec(scan);
  if (fm) {
    form = FORM_WORDS[fm[1].toUpperCase()] ?? fm[1].toLowerCase();
    if (!sm) before = s.slice(0, fm.index).trim();
  }
  const pm = /(\d+(?:\.\d+)?\s*[A-Za-z]{2,4})\s*$/.exec(scan);
  if (pm && fm && pm.index > fm.index) packText = pm[1].toUpperCase();

  // Name: drop punctuation, salts and extended-release markers.
  const words = before.replace(/[,;]/g, " ").split(/\s+/).filter(Boolean);
  let extended = false;
  const kept: string[] = [];
  for (const w of words) {
    const up = w.toUpperCase();
    if (EXTENDED_WORDS.has(up)) extended = true;
    else if (!SALT_WORDS.has(up)) kept.push(w);
  }
  const name = (kept.length ? kept : words).join(" ");
  return { name, rawName: before, strength, form, packText, labeler, extended, longTail };
}

export type ProductSummary = {
  /** Grouping key: cleaned name, strength and form (lowercase). */
  key: string;
  /** First original description seen for this product. */
  description: string;
  /** Description without pack text and labeler, e.g. "ATORVASTATIN CALCIUM 20 mg tablet". */
  displayName: string;
  /** Cleaned drug name (salt words removed). */
  drugName: string;
  strength: string;
  form: string;
  /** Number of invoice lines (credits included). */
  lines: number;
  /** Packages bought, net of credits. */
  packages: number;
  /** Net units: packages x package size. */
  unitsTotal: number;
  /** Months in the file's invoice date range (at least 1). Same for every product. */
  monthsCovered: number;
  unitsPerMonth: number;
  /** Net extended cost / net units, in dollars per unit. 0 when net units are 0. */
  avgUnitPrice: number;
  /** Net spend over the file's date range, in dollars. */
  totalSpend: number;
  wholesalers: string[];
  /** Long-tail placeholder, or a brand: description starts with "LT BRAND" or labeler code is BRD. */
  isBrandLike: boolean;
  /** Description is a "LONG-TAIL ..." or "LT BRAND ..." placeholder. */
  isLongTail: boolean;
  /** Extended-release product. */
  extended: boolean;
};

export type AggregateResult = {
  products: ProductSummary[];
  /** Rows that were aggregated (skipped ones excluded). */
  lineCount: number;
  /** Rows skipped because a quantity, package size or cost was missing or not a number. */
  skipped: number;
  monthsCovered: number;
};

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const t = iso ? Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

type Acc = {
  summary: ProductSummary;
  cost: number; // net dollars on invoice lines
  monthlyUnits: number; // from monthly-summary rows (no invoice lines)
  monthlyCost: number; // dollars per month on those rows
  wholesalers: Set<string>;
};

/**
 * Group invoice lines (or monthly summary rows) by product and total them.
 *
 * - Credits: a row whose transactionType contains CREDIT, RETURN or MEMO counts
 *   as negative (packages and dollars), whatever sign the file used.
 * - Price per unit = package cost / package size, so avgUnitPrice is net cost / net units.
 * - Rows with only unitsPerMonth (and optionally pricePaid, a per-unit price)
 *   are treated as monthly summaries and added as they are.
 * - Rows with a missing or invalid number, or a package size of 0 or less, are skipped and counted.
 */
export function aggregateInvoiceLines(rows: UploadRow[]): AggregateResult {
  // Date range over all rows.
  let minT = Infinity;
  let maxT = -Infinity;
  for (const r of rows) {
    const t = parseDate(r.invoiceDate);
    if (t === undefined) continue;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  const monthsCovered =
    Number.isFinite(minT) && Number.isFinite(maxT)
      ? Math.max(1, Math.round(((maxT - minT) / 86_400_000 + 1) / 30.4375 * 10) / 10)
      : 1;

  const map = new Map<string, Acc>();
  let skipped = 0;
  let lineCount = 0;
  for (const r of rows) {
    const p = parseDescription(r.drugName);
    const strength = p.strength || (r.strength ? parseDescription(`x ${r.strength}`).strength || r.strength.toLowerCase() : "");
    const hasInvoiceQty = r.quantity !== undefined;
    const hasMonthly = r.unitsPerMonth !== undefined;
    if (!p.name || (!hasInvoiceQty && !hasMonthly)) {
      skipped++;
      continue;
    }
    const credit = r.transactionType ? /credit|return|memo/i.test(r.transactionType) : false;
    const sign = credit ? -1 : 1;
    let packages = 0;
    let units = 0;
    let cost = 0;
    let monthlyUnits = 0;
    let monthlyCost = 0;
    if (hasInvoiceQty) {
      const qty = r.quantity as number;
      const sizeText = r.packageSize ? Number(r.packageSize.replace(/[,\s]/g, "")) : NaN;
      const size = Number.isFinite(sizeText) ? sizeText : 1; // no package size: one unit per package
      const unitCost = r.unitCostPerPackage;
      const ext = r.extendedCost;
      if (size <= 0 || (ext === undefined && unitCost === undefined && r.pricePaid === undefined)) {
        skipped++;
        continue;
      }
      packages = credit ? -Math.abs(qty) : qty;
      units = packages * size;
      if (ext !== undefined) cost = credit ? -Math.abs(ext) : ext;
      else if (unitCost !== undefined) cost = packages * (credit ? Math.abs(unitCost) : unitCost);
      else cost = units * (r.pricePaid as number);
    } else {
      monthlyUnits = sign * (r.unitsPerMonth as number);
      monthlyCost = monthlyUnits * (r.pricePaid ?? 0);
    }
    const form = p.form;
    const key = `${p.name}|${strength}|${form}${p.extended ? "|er" : ""}`.toLowerCase();
    let acc = map.get(key);
    if (!acc) {
      acc = {
        summary: {
          key,
          description: r.drugName,
          displayName: [p.rawName, strength, form].filter(Boolean).join(" "),
          drugName: p.name,
          strength,
          form,
          lines: 0,
          packages: 0,
          unitsTotal: 0,
          monthsCovered,
          unitsPerMonth: 0,
          avgUnitPrice: 0,
          totalSpend: 0,
          wholesalers: [],
          isBrandLike: p.longTail && /^LT BRAND/i.test(r.drugName) ? true : p.labeler === "BRD",
          isLongTail: p.longTail,
          extended: p.extended,
        },
        cost: 0,
        monthlyUnits: 0,
        monthlyCost: 0,
        wholesalers: new Set<string>(),
      };
      map.set(key, acc);
    }
    const s = acc.summary;
    s.lines++;
    s.packages += packages;
    s.unitsTotal += units;
    acc.cost += cost;
    acc.monthlyUnits += monthlyUnits;
    acc.monthlyCost += monthlyCost;
    if (r.wholesaler) acc.wholesalers.add(r.wholesaler);
    lineCount++;
  }

  const products: ProductSummary[] = [];
  for (const acc of Array.from(map.values())) {
    const s = acc.summary;
    s.wholesalers = Array.from(acc.wholesalers);
    s.unitsPerMonth = s.unitsTotal / monthsCovered + acc.monthlyUnits;
    const totalUnitsPerMonth = s.unitsTotal / monthsCovered + acc.monthlyUnits;
    const dollarsPerMonth = acc.cost / monthsCovered + acc.monthlyCost;
    s.avgUnitPrice = totalUnitsPerMonth > 0 ? dollarsPerMonth / totalUnitsPerMonth : 0;
    s.totalSpend = dollarsPerMonth * monthsCovered;
    products.push(s);
  }
  return { products, lineCount, skipped, monthsCovered };
}

export type ProductMatch = {
  product: ProductSummary;
  match: DrugMatch;
  /** Plain-words reason when the product was left unmatched on purpose. */
  note?: string;
};

/**
 * Match aggregated products to the pool catalog (one match per product, not per line).
 *
 * - Long-tail placeholders ("LT BRAND #0022", "LONG-TAIL GENERIC ...") and extended-release
 *   products are unmatched without scoring (the pool catalog holds the immediate-release drug).
 * - Everything else goes through matchDrugs using the cleaned name, the form and the strength.
 * - If the best catalog drug has a different strength (for example Atorvastatin 40 mg vs the
 *   20 mg entry), the product is UNMATCHED with a note, not needs-review, so it never inflates
 *   the matched numbers. The confidence of the near-miss is kept.
 * match.rowIndex is the index in `products`.
 */
export function matchProducts(products: ProductSummary[], catalog: CatalogDrug[]): ProductMatch[] {
  const catalogStrength = new Map<string, Strength | undefined>();
  for (const c of catalog) catalogStrength.set(c.id, extractStrengths(tokenize(c.strength))[0]);

  const scoreRows: UploadRow[] = [];
  const scoreIndex: number[] = [];
  const out: ProductMatch[] = new Array<ProductMatch>(products.length);
  products.forEach((p, i) => {
    if (p.isLongTail || p.extended) {
      out[i] = {
        product: p,
        match: { rowIndex: i, original: p.displayName, corrected: "", status: "unmatched", confidence: 0, suggestions: [] },
        note: p.isLongTail ? "Brand or long-tail item, not in the pool catalog" : "Extended-release product, not in the pool catalog",
      };
      return;
    }
    scoreIndex.push(i);
    const row: UploadRow = { rowIndex: i, drugName: p.form ? `${p.drugName} ${p.form}` : p.drugName };
    if (p.strength) row.strength = p.strength;
    scoreRows.push(row);
  });

  const matches = matchDrugs(scoreRows, catalog);
  matches.forEach((m, k) => {
    const i = scoreIndex[k];
    const p = products[i];
    const match: DrugMatch = { ...m, rowIndex: i, original: p.displayName };
    let note: string | undefined;
    if (match.status !== "unmatched" && match.drugId && p.strength) {
      const cs = catalogStrength.get(match.drugId);
      const ps = extractStrengths(tokenize(p.strength));
      if (cs && ps.length > 0 && !strengthAgrees(ps, cs)) {
        note = `Same drug, different strength (${p.strength}), not in the pool catalog`;
        out[i] = {
          product: p,
          match: { ...match, status: "unmatched", corrected: "", drugId: undefined, suggestions: [] },
          note,
        };
        return;
      }
    }
    out[i] = { product: p, match };
  });
  return out;
}
