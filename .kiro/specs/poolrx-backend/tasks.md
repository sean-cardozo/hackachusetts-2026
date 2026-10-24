# Implementation Plan

## Overview

Backend library, sample data and AI helper route for PharmaPool. Work only in the files named in `design.md`. Do not edit `app/` pages, `components/`, `.kiro/specs/poolrx/`, `lib/feed-types.ts`, `lib/ndc.ts`, `lib/feeds.ts`, `data/cache/` or `scripts/fetch-feeds.ts`, which belong to other people.

## Tasks

- [x] 1. Shared foundation
  - Create `lib/types.ts`, `lib/format.ts` and `lib/store.ts` as described in Requirement 1. Base the types on the data model in `.kiro/specs/poolrx/design.md`. Do not define the Feed Types and do not touch `lib/feed-types.ts`. Add tests in `tests/format.test.ts` and `tests/store.test.ts`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Sample data
  - [x] 2.1 Create `data/sample/drugs.json`, `rounds.json`, `quotes.json` and `upload-demo.json` with the exact values from `.kiro/specs/poolrx/design.md`, after the x6 scale. Include `nadacFallback` and `"kind": "sample"`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 2.2 Create `lib/sample.ts` with Zod validation and `tests/sample.test.ts`, including a check that quote group totals and the Cardio round totals match the design.
    - _Requirements: 2.6, 2.7_

- [x] 3. Calculator
  - [x] 3.1 Create `lib/calc.ts` with the formulas in Requirement 3.1 to 3.9.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.14_
  - [x] 3.2 Add Summary figures: savings split, Savings by step, 24-month series.
    - _Requirements: 3.10_
  - [x] 3.3 Write unit tests with the numbers from the design and fast-check property tests for the range, order-independence and monotonicity properties.
    - _Requirements: 3.11, 3.12, 3.13_

- [x] 4. Upload matcher
  - [x] 4.1 Create `lib/match.ts` with CSV parsing (Papaparse), column mapping with confidence, and drug-name matching with statuses and suggestions.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 4.9, 4.10_
  - [x] 4.2 Write `tests/match.test.ts` using the demo headers and the demo names from Requirement 4.6.
    - _Requirements: 4.6_

- [x] 5. AI service
  - [x] 5.1 Create `lib/ai.ts` with the AI call wrapper (15 second timeout, Zod validation) and the five fallbacks, using `lib/calc.ts` and `lib/match.ts`.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [x] 5.2 Create `app/api/ai/[task]/route.ts` and `tests/ai.test.ts` that runs without a key and checks every task returns a Fallback result, and that invalid bodies return 400.
    - _Requirements: 5.1, 5.9_

- [x] 6. Run notes
  - Create `.env.example` and `docs/BACKEND.md`. Run `npx vitest --run`, `npx tsc --noEmit` and `npm run build` and fix any problems in files owned by this spec.
  - _Requirements: 6.1, 6.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2"] },
    { "id": 3, "tasks": ["3.3", "5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["6"] }
  ]
}
```

## Notes

- All numbers and formulas come from `.kiro/specs/poolrx/design.md`.
- Tasks in the same wave touch different files and can run in parallel.
- Do not run `git commit` or `git push`.
- No real API keys in any file. Keys go only in `.env`.
