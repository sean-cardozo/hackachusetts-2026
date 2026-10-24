import RequireUpload from "@/components/RequireUpload";
import CompareClient from "@/components/compare/CompareClient";
import { getDrugViews, getRounds, getSwapOptions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function ComparePage() {
  const drugs = getDrugViews();
  const rounds = getRounds();
  const swapOptions = getSwapOptions();
  return (
    <RequireUpload title="Re-negotiate">
      <CompareClient drugs={drugs} rounds={rounds} swapOptions={swapOptions} />
    </RequireUpload>
  );
}
