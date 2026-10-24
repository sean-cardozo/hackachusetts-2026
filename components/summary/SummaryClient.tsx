"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppState } from "@/components/AppState";
import { buttonClass } from "@/components/Button";
import HeroNumber from "@/components/HeroNumber";
import LiveBadge from "@/components/LiveBadge";
import SampleBadge from "@/components/SampleBadge";
import SourceTip from "@/components/SourceTip";
import StatCard from "@/components/StatCard";
import { usePlan } from "@/components/PlanState";
import { EmptyState } from "@/components/StateViews";
import { computePlan } from "@/components/plan";
import { monthlySeries, savingsByStep, summaryFigures } from "@/lib/calc";
import type { SavingsFigure } from "@/lib/calc";
import { formatDollars, formatPercent } from "@/lib/format";

export type SummaryProps = {
  genericsSpend: number;
  genericsBenchmark: number | null;
  brandSpend: number;
  otcSpend: number;
  swapOptions: { drugId: string; drugName: string; toMfr: string; extraSavingsYr: number }[];
  rounds: {
    id: string;
    name: string;
    status: string;
    drugIds: string[];
    estLow: number | null;
    estHigh: number | null;
    userSpendUsd: number | null;
    userJoined: boolean;
  }[];
  drugs: {
    id: string;
    name: string;
    daysOfSupply: number | null;
    shortageCurrent: boolean;
    gapPct: number | null;
    nadacLive: boolean;
    savingsLow: number | null;
    savingsHigh: number | null;
  }[];
  nadacDate: string | null;
  startMonth: string;
  quotedPctBySupplier: Record<string, number>;
  quotesRoundId: string;
  quotesRoundName: string;
};

/** Estimated round range before quotes arrive (Requirement 4.3: "Estimated 8-14%"). */
const ESTIMATED_PCT: [number, number] = [8, 14];
const SHORTAGE_DAYS = 14;
const DASH = "\u2013";

function range(low: number, high: number, fmt: (n: number) => string): string {
  return fmt(low) === fmt(high) ? fmt(low) : `${fmt(low)}${DASH}${fmt(high)}`;
}
function dollarRange(f: { low: number; high: number }): string {
  return range(f.low, f.high, (n) => formatDollars(n));
}
function pctRange(f: SavingsFigure): string {
  if (f.pctLow === null || f.pctHigh === null) return "n/a";
  return range(f.pctLow, f.pctHigh, (n) => formatPercent(n));
}
function pctOfSpend(dollars: number, spend: number): number | null {
  return spend > 0 ? (dollars / spend) * 100 : null;
}

/** Count-up from `from` to `to` over ~1.4 s. Jumps straight to `to` with reduced motion. */
function useCountUp(from: number, to: number, active: boolean): number {
  const [value, setValue] = useState(active ? from : to);
  useEffect(() => {
    if (!active) {
      setValue(to);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1400);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setValue(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, active]);
  return value;
}

function SavingsPair({ f, className = "" }: { f: SavingsFigure | null; className?: string }) {
  if (!f) return <span className={`text-muted ${className}`}>n/a</span>;
  return (
    <span className={`tabular-nums ${className}`}>
      <strong>{dollarRange(f)}/yr</strong> <span className="text-muted">({pctRange(f)})</span>
    </span>
  );
}

type Rec = {
  key: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  done: boolean;
  urgent?: boolean;
  savings: SavingsFigure | null;
};

export default function SummaryClient(props: SummaryProps) {
  const { state, approvedSwapDrugIds } = useAppState();
  const { plan: planState } = usePlan();
  const plan = useMemo(
    () =>
      computePlan({
        drugs: props.drugs,
        negotiated: planState.negotiated,
        swaps: props.swapOptions,
        approvedSwapIds: approvedSwapDrugIds,
        rounds: props.rounds,
        joinedRoundIds: props.rounds.filter((r) => r.userJoined || state.optIns[r.id]).map((r) => r.id),
      }),
    [props.drugs, props.swapOptions, props.rounds, planState.negotiated, approvedSwapDrugIds, state.optIns],
  );
  // Join potential: every round you could join (ended ones count as their next round), valued like the plan.
  const joinPotential = useMemo(
    () =>
      computePlan({
        drugs: [],
        negotiated: [],
        swaps: [],
        approvedSwapIds: [],
        rounds: props.rounds,
        joinedRoundIds: props.rounds.map((r) => r.id),
      }).join,
    [props.rounds],
  );

  const approved = useMemo(() => new Set(approvedSwapDrugIds), [approvedSwapDrugIds]);
  const approvedExtras = props.swapOptions
    .filter((s) => approved.has(s.drugId))
    .reduce((s, o) => s + o.extraSavingsYr, 0);
  const potentialExtras = props.swapOptions.reduce((s, o) => s + o.extraSavingsYr, 0);

  const figures = useMemo(
    () =>
      summaryFigures({
        generics: { spend: props.genericsSpend, benchmark: props.genericsBenchmark, swapExtras: approvedExtras },
        brand: { spend: props.brandSpend },
        otc: { spend: props.otcSpend },
      }),
    [props.genericsSpend, props.genericsBenchmark, props.brandSpend, props.otcSpend, approvedExtras],
  );
  const total = figures.totalSpend;

  const steps = useMemo(
    () =>
      savingsByStep({
        totalAnnualSpend: total,
        generics: { spend: props.genericsSpend, benchmark: props.genericsBenchmark },
        approvedSwapExtras: approvedExtras,
        potentialSwapExtras: potentialExtras,
        rounds: props.rounds.flatMap((r) =>
          r.estLow !== null && r.estHigh !== null ? [{ low: r.estLow, high: r.estHigh }] : [],
        ),
      }),
    [total, props.genericsSpend, props.genericsBenchmark, props.rounds, approvedExtras, potentialExtras],
  );

  const series = useMemo(
    () =>
      figures.total
        ? monthlySeries({
            totalAnnual: total,
            todayIndex: 12,
            months: 24,
            startMonth: props.startMonth,
            annualSavingsRange: { low: figures.total.low, high: figures.total.high },
          })
        : null,
    [figures.total, total, props.startMonth],
  );

  const chartData = useMemo(() => {
    if (!series) return [];
    return series.points.map((p) => {
      const isActual = p.monthIndex < series.todayIndex;
      const joint = p.monthIndex === series.todayIndex - 1;
      const mid = (p.projectedWithLow + p.projectedWithHigh) / 2;
      return {
        label: p.label ?? `M${p.monthIndex + 1}`,
        actual: isActual ? Math.round(p.actual ?? p.projectedWithout) : undefined,
        without: !isActual || joint ? Math.round(p.projectedWithout) : undefined,
        withMid: !isActual || joint ? Math.round(mid) : undefined,
        bandBase: !isActual || joint ? Math.round(p.projectedWithHigh) : undefined,
        bandSize: !isActual || joint ? Math.round(p.projectedWithLow - p.projectedWithHigh) : undefined,
      };
    });
  }, [series]);
  const todayLabel = series ? chartData[series.todayIndex - 1]?.label : undefined;
  // Y axis starts just below the lowest value (not at $0) so month-to-month movement is visible.
  const yMin = useMemo(() => {
    const vals = chartData.flatMap((d) => [d.actual, d.without, d.withMid, d.bandBase]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return 0;
    return Math.max(0, Math.floor((Math.min(...vals) * 0.9) / 10000) * 10000);
  }, [chartData]);

  // Re-negotiate potential: the same per-drug sum the Re-negotiate page shows (drugs above NADAC).
  const negotiatePotential = useMemo<SavingsFigure>(() => {
    const above = props.drugs.filter((d) => d.gapPct !== null && d.gapPct > 0 && (d.savingsHigh ?? 0) > 0);
    const low = above.reduce((s, d) => s + (d.savingsLow ?? 0), 0);
    const high = above.reduce((s, d) => s + (d.savingsHigh ?? 0), 0);
    return { low, high, pctLow: pctOfSpend(low, total), pctHigh: pctOfSpend(high, total) };
  }, [props.drugs, total]);

  // Shortage alert and stats.
  const shortages = props.drugs
    .filter((d) => d.shortageCurrent && d.daysOfSupply !== null && d.daysOfSupply < SHORTAGE_DAYS)
    .sort((a, b) => (a.daysOfSupply ?? 0) - (b.daysOfSupply ?? 0));
  const lowSupply = props.drugs.filter((d) => d.daysOfSupply !== null && d.daysOfSupply < SHORTAGE_DAYS).length;
  const aboveNadac = props.drugs.filter((d) => d.gapPct !== null && d.gapPct > 0).length;
  const openRounds = props.rounds.filter((r) => ["open", "target", "quotes"].includes(r.status)).length;
  const anyLive = props.drugs.some((d) => d.nadacLive);

  // Recommendations, ranked: shortage, swaps, Cardio round, atorvastatin review.
  const recs = useMemo<Rec[]>(() => {
    const out: Rec[] = [];
    const fig = (low: number, high: number): SavingsFigure => ({
      low,
      high,
      pctLow: pctOfSpend(low, total),
      pctHigh: pctOfSpend(high, total),
    });
    const roundFig = (r?: SummaryProps["rounds"][number]) =>
      r && r.estLow !== null && r.estHigh !== null
        ? fig(r.estLow, r.estHigh)
        : r && r.userSpendUsd
          ? fig((r.userSpendUsd * ESTIMATED_PCT[0]) / 100, (r.userSpendUsd * ESTIMATED_PCT[1]) / 100)
          : null;

    const worst = shortages[0];
    if (worst) {
      const r = props.rounds.find((x) => x.drugIds.includes(worst.id));
      out.push({
        key: "shortage",
        title: `Secure ${worst.name} now`,
        detail: `${worst.daysOfSupply} days of supply left and an active shortage.${r ? ` Join the ${r.name} round to lock in supply.` : ""}`,
        href: "/join",
        cta: "Go to Join",
        done: r ? !!state.optIns[r.id] : false,
        urgent: true,
        savings: roundFig(r) ?? (worst.savingsLow !== null && worst.savingsHigh !== null ? fig(worst.savingsLow, worst.savingsHigh) : null),
      });
    }
    const pending = props.swapOptions.filter((s) => !approved.has(s.drugId));
    if (props.swapOptions.length > 0) {
      const sum = (pending.length ? pending : props.swapOptions).reduce((s, o) => s + o.extraSavingsYr, 0);
      out.push({
        key: "swaps",
        title: pending.length ? `Approve ${pending.length} swap${pending.length === 1 ? "" : "s"}` : `Approved all ${props.swapOptions.length} swaps`,
        detail: "Same drug, a lower cost manufacturer. No change for your patients.",
        href: "/swap",
        cta: pending.length ? "Review swaps" : "View swaps",
        done: pending.length === 0,
        savings: fig(sum, sum),
      });
    }
    const cardio = props.rounds.find((r) => /cardio/i.test(r.name));
    if (cardio) {
      out.push({
        key: "cardio",
        title: `Opt in to the ${cardio.name} round`,
        detail: "Pool your volume with other pharmacies for a better supplier quote.",
        href: "/join",
        cta: "Opt in",
        done: !!state.optIns[cardio.id],
        savings: roundFig(cardio),
      });
    }
    const ator = props.drugs.find((d) => /atorvastatin/i.test(d.name));
    if (ator) {
      out.push({
        key: "ator",
        title: "Review atorvastatin vs NADAC",
        detail: "You pay above the national average acquisition cost.",
        href: "/compare",
        cta: "Re-negotiate",
        done: false,
        savings: ator.savingsLow !== null && ator.savingsHigh !== null ? fig(ator.savingsLow, ator.savingsHigh) : null,
      });
    }
    return out;
  }, [shortages, props.rounds, props.swapOptions, props.drugs, approved, state.optIns, total]);

  // Award headline: Estimated 8-14% -> Quoted X%.
  const award = state.award;
  const quoted = award ? (props.quotedPctBySupplier[award.supplier] ?? null) : null;
  const animate = quoted !== null;
  const shown = useCountUp(ESTIMATED_PCT[0], quoted ?? ESTIMATED_PCT[0], animate);
  const awardRound = props.rounds.find((r) => r.id === (award?.roundId ?? props.quotesRoundId));
  const quotedDollars =
    quoted !== null && awardRound?.userSpendUsd ? (awardRound.userSpendUsd * quoted) / 100 : null;

  if (!figures.total) {
    return (
      <section className="mx-auto w-full max-w-[1280px]">
        <h1 className="page-title">Summary</h1>
        <div className="mt-6">
          <EmptyState
            title="No savings estimate yet"
            description="Upload your purchase data to see what you could save."
            action={
              <Link href="/upload" className={buttonClass("primary")}>
                Upload data
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  const bars = [
    { key: "generics", label: "Generics", b: figures.breakdown.generics, note: "50\u201385% of the gap to NADAC, plus approved swaps." },
    { key: "brand", label: "Brand", b: figures.breakdown.brand, note: "Wholesaler tier, prompt-pay discount and shared rebates." },
    { key: "otc", label: "OTC & supplies", b: figures.breakdown.otc, note: "Pooled volume on store brand and supplies." },
  ];
  const maxHigh = Math.max(...bars.map((x) => x.b.savings?.high ?? 0), 1);
  const fmtAxis = (v: number) => formatDollars(v);

  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Summary</h1>
        <SampleBadge label="Sample pharmacy" />
      </div>

      {shortages.length > 0 ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-l-4 border-line border-l-bad bg-surface px-4 py-3">
          <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-bad text-[13px] font-extrabold text-white">
            !
          </span>
          <strong className="text-ink">Shortage alert</strong>
          <span className="flex-1 text-[14px]">
            {shortages.map((d) => `${d.name}: ${d.daysOfSupply} days of supply`).join("; ")}. Order or join a round before you run out.
          </span>
          <Link href="/join" className={buttonClass("primary", true)}>
            Go to Join
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="card-accent flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-bg">Estimated</span>
            {anyLive ? <LiveBadge /> : null}
            <SampleBadge />
            <span className="text-[12px] text-muted">
              Prices from <SourceTip source="CMS NADAC" date={props.nadacDate ?? undefined}>CMS NADAC</SourceTip>
              {props.nadacDate ? ` (${props.nadacDate})` : ""}
            </span>
          </div>

          {quoted !== null ? (
            <div aria-live="polite" className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[12px] bg-surface px-4 py-3">
              <span className="text-[14px] text-muted line-through">
                Estimated {ESTIMATED_PCT[0]}{DASH}{ESTIMATED_PCT[1]}%
              </span>
              <span className="font-display text-[34px] leading-none tabular-nums">Quoted {formatPercent(shown)}</span>
              {quotedDollars !== null ? (
                <span className="text-[13px] text-muted tabular-nums">
                  {formatDollars(quotedDollars)}/yr on {awardRound?.name ?? props.quotesRoundName}
                </span>
              ) : null}
            </div>
          ) : null}

          <HeroNumber label="Estimated savings per year">
            {dollarRange(figures.total)}
          </HeroNumber>
          <p className="m-0 text-[15px] font-bold tabular-nums">
            {pctRange(figures.total)} of {formatDollars(total)} annual spend
          </p>
          {figures.includedSwapExtras > 0 ? (
            <p className="m-0 text-[13.5px] font-semibold text-good">
              Includes {formatDollars(figures.includedSwapExtras)} from approved swaps.
            </p>
          ) : null}
          {figures.incomplete ? (
            <p className="m-0 text-[12.5px] text-muted">Partial estimate: some prices are missing.</p>
          ) : null}

          <h2 className="section-title mt-2 !text-[20px]">Spend mix</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {bars.map((x) => (
              <li key={x.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
                  <span className="font-extrabold">{x.label}</span>
                  <span className="tabular-nums text-muted">{formatDollars(x.b.spend)} spend</span>
                </div>
                <div className="my-1 h-2.5 w-full rounded-full bg-accent-soft" role="img" aria-label={`${x.label} share of savings`}>
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, ((x.b.savings?.high ?? 0) / maxHigh) * 100)}%` }}
                  />
                </div>
                <div className="text-[13px]">
                  <SavingsPair f={x.b.savings} /> <span className="text-muted">· {x.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Monthly purchases</h2>
            <SampleBadge />
          </div>
          {series ? (
            <>
              <div className="min-h-[320px] w-full flex-1" role="img" aria-label={`Monthly purchases: 12 months actual, then 12 months projected with and without PharmaPool. Projected 12 month savings ${dollarRange(series.projected12MonthSavings)} per year.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={56} domain={[yMin, "auto"]} allowDataOverflow />
                    <Tooltip formatter={(v) => formatDollars(Number(v ?? 0))} />
                    <Area dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none" />
                    <Area dataKey="bandSize" stackId="band" stroke="none" fill="#0f9f7a" fillOpacity={0.22} isAnimationActive={false} name="Savings band" />
                    <Line dataKey="actual" name="Actual" stroke="#0e2742" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line dataKey="without" name="Without PharmaPool" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line dataKey="withMid" name="With PharmaPool" stroke="#0f9f7a" strokeWidth={3} dot={false} isAnimationActive={false} />
                    {todayLabel ? (
                      <ReferenceLine x={todayLabel} stroke="#0f1d33" strokeDasharray="2 3" label={{ value: "Today", position: "insideTopRight", fontSize: 11, fontWeight: 700 }} />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12.5px] text-muted">
                <li><span aria-hidden className="mr-1 inline-block h-[3px] w-5 bg-ink align-middle" />Actual</li>
                <li><span aria-hidden className="mr-1 inline-block h-0 w-5 border-t-2 border-dashed border-muted align-middle" />Without PharmaPool</li>
                <li><span aria-hidden className="mr-1 inline-block h-[3px] w-5 bg-accent align-middle" />With PharmaPool (shaded: low to high)</li>
              </ul>
              <p className="m-0 text-[14px] tabular-nums">
                Projected 12-month savings: <strong>{dollarRange(series.projected12MonthSavings)}</strong>{" "}
                <span className="text-muted">({pctRange(series.projected12MonthSavings)}, ramps up over the first 4 months)</span>
              </p>
            </>
          ) : (
            <EmptyState title="No chart yet" description="Add purchase data to see projections." />
          )}
        </div>
      </div>

      <div>
        <div className="card-accent mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-accent-ink">Your plan so far</div>
            <div className="font-display text-[28px] leading-tight tabular-nums text-ink">
              {plan.count > 0 ? `${dollarRange(plan.total)}/yr` : "$0/yr"}
            </div>
            <div className="text-[13px] text-muted">
              {plan.count > 0
                ? `${plan.count} action${plan.count === 1 ? "" : "s"}: ${plan.negotiate.items.length} to re-negotiate, ${plan.swap.items.length} swap${plan.swap.items.length === 1 ? "" : "s"}, ${plan.join.items.length} round${plan.join.items.length === 1 ? "" : "s"} joined. Updates as you act on each tab.`
                : "Nothing chosen yet. Pick actions on Re-negotiate, Swap and Join."}
            </div>
          </div>
          <Link href="/award" className={buttonClass("primary", true)}>
            Review in Award
          </Link>
        </div>
        <h2 className="section-title mb-3">Savings by step</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Re-negotiate",
              f: negotiatePotential,
              href: "/compare",
              sub: "Negotiate your own prices with your wholesaler, using NADAC as the benchmark.",
              inPlan: plan.negotiate,
            },
            {
              name: "Swap potential",
              f: steps.swap.potential,
              href: "/swap",
              sub: "Switch from brand or higher-cost products to FDA-rated equivalent generics.",
              inPlan: plan.swap,
            },
            {
              name: "Join",
              f: {
                low: joinPotential.low,
                high: joinPotential.high,
                pctLow: pctOfSpend(joinPotential.low, total),
                pctHigh: pctOfSpend(joinPotential.high, total),
              },
              href: "/join",
              sub: "Extra savings from pooling your volume with other pharmacies.",
              inPlan: plan.join,
            },
          ].map((s) => (
            <Link key={s.name} href={s.href} className="card flex flex-col gap-1 p-4 no-underline hover:border-line-strong">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{s.name}</span>
              <span className="font-display text-[30px] leading-none tabular-nums text-ink">
                {s.f ? `${dollarRange(s.f)}/yr` : "n/a"}
              </span>
              <span className="text-[14px] font-bold tabular-nums text-ink">{s.f ? pctRange(s.f) : ""}</span>
              <span className="text-[12.5px] text-muted">{s.sub}</span>
              <span className="mt-1 border-t border-line pt-2 text-[12.5px] font-bold tabular-nums">
                {s.inPlan.items.length > 0 ? (
                  <span className="text-good">
                    <span aria-hidden>✓ </span>In your plan: {dollarRange(s.inPlan)}/yr
                  </span>
                ) : (
                  <span className="text-muted">Not in your plan yet</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="section-title mb-3">Key recommendations</h2>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {recs.map((r, i) => (
            <li
              key={r.key}
              className={`flex flex-wrap items-center gap-4 p-4 ${r.urgent && !r.done ? "card-strong" : "card"}`}
            >
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[18px] ${
                  r.done ? "bg-good text-white" : "bg-accent text-white"
                }`}
              >
                {r.done ? "\u2713" : i + 1}
              </span>
              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[15.5px]">{r.title}</strong>
                  {r.urgent && !r.done ? <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-bad">Urgent</span> : null}
                  {r.done ? <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-good">Done</span> : null}
                </div>
                <div className="text-[13px] text-muted">{r.detail}</div>
              </div>
              <div className="text-[14px]">
                <SavingsPair f={r.savings} />
              </div>
              <Link href={r.href} className={buttonClass(r.done ? "secondary" : "primary", true)}>
                {r.done ? "View" : r.cta}
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Annual spend" value={formatDollars(total)} badge={<SampleBadge />} sub="Generics, brand, OTC & supplies" />
        <StatCard
          label="Above NADAC"
          value={`${aboveNadac} of ${props.drugs.length}`}
          badge={anyLive ? <LiveBadge /> : <SampleBadge />}
          sub="Drugs priced over the national average"
        />
        <StatCard
          label="Under 14 days"
          value={lowSupply}
          badge={<SampleBadge />}
          sub={lowSupply ? "Drugs with low days of supply" : "No drugs running low"}
        />
        <StatCard label="Open rounds" value={openRounds} badge={<SampleBadge />} sub="Group buying rounds you can join" />
      </div>
    </section>
  );
}
