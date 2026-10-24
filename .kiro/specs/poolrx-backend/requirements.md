# Requirements Document

## Introduction

This spec covers the backend library and data layer of PharmaPool. It serves the screens designed in `.kiro/specs/poolrx/` and does not change them. The screens, components and the live government data feeds are built by other people and are out of scope here. This spec delivers shared types, formatting helpers, sample data, the calculations behind every number on screen, upload matching, and AI helper routes that always have a rule-based fallback.

Source of truth for rules and numbers: `.kiro/specs/poolrx/design.md` (calculations, data model and sample data) and `.kiro/specs/poolrx/requirements.md`. If this spec and that one disagree, that one wins.

## Glossary

- **System**: The PharmaPool backend library (`lib/`), sample data (`data/sample/`) and AI routes (`app/api/ai/`).
- **Calculator**: The module `lib/calc.ts` that computes the numbers shown on screen.
- **Sample Data**: Synthetic member, inventory, round and supplier data stored in `data/sample/`.
- **Matcher**: The module `lib/match.ts` that maps uploaded columns and matches uploaded drug names.
- **AI Service**: The route `app/api/ai/[task]/route.ts` and its helper module `lib/ai.ts`.
- **Fallback**: The rule-based result the System returns when no AI key is set or an AI call fails.
- **Confidence Label**: High for a confidence of 90 or more, Medium for 80 to 89, Low for under 80.
- **Feed Types**: The types `Benchmark`, `Equivalent`, `Shortage` and `FeedStatus`, which live in `lib/feed-types.ts` and are owned by the live-data work.

## Requirements

### Requirement 1: Shared Types, Formatting and Store

**User Story:** As a developer building screens, I want shared types and helpers, so that screens and logic agree on data shapes.

#### Acceptance Criteria

1. THE System SHALL export from `lib/types.ts` the types `Drug`, `Round`, `RoundStatus`, `Quote`, `SupplierScore`, `UploadRow`, `ColumnMapping`, `DrugMatch`, `MatchStatus`, `AiResult`, `SwapDecision` and `OptIn`, following the data model in `.kiro/specs/poolrx/design.md`.
2. THE System SHALL NOT define the Feed Types in `lib/types.ts`, and SHALL NOT edit `lib/feed-types.ts`.
3. THE System SHALL export from `lib/format.ts` functions that format dollars, percentages and savings pairs, including the pattern "$23.3k/yr (11.2%)", with tabular-friendly output and no color information.
4. THE System SHALL export from `lib/store.ts` a `Store` interface and a localStorage implementation that persists approved swaps, opt-ins and the award decision, and that falls back to in-memory storage when localStorage is unavailable.
5. IF a stored value cannot be parsed, THEN THE Store SHALL ignore the stored value and return the default state.

### Requirement 2: Sample Data

**User Story:** As a demo user, I want realistic example data, so that every screen shows numbers without an upload.

#### Acceptance Criteria

1. THE System SHALL store in `data/sample/` JSON files for the 10 drugs, the rounds, the supplier quotes and the upload demo rows, using the values in `.kiro/specs/poolrx/design.md` after applying the stated scale factor of 6 to units per month and on-hand values.
2. THE System SHALL store for each drug the id, name, strength, form, category, manufacturer, units per month, price paid, units on hand, count date and a flag for the sample shortage.
3. THE System SHALL store for each drug a `nadacFallback` value equal to the NADAC value in the design table, and SHALL document that the value is used only when the live NADAC cache is missing.
4. THE System SHALL include the five rounds and their states described in the design (Cardio open, Antibiotics and respiratory target reached, Diabetes and thyroid with quotes, Mental health and GI awarded, Pain and neuro closed) and the At risk and Target missed examples from the Spend mix section.
5. THE System SHALL label every file with a top-level field `"kind": "sample"` so that screens can show the Sample badge.
6. THE System SHALL provide a loader module `lib/sample.ts` that validates every sample file with Zod and returns typed data.
7. IF a sample file fails validation, THEN THE Loader SHALL throw an error naming the file and the failing field.

### Requirement 3: Calculator

**User Story:** As a developer building screens, I want one tested module for every number, so that the screens show consistent figures.

#### Acceptance Criteria

1. THE Calculator SHALL compute annual spend as unit price paid × units per month × 12.
2. THE Calculator SHALL compute benchmark spend as NADAC × units per month × 12 and the gap percentage as (paid − NADAC) ÷ NADAC × 100.
3. THE Calculator SHALL compute the estimated savings range as the larger of 0 and (spend − benchmark spend) multiplied by 0.50 for the low value and 0.85 for the high value, plus approved swap extras.
4. THE Calculator SHALL compute days of supply as units on hand ÷ (units per month ÷ 30), rounded to the nearest whole number.
5. THE Calculator SHALL compute shortage risk as High when the drug has an FDA shortage and days of supply is under 14, Watch when the drug has an FDA shortage, and Low otherwise.
6. THE Calculator SHALL compute the recommended commitment as 3 × units per month − the larger of 0 and (units on hand − units per month).
7. THE Calculator SHALL compute supplier scores using price = minimum total ÷ total × 100, delivery = 100 − (delivery days − 3) × 8, and a reliability score given in the quote, with the total equal to Σ(weight × score) ÷ Σweights, and default weights of price 50, delivery 20 and reliability 30.
8. THE Calculator SHALL compute round progress as committed units ÷ target units, the projected progress after an opt-in, and the status "target reached" when the projected progress is 100 percent or more.
9. THE Calculator SHALL compute, for a round that is on pace to miss, the status "At risk" with the projected percentage at close and the number of additional pharmacies needed, using the values in the design.
10. THE Calculator SHALL compute the Summary figures: total savings range in dollars and percent, the split between Generics, Brand and OTC and supplies using the Spend mix section, the Savings by step values for Compare, Swap and Join, and the 24-month series (12 actual, 12 projected without and with PharmaPool) using the chart rule in the design.
11. FOR ALL inputs, THE Calculator SHALL return a savings range whose low value is less than or equal to its high value and whose values are never negative (range property).
12. FOR ALL inputs with the same weights, THE Calculator SHALL return supplier totals that stay between 0 and 100 and that rank the same supplier first when the input order changes (order independence property).
13. FOR ALL drugs, a larger units-on-hand value with the same usage SHALL never reduce days of supply (monotonicity property).
14. IF units per month is 0 or NADAC is 0 or missing, THEN THE Calculator SHALL return a defined "not available" result for the affected figure and SHALL NOT return NaN or Infinity.

### Requirement 4: Upload Matching

**User Story:** As a pharmacy owner, I want messy files cleaned and matched, so that I do not retype my data.

#### Acceptance Criteria

1. WHEN a CSV file is uploaded, THE Matcher SHALL parse it with Papaparse and map each column to a standard field (drug name, strength, NDC, package size, units per month, price paid, wholesaler, units on hand, count date, expiration date) with a confidence percentage and a Confidence Label.
2. THE Matcher SHALL map column names by comparing normalized header text against known synonyms, including the demo headers "Drug Desc", "Str.", "NDC#", "Pkg Sz", "Qty/Mo", "Cost Ea", "Vendor" and "Notes".
3. THE Matcher SHALL match each drug row to a catalog drug and assign the status matched, needs review or unmatched, with a confidence percentage, the original text and the corrected name.
4. THE Matcher SHALL assign matched for a confidence of 90 or more, needs review for 80 to 89 or for a brand name that maps to a generic ingredient, and unmatched otherwise.
5. THE Matcher SHALL return, for a row that needs review, up to 3 suggestions ordered by confidence.
6. THE Matcher SHALL match the demo names as follows: "Atorvastatn 20mg tab" and "Lisinipril 10 MG" as matched, "Levoxyl 50mcg" and "Gaba 300" as needs review, and "Vit D3 2000IU" as unmatched.
7. WHEN an NDC is present in a row and exists in the catalog, THE Matcher SHALL assign matched with a confidence of 100.
8. IF a file cannot be parsed or has no data rows, THEN THE Matcher SHALL return an error that names the file and says how to fix it.
9. IF the file has more than 10,000 data rows or is larger than 10 MB, THEN THE Matcher SHALL reject the file and state the limit.
10. THE Matcher SHALL NOT call the network.

### Requirement 5: AI Service

**User Story:** As a pharmacy owner, I want AI help that never breaks the app, so that the demo works with or without an AI key.

#### Acceptance Criteria

1. THE AI Service SHALL expose `POST /api/ai/[task]` for the tasks `column-map`, `drug-match`, `supplier-reason`, `rfq` and `ask`.
2. THE AI Service SHALL return structured JSON with the fields `task`, `result`, `confidence`, `source` and `sourceNote`, where `source` is "ai" or "fallback".
3. WHERE the environment variable `AI_API_KEY` is set, THE AI Service SHALL call the configured AI model and validate the response with Zod.
4. IF no AI key is set, or the AI call fails, times out after 15 seconds, or returns an invalid response, THEN THE AI Service SHALL return the Fallback result with `source` equal to "fallback".
5. THE Fallback for `column-map` and `drug-match` SHALL use the Matcher, the Fallback for `supplier-reason` SHALL use the Calculator and produce a two-sentence reason naming the best supplier, and the Fallback for `rfq` SHALL fill a fixed text template.
6. THE Fallback and the AI answer for `ask` SHALL use only the data sent in the request, SHALL cite the source of each figure, and SHALL say that it cannot answer when the data does not contain the answer.
7. THE `rfq` task SHALL produce text that contains combined demand by product, the number of pharmacies, the region Massachusetts and the delivery cadence, and SHALL NOT contain any pharmacy name, price or stock level.
8. THE AI Service SHALL read the API key only on the server, SHALL NOT return the key or log it, and SHALL NOT send pharmacy names or patient data to the AI model.
9. IF the request body is invalid, THEN THE AI Service SHALL return HTTP status 400 with an error message.

### Requirement 6: Run Notes

**User Story:** As a teammate, I want clear run instructions, so that I can start the project fast.

#### Acceptance Criteria

1. THE System SHALL provide a `.env.example` file that lists `AI_API_KEY` and `AI_MODEL` with empty values and a comment that real keys go only in `.env`.
2. THE System SHALL provide a file `docs/BACKEND.md` that lists each backend module, its exported functions, the sample data files, the AI routes, and the commands to run the tests and the app.
