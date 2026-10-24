"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppState } from "@/components/AppState";
import Button, { buttonClass } from "@/components/Button";
import AwardSection from "@/components/join/AwardSection";
import { usePlan } from "@/components/PlanState";
import { computePlan } from "@/components/plan";
import type { PlanDrug, PlanLine, PlanPart, PlanRound, PlanSwap } from "@/components/plan";
import SampleBadge from "@/components/SampleBadge";
import { useToast } from "@/components/Toast";
import type { QuotesView, RoundView } from "@/lib/data";
import { formatDollars, formatPercent } from "@/lib/format";

const DASH = "–";

function money(low: number, high: number): string {
  const a = formatDollars(low);
  const b = formatDollars(high);
  return a === b ? `${a}/yr` : `${a}${DASH}${b}/yr`;
}

interface Props {
  totalSpend: number;
  drugs: PlanDrug[];
  swaps: PlanSwap[];
  rounds: (PlanRound & { userJoined: boolean })[];
  quotes: QuotesView;
  quotesRound: RoundView | null;
}

function Section({
  title,
  what,
  part,
  href,
  cta,
  empty,
  onRemove,
  removeLabel,
}: {
  title: string;
  what: string;
  part: PlanPart;
  href: string;
  cta: string;
  empty: string;
  onRemove?: (line: PlanLine) => void;
  removeLabel?: string;
}) {
  return (
    <section className="card flex flex-col gap-3 p-5" aria-labelledby={`plan-${href}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`plan-${href}`} className="section-title">
            {title}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-muted">{what}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-[22px] tabular-nums">
            {part.items.length > 0 ? money(part.low, part.high) : "$0/yr"}
          </div>
          <Link href={href} className="text-[12.5px] font-bold">
            {cta}
          </Link>
        </div>
      </div>
      {part.items.length === 0 ? (
        <p className="m-0 rounded-[12px] bg-surface-2 px-3 py-2.5 text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {part.items.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 text-[13.5px]">
              <span className="font-bold">{l.label}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-good">
                  <span aria-hidden>▼ </span>
                  {money(l.low, l.high)}
                </span>
                {onRemove ? (
                  <Button variant="secondary" small onClick={() => onRemove(l)} aria-label={`${removeLabel ?? "Remove"}: ${l.label}`}>
                    {removeLabel ?? "Remove"}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AwardClient({ totalSpend, drugs, swaps, rounds, quotes, quotesRound }: Props) {
  const { state, approvedSwapDrugIds, undoSwap } = useAppState();
  const { plan: planState, setNegotiated } = usePlan();
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);

  const plan = useMemo(
    () =>
      computePlan({
        drugs,
        negotiated: planState.negotiated,
        swaps,
        approvedSwapIds: approvedSwapDrugIds,
        rounds,
        joinedRoundIds: rounds.filter((r) => r.userJoined || state.optIns[r.id]).map((r) => r.id),
      }),
    [drugs, swaps, rounds, planState.negotiated, approvedSwapDrugIds, state.optIns],
  );

  const pct = (n: number) => (totalSpend > 0 ? formatPercent((n / totalSpend) * 100) : "n/a");

  return (
    <section className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div>
        <h1 className="page-title">Award</h1>
        <p className="mt-2 max-w-[720px] text-muted">
          Your check-out. Everything you chose on Re-negotiate, Swap and Join, with the estimated savings per
          year. Review it, then confirm your plan.
        </p>
      </div>

      <div className="card-strong flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
            Estimated impact <SampleBadge label="Estimate" />
          </div>
          <div className="font-display text-[clamp(36px,4.4vw,56px)] leading-none tabular-nums">
            {plan.count > 0 ? money(plan.total.low, plan.total.high) : "$0/yr"}
          </div>
          <div className="mt-1 text-[13.5px] text-muted">
            {plan.count > 0
              ? `${pct(plan.total.low)}${DASH}${pct(plan.total.high)} of your ${formatDollars(totalSpend)} annual spend · ${plan.count} action${plan.count === 1 ? "" : "s"}`
              : "Nothing in your plan yet."}
          </div>
        </div>
        {confirmed ? (
          <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-4 py-2 text-[13px] font-extrabold text-good">
            <span aria-hidden>✓</span> Plan confirmed
          </span>
        ) : (
          <Button
            disabled={plan.count === 0}
            onClick={() => {
              setConfirmed(true);
              toast("Plan confirmed (demo). Your wholesaler and the pool are notified.");
            }}
          >
            Confirm plan
          </Button>
        )}
      </div>

      <Section
        title="Re-negotiate"
        what="Drugs you will ask your wholesaler to price closer to NADAC."
        part={plan.negotiate}
        href="/compare"
        cta="Open Re-negotiate"
        empty="No drugs chosen. Pick Negotiate on the drugs you overpay for."
        onRemove={(l) => {
          setNegotiated(l.id, false);
          setConfirmed(false);
          toast(`${l.label} removed from your plan`);
        }}
      />
      <Section
        title="Swap"
        what="Approved switches to FDA-rated equivalent generics."
        part={plan.swap}
        href="/swap"
        cta="Open Swap"
        empty="No swaps approved yet."
        removeLabel="Undo"
        onRemove={(l) => {
          undoSwap(l.id);
          setConfirmed(false);
          toast("Swap undone");
        }}
      />
      <Section
        title="Join"
        what="Buying rounds you joined with other pharmacies. Manage them on the Join page."
        part={plan.join}
        href="/join"
        cta="Open Join"
        empty="No rounds joined yet."
      />

      {quotesRound ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[13px] text-muted">
            Supplier quotes are in for the {quotesRound.name} round. Pick the supplier to award.
          </p>
          <AwardSection quotes={quotes} round={quotesRound} drugNames={quotes.products} />
        </div>
      ) : (
        <Link href="/join" className={buttonClass("secondary")}>
          Go to Join
        </Link>
      )}
    </section>
  );
}
