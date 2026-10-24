export default function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line bg-surface px-6 py-[18px] text-[12.5px] text-muted">
      <span>
        Benchmarks: CMS NADAC, FDA Orange Book, openFDA drug shortages. Member data anonymized and
        aggregated.
      </span>
      <span className="font-display uppercase tracking-[0.04em] text-ink">
        Pharma<span className="text-accent-ink">Pool</span> · Hackachusetts 2026
      </span>
    </footer>
  );
}
