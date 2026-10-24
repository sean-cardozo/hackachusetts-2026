// Downloads the three government feeds and saves small, filtered copies
// in data/cache/. Run it with:  npx tsx scripts/fetch-feeds.ts
//
// Rules:
//  - A feed is marked "live" only when it was just downloaded successfully.
//  - If a download fails, the old cache file is kept, marked "cached", and its
//    fetchedAt is left alone.
//  - An empty result never overwrites a good file.
//  - No API key is needed, and none is printed or saved.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import Papa from "papaparse";
import { normalizeNdc } from "../lib/ndc";
import { FEED_SCHEMAS, TRACKED_DRUGS } from "../lib/feed-types";
import type {
  Benchmark,
  Equivalent,
  FeedName,
  NadacCache,
  OrangeBookCache,
  OrangeBookProduct,
  Shortage,
  ShortagesCache,
} from "../lib/feed-types";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const NADAC_BASE = "https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost";
const ORANGE_BOOK_URL = "https://www.fda.gov/media/76860/download";
const SHORTAGES_URL = "https://api.fda.gov/drug/shortages.json";
const USER_AGENT = "PharmaPool-hackathon-demo (feed refresh script)";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// "10/21/2026" -> "2026-10-21"
function mdyToIso(mdy: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy.trim());
  if (!match) throw new Error(`Unexpected date: "${mdy}"`);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function download(url: string, destination: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status}) for ${url}`);
  await pipeline(Readable.fromWeb(response.body as unknown as WebReadableStream), fs.createWriteStream(destination));
  return response;
}

// ---------------------------------------------------------------------------
// NADAC (CMS) - weekly file, one row per NDC per week
// ---------------------------------------------------------------------------

// The file name contains the date (MM-DD-YYYY). Walk back from today to find the newest one.
async function findNewestNadacUrl(): Promise<string> {
  for (let daysBack = 0; daysBack < 28; daysBack++) {
    const day = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(day.getUTCDate()).padStart(2, "0");
    const url = `${NADAC_BASE}-${mm}-${dd}-${day.getUTCFullYear()}.csv`;
    const response = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return url;
  }
  throw new Error("No NADAC file found in the last 28 days");
}

async function buildNadac(): Promise<NadacCache> {
  const url = await findNewestNadacUrl();
  console.log(`NADAC: downloading ${url}`);
  const tmpFile = path.join(os.tmpdir(), "pharmapool-nadac.csv");
  await download(url, tmpFile);

  // The file is ~110 MB. Read it line by line and keep only lines that start
  // with a tracked ingredient, then parse just those lines as CSV.
  const firstWords = TRACKED_DRUGS.map((d) => d.nadacDescription.split(" ")[0]);
  const prefilter = new RegExp(`^"?(${firstWords.join("|")})`);
  let headerLine = "";
  const keptLines: string[] = [];
  const reader = readline.createInterface({ input: fs.createReadStream(tmpFile), crlfDelay: Infinity });
  for await (const line of reader) {
    if (!headerLine) headerLine = line;
    else if (prefilter.test(line)) keptLines.push(line);
  }
  fs.rmSync(tmpFile, { force: true });

  const parsed = Papa.parse<Record<string, string>>(`${headerLine}\n${keptLines.join("\n")}`, {
    header: true,
    skipEmptyLines: true,
  });

  // The file holds many weeks of history. Use only the newest week ("As of Date").
  const drugByDescription = new Map(TRACKED_DRUGS.map((d) => [d.nadacDescription, d]));
  const matching = parsed.data.filter((row) => drugByDescription.has(row["NDC Description"]));
  const newestAsOf = matching.map((row) => mdyToIso(row["As of Date"])).sort().pop();
  if (!newestAsOf) throw new Error("NADAC: no rows matched the tracked drugs");

  const items: Benchmark[] = [];
  for (const row of matching) {
    if (mdyToIso(row["As of Date"]) !== newestAsOf) continue;
    const classification = row["Classification for Rate Setting"];
    if (classification !== "G" && classification !== "B") continue;
    items.push({
      ndc: normalizeNdc(row["NDC"]),
      description: row["NDC Description"],
      nadac: Number(row["NADAC Per Unit"]),
      pricingUnit: row["Pricing Unit"],
      classification,
      effectiveDate: mdyToIso(row["Effective Date"]),
      drugKey: drugByDescription.get(row["NDC Description"])!.drugKey,
    });
  }
  items.sort((a, b) => a.drugKey.localeCompare(b.drugKey) || a.ndc.localeCompare(b.ndc));

  // One representative price per drug: the median over generic (G) NDCs.
  const byDrug: NadacCache["byDrug"] = {};
  for (const drug of TRACKED_DRUGS) {
    const generic = items.filter((item) => item.drugKey === drug.drugKey && item.classification === "G");
    if (generic.length === 0) continue;
    byDrug[drug.drugKey] = {
      nadac: median(generic.map((item) => item.nadac)),
      pricingUnit: generic[0].pricingUnit,
      ndcCount: generic.length,
      method:
        `Median of NADAC Per Unit across ${generic.length} generic (G) NDCs whose NADAC description is exactly ` +
        `"${drug.nadacDescription}", week of ${newestAsOf}`,
    };
  }

  const effectiveDate = items.map((item) => item.effectiveDate).sort().pop()!;
  return {
    feed: "nadac",
    source: "CMS NADAC",
    cadence: "weekly",
    fetchedAt: new Date().toISOString(),
    effectiveDate,
    status: "live",
    items,
    byDrug,
  };
}

// ---------------------------------------------------------------------------
// FDA Orange Book - a zip with products.txt ("~" separated)
// ---------------------------------------------------------------------------

async function buildOrangeBook(): Promise<OrangeBookCache> {
  console.log(`Orange Book: downloading ${ORANGE_BOOK_URL}`);
  const zipFile = path.join(os.tmpdir(), "pharmapool-orangebook.zip");
  await download(ORANGE_BOOK_URL, zipFile);

  // The system `unzip` keeps us from adding a zip library.
  const text = execFileSync("unzip", ["-p", zipFile, "products.txt"], { maxBuffer: 100 * 1024 * 1024 }).toString("latin1");
  const listing = execFileSync("unzip", ["-l", zipFile]).toString();
  fs.rmSync(zipFile, { force: true });

  // Effective date = the date stamped on products.txt inside the zip (MM-DD-YYYY).
  const dateMatch = /(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}\s+products\.txt/.exec(listing);
  if (!dateMatch) throw new Error("Orange Book: could not read the date of products.txt");
  const effectiveDate = `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`;

  const lines = text.split("\n").map((line) => line.replace(/\r$/, "")).filter((line) => line.length > 0);
  const columns = lines[0].split("~");
  const rows = lines.slice(1).map((line) => {
    const cells = line.split("~");
    return Object.fromEntries(columns.map((name, i) => [name, cells[i] ?? ""]));
  });

  const products: OrangeBookProduct[] = [];
  for (const drug of TRACKED_DRUGS) {
    for (const row of rows) {
      const strength = row["Strength"].replace(/\s*\*\*.*$/, "").trim(); // drop "**See ..." notes
      const sameDrug = row["Ingredient"] === drug.obIngredient && strength === drug.obStrength && row["DF;Route"] === drug.obForm;
      if (!sameDrug || row["Type"] === "DISCN") continue; // skip products no longer marketed
      products.push({
        drugKey: drug.drugKey,
        ingredient: row["Ingredient"],
        strength,
        dosageForm: row["DF;Route"],
        applicant: row["Applicant_Full_Name"],
        applNo: row["Appl_No"],
        applType: row["Appl_Type"],
        teCode: row["TE_Code"],
      });
    }
  }

  if (products.length === 0) throw new Error("Orange Book: no products matched the tracked drugs");

  // Equivalents: different manufacturers with a TE code starting with "A".
  // Brand-name (NDA, Appl_Type "N") products stay in `products` but are not offered as swaps.
  const equivalents: Equivalent[] = [];
  for (const drug of TRACKED_DRUGS) {
    const seen = new Set<string>();
    const candidates = products
      .filter((p) => p.drugKey === drug.drugKey && p.teCode.startsWith("A") && p.applType === "A")
      .sort((a, b) => a.applicant.localeCompare(b.applicant) || a.applNo.localeCompare(b.applNo));
    for (const p of candidates) {
      if (seen.has(p.applicant)) continue;
      seen.add(p.applicant);
      equivalents.push({ drugKey: drug.drugKey, mfr: p.applicant, teCode: p.teCode, applNo: p.applNo });
    }
  }

  return {
    feed: "orangebook",
    source: "FDA Orange Book",
    cadence: "monthly",
    fetchedAt: new Date().toISOString(),
    effectiveDate,
    status: "live",
    products,
    equivalents,
  };
}

// ---------------------------------------------------------------------------
// openFDA drug shortages
// ---------------------------------------------------------------------------

// First strength in a text like "Clonazepam, Tablet, .5 mg (NDC ...)" or "90 mcg", in mg. null if none.
function strengthInMg(text: string): number | null {
  const match = /(\d*\.?\d+)\s*(mg|mcg|g)\b/i.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === "mcg" ? amount / 1000 : unit === "g" ? amount * 1000 : amount;
}

type OpenFdaShortage = {
  presentation?: string;
  generic_name?: string;
  status?: string;
  update_date?: string;
  dosage_form?: string;
  company_name?: string;
  openfda?: { generic_name?: string[]; substance_name?: string[] };
};

async function fetchAllShortages(): Promise<OpenFdaShortage[]> {
  const all: OpenFdaShortage[] = [];
  const pageSize = 1000;
  let total = Infinity;
  while (all.length < total) {
    const response = await fetch(`${SHORTAGES_URL}?limit=${pageSize}&skip=${all.length}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60 * 1000),
    });
    if (response.status === 429) throw new Error("openFDA shortages: rate limited (HTTP 429), stopping");
    if (!response.ok) throw new Error(`openFDA shortages: HTTP ${response.status}`);
    const body = (await response.json()) as { meta: { results: { total: number } }; results: OpenFdaShortage[] };
    total = body.meta.results.total;
    if (body.results.length === 0) break;
    all.push(...body.results);
    await sleep(300); // be polite between pages
  }
  return all;
}

async function buildShortages(): Promise<ShortagesCache> {
  console.log(`Shortages: downloading ${SHORTAGES_URL}`);
  const records = await fetchAllShortages();
  if (records.length === 0) throw new Error("openFDA shortages: no records returned");

  const now = new Date();
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);
  const cutoff = threeYearsAgo.toISOString().slice(0, 10);

  const items: Shortage[] = [];
  for (const record of records) {
    // Only real shortages: "Current" and "Resolved". ("To Be Discontinued" is not a shortage.)
    const status = record.status === "Current" ? "current" : record.status === "Resolved" ? "resolved" : null;
    if (!status || !record.update_date) continue;
    const updated = mdyToIso(record.update_date);
    if (status === "resolved" && updated < cutoff) continue; // history window: last 3 years

    const names = [record.generic_name ?? "", ...(record.openfda?.generic_name ?? []), ...(record.openfda?.substance_name ?? [])]
      .join(" ")
      .toLowerCase();
    const isCombination = (record.generic_name ?? "").includes("/"); // e.g. "Quinapril/Hydrochlorothiazide Tablet"
    const recordForm = `${record.dosage_form ?? ""} ${record.generic_name ?? ""}`.toLowerCase();
    for (const drug of TRACKED_DRUGS) {
      if (isCombination || !new RegExp(`\\b${drug.shortageWord}\\b`).test(names)) continue;
      // The dosage form must match too: a tablet is not affected by an injection shortage.
      const formWord = ["tablet", "capsule", "aerosol"].find((word) => drug.form.includes(word));
      if (formWord && !recordForm.includes(formWord)) continue;
      // Same strength too (a 2 mg shortage does not affect the 0.5 mg product).
      // If the record has no readable strength, keep it to be safe.
      const recordMg = strengthInMg(record.presentation ?? "");
      if (recordMg !== null && Math.abs(recordMg - strengthInMg(drug.strength)!) > 1e-6) continue;
      items.push({
        drugKey: drug.drugKey,
        ingredient: drug.name,
        status,
        updated,
        dosageForm: record.dosage_form ?? "",
        company: record.company_name ?? "",
      });
    }
  }
  items.sort((a, b) => a.drugKey.localeCompare(b.drugKey) || b.updated.localeCompare(a.updated));

  const history: ShortagesCache["history"] = {};
  for (const drug of TRACKED_DRUGS) {
    const mine = items.filter((item) => item.drugKey === drug.drugKey);
    history[drug.drugKey] = {
      currentCount: mine.filter((item) => item.status === "current").length,
      last3yCount: mine.filter((item) => item.updated >= cutoff).length,
    };
  }

  // Freshness of the whole feed = newest update_date anywhere in it.
  const newest = records.map((r) => (r.update_date ? mdyToIso(r.update_date) : "")).sort().pop()!;
  return {
    feed: "shortages",
    source: "openFDA drug shortages",
    cadence: "daily",
    fetchedAt: now.toISOString(),
    effectiveDate: newest,
    status: "live",
    items,
    history,
  };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

function cacheFile(feed: FeedName) {
  return path.join(CACHE_DIR, `${feed}.json`);
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file); // swap in only after the whole file is written
}

// Returns true if the feed ended up with a usable cache file (fresh or old).
async function refreshFeed(feed: FeedName, build: () => Promise<unknown>): Promise<boolean> {
  try {
    const fresh = await build(); // each builder throws if its download was empty
    FEED_SCHEMAS[feed].parse(fresh); // make sure the shape is right before saving
    writeJson(cacheFile(feed), fresh);
    console.log(`${feed}: saved fresh data (status "live")`);
    return true;
  } catch (error) {
    console.error(`${feed}: refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    const file = cacheFile(feed);
    if (!fs.existsSync(file)) {
      console.error(`${feed}: no old cache file to fall back on`);
      return false;
    }
    const old = JSON.parse(fs.readFileSync(file, "utf8"));
    writeJson(file, { ...old, status: "cached" }); // keep old data and old fetchedAt
    console.error(`${feed}: kept the old cache file, marked "cached"`);
    return true;
  }
}

async function main() {
  const results = [
    await refreshFeed("nadac", buildNadac),
    await refreshFeed("orangebook", buildOrangeBook),
    await refreshFeed("shortages", buildShortages),
  ];
  if (results.includes(false)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
