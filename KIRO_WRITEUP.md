# How we built PharmaPool with Kiro

**PharmaPool** helps independent pharmacies cut drug costs: renegotiate prices against a public benchmark, swap to FDA-rated generics, and buy as a group. Track: Healthcare & Biotech.
Live: https://pharmapool-eight.vercel.app · Repo: https://github.com/sean-cardozo/hackachusetts-2026

Kiro was the backbone of this project. Two of us, one designer-minded and one builder, went from an idea to a working, tested app with live government data in a single day, and Kiro's spec-driven workflow is what made that possible.

## Kiro IDE as the engine

We built PharmaPool in the **Kiro IDE**. Kiro generated the data layer, the savings calculator, the upload matcher, the live feed clients and the first version of every screen from our specs. Because the two halves of the team worked in parallel (Nathan on the user experience, Sean on data and screens), the specs became the contract between us: each person could hand Kiro a spec and trust the result to fit the other half.

## Spec-driven development: three specs, one source of truth

We structured the work as three Kiro specs in `.kiro/specs/`, each with requirements, design and tasks:

- **`poolrx`** (product): 40 acceptance criteria in EARS format ("WHEN… THE App SHALL…") covering every screen, the Live vs. Sample labeling of every number, accessibility and the savings math. This is the source of truth.
- **`poolrx-backend`**: 8 requirements and 47 acceptance criteria for the calculator, sample data, upload matcher and AI routes. Its first rule: if it disagrees with `poolrx`, `poolrx` wins. Kiro implemented all 8 tasks.
- **`poolrx-ui`**: 11 requirements and 34 acceptance criteria for the screens, built on top of the backend.

**Why it beat vibe coding:** in a pricing app, a number that silently drifts is a bug a pharmacist will not forgive. With specs, every figure on screen traces to a written rule (for example, "savings are 50–85% of the gap to NADAC"). Kiro implemented against those rules, so when we changed a screen, the math did not move. Splitting product, backend and UI also let Kiro build one layer at a time without breaking the others.

## Steering docs: rules, not descriptions

Three always-included steering files in `.kiro/steering/` shaped every response:

- **`product.md`**: who the user is, the tabs, and plain-language rules such as "every price says whether it is Live or Sample".
- **`tech.md`**: the stack (Next.js 14, TypeScript, Tailwind, Recharts, Zod), the three government feeds (CMS NADAC, FDA Orange Book, openFDA drug shortages) and the rule to serve the last good cache when a feed fails.
- **`theme.md`**: the full visual identity as design tokens.

The strategy that made the biggest difference: **short, testable rules instead of prose**, and updating steering the moment the design changed. When we re-skinned the app mid-day, we rewrote `theme.md` first, and every change after that followed the new identity without restating colors or fonts.

## Property-based testing: correctness we can prove

Kiro's design phase produced explicit correctness properties, and we implemented them with **fast-check** alongside unit tests, 229 tests in total:

- **Savings range**: every result is empty or `0 ≤ low ≤ high`, including the exact 50/85% split.
- **Supplier ranking**: scores stay within 0–100, and the input order never changes the winner.
- **Days of supply**: more units on hand never lowers days of supply.
- **No NaN**: every calculation returns a finite number or null, even on random and malformed inputs.

Further properties cover NDC parsing, upload matching against a messy 7,762-line wholesaler export, and number formatting. For an app that tells a pharmacy how much money it can save, these properties are what let us trust the numbers on screen.

## Other tools

Kiro built the product. We also used Claude Code for the visual re-skin and later UI iterations, working inside the boundaries set by Kiro's steering docs and specs.
