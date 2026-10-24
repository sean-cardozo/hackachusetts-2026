# Requirements — PharmaPool

## R1 Global shell
**User story:** As an owner, I want to always know how fresh the numbers are and where they come from.
1. WHEN any page loads THEN the header SHALL show tabs Summary, Compare, Swap, Join, and on the right an "Upload data" button next to a "Data sources" link; a floating "Ask PharmaPool" button SHALL sit bottom-right. Light theme only.
2. WHEN all feeds are live THEN the freshness chip SHALL read "Benchmarks: NADAC as of [date] · FDA shortages as of [today]" with a pulsing orange dot.
3. IF any feed failed its last refresh THEN the chip SHALL read "Cached [date]" with a gray dot.
4. The footer SHALL read "Benchmarks: CMS NADAC, FDA Orange Book, openFDA drug shortages. Member data anonymized and aggregated."

## R2 Data badges & tooltips
1. Every value from CMS/FDA SHALL carry a Live badge; every member/supplier value SHALL carry a Sample badge.
2. WHEN the user hovers or focuses a benchmark value THEN a tooltip SHALL show source + effective date.
3. Above/below benchmark SHALL be shown with ▲/▼ + "above"/"below" text in red/green.

## R3 Upload page (header button)
1. Step 1 (required) SHALL accept CSV/XLSX via drag-and-drop or picker, and offer "Download template" with columns: drug name, strength, NDC (optional), package size, units purchased per month, unit price paid, wholesaler (optional).
2. Step 2 (optional) SHALL accept inventory with columns: drug name, strength, NDC (optional), units on hand, count date, expiration date (optional), and show "Add inventory to see days of supply and get a recommended commitment."
3. WHEN a file is parsed THEN the system SHALL map each column to a standard field with a confidence %, and match each drug row as matched / needs review / unmatched, showing the original text → corrected name.
4. WHEN a row needs review THEN the system SHALL show suggestion buttons; WHEN the user picks one THEN the row SHALL become matched ("Confirmed by you").
5. The privacy statement SHALL be visible on the upload surface.
6. IF the file can't be parsed THEN show an error naming the file and how to fix it.

## R4 Summary — Big numbers
1. The Summary SHALL show estimated annual savings as a large $ range and % of spend.
2. WHEN swaps are approved THEN the estimate SHALL increase and say "Includes $X from approved swaps."
3. WHEN quotes exist for a round THEN a headline SHALL animate from "Estimated 8–14%" to "Quoted 11.2%" (count-up ~1.4s, old value struck through).
4. Summary SHALL show annual spend, drugs above NADAC, drugs under 14 days, open rounds, and "Savings by step" cards showing $ and % for Compare, Swap and Join.
5. Summary SHALL show a ranked "Key recommendations" list (urgent shortage action first), each with a $ and % value and one action button; completed items show ✓.
6. Every savings figure in the app SHALL show both $ and %.

## R5 Join — Award
1. The Award section SHALL show three supplier cards (A, B, C; Sample) with unit price per product, group total, your share, delivery time, minimum order and a Supply reliability score (Live, from FDA shortage history).
2. A recommendation panel SHALL name the best supplier with a two-sentence reason, and score bars (price, delivery, reliability) with adjustable weight sliders that re-rank live.
3. "Accept recommendation" SHALL award and show success; "Choose a different supplier" SHALL reveal "Award to Supplier X" on each card.
4. A "What suppliers see" toggle SHALL show side by side: your view vs. supplier view (combined demand by product, # pharmacies, region Massachusetts, delivery cadence, AI-written RFQ). No names, prices or stock in the supplier view.

## R6 Compare
1. Category table rows: cardiovascular, diabetes, mental health, antibiotics, respiratory, GI, thyroid, pain — your spend (Sample), benchmark spend (Live), gap %, est. savings range, days of supply, shortage risk. Rows expand to drugs.
2. WHEN a drug is clicked THEN a drawer SHALL show: 12-month line chart your price vs NADAC, monthly usage bars, units on hand + days of supply, FDA shortage status (Live), and Equivalent products (manufacturer, TE code, benchmark price, in-round status, extra savings, Swap button, "You approve every swap before it's used.").
3. IF a drug on the FDA shortage list has <14 days of supply THEN a red alert banner SHALL appear on Summary and Compare linking to the round containing it.

## R7 Swap
1. Swap SHALL list swaps that unlock an open round, showing Now → Swap to, TE code, benchmark and extra $/yr, with Approve / Undo.
2. A banner SHALL read "3 equivalent swaps available. Switching lets you join the Cardio round and save an extra $X." with "Approve all".
3. Other equivalents (not in a round) SHALL be listed and open the drug drawer.

## R8 Join
1. Each round card SHALL show status, est. savings %, countdown, progress bar to volume target ("94% of target, 14 pharmacies joined"), included drugs and "Confirmation rate on past rounds: N%".
2. States: open, target reached (confirm window countdown + Confirm / Drop out), quotes received, awarded, closed, and empty ("No rounds available").
3. WHEN "Opt in" is clicked THEN a dialog SHALL pre-fill a commitment per drug = 3 × monthly usage − extra stock (on hand − 1 month usage, min 0), editable, with that one-line explanation.
4. IF the user's product isn't in the round but an equivalent is THEN show inline "Swap to join".
5. The dialog SHALL show projected progress (from → to %) and the non-binding note.
6. WHEN opt-in pushes the round ≥100% THEN the round SHALL switch to target reached with a 48h confirm countdown.

## R9 Data sources
1. One row per feed: CMS NADAC (weekly), FDA Orange Book (monthly), openFDA drug shortages (daily) with last refresh and Live/Cached status.
2. A visually separate "Sample member data" section SHALL explain member histories and supplier quotes are synthetic.

## R10 Ask PharmaPool
1. A chat panel opened from the bottom-right button on every screen SHALL answer questions grounded in the user's data, with suggestions: "Why is my atorvastatin cost high?", "What runs out first?", "Why did you recommend Supplier B?"

## R11 States
1. Every tab SHALL implement empty, loading (skeleton), error (message + Try again) and success (toast/inline confirmation) states.

## R12 Savings across all purchases
1. Summary SHALL estimate savings across total purchases (~$4.3M/yr) split into Generics, Brand and OTC & supplies, each with $ and %.
2. Brand savings SHALL be explained (wholesaler tier, prompt-pay, shared rebates).

## R13 History & projection chart
1. Summary SHALL show monthly purchases: 12 months actual, 12 months projected without PharmaPool (dashed) and with PharmaPool (line + shaded range), with a Today marker and projected 12-month savings in $ and %.

## R14 Rounds that miss
1. A round on pace to miss SHALL show "At risk" with projected % at close and how many more pharmacies are needed.
2. A closed round below target SHALL show "Target missed" and state that no orders were placed and commitments were released.

## R15 Actions on every page
1. Compare drug rows SHALL show a Next step action (Swap / Join round / Confirm round / Award / Reorder) that performs or navigates to the action.
