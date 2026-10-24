"use client";
import { useEffect, useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppState } from "@/components/AppState";
import Button from "@/components/Button";
import LiveBadge from "@/components/LiveBadge";
import SampleBadge from "@/components/SampleBadge";
import SourceTip from "@/components/SourceTip";
import { useToast } from "@/components/Toast";
import { formatDollars, formatPercent } from "@/lib/format";
import type { DrugView, RoundView } from "@/lib/data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Fixed illustrative shape, oldest month first. The last entry is 1 so the last month equals the real price. */
const YOUR_SHAPE = [0.9, 0.93, 0.92, 0.96, 0.95, 0.98, 0.97, 1.01, 1.0, 1.03, 1.02, 1];
const NADAC_SHAPE = [1.08, 1.06, 1.07, 1.04, 1.05, 1.03, 1.02, 1.03, 1.01, 1.02, 1.01, 1];
/** Fixed +/-6% usage pattern, oldest month first. */
const USAGE_SHAPE = [-0.04, 0.03, 0.05, -0.02, 0.06, -0.05, 0.01, 0.04, -0.06, 0.02, -0.03, 0.0];

const SAMPLE_SRC = "Sample data (illustrative, not a live feed)";
const unitPrice = (v: number) => `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function monthLabels(anchor: string | undefined): string[] {
  const t = anchor ? Date.parse(anchor) : NaN;
  const d = Number.isFinite(t) ? new Date(t) : new Date(Date.UTC(2026, 9, 24));
  const end = d.getUTCMonth();
  return Array.from({ length: 12 }, (_, i) => MONTHS[(((end - 11 + i) % 12) + 12) % 12] as string);
}

export default function DrugDrawer({
  drug,
  rounds,
  opener,
  onClose,
}: {
  drug: DrugView;
  rounds: RoundView[];
  opener: HTMLElement | null;
  onClose: () => void;
}) {
  const { state, approveSwap } = useAppState();
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const live = drug.nadacSource === "live";
  const onCloseRef = useRef(onClose);
  const openerRef = useRef(opener);
  useEffect(() => {
    onCloseRef.current = onClose;
    openerRef.current = opener;
  });

  useEffect(() => {
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, []);

  const labels = useMemo(() => monthLabels(rounds[0]?.anchors.demoNow), [rounds]);
  const priceData = useMemo(
    () =>
      labels.map((m, i) => ({
        m,
        yours: Number((drug.paid * (YOUR_SHAPE[i] ?? 1)).toFixed(4)),
        ...(drug.nadac !== null ? { nadac: Number((drug.nadac * (NADAC_SHAPE[i] ?? 1)).toFixed(4)) } : {}),
      })),
    [labels, drug.paid, drug.nadac],
  );
  const usageData = useMemo(
    () => labels.map((m, i) => ({ m, units: Math.round(drug.unitsPerMonth * (1 + (USAGE_SHAPE[i] ?? 0))) })),
    [labels, drug.unitsPerMonth],
  );
  const dos = drug.daysOfSupply;
  const roundOf = (id?: string) => (id ? rounds.find((r) => r.id === id) : undefined);

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drug-drawer-title"
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-[600px] flex-col gap-5 overflow-y-auto border-l-[2.5px] border-ink bg-surface p-6 shadow-pp outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="drug-drawer-title" className="section-title">{drug.name}</h2>
            <p className="m-0 mt-1 text-muted">
              {drug.strength} · {drug.form} · {drug.category}
            </p>
          </div>
          <Button variant="secondary" small onClick={onClose} aria-label={`Close ${drug.name} details`}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3">
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">You pay <SampleBadge /></div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums">
              <SourceTip source="Your uploaded purchase price (sample data)">{unitPrice(drug.paid)}</SourceTip>
              <span className="text-[12px] font-semibold text-muted"> / unit</span>
            </div>
          </div>
          <div className="card p-3">
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
              NADAC benchmark {live ? <LiveBadge /> : <SampleBadge />}
            </div>
            <div className="mt-1 text-[20px] font-extrabold tabular-nums">
              {drug.nadac === null ? "—" : (
                <SourceTip
                  source={live ? "CMS NADAC (weekly average acquisition cost)" : "Sample reference price, used because live NADAC is not usable for this drug"}
                  {...(drug.nadacEffectiveDate ? { date: drug.nadacEffectiveDate } : {})}
                >
                  {unitPrice(drug.nadac)}
                </SourceTip>
              )}
              <span className="text-[12px] font-semibold text-muted"> / unit</span>
            </div>
            {drug.nadacNote ? <p className="m-0 mt-1 text-[12px] text-muted">{drug.nadacNote}</p> : null}
          </div>
        </div>
        {drug.gapPct !== null ? (
          <p className="m-0 text-[13px] text-muted">
            <span aria-hidden>{drug.gapPct > 0 ? "▲ " : "▼ "}</span>
            {drug.gapPct > 0 ? "You pay" : "You pay less than benchmark:"} {formatPercent(Math.abs(drug.gapPct))}
            {drug.gapPct > 0 ? " above benchmark" : ""}
            {drug.savings && drug.annualSpend
              ? `. Estimated savings ${formatDollars(drug.savings.low)}–${formatDollars(drug.savings.high)}/yr (${formatPercent((drug.savings.low / drug.annualSpend) * 100)}–${formatPercent((drug.savings.high / drug.annualSpend) * 100)}).`
              : "."}
          </p>
        ) : null}

        <section aria-labelledby="dd-price">
          <h3 id="dd-price" className="m-0 text-[15px] font-extrabold">
            12-month price: your price <SampleBadge /> vs NADAC {live ? <LiveBadge /> : <SampleBadge />}
          </h3>
          <p className="m-0 mb-2 text-[12px] text-muted">Illustrative monthly history (sample). The last month is the current price.</p>
          <div className="h-[200px] w-full" role="img" aria-label={`Line chart of illustrative monthly price for ${drug.name}: your price versus NADAC`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eee5d7" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v: number) => unitPrice(v)} domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => unitPrice(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="yours" name="Your price" stroke="#121212" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {drug.nadac !== null ? (
                  <Line type="monotone" dataKey="nadac" name="NADAC" stroke="#ff7a00" strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section aria-labelledby="dd-usage">
          <h3 id="dd-usage" className="m-0 text-[15px] font-extrabold">Monthly usage <SampleBadge /></h3>
          <p className="m-0 mb-2 text-[12px] text-muted">Illustrative monthly usage (sample), within about ±6% of {drug.unitsPerMonth.toLocaleString("en-US")} units a month.</p>
          <div className="h-[150px] w-full" role="img" aria-label={`Bar chart of illustrative monthly usage for ${drug.name}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eee5d7" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <Tooltip />
                <Bar dataKey="units" name="Units" fill="#121212" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-label="Supply and shortage">
          <div className="card p-3">
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Units on hand <SampleBadge /></div>
            <div className="mt-1 text-[18px] font-extrabold tabular-nums">
              {drug.onHand !== undefined ? drug.onHand.toLocaleString("en-US") : "—"}
            </div>
            <div className={`text-[13px] tabular-nums ${dos !== null && dos < 14 ? "font-extrabold text-bad" : "text-muted"}`}>
              {dos === null ? "Days of supply unknown" : (
                <>
                  {dos < 14 ? <span aria-hidden>⚠ </span> : null}
                  {Math.round(dos)} days of supply{dos < 14 ? " (under 14)" : ""}
                </>
              )}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
              FDA shortage {drug.shortage.source === "live" ? <LiveBadge /> : <SampleBadge />}
            </div>
            <div className={`mt-1 text-[18px] font-extrabold ${drug.shortage.current ? "text-bad" : ""}`}>
              {drug.shortage.current ? <><span aria-hidden>⚠ </span>On the shortage list</> : "Not on the shortage list"}
            </div>
            <div className="text-[13px] text-muted">
              Risk: {drug.shortageRisk}
              {drug.shortage.updated ? ` · updated ${drug.shortage.updated}` : ""}
              {drug.shortage.last3yCount !== undefined ? ` · ${drug.shortage.last3yCount} in 3 years` : ""}
            </div>
          </div>
        </section>

        <section aria-labelledby="dd-eq">
          <h3 id="dd-eq" className="m-0 text-[15px] font-extrabold">Equivalent products</h3>
          {drug.equivalents.length === 0 ? (
            <p className="m-0 mt-2 text-muted">No therapeutically equivalent products found for this drug.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-[1.5px] border-line text-left text-[11.5px] uppercase tracking-[0.05em] text-muted">
                    <th className="py-2 pr-2 font-bold">Manufacturer</th>
                    <th className="py-2 pr-2 font-bold">TE code</th>
                    <th className="py-2 pr-2 text-right font-bold">Benchmark</th>
                    <th className="py-2 pr-2 font-bold">In round</th>
                    <th className="py-2 pr-2 text-right font-bold">Extra savings</th>
                    <th className="py-2 text-right font-bold"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {drug.equivalents.map((e) => {
                    const r = roundOf(e.inRoundId);
                    const approved = state.swaps[drug.id]?.approved === true && state.swaps[drug.id]?.toMfr === e.mfr;
                    const extra = e.extraSavingsYr;
                    return (
                      <tr key={`${e.mfr}-${e.applNo}`} className="border-b border-line align-top">
                        <td className="py-2 pr-2 font-bold">{e.mfr}</td>
                        <td className="py-2 pr-2 font-mono text-[12px]">{e.teCode}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {drug.nadac === null ? "—" : (
                            <SourceTip
                              source={live ? "CMS NADAC (weekly average acquisition cost), same for the equivalent group" : "Sample reference price"}
                              {...(drug.nadacEffectiveDate ? { date: drug.nadacEffectiveDate } : {})}
                            >
                              {unitPrice(drug.nadac)}
                            </SourceTip>
                          )}
                        </td>
                        <td className="py-2 pr-2">{r ? `${r.name} (${r.displayStatus})` : "Not in a round"}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {extra !== undefined && extra > 0 && drug.annualSpend ? (
                            <span className="font-bold text-good">
                              <span aria-hidden>▼ </span>
                              {formatDollars(extra)}/yr
                              <br />
                              <span className="text-[12px] font-semibold">{formatPercent((extra / drug.annualSpend) * 100)}</span>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {extra !== undefined && extra > 0 ? (
                            approved ? (
                              <span className="font-bold text-good">Approved</span>
                            ) : (
                              <Button
                                small
                                aria-label={`Swap ${drug.name} to ${e.mfr}`}
                                onClick={() => {
                                  approveSwap(drug.id, e.mfr, extra);
                                  toast(`Swap approved: ${drug.name} to ${e.mfr}`);
                                }}
                              >
                                Swap
                              </Button>
                            )
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="m-0 mt-2 text-[12.5px] text-muted">You approve every swap before it&apos;s used.</p>
        </section>
        <p className="sr-only">{SAMPLE_SRC}</p>
      </div>
    </div>
  );
}
