"use client";
import { ErrorState } from "@/components/StateViews";

export default function SummaryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <h1 className="page-title">Summary</h1>
      <div className="mt-6">
        <ErrorState message="We could not load the summary. Your data is unchanged." onRetry={reset} />
      </div>
    </section>
  );
}
