---
inclusion: always
---
# Product steering — PharmaPool

- Audience: independent pharmacy owners. Write in plain language, short sentences, no jargon without a tooltip.
- Tooltip glossary: NADAC = "the national average price pharmacies pay wholesalers" (CMS, weekly). AB rating = "FDA says this product is therapeutically equivalent." Days of supply = "units on hand ÷ average daily usage."
- Tabs are exactly: Summary (savings, chart, key recommendations), Compare, Swap, Join. Upload data and Data sources sit in the left sidebar under the tabs; Ask PharmaPool is a floating bottom-right button. Award lives in Join. Each page carries its own actions.
- Every savings figure shows both $ and %.
- Data provenance is always visible: `<LiveBadge>` for CMS/FDA data, `<SampleBadge>` for member/supplier data. Every benchmark value has a source tooltip with the effective date.
- Never show color alone for status. Pair green/red with ▲/▼ and "above"/"below".
- Savings are ranges until quotes arrive ("$16.9k–$28.7k"); after quotes they become a single quoted figure.
- Swaps always require explicit owner approval. Copy: "You approve every swap before it's used."
- Opt-in copy: "Non-binding. When the round reaches its target, you'll have 48 hours to confirm or drop out."
- Privacy copy must appear on the upload surface verbatim (see BRIEF.md).
- Every screen implements empty, loading, error and success states.
- Ask PharmaPool answers only from the user's data + benchmark feeds, and cites the source.

- Estimated savings cover all purchases (~$4.3M): generics (deepest %), brand (1–2.5% via wholesaler tier, prompt-pay, shared rebates), OTC & supplies (8–14%).
- Rounds can miss their target; show "At risk" with pace and "Target missed" states honestly.
