# PharmaPool — Product brief (working name)

**One line:** PharmaPool lets independent pharmacy owners pool purchasing power for generic drugs, so they buy like a chain without giving up their data.

**User:** an independent pharmacy owner in Massachusetts. Busy, practical, not a data analyst. Wants three answers fast: *Am I overpaying? What can I switch? What should I commit to?*

**Built at:** Hackachusetts 2026. Visual theme follows the Hackachusetts brand (black, bright orange, white; heavy condensed display type; paint-drip accents) in a bright, light-first layout.

## Navigation (4 tabs + header utilities)
1. **Summary — Savings & next steps.** Big estimated savings across **all purchases** (~$4.3M/yr: generics, brand, OTC & supplies) in $ and %, with a breakdown by spend type; a **Monthly purchases chart** (12 months actual + 12 months projected, with and without PharmaPool, savings range shaded); **Savings by step** cards ($ and %) for Compare, Swap, Join; ranked **Key recommendations** each with one action; key stats.
2. **Compare.** Each drug priced against NADAC, the weekly CMS average of what pharmacies pay wholesalers. Savings by category ($ and %), days of supply, FDA shortage alerts, and a **Next step** action per drug (Swap, Join round, Confirm round, Award, Reorder).
3. **Swap.** Suggests switching to an FDA-rated equivalent (Orange Book "AB") from another manufacturer to join a round. Approve / undo per swap.
4. **Join.** Buying rounds with a recommended commitment, non-binding until the round reaches its volume target, then a 48-hour window to confirm. Not every round makes it: rounds can be **At risk** (on pace to miss) or **Target missed** (nothing ordered, commitments released). The **Award** decision (quotes, AI recommendation, supplier view) lives here.
- Header utilities: **↑ Upload data** button and **Data sources** link (right side, not tabs). Upload page = 2 steps, AI mapping, drug matching, privacy panel.
- Floating **Ask PharmaPool** button bottom-right. Light theme only.

## Non-negotiables
- Every savings figure shows both $ and % (e.g. "$23.3k/yr (11.2%)").
- "Live" badge (orange outline) on government data; "Sample" badge (gray outline) on member data.
- Every benchmark number has a source tooltip ("CMS NADAC, effective Oct 22, 2026").
- Green/red only for below/above benchmark, always with ▲/▼ and a word. Never color alone.
- Numbers right-aligned in tables, tabular numerals.
- Privacy: "Your name, prices and stock levels are never shown to other pharmacies or suppliers. Group figures are shown only when 5 or more pharmacies contribute."
- Every screen has empty, loading, error and success states.
- Footer: "Benchmarks: CMS NADAC, FDA Orange Book, openFDA drug shortages. Member data anonymized and aggregated."

## Demo story (sample data)
- Sample pharmacy: ~$4.3M/yr total drug purchases (estimate derived from NCPA sales and margin figures); ~$920k/yr of that is the 10 tracked generics (generics are a small share of dollars but most prescriptions).
- 10 generics; amoxicillin 500 mg + albuterol HFA on FDA shortage; amoxicillin has 9 days of supply → red alert.
- Atorvastatin, lisinopril, amlodipine each have an AB-rated equivalent in the Cardio round (+$26,220/yr total).
- Cardio round sits at 94% of target; the demo user's opt-in (after swaps) pushes it to ~102%.
- Diabetes & thyroid round has 3 quotes; Supplier B recommended (2% pricier than A, no shortages in 3 years, 5-day delivery).

## Success = a judge can, in under 2 minutes:
see the savings number → find an overpriced drug → approve 3 swaps → opt in and push Cardio over target → accept the Supplier B award.
