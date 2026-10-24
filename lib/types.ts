// Shared types for PharmaPool. Export-only: no runtime code in this file.
// Data model follows .kiro/specs/poolrx/design.md.
// Feed Types (Benchmark, Equivalent, Shortage, FeedStatus) live in lib/feed-types.ts.

export type Supplier = "A" | "B" | "C";

export type Drug = {
  id: string;
  name: string;
  strength: string;
  form: string;
  category: string;
  ndc?: string;
  mfr: string;
  unitsPerMonth: number;
  /** Unit price paid, in dollars. */
  paid: number;
  onHand?: number;
  /** ISO date (YYYY-MM-DD) of the last inventory count. */
  countDate?: string;
  /** Sample flag for an FDA shortage. */
  hasShortage: boolean;
  /** NADAC unit price used only when the live NADAC cache is missing. */
  nadacFallback: number;
};

export type RoundStatus =
  | "open"
  | "target"
  | "quotes"
  | "awarded"
  | "closed"
  | "at-risk"
  | "missed";

export type Round = {
  id: string;
  name: string;
  status: RoundStatus;
  /** Estimated savings range as a percentage, [low, high]. null when the design gives none. */
  estRange: [number, number] | null;
  targetUnits: number | null;
  committedUnits: number | null;
  pharmacies: number | null;
  /** ISO timestamp when the round closes. null when the round has no open deadline. */
  deadline: string | null;
  /** ISO timestamp by which pharmacies must confirm. */
  confirmDeadline?: string;
  /** Drug ids included in the round. */
  drugs: string[];
  /** Share of past opt-ins that confirmed, 0 to 1. null when unknown. */
  pastConfirmRate: number | null;
  /** Progress percent given directly by the design (can be above 100). */
  progressPct?: number;
  /** Projected percent at close for an at-risk round. */
  projectedPct?: number;
  /** True when the current pharmacy already joined the round. */
  userJoined?: boolean;
  awardedSupplier?: Supplier;
  /** Awarded savings percentage. */
  awardedPct?: number;
  /** Dollars saved by a closed round. */
  savedUsd?: number;
  /** Brand spend of the current pharmacy, in dollars per year. */
  userBrandSpendUsd?: number;
  unscaledProgressNote?: string;
  deadlineNote?: string;
  confirmDeadlineNote?: string;
};

export type Quote = {
  supplier: Supplier;
  /** Unit price by product id. */
  prices: Record<string, number>;
  deliveryDays: number;
  /** Minimum order in dollars. */
  minOrder: number;
  /** Reliability score, 0 to 100. */
  reliability: number;
  /** Quoted savings percentage. */
  quotedPct: number;
};

export type SupplierScore = {
  supplier: Supplier;
  /** Total of the quoted prices for the group demand, in dollars. */
  total: number;
  price: number;
  delivery: number;
  reliability: number;
  /** Weighted score, 0 to 100. */
  score: number;
};

export type StandardField =
  | "drugName"
  | "strength"
  | "ndc"
  | "packageSize"
  | "unitsPerMonth"
  | "pricePaid"
  | "wholesaler"
  | "onHand"
  | "countDate"
  | "expirationDate"
  // Invoice-line fields (wholesaler purchase exports).
  | "quantity"
  | "invoiceDate"
  | "packageUnit"
  | "unitCostPerPackage"
  | "extendedCost"
  | "transactionType"
  | "creditReason"
  | "invoiceId";

export type ConfidenceLabel = "High" | "Medium" | "Low";

export type ColumnMapping = {
  /** Header text as found in the uploaded file. */
  source: string;
  /** Standard field, or null when the column is not recognized. */
  field: StandardField | null;
  /** Confidence percentage, 0 to 100. */
  confidence: number;
  label: ConfidenceLabel;
};

export type UploadRow = {
  rowIndex: number;
  drugName: string;
  strength?: string;
  ndc?: string;
  packageSize?: string;
  unitsPerMonth?: number;
  pricePaid?: number;
  wholesaler?: string;
  onHand?: number;
  countDate?: string;
  expirationDate?: string;
  /** Packages shipped on an invoice line. Credits are recognised by transactionType. */
  quantity?: number;
  invoiceDate?: string;
  packageUnit?: string;
  /** Price of one package (not one unit). */
  unitCostPerPackage?: number;
  extendedCost?: number;
  transactionType?: string;
  creditReason?: string;
  invoiceId?: string;
};

export type MatchStatus = "matched" | "needs-review" | "unmatched";

export type DrugMatch = {
  rowIndex: number;
  /** Text as uploaded. */
  original: string;
  /** Corrected catalog name, empty when unmatched. */
  corrected: string;
  status: MatchStatus;
  /** Confidence percentage, 0 to 100. */
  confidence: number;
  drugId?: string;
  /** Up to 3 suggestions ordered by confidence. */
  suggestions: { drugId: string; name: string; confidence: number }[];
};

export type AiTask = "column-map" | "drug-match" | "supplier-reason" | "rfq" | "ask";

export type AiResult<T = unknown> = {
  task: AiTask;
  result: T;
  /** Confidence percentage, 0 to 100. */
  confidence: number;
  source: "ai" | "fallback";
  sourceNote: string;
};

export type SwapDecision = {
  drugId: string;
  /** Manufacturer of the equivalent the user approved. */
  toMfr: string;
  approved: boolean;
  /** Extra savings per year, in dollars. */
  extraSavingsYr: number;
  /** ISO timestamp. */
  decidedAt: string;
};

export type OptIn = {
  roundId: string;
  /** Units the pharmacy commits to the round. */
  units: number;
  /** ISO timestamp. */
  optedAt: string;
  confirmed: boolean;
};

export type AwardDecision = {
  roundId: string;
  supplier: Supplier;
  /** ISO timestamp. */
  decidedAt: string;
};

export type StoreState = {
  /** Approved swaps by drug id. */
  swaps: Record<string, SwapDecision>;
  /** Opt-ins by round id. */
  optIns: Record<string, OptIn>;
  award: AwardDecision | null;
};
