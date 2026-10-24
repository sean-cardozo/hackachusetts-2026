export default function GapPill({ gapPct }: { gapPct: number | null }) {
  if (gapPct === null || Number.isNaN(gapPct)) {
    return (
      <span className="inline-flex items-center rounded-full border-[1.5px] border-line-strong px-2.5 py-0.5 text-[12px] font-extrabold text-muted">
        n/a
      </span>
    );
  }
  const above = gapPct > 0;
  const pct = Math.abs(gapPct).toFixed(1).replace(/\.0$/, "");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${
        above ? "bg-bad-soft text-bad" : "bg-good-soft text-good"
      }`}
    >
      <span aria-hidden>{above ? "▲" : "▼"}</span>
      {pct}% {above ? "above" : "below"}
    </span>
  );
}
