"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppState } from "@/components/AppState";
import { buttonClass } from "@/components/Button";
import GapPill from "@/components/GapPill";
import LiveBadge from "@/components/LiveBadge";
import RiskPill from "@/components/RiskPill";
import SampleBadge from "@/components/SampleBadge";
import SourceTip from "@/components/SourceTip";
import StatCard from "@/components/StatCard";
import { EmptyState } from "@/components/StateViews";
import { useToast } from "@/components/Toast";
import { formatDollars, formatPercent } from "@/lib/format";
import type { DrugView, RoundView, SwapOption } from "@/lib/data";
import DrugDrawer from "./DrugDrawer";

export const SAMPLE_REF_SOURCE = "Sample reference price (design table), used because live NADAC is not usable for this drug";

export function benchmarkTip(d: DrugView): { source: string; date?: string } {
  return d.nadacSource === "live"
    ? { source: "CMS NADAC (weekly average acquisition cost)", ...(d.nadacEffectiveDate ? { date: d.nadacEffectiveDate } : {}) }
    : { source: SAMPLE_REF_SOURCE };
}

type Action =
  | { kind: "swap"; label: string; href: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "reorder"; label: string };

const CATEGORY_ORDER = ["Cardio", "Diabetes", "Mental health", "Antibiotics", "Respiratory", "GI", "Thyroid", "Pain"];

function roundOf(drug: DrugView, rounds: RoundView[]): RoundView | undefined {
  return rounds.find((r) => r.drugs.includes(drug.id));
}

export function nextAction(drug: DrugView, rounds: RoundView[], swapApproved: boolean): Action {
  const hasSwap = drug.equivalents.some((e) => e.extraSavingsYr !== undefined && e.extraSavingsYr > 0);
  if (hasSwap && !swapApproved) return { kind: "swap", label: "Swap", href: "/swap" };
  const round = roundOf(drug, rounds);
  if (round?.status === "open") {
    return round.progress !== null && round.progress >= 100
      ? { kind: "link", label: "Confirm round", href: "/join" }
      : { kind: "link", label: "Join round", href: "/join" };
  }
  if (round?.status === "target") return { kind: "link", label: "Confirm round", href: "/join" };
  if (round?.status === "quotes") return { kind: "link", label: "Award", href: "/join" };
  return { kind: "reorder", label: "Reorder" };
}

interface Cat {
  name: string;
  drugs: DrugView[];
  spend: number;
  bench: number;
  low: number;
  high: number;
  dos: number | null;
  risk: "High" | "Watch" | "Low";
  allLive: boolean;
}

function buildCategories(drugs: DrugView[]): Cat[] {
  const names = Array.from(new Set(drugs.map((d) => d.category)));
  names.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return names.map((name) => {
    const ds = drugs.filter((d) => d.category === name);
    const dosList = ds.map((d) => d.daysOfSupply).filter((x): x is number => x !== null);
    const risks = ds.map((d) => d.shortageRisk);
    return {
      name,
      drugs: ds,
      spend: ds.reduce((s, d) => s + (d.annualSpend ?? 0), 0),
      bench: ds.reduce((s, d) => s + (d.benchmarkSpend ?? 0), 0),
      low: ds.reduce((s, d) => s + (d.savings?.low ?? 0), 0),
      high: ds.reduce((s, d) => s + (d.savings?.high ?? 0), 0),
      dos: dosList.length ? Math.min(...dosList) : null,
      risk: risks.includes("High") ? "High" : risks.includes("Watch") ? "Watch" : "Low",
      allLive: ds.every((d) => d.nadacSource === "live"),
    };
  });
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const GRID =
  "grid min-w-[1040px] grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_0.8fr_0.8fr_1fr] items-center gap-x-3";
const NUM = "text-right tabular-nums";

function SavingsCell({ low, high, spend }: { low: number; high: number; spend: number }) {
  if (spend <= 0) return <span>—</span>;
  return (
    <span>
      {formatDollars(low)}–{formatDollars(high)}/yr
      <br />
      <span className="text-[12px] text-muted">
        {formatPercent(pct(low, spend))}–{formatPercent(pct(high, spend))}
      </span>
    </span>
  );
}

function DosCell({ dos }: { dos: number | null }) {
  if (dos === null) return <span>—</span>;
  const short = dos < 14;
  return (
    <span className={short ? "font-extrabold text-bad" : ""}>
      {short ? <span aria-hidden>⚠ </span> : null}
      {Math.round(dos)} days
    </span>
  );
}

export default function CompareClient({
  drugs,
  rounds,
  swapOptions,
}: {
  drugs: DrugView[];
  rounds: RoundView[];
  swapOptions: SwapOption[];
}) {
  const { state } = useAppState();
  const { toast } = useToast();
  const [open, setOpen] = useState<Record<string, boolean>>({ Cardio: true });
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  const cats = useMemo(() => buildCategories(drugs), [drugs]);
  const swapApproved = (id: string) => state.swaps[id]?.approved === true;

  if (drugs.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[1280px]">
        <h1 className="page-title">Compare</h1>
        <div className="mt-6">
          <EmptyState title="No drugs to compare" description="Upload your purchases to see how your prices compare." />
        </div>
      </section>
    );
  }

  const totalSpend = drugs.reduce((s, d) => s + (d.annualSpend ?? 0), 0);
  const above = drugs.filter((d) => d.gapPct !== null && d.gapPct > 0).length;
  const under14 = drugs.filter((d) => d.daysOfSupply !== null && d.daysOfSupply < 14).length;
  const shortages = drugs.filter((d) => d.shortage.current).length;
  const urgent = drugs.filter((d) => d.shortage.current && d.daysOfSupply !== null && d.daysOfSupply < 14);
  const drawerDrug = drugs.find((d) => d.id === drawerId) ?? null;

  const openDrawer = (id: string, el: HTMLElement) => {
    setOpener(el);
    setDrawerId(id);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <div>
        <h1 className="page-title">Compare</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Each drug priced against NADAC, the weekly CMS average of what pharmacies pay wholesalers. Open a
          category to see its drugs, then pick a Next step.
        </p>
      </div>

      {urgent.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border-[1.5px] border-bad bg-bad-soft px-5 py-3"
        >
          <p className="m-0 font-bold text-bad">
            <span aria-hidden>⚠ </span>
            Shortage alert: {urgent.map((d) => `${d.name} (${Math.round(d.daysOfSupply ?? 0)} days of supply)`).join(", ")}{" "}
            is on the FDA shortage list with under 14 days left.
          </p>
          <Link href="/join" className={buttonClass("strong", true)}>
            Join the round
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Annual spend" value={formatDollars(totalSpend)} sub="Generics in your inventory" badge={<SampleBadge />} />
        <StatCard
          label="Drugs above NADAC"
          value={`${above} of ${drugs.length}`}
          sub={<span><span aria-hidden>▲ </span>paying more than benchmark</span>}
          badge={<LiveBadge />}
        />
        <StatCard
          label="Under 14 days of supply"
          value={under14}
          sub={under14 > 0 ? <span className="font-bold text-bad"><span aria-hidden>⚠ </span>reorder soon</span> : "None right now"}
          badge={<SampleBadge />}
        />
        <StatCard
          label="Shortage alerts"
          value={shortages}
          sub="Drugs on the FDA shortage list"
          badge={drugs.some((d) => d.shortage.current && d.shortage.source === "live") ? <LiveBadge /> : <SampleBadge />}
        />
      </div>

      <div className="card overflow-x-auto">
        <div role="table" aria-label="Spend by category" className="min-w-[1040px]">
          <div role="row" className={`${GRID} border-b-[1.5px] border-line px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-muted`}>
            <span role="columnheader">Category</span>
            <span role="columnheader" className={NUM}>Your spend <SampleBadge /></span>
            <span role="columnheader" className={NUM}>Benchmark <LiveBadge /></span>
            <span role="columnheader" className="text-right">Gap</span>
            <span role="columnheader" className="text-right">Est. savings</span>
            <span role="columnheader" className="text-right">Days of supply</span>
            <span role="columnheader" className="text-center">Shortage risk</span>
            <span role="columnheader" className="text-right">Next step</span>
          </div>
          {cats.map((c) => {
            const isOpen = !!open[c.name];
            return (
              <div key={c.name} role="rowgroup" className="border-b border-line last:border-b-0">
                <div role="row" className="contents">
                <div role="cell" className="contents">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [c.name]: !o[c.name] }))}
                  className={`${GRID} w-full bg-transparent px-4 py-3 text-left text-[14px] hover:bg-surface-2`}
                >
                  <span className="flex items-center gap-2 font-extrabold">
                    <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                    {c.name}
                    <span className="text-[12px] font-semibold text-muted">({c.drugs.length})</span>
                  </span>
                  <span className={NUM}>{formatDollars(c.spend)}</span>
                  <span className={NUM}>
                    <SourceTip
                      source={c.allLive ? "CMS NADAC (weekly average acquisition cost)" : "NADAC where live, sample reference price otherwise"}
                      {...(c.drugs[0]?.nadacEffectiveDate ? { date: c.drugs[0].nadacEffectiveDate } : {})}
                    >
                      {formatDollars(c.bench)}
                    </SourceTip>{" "}
                    {c.allLive ? <LiveBadge /> : <SampleBadge />}
                  </span>
                  <span className="text-right"><GapPill gapPct={c.bench > 0 ? pct(c.spend - c.bench, c.bench) : null} /></span>
                  <span className={NUM}><SavingsCell low={c.low} high={c.high} spend={c.spend} /></span>
                  <span className={NUM}><DosCell dos={c.dos} /></span>
                  <span className="text-center"><RiskPill risk={c.risk} /></span>
                  <span />
                </button>
                </div>
                </div>
                {isOpen
                  ? c.drugs.map((d) => {
                      const a = nextAction(d, rounds, swapApproved(d.id));
                      return (
                        <div key={d.id} role="row" className={`${GRID} bg-surface-2 px-4 py-2.5 text-[13.5px]`}>
                          <span role="cell" className="pl-6">
                            <button
                              type="button"
                              onClick={(e) => openDrawer(d.id, e.currentTarget)}
                              className="cursor-pointer border-0 bg-transparent p-0 text-left font-bold text-accent-ink underline"
                            >
                              {d.name}
                            </button>
                            <span className="block text-[12px] text-muted">{d.mfr}</span>
                          </span>
                          <span role="cell" className={NUM}>{formatDollars(d.annualSpend ?? 0)}</span>
                          <span role="cell" className={NUM}>
                            {d.benchmarkSpend === null ? "—" : (
                              <SourceTip {...benchmarkTip(d)}>{formatDollars(d.benchmarkSpend)}</SourceTip>
                            )}{" "}
                            {d.nadacSource === "live" ? <LiveBadge /> : <SampleBadge />}
                          </span>
                          <span role="cell" className="text-right"><GapPill gapPct={d.gapPct} /></span>
                          <span role="cell" className={NUM}>
                            {d.savings && d.annualSpend ? (
                              <SavingsCell low={d.savings.low} high={d.savings.high} spend={d.annualSpend} />
                            ) : "—"}
                          </span>
                          <span role="cell" className={NUM}><DosCell dos={d.daysOfSupply} /></span>
                          <span role="cell" className="text-center"><RiskPill risk={d.shortageRisk} /></span>
                          <span role="cell" className="text-right">
                            {a.kind === "reorder" ? (
                              <button type="button" className={buttonClass("secondary", true)} onClick={() => toast("Reorder noted (demo)")}>
                                {a.label}
                              </button>
                            ) : (
                              <Link
                                href={a.href}
                                className={buttonClass(a.kind === "swap" ? "primary" : "secondary", true)}
                                aria-label={`${a.label}: ${d.name}`}
                              >
                                {a.label}
                              </Link>
                            )}
                          </span>
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      </div>

      {swapOptions.length > 0 ? (
        <p className="m-0 text-[13px] text-muted">
          {swapOptions.length} equivalent swaps are available. You approve every swap before it&apos;s used.
        </p>
      ) : null}

      {drawerDrug ? (
        <DrugDrawer
          drug={drawerDrug}
          rounds={rounds}
          opener={opener}
          onClose={() => setDrawerId(null)}
        />
      ) : null}
    </section>
  );
}
