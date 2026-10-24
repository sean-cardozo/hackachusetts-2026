// Sample data loader. Validates every file in data/sample/ with Zod and returns typed data.
// Requirement 2.6 and 2.7.
//
// The JSON files are imported statically (resolveJsonModule), so this module works in the
// browser bundle and on the server. It does not use fs.
//
// Schemas are strict: an unknown or misspelled field is a validation error. They accept
// every field that exists in the current files.
//
// Loader return shapes:
// - loadDrugs / loadRounds / loadQuotes / loadUploadDemo return the whole validated file
//   (including `kind`, `note` and the extra blocks).
// - loadSample returns the pieces screens need: `drugs` (Drug[]), `rounds` (Round[]),
//   `quotes` (the whole quotes file, because group demand, share and weights live there),
//   `upload` (the whole upload demo), `swapExtras` and `demoNow`.

import { z } from "zod";

import drugsJson from "../data/sample/drugs.json";
import quotesJson from "../data/sample/quotes.json";
import roundsJson from "../data/sample/rounds.json";
import uploadJson from "../data/sample/upload-demo.json";
import type { Drug, Quote, Round } from "./types";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/** Thrown when a sample file fails validation. The message names the file and the field path. */
export class SampleError extends Error {
  readonly file: string;
  readonly fieldPath: string;

  constructor(file: string, fieldPath: string, detail: string) {
    super(`Sample file ${file}: invalid field "${fieldPath}": ${detail}`);
    this.name = "SampleError";
    this.file = file;
    this.fieldPath = fieldPath;
  }
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return "(root)";
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

function parseFile<S extends z.ZodType>(file: string, schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const base = formatPath(issue.path);
  if (issue.code === "unrecognized_keys") {
    const keys = issue.keys.map((k) => (base === "(root)" ? k : `${base}.${k}`)).join(", ");
    throw new SampleError(file, keys, issue.message);
  }
  throw new SampleError(file, base, issue.message);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const kind = z.literal("sample");
const supplier = z.enum(["A", "B", "C"]);
const byProduct = z.record(z.string(), z.number());

const roundStatus = z.enum([
  "open",
  "target",
  "quotes",
  "awarded",
  "closed",
  "at-risk",
  "missed",
]);

const drugSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  strength: z.string(),
  form: z.string(),
  category: z.string(),
  ndc: z.string().optional(),
  mfr: z.string(),
  unitsPerMonth: z.number().nonnegative(),
  paid: z.number().nonnegative(),
  onHand: z.number().nonnegative().optional(),
  countDate: z.string().optional(),
  hasShortage: z.boolean(),
  nadacFallback: z.number().nonnegative(),
});

const swapExtraSchema = z.strictObject({
  drugId: z.string().min(1),
  toMfr: z.string().min(1),
  teCode: z.string(),
  extraSavingsYr: z.number().nonnegative(),
  unscaledExtraSavingsYr: z.number().nonnegative(),
});

const swapExtrasSchema = z.strictObject({
  note: z.string(),
  items: z.array(swapExtraSchema),
});

export const drugsFileSchema = z.strictObject({
  kind,
  note: z.string(),
  scaleFactor: z.number().positive(),
  countDate: z.string(),
  items: z.array(drugSchema).min(1),
  swapExtras: swapExtrasSchema,
});

const roundSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  status: roundStatus,
  estRange: z.tuple([z.number(), z.number()]).nullable(),
  targetUnits: z.number().nonnegative().nullable(),
  committedUnits: z.number().nonnegative().nullable(),
  pharmacies: z.number().nonnegative().nullable(),
  deadline: z.string().nullable(),
  confirmDeadline: z.string().optional(),
  drugs: z.array(z.string()),
  pastConfirmRate: z.number().min(0).max(1).nullable(),
  progressPct: z.number().optional(),
  projectedPct: z.number().optional(),
  userJoined: z.boolean().optional(),
  awardedSupplier: supplier.optional(),
  awardedPct: z.number().optional(),
  savedUsd: z.number().optional(),
  userBrandSpendUsd: z.number().optional(),
  unscaledProgressNote: z.string().optional(),
  deadlineNote: z.string().optional(),
  confirmDeadlineNote: z.string().optional(),
});

export const roundsFileSchema = z.strictObject({
  kind,
  note: z.string(),
  demoNow: z.string(),
  items: z.array(roundSchema).min(1),
});

const quoteSchema = z.strictObject({
  supplier,
  prices: byProduct,
  deliveryDays: z.number().nonnegative(),
  minOrder: z.number().nonnegative(),
  reliability: z.number().min(0).max(100),
  quotedPct: z.number(),
});

export const quotesFileSchema = z.strictObject({
  kind,
  note: z.string(),
  scaleFactor: z.number().positive(),
  defaultWeights: z.strictObject({
    price: z.number().nonnegative(),
    delivery: z.number().nonnegative(),
    reliability: z.number().nonnegative(),
  }),
  groupDemand: byProduct,
  yourShare: byProduct,
  unscaled: z.strictObject({
    groupDemand: byProduct,
    yourShare: byProduct,
    minOrder: z.record(supplier, z.number()),
  }),
  quotes: z.array(quoteSchema).min(1),
});

export const uploadDemoFileSchema = z.strictObject({
  kind,
  note: z.string(),
  headers: z.array(z.string()).min(1),
  demoNames: z.strictObject({
    matched: z.array(z.string()),
    needsReview: z.array(z.string()),
    unmatched: z.array(z.string()),
  }),
  items: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(1),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SwapExtra = z.infer<typeof swapExtraSchema>;
export type DrugsFile = Omit<z.infer<typeof drugsFileSchema>, "items"> & { items: Drug[] };
export type RoundsFile = Omit<z.infer<typeof roundsFileSchema>, "items"> & { items: Round[] };
export type QuotesFile = Omit<z.infer<typeof quotesFileSchema>, "quotes"> & { quotes: Quote[] };
export type UploadDemoFile = z.infer<typeof uploadDemoFileSchema>;

export type SampleData = {
  drugs: Drug[];
  rounds: Round[];
  quotes: QuotesFile;
  upload: UploadDemoFile;
  swapExtras: SwapExtra[];
  /** ISO timestamp the sample "now" is pinned to. */
  demoNow: string;
};

// ---------------------------------------------------------------------------
// Per-file parse functions (exported so tests can feed bad data)
// ---------------------------------------------------------------------------

export const SAMPLE_FILES = {
  drugs: "drugs.json",
  rounds: "rounds.json",
  quotes: "quotes.json",
  upload: "upload-demo.json",
} as const;

export function parseDrugs(raw: unknown): DrugsFile {
  return parseFile(SAMPLE_FILES.drugs, drugsFileSchema, raw);
}

export function parseRounds(raw: unknown): RoundsFile {
  return parseFile(SAMPLE_FILES.rounds, roundsFileSchema, raw);
}

export function parseQuotes(raw: unknown): QuotesFile {
  return parseFile(SAMPLE_FILES.quotes, quotesFileSchema, raw);
}

export function parseUploadDemo(raw: unknown): UploadDemoFile {
  return parseFile(SAMPLE_FILES.upload, uploadDemoFileSchema, raw);
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export function loadDrugs(): DrugsFile {
  return parseDrugs(drugsJson);
}

export function loadRounds(): RoundsFile {
  return parseRounds(roundsJson);
}

export function loadQuotes(): QuotesFile {
  return parseQuotes(quotesJson);
}

export function loadUploadDemo(): UploadDemoFile {
  return parseUploadDemo(uploadJson);
}

/** Validates all four files and returns typed data. Throws SampleError on the first bad file. */
export function loadSample(): SampleData {
  const drugs = loadDrugs();
  const rounds = loadRounds();
  const quotes = loadQuotes();
  const upload = loadUploadDemo();
  return {
    drugs: drugs.items,
    rounds: rounds.items,
    quotes,
    upload,
    swapExtras: drugs.swapExtras.items,
    demoNow: rounds.demoNow,
  };
}
