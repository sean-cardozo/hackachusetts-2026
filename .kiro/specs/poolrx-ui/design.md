# Design Document

## Overview

Next.js 14 App Router, TypeScript, Tailwind with CSS variables from `.kiro/steering/theme.md`, Recharts for charts. Server components fetch data through `lib/data.ts`; client components handle interaction and App State. The visual and flow reference is `reference/PharmaPool.dc.html`. Existing backend modules in `lib/` are reused and are not edited by UI tasks.

## Architecture

```mermaid
graph TD
    PAGES[app/(app)/summary compare swap join upload sources] --> COMP[components/*]
    PAGES --> DATA[lib/data.ts]
    COMP --> STATE[components/AppState.tsx]
    STATE --> STORE[lib/store.ts]
    DATA --> CALC[lib/calc.ts]
    DATA --> SAMPLE[lib/sample.ts]
    DATA --> CACHE[data/cache/*.json]
    COMP --> MATCH[lib/match.ts]
    COMP --> AIAPI[app/api/ai/task]
    AIAPI --> AI[lib/ai.ts]
```

## Components and Interfaces

- `lib/data.ts`: `getDrugViews()`, `getRounds()`, `getQuotes()`, `getFeedStatus()`, `getSwapOptions()`, `getAskContext()`. Server-safe and pure. Returns plain JSON-serializable objects.
- `components/AppState.tsx`: client context provider and `useAppState()` hook around `Store`.
- Primitives in `components/`: Header, Footer, FreshnessChip, LiveBadge, SampleBadge, SourceTip, GapPill, RiskPill, StatCard, HeroNumber, StateViews, Toast, AskPanel.
- Page folders under `app/(app)/`: `summary`, `compare`, `swap`, `join`, `upload`, `sources`. Each page owns its own components in `components/<page>/`.

## Data Models

View models extend the `Drug` type from `lib/types.ts` with benchmark fields (`nadac`, `nadacSource`, `gapPct`, `annualSpend`, `savings`, `daysOfSupply`, `shortageRisk`, `recommendedCommitment`, `equivalents`, `shortage`). Feed types come from `lib/feed-types.ts`.

## Correctness Properties

### Property 1: Savings consistency
For all approved swap sets, the Summary total equals the sum of the Savings by step cards and every figure shows dollars and percent. **Validates: Requirements 3.2**

### Property 2: No unlabeled prices
For all rendered pages, every price or savings value is accompanied by a Live or Sample label. **Validates: Requirements 1.3**

## Error Handling

Each page implements loading, empty and error states with `StateViews`. API calls to `/api/ai/*` show the returned source note and fall back to a plain message if the request fails.

## Testing Strategy

Vitest with React Testing Library (jsdom) render tests for pages and primitives, plus unit tests for `lib/data.ts`. Gates: `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npx vitest --run`.
