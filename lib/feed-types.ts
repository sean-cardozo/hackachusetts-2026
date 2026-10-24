// Types for the three "Live" government feeds, plus the list of tracked drugs.
// Each type is defined once as a zod schema so the same shape is used to
// check the cache files and to give TypeScript its types.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tracked drugs
// ---------------------------------------------------------------------------

export type TrackedDrug = {
  drugKey: string; // stable key shared by all three cache files
  name: string;
  strength: string;
  form: string;
  category: string;
  // How to find this drug in each feed:
  nadacDescription: string; // exact "NDC Description" in the NADAC file
  obIngredient: string; // Orange Book "Ingredient"
  obStrength: string; // Orange Book "Strength" (annotations after "**" removed)
  obForm: string; // Orange Book "DF;Route"
  shortageWord: string; // lowercase word to look for in openFDA shortage names
};

export const TRACKED_DRUGS: TrackedDrug[] = [
  {
    drugKey: "atorvastatin-20mg-tablet",
    name: "Atorvastatin", strength: "20 mg", form: "tablet", category: "Cardio",
    nadacDescription: "ATORVASTATIN 20 MG TABLET",
    obIngredient: "ATORVASTATIN CALCIUM", obStrength: "EQ 20MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "atorvastatin",
  },
  {
    drugKey: "lisinopril-10mg-tablet",
    name: "Lisinopril", strength: "10 mg", form: "tablet", category: "Cardio",
    nadacDescription: "LISINOPRIL 10 MG TABLET",
    obIngredient: "LISINOPRIL", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "lisinopril",
  },
  {
    drugKey: "amlodipine-5mg-tablet",
    name: "Amlodipine", strength: "5 mg", form: "tablet", category: "Cardio",
    nadacDescription: "AMLODIPINE BESYLATE 5 MG TAB",
    obIngredient: "AMLODIPINE BESYLATE", obStrength: "EQ 5MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "amlodipine",
  },
  {
    drugKey: "metformin-500mg-tablet",
    name: "Metformin", strength: "500 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "METFORMIN HCL 500 MG TABLET",
    obIngredient: "METFORMIN HYDROCHLORIDE", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "metformin",
  },
  {
    drugKey: "sertraline-50mg-tablet",
    name: "Sertraline", strength: "50 mg", form: "tablet", category: "Mental health",
    nadacDescription: "SERTRALINE HCL 50 MG TABLET",
    obIngredient: "SERTRALINE HYDROCHLORIDE", obStrength: "EQ 50MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "sertraline",
  },
  {
    drugKey: "amoxicillin-500mg-capsule",
    name: "Amoxicillin", strength: "500 mg", form: "capsule", category: "Antibiotics",
    nadacDescription: "AMOXICILLIN 500 MG CAPSULE",
    obIngredient: "AMOXICILLIN", obStrength: "500MG", obForm: "CAPSULE;ORAL",
    shortageWord: "amoxicillin",
  },
  {
    drugKey: "albuterol-90mcg-inhalation-aerosol",
    name: "Albuterol", strength: "90 mcg", form: "inhalation aerosol HFA", category: "Respiratory",
    nadacDescription: "ALBUTEROL HFA 90 MCG INHALER",
    obIngredient: "ALBUTEROL SULFATE", obStrength: "EQ 0.09MG BASE/INH", obForm: "AEROSOL, METERED;INHALATION",
    shortageWord: "albuterol",
  },
  {
    drugKey: "omeprazole-20mg-dr-capsule",
    name: "Omeprazole", strength: "20 mg", form: "delayed-release capsule", category: "GI",
    nadacDescription: "OMEPRAZOLE DR 20 MG CAPSULE",
    obIngredient: "OMEPRAZOLE", obStrength: "20MG", obForm: "CAPSULE, DELAYED REL PELLETS;ORAL",
    shortageWord: "omeprazole",
  },
  {
    drugKey: "levothyroxine-50mcg-tablet",
    name: "Levothyroxine", strength: "50 mcg", form: "tablet", category: "Thyroid",
    nadacDescription: "LEVOTHYROXINE 50 MCG TABLET",
    obIngredient: "LEVOTHYROXINE SODIUM", obStrength: "0.05MG", obForm: "TABLET;ORAL",
    shortageWord: "levothyroxine",
  },
  {
    drugKey: "gabapentin-300mg-capsule",
    name: "Gabapentin", strength: "300 mg", form: "capsule", category: "Pain",
    nadacDescription: "GABAPENTIN 300 MG CAPSULE",
    obIngredient: "GABAPENTIN", obStrength: "300MG", obForm: "CAPSULE;ORAL",
    shortageWord: "gabapentin",
  },
  {
    // Not one of the 10 core drugs. Included because supplier quotes mention it.
    drugKey: "glipizide-5mg-tablet",
    name: "Glipizide", strength: "5 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "GLIPIZIDE 5 MG TABLET",
    obIngredient: "GLIPIZIDE", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "glipizide",
  },
];

export const DRUG_KEYS = TRACKED_DRUGS.map((d) => d.drugKey);

// ---------------------------------------------------------------------------
// Shared header on every cache file
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const statusSchema = z.enum(["live", "cached"]);
const cadenceSchema = z.enum(["daily", "weekly", "monthly"]);

export const FeedStatusSchema = z.object({
  feed: z.string(),
  cadence: cadenceSchema,
  fetchedAt: z.string(),
  effectiveDate: isoDate,
  status: statusSchema,
});
export type FeedStatus = z.infer<typeof FeedStatusSchema>;

const header = {
  source: z.string(),
  cadence: cadenceSchema,
  fetchedAt: z.string(), // ISO timestamp of the last successful download
  effectiveDate: isoDate,
  status: statusSchema,
};

// ---------------------------------------------------------------------------
// NADAC
// ---------------------------------------------------------------------------

export const BenchmarkSchema = z.object({
  ndc: z.string().regex(/^\d{11}$/), // 11 digits, no dashes
  description: z.string(),
  nadac: z.number(), // dollars per pricing unit, not rounded
  pricingUnit: z.string(), // "EA" (each), "GM" (gram), "ML" ...
  classification: z.enum(["G", "B"]), // generic or brand
  effectiveDate: isoDate,
  drugKey: z.string(),
});
export type Benchmark = z.infer<typeof BenchmarkSchema>;

export const NadacByDrugSchema = z.object({
  nadac: z.number(),
  pricingUnit: z.string(),
  ndcCount: z.number(),
  method: z.string(),
});

export const NadacCacheSchema = z.object({
  feed: z.literal("nadac"),
  ...header,
  items: z.array(BenchmarkSchema),
  byDrug: z.record(z.string(), NadacByDrugSchema),
});
export type NadacCache = z.infer<typeof NadacCacheSchema>;

// ---------------------------------------------------------------------------
// Orange Book
// ---------------------------------------------------------------------------

export const OrangeBookProductSchema = z.object({
  drugKey: z.string(),
  ingredient: z.string(),
  strength: z.string(),
  dosageForm: z.string(),
  applicant: z.string(),
  applNo: z.string(),
  applType: z.string(), // "A" = generic (ANDA), "N" = brand (NDA)
  teCode: z.string(), // "AB", "AB1", ... or "" when none
});
export type OrangeBookProduct = z.infer<typeof OrangeBookProductSchema>;

export const EquivalentSchema = z.object({
  drugKey: z.string(),
  mfr: z.string(),
  teCode: z.string(),
  applNo: z.string(),
});
export type Equivalent = z.infer<typeof EquivalentSchema>;

export const OrangeBookCacheSchema = z.object({
  feed: z.literal("orangebook"),
  ...header,
  products: z.array(OrangeBookProductSchema),
  equivalents: z.array(EquivalentSchema),
});
export type OrangeBookCache = z.infer<typeof OrangeBookCacheSchema>;

// ---------------------------------------------------------------------------
// Drug shortages
// ---------------------------------------------------------------------------

export const ShortageSchema = z.object({
  drugKey: z.string(),
  ingredient: z.string(),
  status: z.enum(["current", "resolved"]),
  updated: isoDate,
  dosageForm: z.string(),
  company: z.string(),
});
export type Shortage = z.infer<typeof ShortageSchema>;

export const ShortagesCacheSchema = z.object({
  feed: z.literal("shortages"),
  ...header,
  items: z.array(ShortageSchema),
  history: z.record(z.string(), z.object({ currentCount: z.number(), last3yCount: z.number() })),
});
export type ShortagesCache = z.infer<typeof ShortagesCacheSchema>;

// ---------------------------------------------------------------------------
// Feed names
// ---------------------------------------------------------------------------

export const FEED_NAMES = ["nadac", "orangebook", "shortages"] as const;
export type FeedName = (typeof FEED_NAMES)[number];

export type FeedDataMap = {
  nadac: NadacCache;
  orangebook: OrangeBookCache;
  shortages: ShortagesCache;
};

export const FEED_SCHEMAS = {
  nadac: NadacCacheSchema,
  orangebook: OrangeBookCacheSchema,
  shortages: ShortagesCacheSchema,
};
