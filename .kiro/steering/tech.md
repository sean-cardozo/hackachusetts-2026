# Tech

## Stack
- Vite + React + TypeScript.
- No database. Data lives in JSON files.
- Data pipeline scripts in `/pipeline` (TypeScript, run with `tsx`) write JSON to `/data`.
- Domain logic is pure functions in `/src/lib`. No side effects, no network calls, so they are easy to test.

## Rules
- Every price shown in the UI must be labeled as one of: benchmark (real NADAC), supplier list price (real, with source), or example (made up).
- API keys only in `.env`. It is already gitignored. Never commit keys.
- Money is stored in cents (integers) or rounded half-up to 2 decimals. Never compare floats for money without rounding.

## Tests
- Vitest for unit tests.
- fast-check for property-based tests. Correctness properties in the requirements must each have a property test.

## AI features
Only where they add value and always with a plain fallback so the demo never breaks:
- Cleaning messy files and matching drug names.
- Recommending a supplier from quotes.
- Demand forecast.
- Answering owner questions about their own data.
If an AI call fails, the app uses the simple rule-based result instead.
