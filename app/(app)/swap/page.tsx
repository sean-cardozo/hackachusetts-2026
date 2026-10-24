import RequireUpload from "@/components/RequireUpload";
import SwapClient from "@/components/swap/SwapClient";
import type { OtherEquivalent, SwapRow } from "@/components/swap/SwapClient";
import { ErrorState } from "@/components/StateViews";
import { getDrugViews, getRounds, getSwapOptions } from "@/lib/data";

export default function SwapPage() {
  try {
    const options = getSwapOptions();
    const drugs = getDrugViews();
    const rounds = getRounds();

    const swaps: SwapRow[] = options.map((o) => {
      const drug = drugs.find((d) => d.id === o.drugId);
      const spend = drug?.annualSpend ?? null;
      const round = rounds.find((r) => r.id === o.roundId);
      return {
        ...o,
        live: drug?.nadacSource === "live",
        nadacDate: drug?.nadacEffectiveDate ?? null,
        annualSpend: spend,
        extraPct: spend && spend > 0 ? (o.extraSavingsYr / spend) * 100 : null,
        roundName: round?.name ?? null,
      };
    });

    const genericsSpend = drugs.reduce((s, d) => s + (d.annualSpend ?? 0), 0);

    const round = rounds.find((r) => swaps.some((s) => s.roundId === r.id));
    const roundInfo = round
      ? { id: round.id, name: round.name, progress: round.progress, status: round.displayStatus }
      : null;

    const swapDrugIds = new Set(options.map((o) => o.drugId));
    const others: OtherEquivalent[] = [];
    for (const d of drugs) {
      for (const e of d.equivalents) {
        if (e.extraSavingsYr !== undefined) continue;
        if (swapDrugIds.has(d.id) && e.sampleExtra) continue;
        others.push({ drugId: d.id, drugName: d.name, mfr: e.mfr, teCode: e.teCode });
      }
    }

    return (
      <RequireUpload title="Swap">
        <SwapClient
          swaps={swaps}
          genericsSpend={genericsSpend}
          round={roundInfo}
          others={others}
        />
      </RequireUpload>
    );
  } catch {
    return (
      <section className="mx-auto w-full max-w-[1100px]">
        <h1 className="page-title">Swap</h1>
        <div className="mt-4">
          <ErrorState message="Swaps could not be loaded. Reload the page to try again." />
        </div>
      </section>
    );
  }
}
