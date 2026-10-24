# Design — PharmaPool

Visual reference: `reference/PharmaPool.dc.html` (open in a browser). Theme: see `.kiro/steering/theme.md`.

## Calculations (lib/calc.ts)
- annualSpend = unitPricePaid × unitsPerMonth × 12
- benchmarkSpend = NADAC × unitsPerMonth × 12
- gapPct = (paid − NADAC) / NADAC × 100
- estSavings range = max(0, spend − benchmark) × [0.50, 0.85] (+ approved swap extras)
- daysOfSupply = round(onHand / (unitsPerMonth / 30))
- shortageRisk: High if FDA shortage AND DoS < 14; Watch if shortage; else Low
- recommendedCommitment = 3 × unitsPerMonth − max(0, onHand − unitsPerMonth)
- supplier scores: price = minTotal/total×100; delivery = 100 − (days − 3)×8; reliability = 100 − shortage-weighted penalty (A 62, B 96, C 81 in demo). total = Σ(weight × score)/Σweights.

## Data model (TypeScript)
```ts
type Drug = { id; name; strength; form; category; ndc?; mfr; unitsPerMonth; paid; onHand?; countDate? }
type Benchmark = { ndcOrKey; nadac; effectiveDate; source: 'CMS NADAC' }
type Equivalent = { drugId; mfr; teCode: 'AB'|'AB1'|string; benchmark; roundId?; extraSavingsYr? }
type Shortage = { ingredient; status: 'current'|'resolved'; updated }
type Round = { id; name; status: 'open'|'target'|'quotes'|'awarded'|'closed'; estRange; targetUnits; committedUnits; pharmacies; deadline; confirmDeadline?; drugs: string[]; pastConfirmRate }
type Quote = { supplier: 'A'|'B'|'C'; prices: Record<string, number>; deliveryDays; minOrder; reliability; quotedPct }
type FeedStatus = { feed; cadence; fetchedAt; effectiveDate; status: 'live'|'cached' }
```

## Sample data (paid / NADAC / units per month / on hand / mfr)
Scale: multiply every units/month and on-hand value below by 6 (≈ $920k/yr generic spend). Swap extras ×6: Accord $11,640, Lupin $6,720, Aurobindo $7,860. Cardio round: 5,650,000 / 6,000,000 units. Quote demand: 2,520,000 / 1,116,000 / 588,000; your share 255,600 / 111,600 / 0; minimum orders A $15k, B $9k, C $30k.

| Drug | Cat | Paid | NADAC | /mo | On hand | Mfr | Shortage |
|---|---|---|---|---|---|---|---|
| Atorvastatin 20 mg tab | Cardio | 0.0920 | 0.0605 | 9,800 | 7,400 | Sandoz | – |
| Lisinopril 10 mg tab | Cardio | 0.0480 | 0.0262 | 7,600 | 6,900 | Unichem | – |
| Amlodipine 5 mg tab | Cardio | 0.0390 | 0.0181 | 8,900 | 10,100 | Camber | – |
| Metformin 500 mg tab | Diabetes | 0.0310 | 0.0158 | 14,200 | 16,800 | Zydus | – |
| Sertraline 50 mg tab | Mental health | 0.0540 | 0.0379 | 5,900 | 2,350 (12d) | Lupin | – |
| Amoxicillin 500 mg cap | Antibiotics | 0.1180 | 0.0921 | 4,300 | 1,290 (9d) | Aurobindo | **Yes** |
| Albuterol 90 mcg HFA | Respiratory | 26.40 | 21.85 | 310 | 350 | Cipla | **Yes** |
| Omeprazole 20 mg DR cap | GI | 0.0710 | 0.0546 | 5,400 | 4,800 | Dr. Reddy's | – |
| Levothyroxine 50 mcg tab | Thyroid | 0.1120 | 0.1186 | 6,200 | 5,300 | Amneal | – |
| Gabapentin 300 mg cap | Pain | 0.0440 | 0.0465 | 8,100 | 9,900 | Ascend | – |

Cardio-round swaps: Atorvastatin → Accord AB ($1,940/yr), Lisinopril → Lupin AB ($1,120), Amlodipine → Aurobindo AB ($1,310).

Rounds: Cardio generics bundle (open, 942,000 / 1,000,000 units, 14 pharmacies, closes in ~2d 6h, 91%); Antibiotics & respiratory (target reached 108%, user joined, confirm within ~41h); Diabetes & thyroid (quotes, 22 pharmacies); Mental health & GI (awarded B, 10.4%); Pain & neuro Q3 (closed, saved $612).

Quotes (metformin / levothyroxine / glipizide; group demand 420k / 186k / 98k; your share 42.6k / 18.6k / 0):
A 0.0182/0.1040/0.0298, 9 days, $2,500 min, reliability 62, quoted 12.9% · B 0.0186/0.1061/0.0301, 5 days, $1,500, 96, 11.2% · C 0.0199/0.1098/0.0322, 3 days, $5,000, 81, 7.0%. Default weights price 50 / delivery 20 / reliability 30 → B wins.

Upload demo: messy columns (Drug Desc, Str., NDC#, Pkg Sz, Qty/Mo, Cost Ea, Vendor, Notes) and names ("Atorvastatn 20mg tab", "Lisinipril 10 MG", "Levoxyl 50mcg" → review, "Gaba 300" → review, "Vit D3 2000IU" → unmatched).

## Screen layouts
- **Summary:** title → [Estimated savings card: total $ range + %, Generics/Brand/OTC bars] + [Monthly purchases chart: actual vs projected with/without] → Savings by step → Key recommendations → 4 stat cards.
- **Upload (header button):** title → privacy panel → 2 step cards → mapping/matching tables → "See how your prices compare".
- **Compare:** intro → alert → 4 stat cards → category table (grid rows, expand) → drug drawer (600px right sheet).
- **Swap:** intro → orange hero (+$4,370, Approve all) → 3 swap cards (Now → Swap to) → Other equivalents list.
- **Join:** "Decision needed" banner → explainer → round cards (incl. At risk + Target missed) → Award section (quoted headline animation, recommendation + weights, supplier cards / supplier view).
- **Join (old):** intro + 3-step explainer (Opt in → Target → 48h) → round card grid → Opt-in dialog.
- **Data sources:** feed table → dashed "Sample member data" section.
- **Ask PharmaPool:** floating pill button bottom-right → 390×600 panel anchored bottom-right, suggestions + input.

## Spend mix
Total purchases $4.3M/yr. Generics ≈ $920k (savings 50–85% of NADAC gap), OTC & supplies $280k (8–14%), Brand ≈ $3.1M (1–2.5%). Brand round "Brand inhalers & insulin": user brand spend $640k, 2–4%, at 58% of target, on pace for 81%. Closed round "Dermatology generics · Q3": 72%, target missed.
Chart: monthly = total/12 with ±3% seasonality, +3%/yr drift; savings ramp min(1, month/4).
