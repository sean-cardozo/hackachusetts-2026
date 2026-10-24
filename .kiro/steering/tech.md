---
inclusion: always
---
# Tech steering

- **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind (map tokens from theme.md into `tailwind.config` as CSS vars) + Recharts for the price chart. Zod for parsing. SheetJS (`xlsx`) + Papaparse for uploads.
- **State:** server components for data fetch; client components for interactions. Persist demo state (swaps, opt-ins, award) in localStorage for the hackathon; keep a `lib/store.ts` interface so it can move to a DB.
- **Data feeds (Live):**
  - CMS NADAC — data.medicaid.gov NADAC dataset (weekly). Key by NDC; take the latest effective date.
  - FDA Orange Book — monthly products file (`products.txt`), use `TE_Code` for equivalence (AB, AB1…). Match on ingredient + strength + dosage form.
  - openFDA drug shortages — `https://api.fda.gov/drug/shortages.json` (daily).
  - Cache each feed in `/data/cache/*.json` with `fetchedAt` + `effectiveDate`. On failure serve cache and mark status "cached".
- **AI:** column mapping, drug-name matching, supplier recommendation reason, RFQ text and Ask PharmaPool via an LLM API route (`/api/ai/*`). Always return structured JSON with confidence; UI shows confidence labels (High ≥90, Medium 80–89, Low <80).
- **Sample data:** `/data/sample/*.json` — synthetic member history, inventory, other pharmacies' commitments, supplier quotes. Everything from here renders a Sample badge.
- **Structure:**
  ```
  app/(app)/summary|compare|swap|join|upload|sources/page.tsx
  app/api/feeds/[feed]/route.ts   app/api/ai/[task]/route.ts
  components/ (Header, FreshnessChip, LiveBadge, SampleBadge, SourceTip, GapPill, RiskPill, StatCard, HeroNumber, CategoryTable, DrugDrawer, SwapCard, RoundCard, OptInDialog, SupplierCard, ScoreBreakdown, SupplierViewToggle, UploadStep, MappingTable, MatchTable, AskPanel, StateViews)
  lib/ (calc.ts, feeds.ts, match.ts, store.ts, format.ts)
  ```
- **Accessibility:** WCAG AA contrast, keyboard-reachable drawer/dialogs with focus trap, `role="alert"` on shortage banner, `aria-live` on countdowns at minute granularity.
