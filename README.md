# PharmaPool

Helps independent pharmacies cut drug costs: renegotiate prices, swap to generics, buy as a group.

Built at Hackachusetts powered by Kiro (Sundai Week 146), October 24, 2026. Track: **Healthcare & Biotech**.

**Try it live:** https://pharmapool-eight.vercel.app (no login needed). Start on **Upload data** and click **Use demo file**.

## What it does

An independent pharmacy uploads 12 months of purchase history from its wholesaler. PharmaPool matches every invoice line to a drug, prices it against public benchmarks and shows three ways to save:

| Step | What it means | Data behind it |
|---|---|---|
| **Re-negotiate** | Negotiate your own prices with your wholesaler, using a public benchmark | CMS NADAC (weekly national average acquisition cost) |
| **Swap** | Switch from a brand or higher-cost product to an FDA-rated equivalent generic | FDA Orange Book therapeutic equivalence codes |
| **Join** | Extra savings from pooling volume with other pharmacies in a buying round | Round progress, supplier quotes, openFDA drug shortages |

- **Summary** shows estimated savings per year, a 24-month spend chart and ranked recommendations. "Your plan so far" updates as you act on each tab.
- **Award** is the check-out: everything chosen on Re-negotiate, Swap and Join with its estimated impact, plus the supplier award for a round with quotes.
- **Upload data** auto-maps messy wholesaler column names and drug spellings (rule-based, with optional AI mapping). Matching runs on the device.
- **Data sources** shows the status of each government feed. If a feed fails, the app serves the last good cache and marks it "cached".
- **Ask PharmaPool** answers questions about your numbers, with a rule-based fallback when no AI key is set.

Numbers marked **Sample** come from the bundled demo pharmacy. Numbers marked **Live** come from the government feeds.

## Run it locally

Requirements: Node.js 18.17 or newer, npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

No API key is needed. To enable the AI column mapping and the Ask panel, copy `.env.example` to `.env` and fill in `AI_API_KEY` and `AI_MODEL` (OpenAI-compatible API). Without them the app uses its rule-based fallback.

Production build:

```bash
npm run build
npm start
```

## Try the demo (2 minutes)

1. Open **Upload data** in the left sidebar and click **Use demo file** (a fictional 12-month wholesaler export, 7,762 invoice lines).
   To upload a real CSV instead, use `data/synthetic/store-001/store001_upload_export.csv` from this repo.
2. Click **See how your prices compare** to open the Summary.
3. On **Re-negotiate**, click **Re-negotiate all** or **Negotiate** on a drug.
4. On **Swap**, approve a swap. On **Join**, opt in to a round.
5. Open **Award** to see the plan and its estimated impact, then pick a supplier for the round with quotes.
6. **Reset demo** at the bottom of the sidebar clears everything and starts over.

## Tests

```bash
npm test
```

229 tests (Vitest), including property-based tests with fast-check on the savings calculator, supplier scoring, NDC parsing, upload matching and formatting.

## How it is built

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Zod.
- `lib/`: data layer, savings calculator, upload matcher, live feed clients.
- `components/`: one folder per page, plus the shared shell (sidebar, top bar).
- `data/`: sample pharmacy, synthetic store export, feed cache.
- `.kiro/`: the Kiro specs (`specs/poolrx`, `specs/poolrx-backend`, `specs/poolrx-ui`) and steering docs (`steering/product.md`, `tech.md`, `theme.md`) used to build the project.

All pharmacy, supplier and invoice data in this repository is fictional.
