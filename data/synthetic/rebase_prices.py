#!/usr/bin/env python3
"""Re-base the store-001 prices of the 10 catalog drugs on the REAL NADAC.

    price paid per unit = real NADAC unit price x (1 + markup)

The markup per drug is a fixed base (BASE_MARKUP, the same numbers as data/sample/drugs.json)
plus a deterministic variation by invoice month of at most +/- 2 percentage points, always
(1.5 points when the base is within 3 points of zero). Markups run -9 to +21 percent;
negative means the store pays BELOW NADAC (3 of 10 drugs).

Only invoice lines of the 10 catalog drugs change (the same lines lib/match.ts matches to the
pool catalog: same name, strength and form, not extended-release). On those lines this script
rewrites unit_cost_per_package = round(unit price x package_size, 2) and
extended_cost = qty_shipped x unit_cost_per_package. In the labeled copy it also refreshes
nadac_per_unit, nadac_extended and variance_vs_nadac so the answer key stays consistent.
Every other column and every other line stays byte-for-byte the same.

The result depends only on data/cache/nadac.json and the line itself, so the script is
idempotent: running it again on its own output gives the same files. Run from anywhere:

    python3 data/synthetic/rebase_prices.py

Albuterol is priced per GM in the NADAC cache (not per inhaler), so the sample reference
price 21.85 per inhaler is used for it, like lib/data.ts does.
"""
from __future__ import annotations

import csv
import json
import re
import subprocess
import zlib
from pathlib import Path

ORIGINAL_COMMIT = "115d55c"
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
NADAC_JSON = REPO / "data" / "cache" / "nadac.json"
UPLOAD_CSV = HERE / "store-001" / "store001_upload_export.csv"
LABELED_CSV = HERE / "store-001" / "ground-truth" / "store001_invoice_lines_labeled.csv"

SPREAD, SPREAD_NEAR_ZERO = 2.0, 1.5  # percentage points

# drug id -> (description regex, nadac cache key or None, fallback unit price, base markup %)
DRUGS: dict[str, tuple[str, str | None, float | None, float]] = {
    "atorvastatin-20": (r"^ATORVASTATIN\b.* 20 MG TABLET\b", "atorvastatin-20mg-tablet", None, 18.0),
    "lisinopril-10": (r"^LISINOPRIL 10 MG TABLET\b", "lisinopril-10mg-tablet", None, 15.0),
    "amlodipine-5": (r"^AMLODIPINE\b.* 5 MG TABLET\b", "amlodipine-5mg-tablet", None, 12.0),
    "metformin-500": (r"^METFORMIN\b.* 500 MG TABLET\b", "metformin-500mg-tablet", None, 4.0),
    "sertraline-50": (r"^SERTRALINE\b.* 50 MG TABLET\b", "sertraline-50mg-tablet", None, -6.0),
    "amoxicillin-500": (r"^AMOXICILLIN 500 MG CAPSULE\b", "amoxicillin-500mg-capsule", None, -3.0),
    "albuterol-90": (r"^ALBUTEROL\b.* 90 MCG.* INHALER\b", None, 21.85, 9.0),
    "omeprazole-20": (r"^OMEPRAZOLE DR 20 MG CAPSULE\b", "omeprazole-20mg-dr-capsule", None, 21.0),
    "levothyroxine-50": (r"^LEVOTHYROXINE\b.* 50 MCG TABLET\b", "levothyroxine-50mcg-tablet", None, -9.0),
    "gabapentin-300": (r"^GABAPENTIN 300 MG CAPSULE\b", "gabapentin-300mg-capsule", None, 7.0),
}


def real_nadac(drug_id: str, cache: dict) -> float:
    _, key, fallback, _ = DRUGS[drug_id]
    if key is None:
        assert fallback is not None
        return fallback
    entry = cache["byDrug"][key]
    assert entry["pricingUnit"] == "EA", f"{key} is not priced per each"
    return round(float(entry["nadac"]), 5)


def markup_pct(drug_id: str, month: str) -> float:
    """Base markup +/- up to 2 points by month, deterministic, around the base."""
    base = DRUGS[drug_id][3]
    spread = SPREAD_NEAR_ZERO if abs(base) < 3.0 else SPREAD
    lo, hi = base - spread, base + spread
    u = zlib.crc32(f"{drug_id}|{month}".encode()) / 2**32
    return lo + (hi - lo) * u


def drug_of(description: str) -> str | None:
    for drug_id, (pattern, *_rest) in DRUGS.items():
        if re.search(pattern, description):
            return drug_id
    return None


def fmt(x: float) -> str:
    """Same look as the generator output: shortest repr, at most 2 decimals, no trailing zeros noise."""
    return repr(round(x, 2))


def original_text(path: Path) -> str:
    """Always start from Nathan's original export (git commit 115d55c) so reruns are idempotent."""
    rel = path.relative_to(REPO).as_posix()
    return subprocess.run(["git", "show", f"{ORIGINAL_COMMIT}:{rel}"], cwd=REPO, check=True,
                          capture_output=True, text=True, encoding="utf-8").stdout
def rebase(path: Path, labeled: bool, cache: dict) -> int:
    raw = original_text(path)
    eol = "\r\n" if "\r\n" in raw[:5000] else "\n"
    reader = csv.DictReader(raw.splitlines(keepends=False))
    fields = reader.fieldnames or []
    rows = list(reader)
    changed = 0
    for r in rows:
        drug_id = drug_of(r["product_description"])
        if drug_id is None:
            continue
        month = r["invoice_date"][:7]
        nadac = real_nadac(drug_id, cache)
        unit_price = nadac * (1 + markup_pct(drug_id, month) / 100)
        size = float(r["package_size"])
        qty = float(r["qty_shipped"])
        old_unit = float(r["unit_cost_per_package"])
        sign = -1.0 if old_unit < 0 else 1.0  # credits keep their sign convention
        new_unit = sign * round(unit_price * size, 2)
        new_ext = round(qty * new_unit, 2)
        r["unit_cost_per_package"] = fmt(new_unit)
        r["extended_cost"] = fmt(new_ext)
        if labeled and r["transaction_type"] == "INVOICE":
            r["nadac_per_unit"] = repr(nadac)
            nadac_ext = round(qty * size * nadac, 2)
            r["nadac_extended"] = fmt(nadac_ext)
            r["variance_vs_nadac"] = fmt(new_ext - nadac_ext)
        changed += 1
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator=eol)
        w.writeheader()
        w.writerows(rows)
    return changed


def main() -> None:
    cache = json.loads(NADAC_JSON.read_text(encoding="utf-8"))
    print(f"NADAC week {cache['effectiveDate']} ({NADAC_JSON.relative_to(REPO)})")
    for path, labeled in ((UPLOAD_CSV, False), (LABELED_CSV, True)):
        n = rebase(path, labeled, cache)
        print(f"{path.relative_to(REPO)}: {n} lines re-based")


if __name__ == "__main__":
    main()
