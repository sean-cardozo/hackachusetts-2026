# Implementation plan

- [ ] 1. Scaffold Next.js + TS + Tailwind; add Anton/Archivo/JetBrains Mono; implement light theme tokens (no dark mode). _R1, theme.md_
- [ ] 2. Build shell: Header (wordmark, 4 tabs, freshness chip, Data sources link, theme toggle, Ask button, orange drip bar), Footer. _R1_
- [ ] 3. Primitives: LiveBadge, SampleBadge, SourceTip tooltip, GapPill (▲/▼ + text), RiskPill, StatCard, HeroNumber (with drip underline), StateViews (Empty/Loading/Error), Toast. _R2, R11_
- [ ] 4. Load sample data (`/data/sample`) + `lib/calc.ts` with unit tests for spend, gap, savings range, DoS, risk, commitment, supplier scores. _design.md_
- [ ] 5. Feeds: `lib/feeds.ts` for NADAC, Orange Book, openFDA shortages with cache + live/cached status; seed cache files so the demo works offline. _R1, R9_
- [ ] 6. Upload tab: dropzones, template CSV download, parse CSV/XLSX, AI column mapping with confidence, drug matching with review suggestions, privacy statement, error state. _R3_
- [ ] 7. Summary › Big numbers ($ + %), Savings by step cards, Key recommendations list; count-up animation Estimated → Quoted. _R4, R6.3_
- [ ] 8. Join › Award section: quoted headline count-up, recommendation panel + weights, supplier cards, accept / choose other, supplier-view toggle with AI RFQ. _R5_
- [ ] 9. Compare: category table with expandable drug rows; DrugDrawer with Recharts line chart, usage bars, shortage status, equivalents + Swap. _R6_
- [ ] 10. Swap tab: swap cards, approve/undo, Approve all, other equivalents list; persist swaps. _R7_
- [ ] 11. Join tab: round cards for all 6 states, countdowns, Opt-in dialog with recommended commitments, Swap to join, projected progress, Cardio crosses target → 48h confirm. _R8_
- [ ] 12. Data sources page. _R9_
- [ ] 13. Floating Ask PharmaPool button + panel (bottom-right) with grounded answers + 3 suggestions. _R10_
- [ ] 14. Empty/loading/error/success states on every tab + a dev-only state switcher. _R11_
- [ ] 15. Accessibility & polish pass: contrast, focus traps, keyboard nav, responsive down to 768px; compare against `reference/PharmaPool.dc.html`.
- [ ] 16. Summary spend mix (generics/brand/OTC) + monthly purchases chart (actual + projected). _R12, R13_
- [ ] 17. Round At risk / Target missed states and Compare Next step actions. _R14, R15_
