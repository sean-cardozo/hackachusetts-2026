import SummaryClient from "@/components/summary/SummaryClient";
import type { SummaryProps } from "@/components/summary/SummaryClient";
import { BRAND_SPEND, OTC_SPEND, getDrugViews, getQuotes, getRounds, getSwapOptions } from "@/lib/data";

/** "YYYY-MM" twelve months before the month of an ISO timestamp (start of the 24 month chart). */
function chartStartMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  const y = m ? Number(m[1]) : 2026;
  const mo = m ? Number(m[2]) : 10;
  const idx = y * 12 + (mo - 1) - 12;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export default function SummaryPage() {
  const drugs = getDrugViews();
  const rounds = getRounds();
  const swaps = getSwapOptions();
  const quotes = getQuotes();

  const benches = drugs.map((d) => d.benchmarkSpend);
  const props: SummaryProps = {
    genericsSpend: drugs.reduce((s, d) => s + (d.annualSpend ?? 0), 0),
    genericsBenchmark: benches.some((b) => b === null)
      ? null
      : benches.reduce<number>((s, b) => s + (b ?? 0), 0),
    brandSpend: BRAND_SPEND,
    otcSpend: OTC_SPEND,
    swapOptions: swaps.map((s) => ({
      drugId: s.drugId,
      drugName: s.drugName,
      toMfr: s.toMfr,
      extraSavingsYr: s.extraSavingsYr,
    })),
    rounds: rounds.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      drugIds: r.drugs,
      estLow: r.estSavingsUsd?.low ?? null,
      estHigh: r.estSavingsUsd?.high ?? null,
      userSpendUsd: r.userSpendUsd ?? null,
    })),
    drugs: drugs.map((d) => ({
      id: d.id,
      name: d.name,
      daysOfSupply: d.daysOfSupply,
      shortageCurrent: d.shortage.current,
      gapPct: d.gapPct,
      nadacLive: d.nadacSource === "live",
      savingsLow: d.savings?.low ?? null,
      savingsHigh: d.savings?.high ?? null,
    })),
    nadacDate:
      drugs
        .map((d) => d.nadacEffectiveDate)
        .filter((x): x is string => !!x)
        .sort()
        .pop() ?? null,
    startMonth: chartStartMonth(rounds[0]?.anchors.demoNow ?? "2026-10-24"),
    quotedPctBySupplier: Object.fromEntries(quotes.quotes.map((q) => [q.supplier, q.quotedPct])),
    quotesRoundId: quotes.roundId,
    quotesRoundName: rounds.find((r) => r.id === quotes.roundId)?.name ?? "Diabetes & thyroid",
  };

  return <SummaryClient {...props} />;
}
