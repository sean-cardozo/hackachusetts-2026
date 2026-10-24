# Synthetic store data

Synthetic purchasing data for one independent pharmacy (`STORE-001`, "Beacon Hill Independent (synthetic)"),
Oct 2025 - Sep 2026. Use it for the Upload step of the Pharmacy Buying Pool demo.

**This is not real pharmacy data.** The store's location is modeled on a real Boston independent, but every
quantity, price, NDC, manufacturer and wholesaler is synthetic. Show it under the pseudonym.

## Folder layout

```
synthetic-store-data/
├── README.md
├── generate_store.py                         # regenerates everything (python generate_store.py -> ./out)
└── store-001/
    ├── store001_upload_export.csv            # USE THIS FOR THE DEMO UPLOAD
    ├── store001_summary_workbook.xlsx        # monthly/category summaries, assumptions, README tab
    └── ground-truth/                         # answer key: do NOT upload in the demo
        ├── store001_invoice_lines_labeled.csv
        ├── store001_product_master.csv
        ├── store001_class_master.csv
        └── store001_dispensing_monthly.csv
```

## Which file to upload

`store001_upload_export.csv` has only the columns a wholesaler purchase-history export would contain
(7,762 rows, 19 columns): account, invoice and order IDs, dates, supplier, wholesaler item number, NDC,
description, package size, quantities, unit and extended cost, and credit reason.

It deliberately leaves out the "answers": equivalence class, therapeutic category, brand/generic flag,
benchmark (NADAC) price, shortage and substitution flags. The product should derive those. Use
`ground-truth/store001_invoice_lines_labeled.csv` (same rows, 39 columns) to score the matcher and check the dashboard.

## Headline numbers

| Metric | Value |
|---|---|
| Net purchases (12 months) | $4,345,050 (target: NCPA avg sales $5.411M x (1 - 19.7% margin) = $4,345,033) |
| Brand / generic | $3.69M / $0.65M (15% generic) |
| Fills simulated | 65,759 (NCPA avg 65,795 Rx/store; 81% generic) |
| Invoice lines / NDCs | 7,762 / 954 |
| Generic compliance (primary share of generic $) | 95.6%; dips below 95% in Jan and Sep 2026 |
| Credits | Quarterly overstock returns (-$997) |
| Shortages (synthetic) | Amoxicillin Jan-Mar 2026, albuterol HFA Jun-Jul 2026 |

## What is real vs synthetic

- **Real:** names, strengths and package sizes for the 74 "named basket" drugs; brand names and marketers;
  Eliquis list price ($606.10 -> $346 per 60 tabs on 1/1/2026); NCPA averages used for calibration.
- **Assumed:** Jardiance 1/1/2026 list-price cut set to 50% (direction confirmed by NCPA, size not verified);
  generics = 15% of purchase dollars; rebate tiers; inventory and ordering policy.
- **Synthetic:** all NDCs (labeler codes 900xx/902xx are placeholders, not FDA assignments), generic manufacturers,
  wholesalers (Atlas / Coastal / Summit are fictional), and the 850 long-tail items (`LT Brand #0031`, etc.),
  which carry ~83% of dollars.
- **Approximate:** benchmark (NADAC) prices and national fill counts are rough values, not the CMS file (except for the 10 catalog drugs, see "Price re-base (real NADAC)").

## Regenerate or make more stores

```bash
python generate_store.py   # writes invoice_lines.csv, product_master.csv, class_master.csv, dispensing_monthly.csv to ./out
```

Edit the `STORE` dict (store id, Rx volume, price multiplier, seed) to create other stores. `calibrated_build()`
rescales long-tail prices so totals land on the NCPA-average target.

## Price re-base (real NADAC)

The first version priced the 10 catalog drugs from rough NADAC numbers, so several sat below the real NADAC.
`rebase_prices.py` re-prices only those drugs (atorvastatin 20 mg, lisinopril 10 mg, amlodipine 5 mg, metformin
500 mg, sertraline 50 mg, amoxicillin 500 mg, albuterol HFA 90 mcg, omeprazole DR 20 mg, levothyroxine 50 mcg,
gabapentin 300 mg; 173 invoice lines, the same lines `lib/match.ts` matches to the pool catalog):

- unit price = real NADAC from `data/cache/nadac.json` x (1 + markup). Markups run -9 to +21 percent; 3 of 10 drugs
  are BELOW NADAC (negative markup), 7 above.
  Base markup per drug: atorvastatin +18, lisinopril +15, amlodipine +12, metformin +4, sertraline -6,
  amoxicillin -3, albuterol +9, omeprazole +21, levothyroxine -9, gabapentin +7. Each invoice month moves it by up
  to +/- 2 points (+/- 1.5 for metformin and amoxicillin), deterministic (a hash of drug and month).
- `unit_cost_per_package` = round(unit price x package_size, 2); `extended_cost` = qty_shipped x unit cost.
  Credits keep their sign (none of the 10 drugs has a credit line).
- In the labeled copy, `nadac_per_unit`, `nadac_extended` and `variance_vs_nadac` of those lines are refreshed
  to the real NADAC. Every other column and every other line is unchanged.
- Albuterol is priced per GM in the cache, so the reference 21.85 per inhaler is used for it.

```bash
python3 data/synthetic/rebase_prices.py   # edits store001_upload_export.csv and the labeled copy in place
```

The script is idempotent: it always starts from Nathan's original files read from git (commit 115d55c). Both
versions are kept in `data/upload-variants/`.
Not updated: the `store001_summary_workbook.xlsx`, the product master (no prices) and `generate_store.py`
(still the old calibration; do not re-run it over these files, it would undo the re-base and change the 4.345M total).
Net purchases in the export moved from $4,345,050 to $4,347,433 (the 10 drugs were mostly priced below real NADAC before); the headline table above shows the original figure.
