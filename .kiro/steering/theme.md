---
inclusion: always
---
# Theme steering — Hackachusetts (bright)

Source identity: the Hackachusetts logo — heavy white condensed caps on a black, Massachusetts-shaped plate, underlined by a bright orange paint stripe with drips. PharmaPool uses that identity in a **light-only** UI (no dark mode): bright warm-white ground, black type, orange as the single accent.

## Tokens (CSS variables)
| Token | Light (default) |
|---|---|
| --bg | #fffaf3 |
| --surface | #ffffff |
| --surface-2 | #fbf5ec |
| --line | #eee5d7 |
| --line-strong | #c9bfae |
| --ink | #121212 |
| --muted | #5b554c |
| --accent (orange) | #ff7a00 |
| --accent-ink (orange text) | #a64b00 |
| --accent-soft | #fff0de |
| --good / --good-soft | #17804d / #e3f5ea |
| --bad / --bad-soft | #c8352a / #fdeae6 |

Rules: orange is the only accent. Don't use --accent for body-size text on white (contrast) — use --accent-ink. Text on orange fills is #111.

## Type
- Display: **Anton** (Google Fonts), uppercase, letter-spacing .01–.04em. Page titles 44px, section titles 22–28px, hero numbers clamp(54px, 6.4vw, 96px).
- Body/UI: **Archivo** 400–800. Base 14px. Numbers: `font-variant-numeric: tabular-nums`.
- Mono (codes like "AB", file column names): JetBrains Mono.

## Signature details
- Header: white bar, 5px orange bottom border with 4–5 small orange "drips" (rounded-bottom rectangles 5–8px wide, 6–14px tall) hanging below it.
- Hero savings number: black Anton, with a 10px orange bar underneath carrying 3 drips.
- Wordmark: "PHARMA" in ink + "POOL" in orange, Anton.
- Cards: white, 1.5px --line border, 14–20px radius. Emphasis cards: 2.5px --ink border. Accent cards: --accent-soft fill + 2–2.5px orange border.
- Buttons: pill (999px). Primary = orange fill/#111 text, weight 800. Secondary = 1.5px --line-strong outline. Strong = --ink fill / --bg text.
- Badges: Live = 1.5px orange outline, orange dot, --accent-ink text, uppercase 10.5px. Sample = 1.5px --line-strong outline, --muted text.
- Focus: 2px orange outline, 2px offset. No default blue anywhere (links use --accent-ink).
- No gradients, no emoji, no drop-shadow-heavy cards (one --shadow for drawers/dialogs only).
