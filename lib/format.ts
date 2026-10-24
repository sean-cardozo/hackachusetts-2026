// Display helpers. Plain text only: no color information, tabular-friendly.

const NA = "—";

/**
 * Format dollars. Below $1,000 shows whole dollars; thousands use "k" and
 * millions use "M", each with one decimal (e.g. "$23.3k", "$1.2M").
 * Pass { compact: false } for full dollars with thousands separators.
 */
export function formatDollars(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return NA;
  const compact = opts.compact ?? true;
  const abs = Math.abs(value);
  const sign = value < 0 && Math.round(abs) > 0 ? "-" : "";

  if (!compact) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;

  if (Math.round(abs) < 1000) return `${sign}$${Math.round(abs)}`;

  const k = Math.round((abs / 1000) * 10) / 10;
  if (k < 1000) return `${sign}$${k.toFixed(1)}k`;

  const m = Math.round((abs / 1_000_000) * 10) / 10;
  return `${sign}$${m.toFixed(1)}M`;
}

/** Format a percentage value (11.2 -> "11.2%"). */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return NA;
  const text = value.toFixed(digits);
  return `${Number(text) === 0 ? (0).toFixed(digits) : text}%`;
}

/** Format a savings pair, e.g. "$23.3k/yr (11.2%)". */
export function formatSavings(dollarsPerYear: number, pct?: number): string {
  const base = `${formatDollars(dollarsPerYear)}/yr`;
  if (pct === undefined) return base;
  return `${base} (${formatPercent(pct)})`;
}
