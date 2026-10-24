import AwardClient from "@/components/award/AwardClient";
import RequireUpload from "@/components/RequireUpload";
import { ErrorState } from "@/components/StateViews";
import { BRAND_SPEND, OTC_SPEND, getDrugViews, getQuotes, getRounds, getSwapOptions } from "@/lib/data";

export default function AwardPage() {
  try {
    const drugs = getDrugViews();
    const rounds = getRounds();
    const swaps = getSwapOptions();
    const quotes = getQuotes();
    const genericsSpend = drugs.reduce((s, d) => s + (d.annualSpend ?? 0), 0);
    return (
      <RequireUpload title="Award">
        <AwardClient
          totalSpend={genericsSpend + BRAND_SPEND + OTC_SPEND}
          drugs={drugs.map((d) => ({
            id: d.id,
            name: d.name,
            savingsLow: d.savings?.low ?? null,
            savingsHigh: d.savings?.high ?? null,
          }))}
          swaps={swaps.map((s) => ({
            drugId: s.drugId,
            drugName: s.drugName,
            toMfr: s.toMfr,
            extraSavingsYr: s.extraSavingsYr,
          }))}
          rounds={rounds.map((r) => ({
            id: r.id,
            name: r.name,
            estLow: r.estSavingsUsd?.low ?? null,
            estHigh: r.estSavingsUsd?.high ?? null,
            userSpendUsd: r.userSpendUsd ?? null,
            userJoined: Boolean(r.userJoined),
          }))}
          quotes={quotes}
          quotesRound={rounds.find((r) => r.id === quotes.roundId) ?? null}
        />
      </RequireUpload>
    );
  } catch {
    return (
      <section className="mx-auto w-full max-w-[1100px]">
        <h1 className="page-title">Award</h1>
        <div className="mt-4">
          <ErrorState message="Your plan could not be loaded. Reload the page to try again." />
        </div>
      </section>
    );
  }
}
