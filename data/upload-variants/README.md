Two versions of Nathan's store-001 upload export (same 173 catalog lines, same columns, only unit prices differ).
- original-prices/: Nathan's original export (commit 115d55c), hand-typed prices.
- mixed-real-nadac-prices/: prices = real NADAC (week 2026-10-21) x (1 + markup). This is the active file in data/synthetic/store-001/.
- Markup vs NADAC (negative = store pays below NADAC): atorvastatin +18, lisinopril +15, amlodipine +12, metformin +4, sertraline -6, amoxicillin -3, albuterol +9, omeprazole +21, levothyroxine -9, gabapentin +7 (monthly wobble of +/-2 points, +/-1.5 for metformin and amoxicillin).
- Demo: upload either store001_upload_export.csv on the Upload screen; to switch the default, copy the chosen file over data/synthetic/store-001/store001_upload_export.csv.
