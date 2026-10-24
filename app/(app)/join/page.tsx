import RequireUpload from "@/components/RequireUpload";
import JoinClient from "@/components/join/JoinClient";
import type { JoinDrug, JoinSwap } from "@/components/join/helpers";
import { ErrorState } from "@/components/StateViews";
import { getDrugViews, getRounds, getSwapOptions } from "@/lib/data";

export default function JoinPage() {
  try {
    const rounds = getRounds();
    const drugs: JoinDrug[] = getDrugViews().map((d) => ({
      id: d.id,
      name: d.name,
      strength: d.strength,
      unitsPerMonth: d.unitsPerMonth,
      recommendedCommitment: d.recommendedCommitment,
    }));
    const swaps: JoinSwap[] = getSwapOptions().map((s) => ({
      drugId: s.drugId,
      roundId: s.roundId,
      toMfr: s.toMfr,
    }));
    return (
      <RequireUpload title="Join">
        <section className="mx-auto w-full max-w-[1280px]">
          <JoinClient rounds={rounds} drugs={drugs} swaps={swaps} />
        </section>
      </RequireUpload>
    );
  } catch {
    return (
      <section className="mx-auto w-full max-w-[1280px]">
        <h1 className="page-title">Join</h1>
        <div className="mt-6">
          <ErrorState message="The rounds could not be loaded. Reload the page to try again." />
        </div>
      </section>
    );
  }
}
