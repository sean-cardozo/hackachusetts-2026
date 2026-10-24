"use client";

import { ErrorState } from "@/components/StateViews";

export default function CompareError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <ErrorState message="We could not load the comparison data." onRetry={reset} />
    </section>
  );
}
