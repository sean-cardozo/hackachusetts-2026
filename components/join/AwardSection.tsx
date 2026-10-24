"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/AppState";
import Button from "@/components/Button";
import SampleBadge from "@/components/SampleBadge";
import { useToast } from "@/components/Toast";
import { OTC_PCT_RANGE, scoreSuppliers } from "@/lib/calc";
import type { Weights } from "@/lib/calc";
import type { QuotesView, RoundView } from "@/lib/data";
import { formatDollars, formatPercent } from "@/lib/format";
import type { Supplier } from "@/lib/types";

type AiBody = { result?: { text?: string; reason?: string }; sourceNote?: string };

async function callAi(task: string, body: unknown, signal: AbortSignal): Promise<AiBody> {
  const res = await fetch(`/api/ai/${task}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AiBody;
}

const money4 = (n: number) => `$${n.toFixed(4)}`;

/** Count-up from `from` to `to` in `ms`; jumps straight to `to` with reduced motion. */
function useCountUp(active: boolean, from: number, to: number, ms = 1400) {
  const [value, setValue] = useState(active ? to : from);
  useEffect(() => {
    if (!active) {
      setValue(from);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to, ms]);
  return value;
}

export default function AwardSection({
  quotes,
  round,
  drugNames,
}: {
  quotes: QuotesView;
  round: RoundView;
  drugNames: { id: string; name: string }[];
}) {
  const { state, setAward, clearAward } = useAppState();
  const { toast } = useToast();
  const [weights, setWeights] = useState<Weights>(quotes.defaultWeights);
  const [chooseOther, setChooseOther] = useState(false);
  const [showSupplierView, setShowSupplierView] = useState(false);
  const [reason, setReason] = useState<{ text: string; note: string } | null>(null);
  const [rfq, setRfq] = useState<{ text: string; note: string } | null | "error">(null);

  const scored = useMemo(
    () => scoreSuppliers(quotes.quotes, quotes.groupDemand, weights),
    [quotes, weights],
  );
  const best = scored[0];
  const awarded = state.award && state.award.roundId === quotes.roundId ? state.award : null;
  const awardedQuote = awarded ? quotes.quotes.find((q) => q.supplier === awarded.supplier) : null;
  const nameOf = (id: string) => drugNames.find((p) => p.id === id)?.name ?? id;

  const [estLow, estHigh] = OTC_PCT_RANGE;
  const quotedPct = awardedQuote?.quotedPct ?? 0;
  const counted = useCountUp(Boolean(awardedQuote), estLow, quotedPct);
  const shownPct = awardedQuote ? counted : null;
  const dollars = (pct: number) => (pct / 100) * round.userSpendUsd;

  const yourCost = (supplier: Supplier) => {
    const q = quotes.quotes.find((x) => x.supplier === supplier);
    if (!q) return 0;
    return Object.entries(quotes.yourShare).reduce((s, [id, u]) => s + (q.prices[id] ?? 0) * u, 0);
  };

  // Reason text, debounced on weight changes. Falls back to a computed sentence.
  const fallbackReason = best
    ? `Supplier ${best.supplier} scores highest (${Math.round(best.score)} of 100) with your weights. It balances price, delivery time and supply reliability better than the other two.`
    : "";
  useEffect(() => {
    if (!best) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      callAi(
        "supplier-reason",
        {
          quotes: quotes.quotes,
          demand: quotes.groupDemand,
          weights,
          userShare: quotes.yourShare,
        },
        ctrl.signal,
      )
        .then((r) => {
          const text = r.result?.reason;
          setReason(text ? { text, note: r.sourceNote ?? "" } : null);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setReason(null);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [quotes, weights, best]);

  // RFQ text, loaded the first time the supplier view is opened.
  const rfqRequested = useRef(false);
  useEffect(() => {
    if (!showSupplierView || rfqRequested.current) return;
    rfqRequested.current = true;
    const ctrl = new AbortController();
    callAi(
      "rfq",
      {
        items: Object.entries(quotes.groupDemand).map(([id, units]) => ({
          product: nameOf(id),
          units,
        })),
        pharmacies: round.pharmacies ?? 1,
        region: "Massachusetts",
        cadence: "weekly",
      },
      ctrl.signal,
    )
      .then((r) => setRfq(r.result?.text ? { text: r.result.text, note: r.sourceNote ?? "" } : "error"))
      .catch(() => setRfq("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSupplierView]);

  const accept = (s: Supplier) => {
    setAward(quotes.roundId, s);
    setChooseOther(false);
    toast(`Awarded to Supplier ${s}.`);
  };

  const sliders: { key: keyof Weights; label: string }[] = [
    { key: "price", label: "Price" },
    { key: "delivery", label: "Delivery" },
    { key: "reliability", label: "Reliability" },
  ];

  return (
    <section className="mt-10" aria-labelledby="award-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="award-title" className="section-title m-0">
          Award: {round.name}
        </h2>
        <SampleBadge />
      </div>

      {/* Headline */}
      <div className="card-strong mt-3 p-5">
        <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
          Savings on this round
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-3" aria-live="polite">
          {shownPct === null ? (
            <span className="font-display text-[44px] leading-none">
              Estimated {estLow}-{estHigh}%
            </span>
          ) : (
            <>
              <span className="font-display text-[44px] leading-none">
                Quoted {formatPercent(shownPct)}
              </span>
              <s className="text-[18px] text-muted">Estimated {estLow}-{estHigh}%</s>
            </>
          )}
        </div>
        <div className="mt-1 text-[13.5px]">
          {awardedQuote
            ? `About ${formatDollars(dollars(awardedQuote.quotedPct))}/yr on your ${formatDollars(round.userSpendUsd)} spend`
            : `About ${formatDollars(dollars(estLow))} to ${formatDollars(dollars(estHigh))}/yr on your ${formatDollars(round.userSpendUsd)} spend`}
        </div>
      </div>

      {/* Success */}
      {awarded ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border-[2px] border-good bg-good-soft p-4"
        >
          <div>
            <b className="text-good">✓ Awarded to Supplier {awarded.supplier}.</b>
            <div className="text-[13px]">
              Quoted {formatPercent(awardedQuote?.quotedPct ?? 0)}. Your share ships on the
              supplier&apos;s delivery schedule.
            </div>
          </div>
          <Button variant="secondary" onClick={clearAward}>
            Undo
          </Button>
        </div>
      ) : null}

      {/* Supplier cards */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {quotes.quotes.map((q) => {
          const sc = scored.find((s) => s.supplier === q.supplier);
          const isBest = best?.supplier === q.supplier;
          const isAwarded = awarded?.supplier === q.supplier;
          return (
            <article
              key={q.supplier}
              aria-label={`Supplier ${q.supplier}`}
              className={`${isBest ? "card-accent" : "card"} flex flex-col gap-2 p-4`}
            >
              <header className="flex items-center justify-between gap-2">
                <h3 className="m-0 font-display text-[24px]">Supplier {q.supplier}</h3>
                <span className="flex items-center gap-1.5">
                  {isBest ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-white">
                      Recommended
                    </span>
                  ) : null}
                  <SampleBadge />
                </span>
              </header>
              <table className="w-full text-[13px]">
                <caption className="sr-only">Unit prices from Supplier {q.supplier}</caption>
                <tbody>
                  {Object.keys(quotes.groupDemand).map((id) => (
                    <tr key={id}>
                      <th scope="row" className="py-0.5 pr-2 text-left font-normal text-muted">
                        {nameOf(id)}
                      </th>
                      <td className="py-0.5 text-right tabular-nums">
                        {q.prices[id] !== undefined ? money4(q.prices[id]) : "n/a"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="m-0 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[13px]">
                <dt className="text-muted">Group total</dt>
                <dd className="m-0 text-right tabular-nums">
                  {formatDollars(sc?.total ?? 0, { compact: false })}
                </dd>
                <dt className="text-muted">Your share</dt>
                <dd className="m-0 text-right tabular-nums">
                  {formatDollars(yourCost(q.supplier), { compact: false })}
                </dd>
                <dt className="text-muted">Delivery</dt>
                <dd className="m-0 text-right">{q.deliveryDays} days</dd>
                <dt className="text-muted">Minimum order</dt>
                <dd className="m-0 text-right tabular-nums">
                  {formatDollars(q.minOrder, { compact: false })}
                </dd>
                <dt className="text-muted">Supply reliability</dt>
                <dd className="m-0 text-right tabular-nums">{q.reliability} / 100</dd>
                <dt className="text-muted">Quoted savings</dt>
                <dd className="m-0 text-right tabular-nums">
                  {formatPercent(q.quotedPct)} (
                  {formatDollars(dollars(q.quotedPct))}/yr)
                </dd>
              </dl>
              {chooseOther && !isAwarded ? (
                <Button small variant="strong" onClick={() => accept(q.supplier)}>
                  Award to Supplier {q.supplier}
                </Button>
              ) : null}
              {isAwarded ? <b className="text-good">✓ Awarded</b> : null}
            </article>
          );
        })}
      </div>

      {/* Recommendation panel */}
      {best ? (
        <div className="card mt-4 grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h3 className="m-0 font-display text-[22px]">
              Recommendation: Supplier {best.supplier}
            </h3>
            <p className="mt-2 text-[14px]">{reason?.text ?? fallbackReason}</p>
            {reason?.note ? <p className="m-0 text-[12px] text-muted">{reason.note}</p> : null}

            <div className="mt-4 flex flex-col gap-3">
              {scored.map((s) => (
                <div key={s.supplier}>
                  <div className="flex justify-between text-[13px] font-bold">
                    <span>Supplier {s.supplier}</span>
                    <span className="tabular-nums">{Math.round(s.score)} / 100</span>
                  </div>
                  {(
                    [
                      ["Price", s.price],
                      ["Delivery", s.delivery],
                      ["Reliability", s.reliability],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[72px] text-muted">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${s.supplier === best.supplier ? "bg-accent" : "bg-line-strong"}`}
                          style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{Math.round(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.06em] text-muted">
              What matters to you
            </h3>
            <div className="mt-2 flex flex-col gap-3">
              {sliders.map(({ key, label }) => (
                <label key={key} className="block text-[13px] font-bold">
                  <span className="flex justify-between">
                    <span>{label}</span>
                    <span className="tabular-nums">{weights[key]}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                    className="w-full accent-[#0f9f7a]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!awarded ? (
                <Button onClick={() => accept(best.supplier)}>Accept recommendation</Button>
              ) : null}
              <Button variant="secondary" onClick={() => setChooseOther((v) => !v)}>
                Choose a different supplier
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* What suppliers see */}
      <div className="mt-4">
        <Button
          variant="secondary"
          aria-expanded={showSupplierView}
          onClick={() => setShowSupplierView((v) => !v)}
        >
          {showSupplierView ? "Hide what suppliers see" : "What suppliers see"}
        </Button>
        {showSupplierView ? (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="m-0 font-display text-[20px]">Your view</h3>
              <ul className="mt-2 list-none p-0 text-[13.5px]">
                {Object.keys(quotes.groupDemand).map((id) => (
                  <li key={id} className="flex justify-between py-0.5">
                    <span>{nameOf(id)}</span>
                    <span className="tabular-nums">
                      your share {(quotes.yourShare[id] ?? 0).toLocaleString("en-US")} of{" "}
                      {quotes.groupDemand[id].toLocaleString("en-US")} units
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-2 text-[12.5px] text-muted">
                Includes your pharmacy name, what you pay and your stock levels.
              </p>
            </div>
            <div className="card-accent p-4">
              <h3 className="m-0 font-display text-[20px]">Supplier view</h3>
              <ul className="mt-2 list-none p-0 text-[13.5px]">
                {Object.keys(quotes.groupDemand).map((id) => (
                  <li key={id} className="flex justify-between py-0.5">
                    <span>{nameOf(id)}</span>
                    <span className="tabular-nums">
                      {quotes.groupDemand[id].toLocaleString("en-US")} units
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[13px]">
                {round.pharmacies ?? "Several"} pharmacies · Massachusetts · weekly delivery
              </div>
              <div className="mt-2 text-[13px]">
                {rfq === null ? (
                  <span className="text-muted">Writing the request…</span>
                ) : rfq === "error" ? (
                  <span className="text-muted">The request text could not be loaded.</span>
                ) : (
                  <>
                    <pre className="m-0 whitespace-pre-wrap font-body text-[13px]">{rfq.text}</pre>
                    {rfq.note ? <p className="m-0 mt-1 text-[12px] text-muted">{rfq.note}</p> : null}
                  </>
                )}
              </div>
              <p className="m-0 mt-2 text-[12.5px] text-muted">
                No pharmacy names, prices or stock levels.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
