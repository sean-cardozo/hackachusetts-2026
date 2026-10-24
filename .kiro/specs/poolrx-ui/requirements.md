# Requirements Document

## Introduction

This spec builds the PharmaPool screens as a Next.js 14 App Router app. It does not change the product design. The design is fixed by Nathan's files: `.kiro/specs/poolrx/` (requirements R1 to R15, design, tasks), `.kiro/steering/` (product, theme, tech), `BRIEF.md`, `HANDOFF.md` and the clickable prototype `reference/PharmaPool.dc.html`. When this spec and those files disagree, those files win. Screens read data only through `lib/data.ts` and `lib/calc.ts`, and show demo state through `lib/store.ts`.

## Glossary

- **App**: The PharmaPool Next.js application.
- **Data Layer**: The module `lib/data.ts` that combines sample data, the live feed cache and the calculator into view models for screens.
- **Primitives**: Small shared components such as LiveBadge, SampleBadge, SourceTip, GapPill, RiskPill, StatCard, HeroNumber, StateViews and Toast.
- **App State**: A client context that holds approved swaps, opt-ins and the award decision using `lib/store.ts`.
- **Prototype**: `reference/PharmaPool.dc.html`, the visual and flow reference.

## Requirements

### Requirement 1: Shell, Theme and Primitives

**User Story:** As an owner, I want a consistent look and clear data labels on every page, so that I can trust what I see.

#### Acceptance Criteria

1. THE App SHALL implement the shell, tabs, header utilities, footer and freshness chip described in R1 of `.kiro/specs/poolrx/requirements.md`.
2. THE App SHALL implement the theme tokens, fonts and signature details in `.kiro/steering/theme.md`, light theme only.
3. THE App SHALL provide the Primitives so that every Live value carries LiveBadge, every Sample value carries SampleBadge, and every benchmark value has a SourceTip with source and effective date (R2).
4. THE App SHALL show above or below benchmark with an arrow and a word as well as color (R2.3).
5. THE App SHALL provide empty, loading, error and success states for every tab (R11).

### Requirement 2: Data Layer and App State

**User Story:** As a developer, I want one place that combines all data, so that screens show the same numbers.

#### Acceptance Criteria

1. THE Data Layer SHALL build one view model per sample drug with NADAC, gap percent, annual spend, savings range, days of supply, shortage risk, recommended commitment and equivalents, using `lib/calc.ts`.
2. THE Data Layer SHALL use the NADAC value from the cache file `data/cache/nadac.json` and SHALL use `nadacFallback` when the cache has no value for the drug, and SHALL record which source was used.
3. THE Data Layer SHALL read shortages from `data/cache/shortages.json` and equivalents from `data/cache/orangebook.json`, and SHALL use the sample flag `hasShortage` only when the cache has no record, labeled Sample.
4. THE Data Layer SHALL expose rounds, quotes, swap extras and feed status (fetchedAt, effectiveDate, live or cached).
5. THE App State SHALL persist approved swaps, opt-ins and the award decision with `lib/store.ts` and SHALL update every screen that shows savings when they change.

### Requirement 3: Summary Page

**User Story:** As an owner, I want to see my total savings and the next steps first, so that I know where to act.

#### Acceptance Criteria

1. THE App SHALL implement the Summary page as described in R4, R12 and R13 and the Summary layout in `.kiro/specs/poolrx/design.md`.
2. THE Summary SHALL show every savings figure in both dollars and percent.
3. WHEN swaps are approved, THE Summary SHALL increase the estimate and show "Includes $X from approved swaps."
4. WHEN the award is accepted, THE Summary headline SHALL animate from the estimated range to the quoted figure.

### Requirement 4: Compare Page

**User Story:** As an owner, I want to see each drug against the benchmark, so that I can find where I overpay.

#### Acceptance Criteria

1. THE App SHALL implement the Compare page, category table, drug drawer and Next step actions as described in R6 and R15.
2. THE Drawer SHALL show a 12-month price chart (labeled Sample for my price and Live for NADAC), usage bars, days of supply, shortage status and equivalents with a Swap button.
3. WHEN a drug has a current shortage and fewer than 14 days of supply, THE App SHALL show the red alert banner with role alert.

### Requirement 5: Swap Page

**User Story:** As an owner, I want to approve equivalent products, so that I can join a round.

#### Acceptance Criteria

1. THE App SHALL implement the Swap page as described in R7, with approve, undo and Approve all, and the copy "You approve every swap before it's used."
2. WHEN a swap is approved or undone, THE App State SHALL update and the Join page SHALL show the effect on round progress.

### Requirement 6: Join Page and Award

**User Story:** As an owner, I want to join buying rounds and accept the best supplier, so that I get the group price.

#### Acceptance Criteria

1. THE App SHALL implement round cards in all states (open, at risk, target reached with a 48 hour confirm countdown, quotes, awarded, target missed, closed), the opt-in dialog and the Award section as described in R5, R8 and R14.
2. THE Opt-in dialog SHALL pre-fill each commitment using `recommendedCommitment` from `lib/calc.ts` and SHALL show projected progress from and to percent.
3. WHEN an opt-in pushes the Cardio round to 100 percent or more, THE round SHALL switch to target reached with a 48 hour confirm countdown.
4. THE Award section SHALL show the supplier cards, scores from `scoreSuppliers`, adjustable weight sliders that re-rank live, a recommendation, accept and choose another, and the supplier view toggle.
5. THE Join page SHALL call `/api/ai/supplier-reason` and `/api/ai/rfq` for the recommendation text and the request text, and SHALL show the returned text with the source note.

### Requirement 7: Upload Page

**User Story:** As an owner, I want to upload my file and see it cleaned and matched, so that the comparison uses my data.

#### Acceptance Criteria

1. THE App SHALL implement the two-step Upload page as described in R3, using `parseUpload`, `mapColumns`, `toUploadRows` and `matchDrugs` from `lib/match.ts`.
2. THE Upload page SHALL provide a "Use demo file" action that loads `data/sample/upload-demo.json`.
3. THE Upload page SHALL show the column mapping with confidence labels, the matching table with matched, needs review and unmatched rows, suggestions, and the privacy statement verbatim from BRIEF.md.
4. IF a file cannot be parsed, THEN THE Upload page SHALL show the error message returned by the Matcher.

### Requirement 8: Data Sources and Ask PharmaPool

**User Story:** As an owner, I want to see where data comes from and ask questions about my data.

#### Acceptance Criteria

1. THE App SHALL implement the Data sources page as described in R9 using the feed status from the Data Layer.
2. THE App SHALL implement the floating Ask PharmaPool button and panel as described in R10, calling `/api/ai/ask` with context built from the Data Layer and its sources map.
3. THE Ask panel SHALL show the source note ("AI" or "Rule-based") with each answer.

### Requirement 9: Quality

**User Story:** As a team, I want the app to build and be checked, so that the demo does not break.

#### Acceptance Criteria

1. THE App SHALL pass `npm run build`, `npm run lint` and `npx tsc --noEmit`.
2. THE App SHALL have a render test for each page and for the main components using Vitest, and all tests SHALL pass.
3. THE App SHALL be keyboard reachable with visible focus (orange outline), with focus trapped in the drawer and dialogs.
