# PharmaPool — build brief for Kiro

Hey! Here's everything you need to build **PharmaPool** in Kiro. The specs are already written, so you mostly drive.

## What it is (30 seconds)
PharmaPool helps **independent pharmacies in Massachusetts pool their purchasing** so they buy like a chain. A typical owner spends **~$4.3M a year** on drugs and pays more than chains do. PharmaPool:
1. **Compares** their prices to **NADAC**, the weekly CMS average of what pharmacies pay wholesalers.
2. Suggests **swaps** to FDA-rated equivalent products (Orange Book "AB") so they qualify for group deals.
3. Lets them **join buying rounds** with a recommended commitment. Joining is non-binding until the round hits its volume target, then they get a 48-hour window to confirm. Some rounds miss their target, and then nothing is ordered.
4. **Awards** the order to the best supplier, using an AI recommendation that weighs price, delivery speed and shortage history.

Built for **Hackachusetts 2026**. Look: clean healthcare SaaS — navy sidebar, white workspace, green-teal accent, Plus Jakarta Sans.

## What's in the folder
| Path | What it is |
|---|---|
| `BRIEF.md` | One-page product brief. Read this first |
| `reference/PharmaPool.dc.html` | **Clickable prototype.** Open it in Chrome (keep `support.js` next to it). Match its look and flows |
| `.kiro/steering/product.md` | Product rules Kiro always follows (copy, badges, privacy, $ + %) |
| `.kiro/steering/theme.md` | Visual theme: colors, fonts, buttons, drips |
| `.kiro/steering/tech.md` | Stack (Next.js + TS + Tailwind + Recharts), data feeds, folder structure |
| `.kiro/specs/poolrx/requirements.md` | User stories + acceptance criteria (R1–R15) |
| `.kiro/specs/poolrx/design.md` | Calculations, data model, all sample data, screen layouts |
| `.kiro/specs/poolrx/tasks.md` | Step-by-step implementation plan |

## How to build it in Kiro
1. Create an empty repo and copy **everything in this folder** into its root. Keep the hidden `.kiro/` folder.
2. Open the repo in Kiro. It picks up the steering files automatically.
3. Open `.kiro/specs/poolrx/tasks.md` and click **Start task** on task 1. Go in order.
4. After each screen, open `reference/PharmaPool.dc.html` side by side and compare.

### Prompts to paste into Kiro chat if you want to steer
- *"Read BRIEF.md and all steering files, then summarize the app back to me before writing code."*
- *"Build task 1–3: scaffold, theme tokens from theme.md, navy sidebar with Summary/Compare/Swap/Join plus Upload data and Data sources, sticky top bar with search + freshness chip, footer, and the LiveBadge/SampleBadge/SourceTip primitives."*
- *"Load the sample data from design.md into /data/sample and write lib/calc.ts with unit tests."*
- *"Build the Summary page to match reference/PharmaPool.dc.html: savings hero across all purchases (generics/brand/OTC), monthly purchases chart (actual + projected with/without), Savings by step cards, Key recommendations."*
- *"Build Join with all round states including At risk and Target missed, the Opt-in dialog, and the Award section with the animated 'Estimated 8–14% → Quoted 11.2%' headline."*

## Screens at a glance
- **Summary**: estimated savings across all purchases ($ range + %), split by generics, brand, and OTC & supplies; a 24-month chart; savings per step; ranked recommendations with one-click actions.
- **Compare**: category table vs NADAC, days of supply, shortage risk and a **Next step** button per drug. A drug drawer shows a 12-month price chart and equivalents.
- **Swap**: 3 swaps that unlock the Cardio round (+$26k/yr), with approve / undo.
- **Join**: round cards (Open, At risk, Target reached → 48h confirm, Quotes, Awarded, Target missed, Closed), the Opt-in dialog and the Award section.
- **Upload** (header button): 2-step upload, AI column mapping with confidence, drug-name matching, privacy panel.
- **Data sources** (header link) and the floating **Ask PharmaPool** chat (bottom-right).

## Non-negotiables
- Every savings number shows **$ and %**.
- A **Live** badge on government data (NADAC, FDA) and a **Sample** badge on member/supplier data. Every benchmark number gets a source tooltip.
- Red/green always comes with ▲/▼ and a word, never color alone.
- Privacy line on Upload: *"Your name, prices and stock levels are never shown to other pharmacies or suppliers. Group figures are shown only when 5 or more pharmacies contribute."*
- Every screen needs empty, loading, error and success states.
- Light theme only.

## Data
- **Live (free, public):** CMS NADAC (data.medicaid.gov, weekly), FDA Orange Book products file (monthly, `TE_Code`), openFDA drug shortages API (daily). Cache each one so the demo works offline.
- **Sample:** all member, inventory and supplier data is synthetic. Full numbers are in `design.md`.

## The 2-minute demo path
Summary (see the savings) → Compare (atorvastatin 52% above NADAC) → Swap (approve 3) → Join (opt in, so Cardio goes from 94% to 102%) → Award (accept Supplier B, quoted 11.2%).

Questions about intent: the prototype is the source of truth for look and flow. The spec files are the source of truth for rules and numbers.
