"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppStateProvider, useAppState } from "@/components/AppState";
import Button, { buttonClass } from "@/components/Button";
import LiveBadge from "@/components/LiveBadge";
import SampleBadge from "@/components/SampleBadge";
import SourceTip from "@/components/SourceTip";
import { EmptyState, LoadingState } from "@/components/StateViews";
import { useToast } from "@/components/Toast";
import { formatDollars, formatPercent } from "@/lib/format";
import type { SwapOption } from "@/lib/data";

export type SwapRow = SwapOption & {
  live: boolean;
  nadacDate: string | null;
  annualSpend: number | null;
  extraPct: number | null;
  roundName: string | null;
};

export type OtherEquivalent = { drugId: string; drugName: string; mfr: string; teCode: string };

export type RoundInfo = { id: string; name: string; progress: number | null; status: string };

interface Props {
  swaps: SwapRow[];
  genericsSpend: number;
  round: RoundInfo | null;
  others: OtherEquivalent[];
}

const TE_TIP = "FDA says this product is therapeutically equivalent.";

function money(v: number) {
  return `${formatDollars(v)}/yr`;
}

function TeCode({ code }: { code: string }) {
  return (
    <SourceTip source={TE_TIP}>
      <span className="font-mono text-[12.5px] font-bold">{code}</span>
    </SourceTip>
  );
}

function SwapCard({ swap }: { swap: SwapRow }) {
  const { state, approveSwap, undoSwap } = useAppState();
  const { toast } = useToast();
  const approved = state.swaps[swap.drugId]?.approved === true;
  const price = swap.benchmarkPrice;

  return (
    <article className={`${approved ? "card-accent" : "card"} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[17px] font-extrabold">{swap.drugName}</h3>
          <div className="text-[12.5px] text-muted">{swap.category}</div>
        </div>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1 text-[12.5px] font-extrabold text-good">
            <span aria-hidden>✓</span> Approved
          </span>
        ) : null}
      </div>

      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-[12px] bg-surface-2 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">Now</div>
          <div className="font-bold">{swap.nowMfr}</div>
        </div>
        <span aria-hidden className="hidden text-center text-[18px] font-extrabold sm:block">
          →
        </span>
        <div className="rounded-[12px] border-[1.5px] border-accent bg-surface p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink">
            Swap to
          </div>
          <div className="flex flex-wrap items-center gap-2 font-bold">
            {swap.toMfr} <TeCode code={swap.teCode} />
          </div>
        </div>
      </div>

      <dl className="m-0 grid gap-3 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Benchmark price
          </dt>
          <dd className="m-0 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            {price !== null ? (
              <SourceTip
                source={swap.live ? "CMS NADAC, live feed" : "CMS NADAC, sample reference price"}
                date={swap.nadacDate ?? undefined}
              >
                <span className="font-bold">${price.toFixed(4)} each</span>
              </SourceTip>
            ) : (
              <span className="text-muted">n/a</span>
            )}
            {swap.live ? <LiveBadge /> : <SampleBadge />}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Extra savings
          </dt>
          <dd className="m-0 mt-1 font-bold tabular-nums">
            <span className="text-good">▼ {money(swap.extraSavingsYr)}</span>
            {swap.extraPct !== null ? (
              <span className="text-muted"> ({formatPercent(swap.extraPct)})</span>
            ) : null}
            <div className="text-[12px] font-normal text-muted">less spend per year <SampleBadge /></div>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Unlocks round
          </dt>
          <dd className="m-0 mt-1 font-bold">{swap.roundName ?? "No round"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        {approved ? (
          <Button
            variant="secondary"
            small
            onClick={() => {
              undoSwap(swap.drugId);
              toast(`Undid swap for ${swap.drugName}`);
            }}
          >
            Undo
          </Button>
        ) : (
          <Button
            small
            onClick={() => {
              approveSwap(swap.drugId, swap.toMfr, swap.extraSavingsYr);
              toast(`Approved swap for ${swap.drugName}`);
            }}
          >
            Approve
          </Button>
        )}
        <span className="text-[12.5px] text-muted">You approve every swap before it&apos;s used.</span>
      </div>
    </article>
  );
}

function SwapView({ swaps, genericsSpend, round, others }: Props) {
  const { state, approveAllSwaps } = useAppState();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) {
    return <LoadingState label="Loading swaps" />;
  }
  if (swaps.length === 0) {
    return <EmptyState title="No swaps available" description="Your products have no equivalents that unlock a round." />;
  }

  const pending = swaps.filter((s) => state.swaps[s.drugId]?.approved !== true);
  const totalExtra = swaps.reduce((s, x) => s + x.extraSavingsYr, 0);
  const totalPct = genericsSpend > 0 ? (totalExtra / genericsSpend) * 100 : null;
  const roundName = round?.name ?? "the round";

  return (
    <>
      <div className="card-accent flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[640px]">
          <p className="m-0 text-[18px] font-extrabold leading-snug">
            {swaps.length} equivalent swaps available. Switching lets you join the {roundName} and
            save an extra {money(totalExtra)}
            {totalPct !== null ? ` (${formatPercent(totalPct)} of generics spend)` : ""}.
          </p>
          <p className="m-0 mt-1 text-[13px] text-muted">
            You approve every swap before it&apos;s used.
          </p>
        </div>
        {pending.length > 0 ? (
          <Button
            onClick={() => {
              approveAllSwaps(
                pending.map((s) => ({
                  drugId: s.drugId,
                  toMfr: s.toMfr,
                  extraSavingsYr: s.extraSavingsYr,
                })),
              );
              toast(`Approved ${pending.length} swap${pending.length === 1 ? "" : "s"}`);
            }}
          >
            Approve all
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-4 py-2 text-[13px] font-extrabold text-good">
            <span aria-hidden>✓</span> All swaps approved
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {swaps.map((s) => (
          <SwapCard key={s.drugId} swap={s} />
        ))}
      </div>

      {round ? (
        <div className="card-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Effect on the {round.name}</h2>
            <p className="m-0 mt-1 text-muted">
              Approved swaps let you join the {round.name} on the Join page.
              {round.progress !== null
                ? ` The round is at ${Math.round(round.progress)}% of its target (${round.status}).`
                : ""}
            </p>
          </div>
          <Link href="/join" className={buttonClass("strong")}>
            Go to Join
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="other-equivalents" className="flex flex-col gap-3">
        <h2 id="other-equivalents" className="section-title">
          Other equivalents
        </h2>
        {others.length === 0 ? (
          <div className="card p-5 text-muted">No other equivalents found.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 text-[11.5px] uppercase tracking-[0.06em] text-muted">
                  <th className="px-4 py-2 font-bold">Drug</th>
                  <th className="px-4 py-2 font-bold">Equivalent manufacturer</th>
                  <th className="px-4 py-2 font-bold">TE code</th>
                  <th className="px-4 py-2 text-right font-bold">
                    <span className="sr-only">Open in Compare</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {others.map((o) => (
                  <tr key={`${o.drugId}|${o.mfr}|${o.teCode}`} className="border-t border-line">
                    <td className="px-4 py-2 font-bold">
                      <Link
                        href="/compare"
                        className="text-ink no-underline hover:underline focus-visible:underline"
                      >
                        {o.drugName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{o.mfr}</td>
                    <td className="px-4 py-2">
                      <TeCode code={o.teCode} />
                    </td>
                    <td className="px-4 py-2 text-right text-accent-ink" aria-hidden>
                      →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** Uses the shared App State when the layout provides it, else a local provider (same localStorage). */
function WithState(props: Props) {
  let hasProvider = true;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAppState();
  } catch {
    hasProvider = false;
  }
  return hasProvider ? (
    <SwapView {...props} />
  ) : (
    <AppStateProvider>
      <SwapView {...props} />
    </AppStateProvider>
  );
}

export default function SwapClient(props: Props) {
  return (
    <section className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div>
        <h1 className="page-title">Swap</h1>
        <p className="mt-2 max-w-[720px] text-muted">
          Switch to an FDA-rated equivalent product from another manufacturer so you can join a
          buying round. You approve every swap before it&apos;s used.
        </p>
      </div>
      <WithState {...props} />
    </section>
  );
}
