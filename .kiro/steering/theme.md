---
inclusion: always
---
# Theme steering — PharmaPool (clean healthcare SaaS)

Source identity: `reference/PharmaPool.dc.html`. Navy left sidebar, white workspace, one green-teal accent. Light theme only.

## Tokens (app/globals.css, exposed as Tailwind colors of the same name)
| token | value |
|---|---|
| --bg | #f5f7fa |
| --surface | #ffffff |
| --surface-2 | #f4f7fb |
| --line | #e3e8ef |
| --line-strong | #c5cfdb |
| --ink | #0f1d33 |
| --muted | #5a6779 |
| --accent (green-teal) | #0f9f7a |
| --accent-ink (accent text) | #0a7259 |
| --accent-soft | #e7f6f0 |
| --navy (sidebar) | #0e2742 |
| --blue | #2563eb |
| --good / --good-soft | #15803d / #e6f4ea |
| --bad / --bad-soft | #c2362b / #fdecea |
| --shadow | 0 20px 50px rgba(15,29,51,.16) |

Rules: green-teal is the only accent. Use --accent-ink, not --accent, for body-size text on white. Text on accent fills is white. Red and green always come with a word or an arrow, never color alone.

## Type
- **Plus Jakarta Sans** 400–800 for everything. Headings: weight 800, letter-spacing -0.015em, sentence case (no all-caps display type). Page titles 34px, section titles 22px, hero numbers clamp(44px, 5.2vw, 72px).
- **JetBrains Mono** 500/600 for codes (TE ratings like "AB", NDCs, file column names).
- Base 14px, line-height 1.45, `tabular-nums`.

## Shell
- **Sidebar** (components/Sidebar.tsx): fixed, 232px, --navy. Wordmark (3×3 teal dot grid + "PharmaPool" 22px/800 white) and tagline. Group 1: the 4 tabs Summary, Compare, Swap, Join (24px stroke icon, label 14.5px/700, sub-label 11.5px). Divider rgba(255,255,255,.12). Group 2: Upload data, Data sources. Item: radius 10px, 3px left border; active = bg #18426b, white text, #34d3a6 left border, `aria-current="page"`; idle = #c3d0df. Footer card: "Stronger together…" on rgba(255,255,255,.07). Below md the sidebar stacks above the content.
- **Top bar** (components/TopBar.tsx): sticky, white 95% + 8px blur, 1px --line bottom border. Page title, FreshnessChip (radius 10px, --surface-2, pulsing accent dot when live), pharmacy avatar + "Sample pharmacy".
- Main: padding 34px clamp(16px,3vw,40px) 110px. Footer text unchanged. Ask PharmaPool stays a floating bottom-right primary button.
- Only link to pages that exist. Do not add Award to the sidebar until that page is built.

## Components
- Cards: white, 1px --line border, 14px radius. Emphasis (`.card-strong`): 2px --ink border. Accent (`.card-accent`): --accent-soft fill + 1.5px accent border. Sub-tiles inside cards: 12px radius.
- Buttons: 10px radius, weight 800, padding 10px 18px (small 8px 14px), press scale .95. Primary = accent fill / white text (hover --accent-ink). Secondary = 1.5px --line-strong outline. Strong = --ink fill / --bg text.
- Badges and pills: 999px radius, 1.5px border, 10.5–12px weight 800. Live = accent outline + dot + --accent-ink text. Sample = --line-strong outline + --muted text.
- Charts (Recharts): "With PharmaPool" and bars = #0f9f7a, "Actual" / your price = navy #0e2742, "Without" = gray #94a3b8 dashed, grid #e3e8ef.
- Focus: 2px --accent outline, 2px offset.
- No gradients, no emoji, no paint drips. One --shadow for drawers, dialogs and toasts only.
