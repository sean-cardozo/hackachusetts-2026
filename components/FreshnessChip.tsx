interface FreshnessChipProps {
  status: "live" | "cached";
  nadacDate?: string;
  shortagesDate?: string;
}

export default function FreshnessChip({ status, nadacDate, shortagesDate }: FreshnessChipProps) {
  const live = status === "live";
  const text = live
    ? `Benchmarks: NADAC as of ${nadacDate ?? "n/a"} · FDA shortages as of ${shortagesDate ?? "n/a"}`
    : `Cached ${nadacDate ?? shortagesDate ?? ""}`.trim();
  return (
    <span
      title={text}
      className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line bg-surface-2 px-3 py-1 text-[12px] font-semibold text-muted"
    >
      <span
        aria-hidden
        className={`h-2 w-2 flex-none rounded-full ${live ? "bg-accent" : "bg-line-strong"}`}
        style={live ? { animation: "ppPulse 1.6s ease-in-out infinite" } : undefined}
      />
      {text}
    </span>
  );
}
