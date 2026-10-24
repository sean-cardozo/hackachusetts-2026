# PharmaPool backend

## What the backend is

The backend is the part of PharmaPool with no screens. It is a set of small TypeScript files in `lib/`, some sample data in `data/sample/`, and one API route for AI help. The screens call these files to get every number they show.

Two rules to remember:

- Every figure is computed in one place (`lib/calc.ts`). Screens do not do their own math.
- A figure that cannot be computed comes back as `null`, never `NaN` or `Infinity`. Show "n/a" when you get `null`.

The rules and numbers come from `.kiro/specs/poolrx/design.md`. The requirements for this part are in `.kiro/specs/poolrx-backend/`.

## Modules

| File | Exports | What it does |
| --- | --- | --- |
| `lib/types.ts` | Types: `Supplier`, `Drug`, `RoundStatus`, `Round`, `Quote`, `SupplierScore`, `StandardField`, `ConfidenceLabel`, `ColumnMapping`, `UploadRow`, `MatchStatus`, `DrugMatch`, `AiTask`, `AiResult`, `SwapDecision`, `OptIn`, `AwardDecision`, `StoreState` | Shared data shapes. No code. The live-feed types are NOT here (they are in `lib/feed-types.ts`). |
| `lib/format.ts` | `formatDollars`, `formatPercent`, `formatSavings` | Turn numbers into text, for example `formatSavings(23300, 11.2)` gives "$23.3k/yr (11.2%)". No colors. |
| `lib/store.ts` | `STORE_KEY`, `Store` (interface), `defaultState`, `parseState`, `createMemoryStore`, `createLocalStore` | Saves approved swaps, opt-ins and the award decision. Uses localStorage, or memory when localStorage is not available. A stored value that cannot be read is ignored and the default state is used. |
| `lib/sample.ts` | `SampleError`, `drugsFileSchema`, `roundsFileSchema`, `quotesFileSchema`, `uploadDemoFileSchema`, `SAMPLE_FILES`, `parseDrugs`, `parseRounds`, `parseQuotes`, `parseUploadDemo`, `loadDrugs`, `loadRounds`, `loadQuotes`, `loadUploadDemo`, `loadSample`, plus types (`SwapExtra`, `DrugsFile`, `RoundsFile`, `QuotesFile`, `UploadDemoFile`, `SampleData`) | Loads the files in `data/sample/` and checks them with Zod. A bad file throws a `SampleError` that names the file and the field. |
| `lib/calc.ts` | `annualSpend`, `benchmarkSpend`, `gapPct`, `savingsRange`, `daysOfSupply`, `shortageRisk`, `recommendedCommitment`, `scoreSuppliers`, `roundProgress`, `projectedProgress`, `statusAfterOptIn`, `atRisk`, `summaryFigures`, `savingsByStep`, `savingsRamp`, `monthlySeries`, constants (`SAVINGS_LOW_RATE`, `SAVINGS_HIGH_RATE`, `DEFAULT_WEIGHTS`, `BRAND_PCT_RANGE`, `OTC_PCT_RANGE`, `MAX_SERIES_MONTHS`) | All the numbers: spend, NADAC gap, savings range, days of supply, shortage risk, how much to commit, supplier scores, round progress, at-risk check, Summary figures, savings by step and the 24-month chart series. `monthlySeries` builds at most 120 months (larger `months` values are capped). |
| `lib/match.ts` | `MAX_DATA_ROWS`, `MAX_FILE_BYTES`, `parseUpload`, `mapColumns`, `toUploadRows`, `matchDrugs`, types (`CatalogDrug`, `RawRow`, `UploadParseResult`) | Reads an uploaded CSV (Papaparse), maps messy column names to standard fields with a confidence, and matches drug names to the catalog as matched, needs review or unmatched. Rejects files over 10,000 rows or 10 MB. Never calls the network. |
| `lib/ai.ts` | `AI_TASKS`, `isAiTask`, `AI_TIMEOUT_MS`, `DEFAULT_AI_ENDPOINT`, `MAX_AI_DRUG_ROWS`, `AiInputError`, input and output Zod schemas (`aiInputSchemas`, `aiOutputSchemas`, `aiResultSchema`, ...), `stripSensitive`, `fallbackColumnMap`, `fallbackDrugMatch`, `fallbackSupplierReason`, `fallbackRfq`, `fallbackAsk`, `runAiTask` | `runAiTask(task, input)` always returns a valid result. It calls the AI model when a key is set, and uses the rule-based fallback otherwise or when the call fails or takes more than 15 seconds. |
| `app/api/ai/[task]/route.ts` | `POST`, `runtime`, `dynamic` | The HTTP route `POST /api/ai/<task>`. Wraps `runAiTask` and turns bad input into HTTP 400. |

## Sample data

The files in `data/sample/` are made-up data for the demo, so every screen has numbers without an upload.

| File | Content |
| --- | --- |
| `drugs.json` | The 10 sample drugs: id, name, strength, form, category, manufacturer, units per month, price paid, units on hand, count date, shortage flag and `nadacFallback`. |
| `rounds.json` | The five buying rounds (Cardio open, Antibiotics and respiratory target reached, Diabetes and thyroid with quotes, Mental health and GI awarded, Pain and neuro closed). |
| `quotes.json` | The three supplier quotes (A, B, C), the group demand, your share and the default weights. |
| `upload-demo.json` | The messy demo upload (headers like "Drug Desc", "Qty/Mo", "Cost Ea") used for the matching demo. |

Every file has the top-level field `"kind": "sample"`, so screens can show the Sample badge. Units per month and units on hand are the design values multiplied by 6.

Load them with `lib/sample.ts`:

```ts
import { loadSample } from "@/lib/sample";
const { drugs, rounds, quotes, uploadDemo } = loadSample();
```

## AI route

`POST /api/ai/<task>` with a JSON body. The five tasks are `column-map`, `drug-match`, `supplier-reason`, `rfq` and `ask`.

Start the app first (`npm run dev`), then try these.

column-map (map messy headers to standard fields):

```bash
curl -s -X POST http://localhost:3000/api/ai/column-map \
  -H "Content-Type: application/json" \
  -d '{"headers":["Drug Desc","Str.","NDC#","Pkg Sz","Qty/Mo","Cost Ea","Vendor","Notes"]}'
```

drug-match (match uploaded names to the catalog):

```bash
curl -s -X POST http://localhost:3000/api/ai/drug-match \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"rowIndex":0,"drugName":"Atorvastatn 20mg tab"},{"rowIndex":1,"drugName":"Lisinipril 10 MG"}],"catalog":[{"id":"atorvastatin-20","name":"Atorvastatin","strength":"20 mg","form":"Tablet"},{"id":"lisinopril-10","name":"Lisinopril","strength":"10 mg","form":"Tablet"}]}'
```

supplier-reason (a two-sentence reason for the best supplier):

```bash
curl -s -X POST http://localhost:3000/api/ai/supplier-reason \
  -H "Content-Type: application/json" \
  -d '{"quotes":[{"supplier":"A","prices":{"metformin-500":0.0182,"levothyroxine-50":0.104},"deliveryDays":9,"minOrder":15000,"reliability":62,"quotedPct":12.9},{"supplier":"B","prices":{"metformin-500":0.0186,"levothyroxine-50":0.1061},"deliveryDays":5,"minOrder":9000,"reliability":96,"quotedPct":11.2}],"demand":{"metformin-500":2520000,"levothyroxine-50":1116000},"weights":{"price":50,"delivery":20,"reliability":30}}'
```

rfq (a request-for-quote text with no pharmacy name, price or stock level):

```bash
curl -s -X POST http://localhost:3000/api/ai/rfq \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product":"Metformin 500 mg","units":2520000},{"product":"Levothyroxine 50 mcg","units":1116000}],"pharmacies":12,"region":"Massachusetts","cadence":"weekly"}'
```

ask (a question answered only from the data you send):

```bash
curl -s -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is my atorvastatin price high?","context":{"drugs":[{"id":"atorvastatin-20","drugName":"Atorvastatin","strength":"20 mg","paid":0.12,"unitsPerMonth":3000,"onHand":1500}],"benchmarks":[{"drugId":"atorvastatin-20","nadac":0.09}],"sources":{"drugs":"Sample member data","benchmarks":"CMS NADAC, effective 2026-10-22"}}}'
```

### Response shape

Every task returns the same shape:

```json
{
  "task": "rfq",
  "result": { "text": "..." },
  "confidence": 90,
  "source": "fallback",
  "sourceNote": "Rule-based result (no AI model was used)."
}
```

- `task`: the task name.
- `result`: depends on the task. `column-map` gives a list of column mappings, `drug-match` a list of matches (with suggestions), `supplier-reason` an object with `supplier`, `reason` and `scores`, `rfq` an object with `text`, and `ask` an object with `answer` and `sources`.
- `confidence`: a number from 0 to 100.
- `source`: `"ai"` when the model answered, `"fallback"` otherwise.
- `sourceNote`: plain words on where the answer came from or why the fallback was used.

Errors: an unknown task gives 404, a body that is not JSON or does not match the task gives 400 with `{ "error": "...", "issues": [...] }`, and a body over 1 MB gives 413.

### The app works with no AI key

If there is no AI key, or the AI call fails, times out (15 seconds) or returns something invalid, the route returns the rule-based fallback with `source: "fallback"`. Nothing breaks, and the demo works with no key at all.

To turn the AI on, copy the template and fill it in:

```bash
cp .env.example .env
```

Then edit `.env` (it is gitignored, so it is never committed):

```
AI_API_KEY=your-key-here
AI_MODEL=a-model-id-from-your-provider
# AI_BASE_URL is optional
```

Both `AI_API_KEY` and `AI_MODEL` must be set for the model to be called. The key is read on the server only. It is never returned, logged or sent to the browser. Restart `npm run dev` after changing `.env`. Real keys go ONLY in `.env`, never in `.env.example`.

## How NADAC gets to the calculator

The calculator never reads files or the network. You pass NADAC in. For now, each drug in `data/sample/drugs.json` has a `nadacFallback` value (the NADAC price from the design), and screens pass that to the calculator:

```ts
import { benchmarkSpend, gapPct } from "@/lib/calc";
const benchmark = benchmarkSpend(drug.nadacFallback, drug.unitsPerMonth);
const gap = gapPct(drug.paid, drug.nadacFallback);
```

`nadacFallback` is used only when the live NADAC cache is missing. Once the live cache from the data agent exists, pass the live value first and fall back to `nadacFallback`. If NADAC is 0 or missing, the calculator returns `null`.

## What is NOT here

- Screens and components: built by the UI teammate (`app/` pages and `components/`).
- Live feeds, the NDC normalizer and the cache: built by the data agent (`lib/feed-types.ts`, `lib/ndc.ts`, `lib/feeds.ts`, `scripts/`, `data/cache/`, `app/api/feeds/`).

## Commands

```bash
npm install            # install packages
npm test               # run all tests (vitest --run)
npx tsc --noEmit       # type check
npm run build          # production build
npm run dev            # start the app on http://localhost:3000
```

## Known data note

The numbers in the sample data are the design values after the x6 scale, and two of them differ from the text in the design:

- The 10 sample drugs add up to $899,849 a year (price paid x units per month x 12). The design text says about $920k.
- The Cardio round progress in the sample data is 5,650,000 of 6,000,000 units (94.2%). The design text also says 91% and 942,000 of 1,000,000 units (942,000 x 6 would be 5,652,000).

The sample data uses the scaled values. If the design is updated, change the files in `data/sample/` and the tests in `tests/sample.test.ts`.
