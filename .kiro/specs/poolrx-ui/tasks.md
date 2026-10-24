# Implementation Plan

## Overview

Build the PharmaPool screens in waves. Wave 0 builds the shell and the data layer in parallel. Wave 1 builds the five main pages in parallel, each in its own folders. Wave 2 builds the remaining pages and the quality pass. Do not change the product design; follow `.kiro/specs/poolrx/`, `.kiro/steering/` and `reference/PharmaPool.dc.html`. Do not edit `lib/calc.ts`, `lib/match.ts`, `lib/ai.ts`, `lib/sample.ts`, `lib/store.ts`, `lib/types.ts`, `lib/feed-types.ts`, `lib/ndc.ts`, `lib/feeds.ts`, `data/` or `scripts/` unless a task says so.

## Tasks

- [ ] 1. Foundation
  - [x] 1.1 Theme, shell and primitives: Tailwind tokens, fonts, globals, root layout, Header with tabs and drips, Footer, FreshnessChip, LiveBadge, SampleBadge, SourceTip, GapPill, RiskPill, StatCard, HeroNumber, StateViews, Toast, and placeholder pages for summary, compare, swap, join, upload and sources under `app/(app)/`, with `/` redirecting to `/summary`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 1.2 Data layer and App State: `lib/data.ts`, `components/AppState.tsx`, and `tests/data.test.ts`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Main pages
  - [x] 2.1 Summary page with savings hero, spend mix, monthly chart, Savings by step and Key recommendations.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.2 Compare page with category table, drug drawer and Next step actions.
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 2.3 Swap page with approve, undo and Approve all.
    - _Requirements: 5.1, 5.2_
  - [x] 2.4 Join page with round cards, opt-in dialog and Award section.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 2.5 Upload page with demo file, column mapping and drug matching.
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 3. Remaining pages and quality
  - [x] 3.1 Data sources page and the floating Ask PharmaPool panel.
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 3.2 Quality pass: render tests for every page, accessibility fixes, and make build, lint, tsc and all tests pass.
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 4. Visual identity update (Nathan's new design in reference/PharmaPool.dc.html, BRIEF.md and HANDOFF.md)
  - [ ] 4.1 Re-skin the app to the new identity: navy left sidebar with the 4 tabs, Upload data and Data sources, plus a link to the new Award page; sticky top bar with search, freshness chip and pharmacy name; white workspace; green-teal accent; Plus Jakarta Sans and JetBrains Mono; update tokens, shared classes, primitives, charts and hard-coded colors; rewrite `.kiro/steering/theme.md` and update `.kiro/steering/product.md` to match.
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 4.2 Award (review and submit) page at `/award`: every action from Compare, Swap and Join (approved swaps, opt-ins, award decision) is listed in a review queue with the count shown as a badge in the sidebar, then submitted at once.
    - _Requirements: 5.1, 6.1_

- [x] 5. Automatic mapping for the store-001 invoice export
  - [x] 5.1 Auto-map and auto-match the store-001 invoice-line export end to end: extend the column synonyms and standard fields for its 19 columns, aggregate invoice lines into per-product monthly units and price per unit, auto-apply the mapping and matching on the Upload page with no manual selecting by default, and show the results against the NADAC benchmark.
    - _Requirements: 7.1, 7.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["5.1"] }
  ]
}
```

## Notes

- Follow the Prototype for look and flow. Do not add, remove or rename tabs, copy or flows.
- Do not run `git commit` or `git push`.
- Tasks in the same wave touch different files and can run in parallel. Each page task writes only its own `app/(app)/<page>/` folder and `components/<page>/` folder.
- Keep the demo path working: Summary, Compare (atorvastatin above NADAC), Swap (approve 3), Join (opt in, Cardio crosses target), Award (accept Supplier B).
