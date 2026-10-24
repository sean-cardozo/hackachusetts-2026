# Data: public sources and join keys

All URLs below were checked and responded on 2026-10-24.

## Real data

### NADAC (benchmark price per unit)
https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-10-21-2026.csv
Columns: NDC (11 digits, no dashes), NDC Description, NADAC Per Unit, Pricing Unit, Classification for Rate Setting (G/B). The file name contains a date; newer weekly files may exist.

### FDA Orange Book (interchangeable products)
https://www.fda.gov/media/76860/download (zip, use `products.txt`)
Columns: Ingredient, Strength, DF;Route, Appl_Type, Appl_No, TE_Code. A TE_Code starting with "A" means therapeutically equivalent.

### openFDA NDC Directory (product and package details)
https://api.fda.gov/drug/ndc.json
Fields: product_ndc, labeler_name, application_number (for example ANDA208797), packaging[].package_ndc and description.

### openFDA Drug Shortages (shortage alerts)
https://api.fda.gov/drug/shortages.json
Fields: generic_name, status, update_type, update_date, package_ndc, dosage_form, company_name, openfda.* (application_number, product_ndc, rxcui).

### NPPES NPI Registry (optional, for market sizing)
https://npiregistry.cms.hhs.gov/api/?version=2.1&state=MA&taxonomy_description=Community/Retail%20Pharmacy&limit=200&skip=0

### Cost Plus Drugs (real supplier list prices)
Cost Plus Drugs publishes prices for its generics (its cost plus 15%, plus fees) and sells wholesale to retail pharmacies. There is no public API that we found. For the demo we copy prices for a few of our 3 drugs by hand into `/data/supplier-prices.json`, with the source link and the date copied. Check their terms of use before publishing. Every such price is labeled "Supplier list price, source: Cost Plus Drugs, date".

## Join keys
Orange Book (Appl_Type + Appl_No) <-> openFDA application_number <-> package_ndc <-> NADAC NDC.

IMPORTANT: openFDA NDCs use dashes in 4-4-2, 5-3-2 or 5-4-1 formats. NADAC uses 11 digits in 5-4-2 with no dashes. Normalize by zero-padding the short segment. The result must always be exactly 11 digits.

## Assumptions (not public)
- Volume tier prices are not public. Use an explicit assumption stored in `/data/tiers.json`, for example 1 to 11 units = NADAC +12%, 12 to 23 = NADAC +5%, 24 and up = NADAC -3%. This is the "estimated savings" before quotes arrive. Label it as an assumption in the UI.
- Quotes from suppliers other than Cost Plus are example data, generated into `/data/quotes.json`. Label them as examples. After the quote step, savings are shown as "quoted savings (example)" unless the quote comes from a real list price.

## Synthetic data (Nathan)
- 5 anonymized chains (A to E). No real pharmacy names.
- 3 slow-moving generics.
- 3 or more months of purchases, priced at NADAC x (1 + 8 to 18% markup, depending on chain size). Bigger chains pay a smaller markup.
- Stock lots with expiry dates, and units sold per week.
- Must be generated with the types in `/src/types.ts`.
